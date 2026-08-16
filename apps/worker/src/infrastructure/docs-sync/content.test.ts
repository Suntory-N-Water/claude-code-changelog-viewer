import { describe, expect, it } from 'vitest';
import {
  chunkMarkdown,
  flattenSettingSchema,
  mergeDocumentLists,
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
