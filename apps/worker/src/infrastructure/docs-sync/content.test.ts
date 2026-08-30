import { describe, expect, it } from 'vitest';
import {
  chunkMarkdown,
  flattenSettingSchema,
  mergeDocumentLists,
  parseEnvVarsMd,
  parsePublicEnvEntriesFromDocs,
} from './content';

describe('ドキュメント同期用のコンテンツ処理', () => {
  it('コードフェンス内の見出しをチャンク境界にしないこと', () => {
    const chunks = chunkMarkdown(
      '# Overview\n\n```bash\n# command option\n```\n\n## Details\n\n本文',
    );

    expect(chunks.map((chunk) => chunk.heading)).toEqual([
      'Overview',
      'Details',
    ]);
    expect(chunks[0]?.text).toContain('# command option');
  });

  it('見出し配下の長い本文を段落境界で分割すること', () => {
    const paragraph = '本文 '.repeat(500).trim();
    const content = `## Section\n\n${[paragraph, paragraph, paragraph].join('\n\n')}`;

    const chunks = chunkMarkdown(content);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.heading === 'Section')).toBe(true);
    expect(chunks[0]?.startLine).toBe(1);
    expect(chunks[1]?.startLine).toBeGreaterThan(1);
  });

  it('設定スキーマを設定項目と環境変数のリーフに展開すること', () => {
    const entries = flattenSettingSchema({
      properties: {
        $schema: { type: 'string' },
        permissions: {
          type: 'object',
          description: 'Permission settings',
          properties: {
            allow: {
              type: 'array',
              description: 'Allowed tools',
              default: [],
              enum: ['Read', 'Write'],
            },
          },
        },
        env: {
          type: 'object',
          properties: {
            CLAUDE_CODE_TEST: {
              type: 'string',
              description: 'Test environment variable',
            },
          },
        },
      },
    });

    expect(entries).toEqual([
      {
        key: 'permissions.allow',
        source: 'settings',
        description: 'Allowed tools',
        parentDescriptions: JSON.stringify(['Permission settings']),
        valueType: 'array',
        defaultValue: '[]',
        enumValues: JSON.stringify(['Read', 'Write']),
      },
      {
        key: 'CLAUDE_CODE_TEST',
        source: 'env',
        description: 'Test environment variable',
        parentDescriptions: '[]',
        valueType: 'string',
        defaultValue: null,
        enumValues: null,
      },
    ]);
  });

  it.each([
    ['要素が文字列', { type: 'string' }, 'string[]'],
    ['要素が配列', { type: 'array', items: { type: 'number' } }, 'number[][]'],
    ['要素の型が複数', { type: ['string', 'number'] }, 'array'],
    ['要素の指定がない', undefined, 'array'],
  ])(
    '配列の設定項目で %s のとき、書ける値が分かる型を返すこと',
    (_label, items, expected) => {
      const entries = flattenSettingSchema({
        properties: {
          allow: { type: 'array', ...(items === undefined ? {} : { items }) },
        },
      });

      expect(entries[0]?.valueType).toBe(expected);
    },
  );

  it('env-vars.md の環境変数テーブルを抽出すること', () => {
    const entries = parseEnvVarsMd(`
| Environment variable | Description |
| - | - |
| \`CLAUDE_CODE_TABLE_TEST\` | Table description |
`);

    expect(entries).toMatchObject([
      {
        key: 'CLAUDE_CODE_TABLE_TEST',
        source: 'env',
        description: 'Table description',
      },
    ]);
  });

  it('env-vars.md の純粋な See 参照をページ本文から解決すること', () => {
    const entries = parseEnvVarsMd(
      `
| Environment variable | Description |
| - | - |
| \`CLAUDE_CODE_SEE_TEST\` | See [Configuration](/en/configuration#environment-variables) |
`,
      new Map([
        [
          'configuration.md',
          `# Configuration

## Environment variables

| Environment variable | Description |
| - | - |
| \`CLAUDE_CODE_SEE_TEST\` | Resolved description |
`,
        ],
      ]),
    );

    expect(entries[0]?.description).toBe('Resolved description');
  });

  it('docs 本文中の公開環境変数の言及を抽出すること', () => {
    const entries = parsePublicEnvEntriesFromDocs(
      new Map([
        [
          'guide.md',
          'Claude Code reads `CLAUDE_CODE_MENTION_TEST` from the environment.',
        ],
        ['env-vars.md', 'Claude Code reads `CLAUDE_CODE_EXCLUDED`'],
      ]),
    );

    expect(entries).toMatchObject([
      {
        key: 'CLAUDE_CODE_MENTION_TEST',
        source: 'env',
        description: expect.stringContaining('CLAUDE_CODE_MENTION_TEST'),
      },
    ]);
    expect(entries.some((entry) => entry.key === 'CLAUDE_CODE_EXCLUDED')).toBe(
      false,
    );
  });

  it('llms.txt のパスを優先し、changelog.md を除外すること', () => {
    const documents = mergeDocumentLists(
      [
        {
          title: 'Guide from map',
          url: 'https://code.claude.com/docs/en/guide.md',
          path: 'guide.md',
        },
        {
          title: 'Changelog',
          url: 'https://code.claude.com/docs/en/changelog.md',
          path: 'changelog.md',
        },
      ],
      [
        {
          title: 'guide',
          url: 'https://code.claude.com/docs/en/reference/guide.md',
          path: 'reference/guide.md',
        },
      ],
    );

    expect(documents).toEqual([
      {
        title: 'Guide from map',
        url: 'https://code.claude.com/docs/en/reference/guide.md',
        path: 'reference/guide.md',
      },
    ]);
  });
});
