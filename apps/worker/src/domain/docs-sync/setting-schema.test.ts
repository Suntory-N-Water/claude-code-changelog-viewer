import { describe, expect, it } from 'vitest';
import {
  formatSchemaDefaultValue,
  formatSettingScope,
  mergeSettingSchemaEntries,
  parseSchemaEnumValues,
  type SettingSchemaFields,
} from './setting-schema';

const entry = (
  key: string,
  source: SettingSchemaFields['source'],
  overrides: Partial<SettingSchemaFields> = {},
): SettingSchemaFields => ({
  key,
  source,
  description: key,
  parentDescriptions: '[]',
  valueType: '',
  defaultValue: null,
  enumValues: null,
  scope: null,
  example: null,
  ...overrides,
});

describe('設定スキーマ統合ポリシー', () => {
  it('settings、env-vars.md、スキーマ、docs本文の優先順位で統合する', () => {
    const result = mergeSettingSchemaEntries({
      schemaEntries: [
        entry('setting.only', 'settings'),
        entry('ENV_PRIORITY', 'env', { description: 'schema' }),
        entry('ENV_SCHEMA_ONLY', 'env'),
      ],
      markdownEntries: [
        entry('ENV_PRIORITY', 'env', { description: 'markdown' }),
        entry('ENV_MARKDOWN_ONLY', 'env'),
      ],
      docsEntries: [
        entry('ENV_MARKDOWN_ONLY', 'env', { description: 'docs duplicate' }),
        entry('ENV_DOCS_ONLY', 'env'),
      ],
      referenceEntries: [],
    });

    expect(result).toEqual([
      entry('setting.only', 'settings'),
      entry('ENV_PRIORITY', 'env', { description: 'markdown' }),
      entry('ENV_MARKDOWN_ONLY', 'env'),
      entry('ENV_SCHEMA_ONLY', 'env'),
      entry('ENV_DOCS_ONLY', 'env'),
    ]);
  });

  it('空入力では空配列を返す', () => {
    expect(
      mergeSettingSchemaEntries({
        schemaEntries: [],
        markdownEntries: [],
        docsEntries: [],
        referenceEntries: [],
      }),
    ).toEqual([]);
  });

  it('同じ入力元内の重複キーを一件にする', () => {
    expect(
      mergeSettingSchemaEntries({
        schemaEntries: [
          entry('setting.duplicate', 'settings'),
          entry('setting.duplicate', 'settings', { description: 'later' }),
        ],
        markdownEntries: [],
        docsEntries: [],
        referenceEntries: [],
      }),
    ).toEqual([entry('setting.duplicate', 'settings')]);
  });

  it('公式リファレンスにしかないキーのとき、設定項目として並びに加えること', () => {
    const officialOnly = entry('ultracode', 'settings', {
      description: 'Turn on ultracode.',
      valueType: 'boolean',
      scope: 'Any file',
      example: '{ "ultracode": true }',
    });

    expect(
      mergeSettingSchemaEntries({
        schemaEntries: [entry('model', 'settings')],
        markdownEntries: [],
        docsEntries: [],
        referenceEntries: [officialOnly],
      }),
    ).toEqual([entry('model', 'settings'), officialOnly]);
  });

  it('schemastore が型・既定値・選択肢・説明を持つとき、公式リファレンスの値で上書きしないこと', () => {
    const result = mergeSettingSchemaEntries({
      schemaEntries: [
        entry('model', 'settings', {
          description: 'schemastore',
          valueType: 'string',
          defaultValue: '"opus"',
          enumValues: '["opus","sonnet"]',
        }),
      ],
      markdownEntries: [],
      docsEntries: [],
      referenceEntries: [
        entry('model', 'settings', {
          description: 'official reference',
          valueType: 'array',
          defaultValue: '"sonnet"',
          enumValues: '["fable"]',
          scope: 'Any file',
          example: '{ "model": "opus" }',
        }),
      ],
    });

    expect(result).toEqual([
      entry('model', 'settings', {
        description: 'schemastore',
        valueType: 'string',
        defaultValue: '"opus"',
        enumValues: '["opus","sonnet"]',
        scope: 'Any file',
        example: '{ "model": "opus" }',
      }),
    ]);
  });

  it('schemastore が型・既定値・選択肢・説明を持たないとき、公式リファレンスの値で埋めること', () => {
    const result = mergeSettingSchemaEntries({
      schemaEntries: [entry('spellcheck', 'settings', { description: '' })],
      markdownEntries: [],
      docsEntries: [],
      referenceEntries: [
        entry('spellcheck', 'settings', {
          description: 'Check spelling in the prompt input.',
          valueType: 'object',
          defaultValue: 'true',
          enumValues: '["on","off"]',
          scope: 'Any file',
          example: '{ "spellcheck": true }',
        }),
      ],
    });

    expect(result).toEqual([
      entry('spellcheck', 'settings', {
        description: 'Check spelling in the prompt input.',
        valueType: 'object',
        defaultValue: 'true',
        enumValues: '["on","off"]',
        scope: 'Any file',
        example: '{ "spellcheck": true }',
      }),
    ]);
  });

  it('公式リファレンスにセクションが無いキーのとき、記述場所と記述例を持たないままにすること', () => {
    expect(
      mergeSettingSchemaEntries({
        schemaEntries: [],
        markdownEntries: [entry('CLAUDE_CODE_TEST', 'env')],
        docsEntries: [],
        referenceEntries: [entry('model', 'settings', { scope: 'Any file' })],
      }),
    ).toEqual([
      entry('CLAUDE_CODE_TEST', 'env'),
      entry('model', 'settings', { scope: 'Any file' }),
    ]);
  });
});

describe('既定値の表記', () => {
  it.each([
    ['文字列', '"latest"', 'latest'],
    ['真偽値', 'true', 'true'],
    ['数値', '5', '5'],
    ['空の配列', '[]', '[]'],
    ['オブジェクト', '{"a":1}', '{"a":1}'],
    ['JSON として読めない値', 'latest', 'latest'],
  ])(
    '%s のとき、設定ファイルに書く形で返すこと',
    (_label, stored, expected) => {
      expect(formatSchemaDefaultValue(stored)).toBe(expected);
    },
  );
});

describe('選択肢の表記', () => {
  it.each([
    ['文字列の配列', '["stable","latest"]', ['stable', 'latest']],
    ['数値の配列', '[0,1]', ['0', '1']],
    ['空の配列', '[]', []],
    ['配列ではない値', '"latest"', []],
    ['JSON として読めない値', 'stable, latest', []],
  ])('%s のとき、表示できる値の並びを返すこと', (_label, stored, expected) => {
    expect(parseSchemaEnumValues(stored)).toEqual(expected);
  });
});

describe('記述場所の表記', () => {
  it.each([
    ['Any file', 'どの設定ファイルでも可'],
    ['Managed', '管理者設定のみ'],
    ['User or managed', 'ユーザー設定または管理者設定'],
    ['Global config', 'グローバル設定のみ'],
    ['User, local, or managed', 'ユーザー設定・ローカル設定・管理者設定'],
  ])('%s のとき、日本語の表記を返すこと', (stored, expected) => {
    expect(formatSettingScope(stored)).toBe(expected);
  });

  it('対応表にない値のとき、ハイフンを返すこと', () => {
    expect(formatSettingScope('Project only')).toBe('-');
  });
});
