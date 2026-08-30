type SettingSchemaCandidate = {
  key: string;
  source: 'settings' | 'env';
};

/** settings、env-vars.md、docs本文の優先順位に従って設定スキーマを統合する。 */
export function mergeSettingSchemaEntries<T extends SettingSchemaCandidate>(
  schemaEntries: readonly T[],
  markdownEntries: readonly T[],
  docsEntries: readonly T[],
): T[] {
  const schemaSettings = schemaEntries.filter(
    (entry) => entry.source === 'settings',
  );
  const schemaEnvEntries = schemaEntries.filter(
    (entry) => entry.source === 'env',
  );
  const markdownKeys = new Set(markdownEntries.map((entry) => entry.key));
  const schemaOnly = schemaEnvEntries.filter(
    (entry) => !markdownKeys.has(entry.key),
  );
  const existingKeys = new Set(
    [...markdownEntries, ...schemaOnly].map((entry) => entry.key),
  );
  const docsOnly = docsEntries.filter((entry) => !existingKeys.has(entry.key));
  const result: T[] = [];
  const seenKeys = new Set<string>();

  for (const entry of [
    ...schemaSettings,
    ...markdownEntries,
    ...schemaOnly,
    ...docsOnly,
  ]) {
    if (seenKeys.has(entry.key)) {
      continue;
    }
    seenKeys.add(entry.key);
    result.push(entry);
  }

  return result;
}

/** 保存時に JSON 化された既定値を、設定ファイルに書く形へ戻す。 */
export function formatSchemaDefaultValue(stored: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return stored.trim();
  }
  return typeof parsed === 'string' ? parsed.trim() : JSON.stringify(parsed);
}
