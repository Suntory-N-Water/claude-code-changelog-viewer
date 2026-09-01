export type SettingSchemaFields = {
  key: string;
  source: 'settings' | 'env';
  description: string;
  parentDescriptions: string;
  valueType: string;
  defaultValue: string | null;
  enumValues: string | null;
  enumDescriptions: string | null;
  scope: string | null;
  example: string | null;
  defaultNote: string | null;
};

/**
 * settings、env-vars.md、docs本文、公式リファレンスの4系統を統合する。
 * キーの集合は和集合、型・既定値・選択肢・説明は先の3系統を優先し、
 * 記述場所・記述例・選択肢ごとの説明・既定値の補足は公式リファレンスだけが持つ。
 */
export type SettingSchemaSources = {
  schemaEntries: readonly SettingSchemaFields[];
  markdownEntries: readonly SettingSchemaFields[];
  docsEntries: readonly SettingSchemaFields[];
  referenceEntries: readonly SettingSchemaFields[];
};

export function mergeSettingSchemaEntries({
  schemaEntries,
  markdownEntries,
  docsEntries,
  referenceEntries,
}: SettingSchemaSources): SettingSchemaFields[] {
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
  const referenceByKey = new Map(
    referenceEntries.map((entry) => [entry.key, entry]),
  );
  const result: SettingSchemaFields[] = [];
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
    result.push(applyReferenceFields(entry, referenceByKey.get(entry.key)));
  }

  for (const entry of referenceEntries) {
    if (seenKeys.has(entry.key)) {
      continue;
    }
    seenKeys.add(entry.key);
    result.push(entry);
  }

  return result;
}

function applyReferenceFields(
  entry: SettingSchemaFields,
  reference: SettingSchemaFields | undefined,
): SettingSchemaFields {
  if (reference === undefined) {
    return entry;
  }

  return {
    ...entry,
    description:
      entry.description === '' ? reference.description : entry.description,
    valueType: entry.valueType === '' ? reference.valueType : entry.valueType,
    defaultValue: entry.defaultValue ?? reference.defaultValue,
    enumValues: entry.enumValues ?? reference.enumValues,
    enumDescriptions: reference.enumDescriptions,
    scope: reference.scope,
    example: reference.example,
    defaultNote: reference.defaultNote,
  };
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

/** 保存時に JSON 化された選択肢を、表示できる値の並びへ戻す。 */
export function parseSchemaEnumValues(stored: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return [];
  }
  return Array.isArray(parsed) ? parsed.map(String) : [];
}

const SCOPE_LABELS = new Map([
  ['Any file', 'どの設定ファイルでも可'],
  ['Managed', '管理者設定のみ'],
  ['User or managed', 'ユーザー設定または管理者設定'],
  ['Global config', 'グローバル設定のみ'],
  ['User, local, or managed', 'ユーザー設定・ローカル設定・管理者設定'],
]);

/** 公式リファレンスの記述場所を日本語にする。対応表にない値は英語を出さずハイフンにする。 */
export function formatSettingScope(scope: string): string {
  return SCOPE_LABELS.get(scope.trim()) ?? '-';
}
