import type { AppLogger } from '@claude-code-changelog-viewer/common';
import type {
  SettingsTranslation,
  SettingsTranslationTarget,
} from '../../usecase/settings-translation';
import type { SettingsTranslatorPort } from '../../usecase/settings-entry-translator';
import { GeminiClient } from './gemini-client';
import {
  buildSettingsTranslatePrompt,
  type SettingEntryForPrompt,
} from './prompts/settings-translate-prompt';

export class GeminiSettingsTranslator implements SettingsTranslatorPort {
  private client: GeminiClient;

  constructor(apiKey: string, logger: AppLogger) {
    this.client = new GeminiClient(apiKey, logger);
  }

  async translate(
    targets: SettingsTranslationTarget[],
  ): Promise<SettingsTranslation[]> {
    const result = await this.client.translateSettings(
      buildSettingsTranslatePrompt(targets.map(toPromptEntry)),
    );

    return result.results.map((item) => ({
      id: item.id,
      descriptionJa: item.description_ja,
      useCaseJa: item.use_case_ja,
    }));
  }
}

function toPromptEntry(
  target: SettingsTranslationTarget,
): SettingEntryForPrompt {
  return {
    id: target.id,
    key: target.entry.key,
    source: target.entry.source,
    description_en: target.entry.descriptionEn,
    parent_descriptions: [...target.entry.parentDescriptions],
    doc_snippets: [...target.docSnippets],
    related_changelog: target.relatedChangelog.map((changelog) => ({
      ...(changelog.contentJa !== undefined
        ? { content_ja: changelog.contentJa }
        : {}),
      ...(changelog.inference !== undefined
        ? { inference: changelog.inference }
        : {}),
    })),
  };
}
