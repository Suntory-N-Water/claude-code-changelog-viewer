import type { AppLogger } from '@claude-code-changelog-viewer/common';
import type { SettingsEntry } from '../domain/settings-reference/setting-entry';
import type {
  SchemaInfo,
  SettingsReferenceContext,
  SettingsTranslation,
  SettingsTranslationMap,
  SettingsTranslationTarget,
} from './settings-translation';

export type SettingsTranslatorPort = {
  translate: (
    targets: SettingsTranslationTarget[],
  ) => Promise<SettingsTranslation[]>;
};

type TranslateContext = {
  relatedContext: SettingsReferenceContext;
  settingsTranslator: SettingsTranslatorPort;
  schemaInfoMap?: Map<string, SchemaInfo>;
  log: AppLogger;
};

/**
 * 設定エントリを 30 件ずつのバッチに分割して翻訳する。
 */
export async function translateInBatches(
  entries: SettingsEntry[],
  ctx: TranslateContext,
): Promise<SettingsTranslationMap> {
  const { relatedContext, settingsTranslator, schemaInfoMap, log } = ctx;
  const BATCH_SIZE = 30;
  const resultMap: SettingsTranslationMap = new Map();

  for (
    let batchStart = 0;
    batchStart < entries.length;
    batchStart += BATCH_SIZE
  ) {
    const batch = entries.slice(batchStart, batchStart + BATCH_SIZE);
    log.info(
      `バッチ処理: ${batchStart + 1}〜${Math.min(batchStart + BATCH_SIZE, entries.length)} / ${entries.length}`,
    );

    const results = await settingsTranslator.translate(
      batch.map((entry, i) => ({
        id: batchStart + i,
        entry,
        docSnippets: relatedContext.docSnippetsMap.get(entry.key) ?? [],
        relatedChangelog: relatedContext.changelogsMap.get(entry.key) ?? [],
        ...schemaInfoMap?.get(entry.key),
      })),
    );

    for (const item of results) {
      resultMap.set(item.id, item);
    }
  }

  return resultMap;
}

/**
 * AI なしモード: descriptionEn をそのまま descriptionJa として使用する。
 */
export function buildNoAiTranslationMap(
  entries: SettingsEntry[],
): SettingsTranslationMap {
  const resultMap: SettingsTranslationMap = new Map();
  for (const [i, entry] of entries.entries()) {
    resultMap.set(i, {
      id: i,
      descriptionJa: entry.descriptionEn,
      useCaseJa: '',
    });
  }
  return resultMap;
}
