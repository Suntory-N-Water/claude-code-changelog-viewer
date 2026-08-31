import {
  formatSchemaDefaultValue,
  formatSettingScope,
  parseSchemaEnumValues,
} from '../../domain/docs-sync/setting-schema';

export type SettingSchemaDisplay = {
  valueType?: string;
  defaultValue?: string;
  enumValues?: string[];
  scope?: string;
  example?: string;
};

type SettingSchemaDisplayRow = {
  key: string;
  value_type: string;
  default_value: string | null;
  enum_values: string | null;
  scope: string | null;
  example: string | null;
};

/** 公式の型・既定値・選択肢を、表示できる値を持つキーだけ返す。 */
export async function loadSettingSchemaDisplays(
  docsDb: D1Database,
): Promise<Map<string, SettingSchemaDisplay>> {
  const result = await docsDb
    .prepare(
      'SELECT key, value_type, default_value, enum_values, scope, example FROM setting_schema_entries',
    )
    .all<SettingSchemaDisplayRow>();

  const displays = new Map<string, SettingSchemaDisplay>();
  for (const row of result.results) {
    const defaultValue =
      row.default_value === null
        ? ''
        : formatSchemaDefaultValue(row.default_value);
    const enumValues =
      row.enum_values === null ? [] : parseSchemaEnumValues(row.enum_values);
    const display: SettingSchemaDisplay = {
      ...(row.value_type === '' ? {} : { valueType: row.value_type }),
      ...(defaultValue === '' ? {} : { defaultValue }),
      ...(enumValues.length === 0 ? {} : { enumValues }),
      ...(row.scope === null ? {} : { scope: formatSettingScope(row.scope) }),
      ...(row.example === null || row.example === ''
        ? {}
        : { example: row.example }),
    };
    if (Object.keys(display).length > 0) {
      displays.set(row.key, display);
    }
  }
  return displays;
}
