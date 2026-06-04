import {
  type SettingKey,
  type SettingSource,
  getLeafName,
} from './setting-key';

export type SettingsEntry = {
  readonly key: SettingKey;
  readonly leafName: string;
  readonly source: SettingSource;
  readonly descriptionEn: string;
  readonly parentDescriptions: readonly string[];
};

/**
 * settings schema や env docs から抽出した設定エントリを生成する。
 */
export function createSettingsEntry(input: {
  readonly key: SettingKey;
  readonly source: SettingSource;
  readonly descriptionEn: string;
  readonly parentDescriptions?: readonly string[];
}): SettingsEntry {
  return {
    key: input.key,
    leafName: getLeafName(input.key),
    source: input.source,
    descriptionEn: input.descriptionEn,
    parentDescriptions: input.parentDescriptions ?? [],
  };
}

/**
 * 同じキーの設定エントリを最初の1件にまとめる。
 */
export function dedupeSettingsEntries(
  entries: readonly SettingsEntry[],
): SettingsEntry[] {
  const map = new Map<SettingKey, SettingsEntry>();

  for (const entry of entries) {
    if (!map.has(entry.key)) {
      map.set(entry.key, entry);
    }
  }

  return [...map.values()];
}

/**
 * env-vars.md、schema.env、docs/en の順に環境変数エントリを統合する。
 */
export function mergeEnvEntries(input: {
  readonly markdownEntries: readonly SettingsEntry[];
  readonly schemaEntries: readonly SettingsEntry[];
  readonly docsEntries: readonly SettingsEntry[];
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
