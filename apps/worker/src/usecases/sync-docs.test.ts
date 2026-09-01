import { describe, expect, it } from 'vitest';
import { syncDocs } from './sync-docs';

const emptyContentParser = {
  parseEnvVarsMd: () => [],
  parsePublicEnvEntriesFromDocs: () => [],
  parseSettingsReferenceMd: () => [],
};

describe('ドキュメント同期ユースケース', () => {
  it('変更されたページと新しい設定スキーマを保存する', async () => {
    const changedPages: unknown[] = [];
    const deletedPaths: string[][] = [];
    const replacedSchemas: unknown[] = [];
    const dependencies = {
      source: {
        fetchDocumentList: async () => [
          {
            path: 'guide.md',
            title: 'Guide',
            url: 'https://example.com/guide.md',
          },
        ],
        fetchPage: async () => ({
          path: 'guide.md',
          title: 'Guide',
          url: 'https://example.com/guide.md',
          content: '# Guide\n\nNew content',
          contentHash: 'new-page-hash',
        }),
        fetchSettingSchema: async () => ({
          contentHash: 'new-schema-hash',
          entries: [
            {
              key: 'permissions.allow',
              source: 'settings' as const,
              description: 'Allowed tools',
              parentDescriptions: '["Permission settings"]',
              valueType: 'array',
              defaultValue: '[]',
              enumValues: '["Read","Write"]',
              enumDescriptions: null,
              scope: null,
              example: null,
              defaultNote: null,
            },
          ],
        }),
      },
      store: {
        loadExistingPages: async () => [],
        writeChangedPages: async (pages: unknown[]) => {
          changedPages.push(...pages);
        },
        deletePages: async (paths: string[]) => {
          deletedPaths.push([...paths]);
        },
        loadSettingSchemaHash: async () => null,
        replaceSettingSchema: async (schema: unknown) => {
          replacedSchemas.push(schema);
        },
      },
      contentParser: emptyContentParser,
    };

    const result = await syncDocs(dependencies, {
      now: new Date('2026-08-16T00:00:00.000Z'),
    });

    expect(result).toEqual({
      documentCount: 1,
      successfulCount: 1,
      failedCount: 0,
      changedCount: 1,
      skippedCount: 0,
      deletedCount: 0,
      skippedBySafetyGuard: false,
      schemaUpdated: true,
    });
    expect(changedPages).toEqual([
      {
        path: 'guide.md',
        title: 'Guide',
        url: 'https://example.com/guide.md',
        content: '# Guide\n\nNew content',
        contentHash: 'new-page-hash',
      },
    ]);
    expect(deletedPaths).toEqual([]);
    expect(replacedSchemas).toEqual([
      {
        contentHash: 'new-schema-hash',
        entries: [
          {
            key: 'permissions.allow',
            source: 'settings',
            description: 'Allowed tools',
            parentDescriptions: '["Permission settings"]',
            valueType: 'array',
            defaultValue: '[]',
            enumValues: '["Read","Write"]',
            enumDescriptions: null,
            scope: null,
            example: null,
            defaultNote: null,
          },
        ],
      },
    ]);
  });

  it('parser が返した設定エントリをスキーマ保存に含める', async () => {
    const replacedSchemas: unknown[] = [];
    const pages = [
      {
        path: 'env-vars.md',
        title: 'Environment variables',
        url: 'https://example.com/env-vars.md',
        content: `
| Environment variable | Description |
| - | - |
| \`CLAUDE_CODE_MD_ONLY\` | From env-vars.md |
`,
        contentHash: 'env-vars-hash',
      },
      {
        path: 'guide.md',
        title: 'Guide',
        url: 'https://example.com/guide.md',
        content: `
## Environment variables

| Environment variable | Description |
| - | - |
| \`CLAUDE_CODE_DOCS_ONLY\` | From docs table |
`,
        contentHash: 'guide-hash',
      },
    ];
    const markdownEntries = [
      {
        key: 'CLAUDE_CODE_MD_ONLY',
        source: 'env' as const,
        description: 'From env-vars.md',
        parentDescriptions: '[]',
        valueType: '',
        defaultValue: null,
        enumValues: null,
        enumDescriptions: null,
        scope: null,
        example: null,
        defaultNote: null,
      },
    ];
    const docsEntries = [
      {
        key: 'CLAUDE_CODE_DOCS_ONLY',
        source: 'env' as const,
        description: 'From docs table',
        parentDescriptions: '[]',
        valueType: '',
        defaultValue: null,
        enumValues: null,
        enumDescriptions: null,
        scope: null,
        example: null,
        defaultNote: null,
      },
    ];
    const dependencies = {
      source: {
        fetchDocumentList: async () =>
          pages.map(({ path, title, url }) => ({ path, title, url })),
        fetchPage: async (document: { path: string }) => {
          const page = pages.find(
            (candidate) => candidate.path === document.path,
          );
          if (page === undefined) {
            throw new Error(`未知のページ: ${document.path}`);
          }
          return page;
        },
        fetchSettingSchema: async () => ({
          contentHash: 'schema-hash',
          entries: [
            {
              key: 'permissions.allow',
              source: 'settings' as const,
              description: 'Allowed tools',
              parentDescriptions: '[]',
              valueType: 'array',
              defaultValue: '[]',
              enumValues: null,
              enumDescriptions: null,
              scope: null,
              example: null,
              defaultNote: null,
            },
          ],
        }),
      },
      store: {
        loadExistingPages: async () => [],
        writeChangedPages: async () => {},
        deletePages: async () => {},
        loadSettingSchemaHash: async () => null,
        replaceSettingSchema: async (schema: unknown) => {
          replacedSchemas.push(schema);
        },
      },
      contentParser: {
        parseEnvVarsMd: () => markdownEntries,
        parsePublicEnvEntriesFromDocs: () => docsEntries,
        parseSettingsReferenceMd: () => [],
      },
    };

    await syncDocs(dependencies, { now: new Date('2026-08-16T00:00:00.000Z') });

    expect(replacedSchemas[0]).toMatchObject({ contentHash: 'schema-hash' });
    const savedEntries = (replacedSchemas[0] as { entries: { key: string }[] })
      .entries;
    expect(savedEntries.map(({ key }) => key)).toEqual(
      expect.arrayContaining([
        'permissions.allow',
        'CLAUDE_CODE_MD_ONLY',
        'CLAUDE_CODE_DOCS_ONLY',
      ]),
    );
    expect(savedEntries).toHaveLength(3);
  });

  it('ページ取得に失敗した時は設定スキーマを作り直さない', async () => {
    const replacedSchemas: unknown[] = [];
    const stablePage = {
      path: 'stable.md',
      title: 'Stable',
      url: 'https://example.com/stable.md',
      content: '# Stable\n\nold content',
      contentHash: 'stable-hash',
    };
    const failedPage = {
      path: 'failed.md',
      title: 'Failed',
      url: 'https://example.com/failed.md',
      content: '# Failed\n\nold content',
      contentHash: 'failed-hash',
    };
    const failingPaths = new Set<string>();
    const dependencies = {
      source: {
        fetchDocumentList: async () => [
          {
            path: stablePage.path,
            title: stablePage.title,
            url: stablePage.url,
          },
          {
            path: failedPage.path,
            title: failedPage.title,
            url: failedPage.url,
          },
        ],
        fetchPage: async (document: { path: string }) => {
          if (failingPaths.has(document.path)) {
            throw new Error('ページ取得失敗');
          }
          return document.path === stablePage.path ? stablePage : failedPage;
        },
        fetchSettingSchema: async () => ({
          contentHash: 'schema-hash',
          entries: [],
        }),
      },
      store: {
        loadExistingPages: async () => [
          { path: stablePage.path, contentHash: stablePage.contentHash },
          { path: failedPage.path, contentHash: failedPage.contentHash },
        ],
        writeChangedPages: async () => {},
        deletePages: async () => {},
        loadSettingSchemaHash: async () => 'schema-hash',
        replaceSettingSchema: async (schema: unknown) => {
          replacedSchemas.push(schema);
        },
      },
      contentParser: emptyContentParser,
    };

    await syncDocs(dependencies, {
      now: new Date('2026-08-16T00:00:00.000Z'),
    });
    failingPaths.add(failedPage.path);
    const result = await syncDocs(dependencies, {
      now: new Date('2026-08-16T03:00:00.000Z'),
    });

    expect(result.failedCount).toBe(1);
    expect(result.changedCount).toBe(0);
    expect(replacedSchemas).toHaveLength(0);
  });
});
