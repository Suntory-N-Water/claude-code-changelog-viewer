import { describe, expect, test } from 'vitest';
import {
  buildSettingChildTrees,
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

describe('buildSettingChildTrees', () => {
  const entries = [
    {
      key: 'sandbox',
      slug: 'sandbox',
      source: 'settings' as const,
      description_ja: 'サンドボックスの設定。詳しくは後述します。',
      value_type: 'object',
    },
    {
      key: 'sandbox.enabled',
      slug: 'sandbox-enabled',
      source: 'settings' as const,
      description_ja: 'サンドボックスを有効にする。',
      value_type: 'boolean',
    },
    {
      key: 'sandbox.network',
      slug: 'sandbox-network',
      source: 'settings' as const,
      description_ja: 'ネットワークの分離。',
      value_type: 'object',
    },
    {
      key: 'sandbox.network.httpProxyPort',
      slug: 'sandbox-network-http-proxy-port',
      source: 'settings' as const,
      description_ja: 'HTTP プロキシのポート。',
      value_type: 'integer',
    },
    {
      key: 'env',
      slug: 'env',
      source: 'settings' as const,
      description_ja: '環境変数を渡す。',
      value_type: 'object',
    },
    {
      key: 'CLAUDE_CODE_TEST',
      slug: 'claude-code-test',
      source: 'env' as const,
      description_ja: 'テスト用の環境変数。',
    },
  ];

  test('子を持つキーのとき、キー名・型・要約・個別ページの slug を持つ行をキー名の昇順で返す', () => {
    expect(buildSettingChildTrees(entries).get('sandbox')).toEqual([
      {
        key: 'sandbox.enabled',
        leafName: 'enabled',
        slug: 'sandbox-enabled',
        valueType: 'boolean',
        summary: 'サンドボックスを有効にする。',
        children: [],
      },
      {
        key: 'sandbox.network',
        leafName: 'network',
        slug: 'sandbox-network',
        valueType: 'object',
        summary: 'ネットワークの分離。',
        children: [
          {
            key: 'sandbox.network.httpProxyPort',
            leafName: 'httpProxyPort',
            slug: 'sandbox-network-http-proxy-port',
            valueType: 'integer',
            summary: 'HTTP プロキシのポート。',
            children: [],
          },
        ],
      },
    ]);
  });

  test('子を持たないキーのとき、行を返さない', () => {
    expect(
      buildSettingChildTrees(entries).get('sandbox.enabled'),
    ).toBeUndefined();
  });

  test('env のとき、環境変数のキーを子に含めない', () => {
    expect(buildSettingChildTrees(entries).get('env')).toBeUndefined();
  });
});
