import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import { afterEach, describe, expect, it } from 'vitest';
import {
  searchDocsForChangelogEntry,
  searchDocsForSettingKey,
} from './docs-search';
import { FakeDocsD1Database } from '../test-support/fake-d1';

type ChunkInput = {
  path: string;
  heading?: string;
  content: string;
};

type SeededDb = DrizzleD1Database & { close: () => void };

describe('ドキュメント検索 (FTS5)', () => {
  let db: SeededDb | null = null;

  afterEach(() => {
    db?.close();
    db = null;
  });

  it('バッククォート囲みが当たったとき、BM25 の結果を混ぜないこと', async () => {
    db = await seed([
      {
        path: 'settings.md',
        content: 'Set `additionalDirectories` to grant extra access.',
      },
      {
        path: 'iam.md',
        content: 'The additionalDirectories option lists extra paths.',
      },
    ]);

    await expect(
      searchDocsForSettingKey(db, 'additionalDirectories'),
    ).resolves.toEqual([
      {
        file: 'settings.md',
        snippets: ['Set `additionalDirectories` to grant extra access.'],
        hitCount: 1,
      },
    ]);
  });

  it('バッククォート囲みが0件のとき、BM25 の結果を返すこと', async () => {
    db = await seed([
      { path: 'overview.md', content: 'Choose the model used for responses.' },
      { path: 'unrelated.md', content: 'Hooks run shell commands.' },
    ]);

    await expect(searchDocsForSettingKey(db, 'model')).resolves.toEqual([
      {
        file: 'overview.md',
        snippets: ['Choose the model used for responses.'],
        hitCount: 1,
      },
    ]);
  });

  it('バッククォート囲みが複数ファイルに当たったとき、BM25 の良い順に並べること', async () => {
    db = await seed([
      {
        path: 'z-settings.md',
        content:
          'Set `additionalDirectories` to grant access. `additionalDirectories` accepts globs.',
      },
      {
        path: 'a-reference.md',
        content: `Type definitions. ${'Unrelated interface field documentation. '.repeat(40)}One field is \`additionalDirectories\`.`,
      },
    ]);

    const results = await searchDocsForSettingKey(db, 'additionalDirectories');

    expect(results.map((result) => result.file)).toEqual([
      'z-settings.md',
      'a-reference.md',
    ]);
  });

  it('どちらも0件のとき、空を返すこと', async () => {
    db = await seed([
      { path: 'guide.md', content: 'Hooks run shell commands.' },
    ]);

    await expect(searchDocsForSettingKey(db, 'zzzUnknownKey')).resolves.toEqual(
      [],
    );
  });

  it('検索語が空白だけのとき、空を返すこと', async () => {
    db = await seed([
      { path: 'guide.md', content: 'Hooks run shell commands.' },
    ]);

    await expect(searchDocsForChangelogEntry(db, '   ')).resolves.toEqual([]);
  });

  it.each([
    { term: 'AND OR NOT NEAR permission', expected: ['guide.md'] },
    { term: '- Fixed: `--append-system-prompt` (see #1234)', expected: [] },
    { term: 'a "quoted phrase that never closes', expected: [] },
    { term: '^*()', expected: [] },
  ])(
    '記号や予約語を含む検索語 $term を、演算子として解釈せず語として扱うこと',
    async ({ term, expected }) => {
      db = await seed([
        { path: 'guide.md', content: 'Permission rules use allow and deny.' },
      ]);

      const results = await searchDocsForChangelogEntry(db, term);

      expect(results.map((result) => result.file)).toEqual(expected);
    },
  );

  it('CHANGELOG の入口ではバッククォート囲みを優先しないこと', async () => {
    db = await seed([
      {
        path: 'settings.md',
        content: 'Set `additionalDirectories` to grant extra access.',
      },
      {
        path: 'iam.md',
        content:
          'The additionalDirectories option lists extra directories, and additionalDirectories accepts globs.',
      },
    ]);

    const results = await searchDocsForChangelogEntry(
      db,
      'additionalDirectories',
    );

    expect(results.map((result) => result.file)).toEqual([
      'iam.md',
      'settings.md',
    ]);
  });

  it('ファイルは上位3件、ファイルごとに上位3チャンクに絞ること', async () => {
    db = await seed(
      Array.from({ length: 4 }, (_, fileIndex) =>
        Array.from({ length: 4 }, (_, chunkIndex) => ({
          path: `doc-${fileIndex}.md`,
          content: `hook ${'hook '.repeat(fileIndex)}chunk ${chunkIndex}`,
        })),
      ).flat(),
    );

    const results = await searchDocsForChangelogEntry(db, 'hook');

    expect(results.map((result) => result.file)).toEqual([
      'doc-3.md',
      'doc-2.md',
      'doc-1.md',
    ]);
    expect(results.map((result) => result.snippets.length)).toEqual([3, 3, 3]);
    expect(results.map((result) => result.hitCount)).toEqual([4, 4, 4]);
  });

  it('段落が4つ以上のチャンクを、先頭2段落と検索語が最も多い段落に絞ること', async () => {
    db = await seed([
      {
        path: 'settings.md',
        content: [
          '# Configuration reference',
          'This page lists every available option.',
          'Themes control the color scheme of the terminal.',
          'Notification hooks fire on permission prompts. Configure hooks in settings.',
          'The status line shows the current model.',
        ].join('\n\n'),
      },
    ]);

    await expect(
      searchDocsForChangelogEntry(db, 'Fixed Notification hooks'),
    ).resolves.toEqual([
      {
        file: 'settings.md',
        snippets: [
          [
            '# Configuration reference',
            'This page lists every available option.',
            'Notification hooks fire on permission prompts. Configure hooks in settings.',
          ].join('\n\n'),
        ],
        hitCount: 1,
      },
    ]);
  });

  it('長いスニペットを4000文字以内の改行境界で切り詰めること', async () => {
    const content = [
      '# Configuration reference',
      '',
      '| Name | Description |',
      '| --- | --- |',
      ...Array.from(
        { length: 300 },
        (_, index) => `| option${index} | Configure option ${index}. |`,
      ),
    ].join('\n');
    db = await seed([{ path: 'settings.md', content }]);

    const [result] = await searchDocsForChangelogEntry(db, 'option');

    expect(result?.snippets[0]?.length).toBeLessThanOrEqual(4000);
    expect(result?.snippets[0]).toContain('# Configuration reference');
    expect(result?.snippets[0]).toMatch(
      /\| option\d+ \| Configure option \d+\. \|$/,
    );
  });

  it('同義語の片方だけを含む検索語で、もう片方しか書かれていないドキュメントを拾うこと', async () => {
    db = await seed([
      { path: 'conversation.md', content: 'Resume a previous conversation.' },
      { path: 'unrelated.md', content: 'Set the output style.' },
    ]);

    await expect(
      searchDocsForChangelogEntry(db, 'Fixed session resume'),
    ).resolves.toMatchObject([{ file: 'conversation.md' }]);
  });
});

async function seed(chunks: ChunkInput[]): Promise<SeededDb> {
  const rawDb = new FakeDocsD1Database();
  const chunkIndexes = new Map<string, number>();

  for (const chunk of chunks) {
    const chunkIndex = chunkIndexes.get(chunk.path) ?? 0;
    chunkIndexes.set(chunk.path, chunkIndex + 1);
    await rawDb
      .prepare(
        'INSERT INTO page_chunks_fts (content, path, heading, chunk_index) VALUES (?, ?, ?, ?)',
      )
      .bind(chunk.content, chunk.path, chunk.heading ?? '', chunkIndex)
      .run();
  }

  const db = drizzle(rawDb as unknown as D1Database) as unknown as SeededDb;
  db.close = () => rawDb.close();
  return db;
}
