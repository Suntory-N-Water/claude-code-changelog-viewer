import type { AppLogger } from '@claude-code-changelog-viewer/common';
import type { SettingsEntry } from '../domain/settings-reference/setting-entry';
import type { SettingKey } from '../domain/settings-reference/setting-key';
import { createSettingSlugFromKey } from '../domain/settings-reference/setting-slug';
import {
  buildNoAiTranslationMap,
  translateInBatches,
  type SettingsTranslatorPort,
} from './settings-entry-translator';
import type {
  SettingReferenceOutput,
  SettingsReferenceContext,
  SettingsTranslationMap,
} from './settings-translation';

export type RawSettingsEntries = {
  schemaSettings: SettingsEntry[];
  mdEnvEntries: SettingsEntry[];
  schemaEnvEntries: SettingsEntry[];
  docsEnvEntries: SettingsEntry[];
};

export type LoadedSettingsReferenceContext = {
  allInferredCount: number;
  relatedContext: SettingsReferenceContext;
};

export type SettingsReferencePaths = {
  schemaPath: string;
  envVarsMdPath: string;
  docsEnDir: string;
  inferredDir: string;
  outputDir: string;
};

export type SettingsEntrySourcePort = {
  load: (input: {
    schemaPath: string;
    envVarsMdPath: string;
    docsEnDir: string;
  }) => Promise<RawSettingsEntries>;
  findUnmergedPublicEnvMentions: (
    mergedKeys: Set<SettingKey>,
    docsEnDir: string,
  ) => string[];
};

function dedupeSettingsEntries(entries: SettingsEntry[]): SettingsEntry[] {
  const map = new Map<SettingKey, SettingsEntry>();
  for (const entry of entries) {
    if (!map.has(entry.key)) {
      map.set(entry.key, entry);
    }
  }
  return [...map.values()];
}

function mergeEnvEntries(input: {
  markdownEntries: SettingsEntry[];
  schemaEntries: SettingsEntry[];
  docsEntries: SettingsEntry[];
}): SettingsEntry[] {
  const markdownKeys = new Set(input.markdownEntries.map((entry) => entry.key));
  const schemaOnly = input.schemaEntries.filter(
    (entry) => !markdownKeys.has(entry.key),
  );
  const existingKeys = new Set(
    [...input.markdownEntries, ...schemaOnly].map((entry) => entry.key),
  );
  const docsOnly = input.docsEntries.filter(
    (entry) => !existingKeys.has(entry.key),
  );
  return dedupeSettingsEntries([
    ...input.markdownEntries,
    ...schemaOnly,
    ...docsOnly,
  ]);
}

export type SettingsReferenceContextPort = {
  load: (input: {
    inferredDir: string;
    entries: SettingsEntry[];
  }) => Promise<LoadedSettingsReferenceContext>;
};

export type SettingsReferenceStorePort = {
  loadExistingKeys: (outputDir: string) => Set<string>;
  writeReferences: (input: {
    outputDir: string;
    references: SettingReferenceOutput[];
  }) => Promise<number>;
};

