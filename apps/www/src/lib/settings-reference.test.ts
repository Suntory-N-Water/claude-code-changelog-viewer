import { describe, expect, test } from 'vitest';
import {
  buildSettingValueOptions,
  summarizeSettingDescription,
} from './settings-reference';

describe('summarizeSettingDescription', () => {
  test.each([
    [
      'Markdownリンクを含むとき、リンク記法を除去して最初の文を返す',
      '[公式ドキュメント](https://example.com)を参照します。次の文。',
      '公式ドキュメントを参照します。',
    ],
    [
      'バッククォートを含むとき、記法を除去して最初の文を返す',
      '`claude.code.setting`を有効にします。次の文。',
      'claude.code.settingを有効にします。',
    ],
    [
      '設定名のASCIIピリオドを含むとき、日本語の句点までを最初の文として返す',
      'claude.code.setting を有効にします。次の文。',
      'claude.code.setting を有効にします。',
    ],
  ])('%s', (_caseName, description, expected) => {
    expect(summarizeSettingDescription(description)).toBe(expected);
  });

  test('80文字ちょうどのとき、省略せず全文を返す', () => {
    const description = 'あ'.repeat(80);

    expect(summarizeSettingDescription(description)).toBe(description);
  });

  test('81文字のとき、末尾を省略記号に置き換えて80文字にする', () => {
    const description = 'あ'.repeat(81);

    expect(summarizeSettingDescription(description)).toBe(
      `${'あ'.repeat(79)}…`,
    );
  });

  test('日本語の句点がない80文字未満のとき、全文を返す', () => {
    const description = '設定を有効にします';

    expect(summarizeSettingDescription(description)).toBe(description);
  });
});

describe('buildSettingValueOptions', () => {
  test('既定値が選択肢に含まれるとき、その値だけに既定の印が付く', () => {
    expect(buildSettingValueOptions(['stable', 'latest'], 'latest')).toEqual([
      { value: 'stable', isDefault: false },
      { value: 'latest', isDefault: true },
    ]);
  });

  test.each([
    ['既定値がないとき', undefined],
    ['既定値が選択肢にないとき', 'nightly'],
  ])('%s、どの値にも既定の印が付かない', (_caseName, defaultValue) => {
    expect(
      buildSettingValueOptions(['stable', 'latest'], defaultValue),
    ).toEqual([
      { value: 'stable', isDefault: false },
      { value: 'latest', isDefault: false },
    ]);
  });
});
