import { describe, expect, it } from 'vitest';
import { mergeSettingSchemaEntries } from './setting-schema';

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
