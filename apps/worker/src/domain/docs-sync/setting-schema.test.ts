import { describe, expect, it } from 'vitest';
import {
  formatSchemaDefaultValue,
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
