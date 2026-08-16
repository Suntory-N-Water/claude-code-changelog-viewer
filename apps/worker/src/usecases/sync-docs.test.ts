import { describe, expect, it } from 'vitest';
import { syncDocs } from './sync-docs';

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
            },
          ],
        }),
      },
      store: {
        loadExistingPages: async () => [],
        writeChangedPages: async (pages: readonly unknown[]) => {
          changedPages.push(...pages);
        },
        deletePages: async (paths: readonly string[]) => {
          deletedPaths.push([...paths]);
        },
        loadSettingSchemaHash: async () => null,
        replaceSettingSchema: async (schema: unknown) => {
          replacedSchemas.push(schema);
        },
      },
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
          },
        ],
      },
    ]);
  });
});