export async function generateSettingsReference(input: {
  noAiMode: boolean;
  paths: SettingsReferencePaths;
  settingsEntrySource: SettingsEntrySourcePort;
  relatedContextSource: SettingsReferenceContextPort;
  settingsReferenceStore: SettingsReferenceStorePort;
  settingsTranslator?: SettingsTranslatorPort;
  log: AppLogger;
}): Promise<number> {
  const { log, paths } = input;

  log.info('settings.json スキーマ・env-vars.md・docs/en を解析中...');
  const rawEntries = await input.settingsEntrySource.load({
    schemaPath: paths.schemaPath,
    envVarsMdPath: paths.envVarsMdPath,
    docsEnDir: paths.docsEnDir,
  });

  const mergedEnvEntries = mergeEnvEntries({
    markdownEntries: rawEntries.mdEnvEntries,
    schemaEntries: rawEntries.schemaEnvEntries,
    docsEntries: rawEntries.docsEnvEntries,
  });

  const allEntries = [...rawEntries.schemaSettings, ...mergedEnvEntries];
  log.info(
    `設定: ${rawEntries.schemaSettings.length}件, 環境変数: ${mergedEnvEntries.length}件 (env-vars.md=${rawEntries.mdEnvEntries.length}, schema=${rawEntries.schemaEnvEntries.length}, docs=${rawEntries.docsEnvEntries.length}), 合計: ${allEntries.length}件`,
  );

  const unmergedMentions =
    input.settingsEntrySource.findUnmergedPublicEnvMentions(
      new Set(mergedEnvEntries.map((e) => e.key)),
      paths.docsEnDir,
    );
  if (unmergedMentions.length > 0) {
    log.warn(
      `docs/en に出現する未取り込みの組み込み環境変数: ${unmergedMentions.join(', ')}`,
    );
  }

  const existingKeys = input.settingsReferenceStore.loadExistingKeys(
    paths.outputDir,
  );
  const newEntries = allEntries.filter((entry) => !existingKeys.has(entry.key));
  log.info(
    `生成済みスキップ: ${existingKeys.size}件, 新規生成対象: ${newEntries.length}件`,
  );

  if (newEntries.length === 0) {
    log.info('新規生成対象なし。処理を終了します');
    return 0;
  }

  log.info('更新履歴と関連情報を収集中...');
  const { allInferredCount, relatedContext } =
    await input.relatedContextSource.load({
      inferredDir: paths.inferredDir,
      entries: newEntries,
    });
  log.info(`更新履歴アイテム: ${allInferredCount}件`);

  const withContextCount = countEntriesWithContext(newEntries, relatedContext);
  log.info(
    `コンテキストあり: ${withContextCount}件, コンテキストなし: ${newEntries.length - withContextCount}件`,
  );

  const translationMap = await translateEntries({
    entries: newEntries,
    noAiMode: input.noAiMode,
    relatedContext,
    ...(input.settingsTranslator !== undefined
      ? { settingsTranslator: input.settingsTranslator }
      : {}),
    log,
  });

  const fetchedAt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
  }).format(new Date());

  const references = newEntries.flatMap((entry, index) => {
    const translation = translationMap.get(index);
    if (!translation) {
      return [];
    }

    return [
      {
        key: entry.key,
        leafName: entry.leafName,
        slug: createSettingSlugFromKey(entry.key, entry.source),
        source: entry.source,
        descriptionEn: entry.descriptionEn,
        descriptionJa: translation.descriptionJa,
        ...(translation.useCaseJa ? { useCaseJa: translation.useCaseJa } : {}),
        parentDescriptions: entry.parentDescriptions,
        docSnippets: relatedContext.docSnippetsMap.get(entry.key) ?? [],
        relatedChangelog: relatedContext.changelogsMap.get(entry.key) ?? [],
        fetchedAt,
      },
    ];
  });

  return input.settingsReferenceStore.writeReferences({
    outputDir: paths.outputDir,
    references,
  });
}

function countEntriesWithContext(
  entries: SettingsEntry[],
  ctx: SettingsReferenceContext,
): number {
  return entries.filter(
    (entry) =>
      (ctx.docSnippetsMap.get(entry.key)?.length ?? 0) > 0 ||
      (ctx.changelogsMap.get(entry.key)?.length ?? 0) > 0,
  ).length;
}

async function translateEntries(input: {
  entries: SettingsEntry[];
  noAiMode: boolean;
  relatedContext: SettingsReferenceContext;
  settingsTranslator?: SettingsTranslatorPort;
  log: AppLogger;
}): Promise<SettingsTranslationMap> {
  if (input.noAiMode) {
    input.log.info('AI なしモード: 翻訳をスキップします');
    return buildNoAiTranslationMap(input.entries);
  }

  if (!input.settingsTranslator) {
    throw new Error('設定翻訳には settingsTranslator が必要です');
  }

  return translateInBatches(input.entries, {
    relatedContext: input.relatedContext,
    settingsTranslator: input.settingsTranslator,
    log: input.log,
  });
}
