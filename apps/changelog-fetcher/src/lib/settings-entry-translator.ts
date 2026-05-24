import type { AppLogger } from '@claude-code-changelog-viewer/common';
import type { GeminiClient } from '../ai/gemini-client';
import type { SettingEntryForPrompt } from '../ai/prompts/settings-translate-prompt';
import { buildSettingsTranslatePrompt } from '../ai/prompts/settings-translate-prompt';
import type {
  RawEntry,
  RelatedChangelog,
  TranslationMap,
} from './settings-entry-types';

type TranslateContext = {
  docSnippetsMap: Map<string, string[]>;
  changelogsMap: Map<string, RelatedChangelog[]>;
  geminiClient: GeminiClient;
  log: AppLogger;
};

/**
 * 設定エントリを 30 件ずつのバッチに分割して Gemini API に送信
 */
export async function translateInBatches(
  entries: RawEntry[],
  ctx: TranslateContext,
): Promise<TranslationMap> {
  const { docSnippetsMap, changelogsMap, geminiClient, log } = ctx;
  const BATCH_SIZE = 30;
  const resultMap: TranslationMap = new Map();

  for (
    let batchStart = 0;
    batchStart < entries.length;
    batchStart += BATCH_SIZE
  ) {
    const batch = entries.slice(batchStart, batchStart + BATCH_SIZE);
    log.info(
      `バッチ処理: ${batchStart + 1}〜${Math.min(batchStart + BATCH_SIZE, entries.length)} / ${entries.length}`,
    );

    const promptEntries: SettingEntryForPrompt[] = batch.map((entry, i) => ({
      id: batchStart + i,
      key: entry.key,
      source: entry.source,
      description_en: entry.description_en,
      parent_descriptions: entry.parent_descriptions,
      doc_snippets: docSnippetsMap.get(entry.key) ?? [],
      related_changelog: (changelogsMap.get(entry.key) ?? []).map((c) => ({
        ...(c.content_ja !== undefined ? { content_ja: c.content_ja } : {}),
        ...(c.inference !== undefined ? { inference: c.inference } : {}),
      })),
    }));

    const prompt = buildSettingsTranslatePrompt(promptEntries);
    const result = await geminiClient.translateSettings(prompt);

    for (const item of result.results) {
      resultMap.set(item.id, {
        description_ja: item.description_ja,
        use_case_ja: item.use_case_ja,
      });
    }
  }

  return resultMap;
}

/**
 * AI なしモード: description_en をそのまま description_ja として使用
 */
export function buildNoAiTranslationMap(entries: RawEntry[]): TranslationMap {
  const resultMap: TranslationMap = new Map();
  for (const [i, entry] of entries.entries()) {
    resultMap.set(i, {
      description_ja: entry.description_en,
      use_case_ja: '',
    });
  }
  return resultMap;
}
