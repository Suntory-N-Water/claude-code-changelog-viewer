import { describe, expect, it } from 'vitest';
import { FakeDocsD1Database } from '../../test-support/fake-d1';
import {
  formatDefaultValue,
  loadSettingSchemaDisplays,
} from './setting-schema-reader';

describe('formatDefaultValue', () => {
  it('文字列の既定値からクォートを外すこと', () => {
    expect(formatDefaultValue('"latest"')).toBe('latest');
  });

  it('文字列以外は JSON の表記のまま返すこと', () => {
    expect(formatDefaultValue('true')).toBe('true');
    expect(formatDefaultValue('[]')).toBe('[]');
    expect(formatDefaultValue('{"a":1}')).toBe('{"a":1}');
  });

  it('JSON として読めない値はそのまま返すこと', () => {
    expect(formatDefaultValue('latest')).toBe('latest');
  });
});

describe('loadSettingSchemaDisplays', () => {
  it('値を持つキーだけを返すこと', async () => {
    const docsDb = new FakeDocsD1Database();
    await docsDb
      .prepare(
        `INSERT INTO setting_schema_entries
           (key, source, description, parent_descriptions, value_type, default_value, enum_values)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('model', 'settings', '', '[]', 'string', '"latest"', null)
      .run();
    await docsDb
      .prepare(
        `INSERT INTO setting_schema_entries
           (key, source, description, parent_descriptions, value_type, default_value, enum_values)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('permissions.allow', 'settings', '', '[]', 'string[]', null, null)
      .run();
    await docsDb
      .prepare(
        `INSERT INTO setting_schema_entries
           (key, source, description, parent_descriptions, value_type, default_value, enum_values)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('CLAUDE_CODE_TEST', 'env', '', '[]', '', null, null)
      .run();

    const displays = await loadSettingSchemaDisplays(docsDb);

    expect([...displays]).toEqual([
      ['model', { valueType: 'string', defaultValue: 'latest' }],
      ['permissions.allow', { valueType: 'string[]' }],
    ]);
    docsDb.close();
  });
});
