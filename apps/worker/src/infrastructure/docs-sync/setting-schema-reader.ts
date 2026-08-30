export type SettingSchemaDisplay = {
  valueType?: string;
  defaultValue?: string;
};

type SettingSchemaDisplayRow = {
  key: string;
  value_type: string;
  default_value: string | null;
};

/** 公式の型と既定値を、表示できる値を持つキーだけ返す。 */
export async function loadSettingSchemaDisplays(
  docsDb: D1Database,
): Promise<Map<string, SettingSchemaDisplay>> {
  const result = await docsDb
    .prepare(
      'SELECT key, value_type, default_value FROM setting_schema_entries',
    )
    .all<SettingSchemaDisplayRow>();

  const displays = new Map<string, SettingSchemaDisplay>();
  for (const row of result.results) {
    const defaultValue =
      row.default_value === null ? '' : formatDefaultValue(row.default_value);
    const display: SettingSchemaDisplay = {
      ...(row.value_type === '' ? {} : { valueType: row.value_type }),
      ...(defaultValue === '' ? {} : { defaultValue }),
    };
    if (display.valueType !== undefined || display.defaultValue !== undefined) {
      displays.set(row.key, display);
    }
  }
  return displays;
}

/** 保存時に JSON 化された既定値を、設定ファイルに書く形に戻す。 */
export function formatDefaultValue(stored: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return stored.trim();
  }
  return typeof parsed === 'string' ? parsed.trim() : JSON.stringify(parsed);
}
