import { describe, expect, it } from 'vitest';
import {
  buildSettingsReferenceInput,
  loadSettingsReferenceEntries,
  saveSettingsReferences,
} from './settings-reference';

describe('設定リファレンス生成ユースケース', () => {
  it('targetKeys を指定しない時、未生成の設定項目だけを返すこと', async () => {
    const source = {
      loadEntries: async () => [
        {
          key: 'already.generated',
          source: 'settings' as const,
          descriptionEn: 'Already generated',
          parentDescriptions: [],
        },
        {
          key: 'not.generated',
          source: 'settings' as const,
          descriptionEn: 'Not generated',
          parentDescriptions: [],
        },
      ],
      loadExistingKeys: async () => new Set(['already.generated']),
      findRelatedChangelogs: async () => [],
    };

    const result = await loadSettingsReferenceEntries(source, {});

    expect(result).toEqual([
      {
        key: 'not.generated',
        source: 'settings',
        descriptionEn: 'Not generated',
        parentDescriptions: [],
      },
    ]);
  });

  it('targetKeys を指定した時、生成済みの設定項目も対象に含めること', async () => {
    const source = {
      loadEntries: async () => [
        {
          key: 'already.generated',
          source: 'settings' as const,
          descriptionEn: 'Already generated',
          parentDescriptions: [],
        },
      ],
      loadExistingKeys: async () => new Set(['already.generated']),
      findRelatedChangelogs: async () => [],
    };

    const result = await loadSettingsReferenceEntries(source, {
      targetKeys: ['already.generated'],
    });

    expect(result).toEqual([
      {
        key: 'already.generated',
        source: 'settings',
        descriptionEn: 'Already generated',
        parentDescriptions: [],
      },
    ]);
  });

  it('env-vars.md を除外し、ドキュメント抜粋を8000文字と更新履歴を5件までに制限すること', async () => {
    const input = await buildSettingsReferenceInput(
      {
        searchSettingKey: async () => [
          { file: 'env-vars.md', snippets: ['重複する説明'] },
          { file: 'guide.md', snippets: ['A'.repeat(7999), 'ignored'] },
          { file: 'reference.md', snippets: ['次のファイル'] },
        ],
      },
      {
        loadEntries: async () => [],
        loadExistingKeys: async () => new Set(),
        findRelatedChangelogs: async () =>
          Array.from({ length: 6 }, (_, index) => ({
            version: `2.1.${6 - index}`,
          })),
      },
      [
        {
          key: 'CLAUDE_CODE_TEST',
          source: 'env',
          descriptionEn: 'Test environment variable',
          parentDescriptions: [],
        },
      ],
    );

    expect(input.entries[0]).toMatchObject({
      id: 0,
      officialDocs: ['guide.md', 'reference.md'],
      relatedChangelog: [
        { version: '2.1.6' },
        { version: '2.1.5' },
        { version: '2.1.4' },
        { version: '2.1.3' },
        { version: '2.1.2' },
      ],
    });
    expect(input.entries[0]?.docSnippets.join('')).toHaveLength(8000);
    expect(input.entries[0]?.docSnippets.at(-1)).toBe('i');
  });

  it('翻訳がない項目を保存対象から除外し、空の用途解説を null に変換すること', async () => {
    const saved: unknown[] = [];
    const result = await saveSettingsReferences(
      {
        save: async (input) => {
          saved.push(input);
        },
      },
      {
        input: {
          entries: [
            {
              id: 0,
              key: 'CLAUDE_CODE_TEST',
              source: 'env',
              descriptionEn: 'Test environment variable',
              parentDescriptions: [],
              docSnippets: [],
              officialDocs: ['guide.md'],
              relatedChangelog: [],
            },
            {
              id: 1,
              key: 'unused',
              source: 'settings',
              descriptionEn: 'Unused setting',
              parentDescriptions: [],
              docSnippets: [],
              officialDocs: [],
              relatedChangelog: [],
            },
          ],
        },
        translations: [
          { id: 0, descriptionJa: 'テスト用の環境変数です。', useCaseJa: '' },
        ],
        fetchedAt: '2026-08-17',
      },
    );

    expect(result).toEqual({ count: 1 });
    expect(saved).toEqual([
      {
        records: [
          {
            key: 'CLAUDE_CODE_TEST',
            leafName: 'CLAUDE_CODE_TEST',
            slug: 'claude-code-test',
            source: 'env',
            descriptionEn: 'Test environment variable',
            descriptionJa: 'テスト用の環境変数です。',
            useCaseJa: null,
            fetchedAt: '2026-08-17',
            officialDocs: ['guide.md'],
          },
        ],
      },
    ]);
  });
});
