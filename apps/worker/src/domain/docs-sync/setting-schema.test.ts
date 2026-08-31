import { describe, expect, it } from 'vitest';
import {
  applySettingsReferenceDetails,
  formatSchemaDefaultValue,
  formatSettingScope,
  mergeSettingSchemaEntries,
  parseSchemaEnumValues,
} from './setting-schema';

type Entry = {
  key: string;
  source: 'settings' | 'env';
  description: string;
};

const entry = (
  key: string,
  source: Entry['source'],
  description = key,
): Entry => ({ key, source, description });

describe('設定スキーマ統合ポリシー', () => {
  it('settings、env-vars.md、スキーマ、docs本文の優先順位で統合する', () => {
    const result = mergeSettingSchemaEntries(
      [
        entry('setting.only', 'settings'),
        entry('ENV_PRIORITY', 'env', 'schema'),
        entry('ENV_SCHEMA_ONLY', 'env'),
      ],
      [
        entry('ENV_PRIORITY', 'env', 'markdown'),
        entry('ENV_MARKDOWN_ONLY', 'env'),
      ],
      [
        entry('ENV_MARKDOWN_ONLY', 'env', 'docs duplicate'),
        entry('ENV_DOCS_ONLY', 'env'),
      ],
    );

    expect(result).toEqual([
      entry('setting.only', 'settings'),
      entry('ENV_PRIORITY', 'env', 'markdown'),
      entry('ENV_MARKDOWN_ONLY', 'env'),
      entry('ENV_SCHEMA_ONLY', 'env'),
      entry('ENV_DOCS_ONLY', 'env'),
    ]);
  });

  it('空入力では空配列を返す', () => {
    expect(mergeSettingSchemaEntries([], [], [])).toEqual([]);
  });

  it('同じ入力元内の重複キーを一件にする', () => {
    expect(
      mergeSettingSchemaEntries(
        [
          entry('setting.duplicate', 'settings'),
          entry('setting.duplicate', 'settings', 'later'),
        ],
        [],
        [],
      ),
    ).toEqual([entry('setting.duplicate', 'settings')]);
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

describe('公式リファレンスの記述場所と記述例の取り込み', () => {
  const detail = (
    key: string,
    scope: string | null = null,
    example: string | null = null,
  ) => ({ key, scope, example });

  it('同じキーのセクションがあるとき、記述場所と記述例を付けること', () => {
    const result = applySettingsReferenceDetails(
      [detail('model'), detail('permissions.allow')],
      [
        detail('model', 'Any file', '{ "model": "opus" }'),
        detail('permissions.allow', 'User or managed', null),
      ],
    );

    expect(result).toEqual([
      detail('model', 'Any file', '{ "model": "opus" }'),
      detail('permissions.allow', 'User or managed', null),
    ]);
  });

  it('セクションが無いキーのとき、記述場所と記述例を持たないままにすること', () => {
    expect(
      applySettingsReferenceDetails([detail('CLAUDE_CODE_TEST')], []),
    ).toEqual([detail('CLAUDE_CODE_TEST')]);
  });

  it('公式リファレンスにしかないキーのとき、エントリを増やさないこと', () => {
    expect(
      applySettingsReferenceDetails(
        [detail('model')],
        [detail('officialOnly', 'Managed', '{ "officialOnly": true }')],
      ),
    ).toEqual([detail('model')]);
  });
});
