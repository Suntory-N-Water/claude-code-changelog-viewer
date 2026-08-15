import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { syncDocs } from './docs-sync';
import { FakeDocsD1Database } from '../test-support/fake-d1';

const DOCS_MAP_URL = 'https://code.claude.com/docs/en/claude_code_docs_map.md';
const LLMS_URL = 'https://code.claude.com/docs/llms.txt';
const SCHEMA_URL = 'https://www.schemastore.org/claude-code-settings.json';
const DOCS_BASE_URL = 'https://code.claude.com/docs/en/';

type TestDocument = {
  path: string;
  title: string;
  content: string;
};

type RemoteState = {
  documents: TestDocument[];
  schema?: string;
  failingPaths?: Set<string>;
  listFailure?: boolean;
};

describe('ドキュメント検索用 D1 同期 cron', () => {
  let db: FakeDocsD1Database | null = null;

  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    db?.close();
    db = null;
  });

  it('公式ドキュメントと設定スキーマを D1 に保存し、FTS5 を同期すること', async () => {
    db = new FakeDocsD1Database();
    const document = testDocument(
      'guide.md',
      'Guide',
      '# Guide\n\nHooks are useful.',
    );
    mockRemote({ documents: [document] });

    await syncDocs(testEnv(db), new Date('2026-08-16T00:00:00.000Z'));

    await expect(
      db
        .prepare(
          'SELECT title, source_url, content_hash FROM pages WHERE path = ?',
        )
        .bind('guide.md')
        .first(),
    ).resolves.toMatchObject({
      title: 'Guide',
      source_url: `${DOCS_BASE_URL}guide.md`,
    });
    await expect(
      db
        .prepare(
          'SELECT content, path, heading, chunk_index FROM page_chunks_fts WHERE page_chunks_fts MATCH ?',
        )
        .bind('hook')
        .all(),
    ).resolves.toMatchObject({
      results: [
        {
          content: expect.stringContaining('Hooks are useful.'),
          path: 'guide.md',
          heading: 'Guide',
          chunk_index: 1,
        },
      ],
    });
    await expect(
      db
        .prepare(
          'SELECT key, source, description, parent_descriptions, value_type, default_value, enum_values FROM setting_schema_entries',
        )
        .all(),
    ).resolves.toMatchObject({
      results: [
        {
          key: 'permissions.allow',
          source: 'settings',
          description: 'Allowed tools',
          parent_descriptions: '["Permission settings"]',
          value_type: 'array',
          default_value: '[]',
          enum_values: '["Read","Write"]',
        },
        {
          key: 'CLAUDE_CODE_TEST',
          source: 'env',
          value_type: 'string',
        },
      ],
    });
    await expect(
      db
        .prepare('SELECT content_hash FROM setting_schema_meta WHERE id = 1')
        .first(),
    ).resolves.toMatchObject({ content_hash: expect.any(String) });
  });

  it('内容ハッシュが一致するページを書き込まないこと', async () => {
    db = new FakeDocsD1Database();
    const document = testDocument('guide.md', 'Guide', '# Guide\n\n本文');
    mockRemote({ documents: [document] });
    const env = testEnv(db);

    await syncDocs(env, new Date('2026-08-16T00:00:00.000Z'));
    const before = await db
      .prepare('SELECT updated_at FROM pages WHERE path = ?')
      .bind('guide.md')
      .first<{ updated_at: string }>();

    await syncDocs(env, new Date('2026-08-16T03:00:00.000Z'));

    await expect(
      db
        .prepare('SELECT updated_at FROM pages WHERE path = ?')
        .bind('guide.md')
        .first(),
    ).resolves.toEqual(before);
  });

  it('変更ページの FTS5 チャンクを置き換えること', async () => {
    db = new FakeDocsD1Database();
    const document = testDocument('guide.md', 'Guide', '# Guide\n\nold hooks');
    mockRemote({ documents: [document] });
    const env = testEnv(db);

    await syncDocs(env);
    mockRemote({
      documents: [{ ...document, content: '# Guide\n\nnew permissions' }],
    });

    await syncDocs(env);

    await expect(
      db
        .prepare('SELECT content FROM page_chunks_fts ORDER BY chunk_index')
        .all(),
    ).resolves.toMatchObject({
      results: expect.arrayContaining([
        { content: expect.stringContaining('new permissions') },
      ]),
    });
    await expect(
      db
        .prepare(
          'SELECT content FROM page_chunks_fts WHERE page_chunks_fts MATCH ?',
        )
        .bind('old')
        .all(),
    ).resolves.toMatchObject({ results: [] });
  });

  it('一部ページの取得に失敗しても他のページを同期し、失敗ページを保持すること', async () => {
    db = new FakeDocsD1Database();
    const stable = testDocument(
      'stable.md',
      'Stable',
      '# Stable\n\nold content',
    );
    const failed = testDocument(
      'failed.md',
      'Failed',
      '# Failed\n\nold content',
    );
    const env = testEnv(db);
    mockRemote({ documents: [stable, failed] });
    await syncDocs(env);

    mockRemote({
      documents: [{ ...stable, content: '# Stable\n\nnew content' }, failed],
      failingPaths: new Set(['failed.md']),
    });
    vi.useFakeTimers();
    const syncPromise = syncDocs(env);
    await vi.runAllTimersAsync();
    await syncPromise;

    await expect(
      db
        .prepare('SELECT content FROM pages WHERE path = ?')
        .bind('stable.md')
        .first(),
    ).resolves.toMatchObject({
      content: expect.stringContaining('new content'),
    });
    await expect(
      db
        .prepare('SELECT content FROM pages WHERE path = ?')
        .bind('failed.md')
        .first(),
    ).resolves.toMatchObject({
      content: expect.stringContaining('old content'),
    });
  });

  it('一覧が前回の 50% 未満に減った時は削除せず、十分な一覧なら削除すること', async () => {
    db = new FakeDocsD1Database();
    const documents: [TestDocument, TestDocument, TestDocument] = [
      testDocument('one.md', 'One', '# One\n\none'),
      testDocument('two.md', 'Two', '# Two\n\ntwo'),
      testDocument('three.md', 'Three', '# Three\n\nthree'),
    ];
    const env = testEnv(db);
    mockRemote({ documents });
    await syncDocs(env);

    const one = documents[0];
    const two = documents[1];

    mockRemote({ documents: [one] });
    await syncDocs(env);
    await expect(
      db.prepare('SELECT COUNT(*) AS count FROM pages').first(),
    ).resolves.toEqual({
      count: 3,
    });

    mockRemote({ documents: [one, two] });
    await syncDocs(env);
    await expect(
      db.prepare('SELECT COUNT(*) AS count FROM pages').first(),
    ).resolves.toEqual({
      count: 2,
    });
    await expect(
      db
        .prepare(
          'SELECT path FROM page_chunks_fts WHERE page_chunks_fts MATCH ?',
        )
        .bind('three')
        .all(),
    ).resolves.toMatchObject({ results: [] });
  });

  it('ドキュメント一覧の取得に失敗した時は D1 を変更しないこと', async () => {
    db = new FakeDocsD1Database();
    const document = testDocument('guide.md', 'Guide', '# Guide\n\n本文');
    const env = testEnv(db);
    mockRemote({ documents: [document] });
    await syncDocs(env);
    const before = await db
      .prepare('SELECT path, content_hash, updated_at FROM pages')
      .all();

    mockRemote({ documents: [document], listFailure: true });
    vi.useFakeTimers();
    const rejection = expect(syncDocs(env)).rejects.toThrow('HTTP 500');
    await vi.runAllTimersAsync();
    await rejection;

    await expect(
      db.prepare('SELECT path, content_hash, updated_at FROM pages').all(),
    ).resolves.toEqual(before);
  });
});

function testEnv(db: FakeDocsD1Database): CloudflareBindings {
  return { DOCS_DB: db } as unknown as CloudflareBindings;
}

function testDocument(
  path: string,
  title: string,
  content: string,
): TestDocument {
  return { path, title, content };
}

function mockRemote(state: RemoteState): void {
  const schema =
    state.schema ??
    JSON.stringify({
      properties: {
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
  const byUrl = new Map(
    state.documents.map((document) => [
      `${DOCS_BASE_URL}${document.path}`,
      document,
    ]),
  );
  const docsMap = state.documents
    .map((document) => `[${document.title}](${DOCS_BASE_URL}${document.path})`)
    .join('\n');
  const llms = state.documents
    .map((document) => `${DOCS_BASE_URL}${document.path}`)
    .join('\n');

  vi.mocked(globalThis.fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url === DOCS_MAP_URL || url === LLMS_URL) {
      if (state.listFailure) {
        return new Response('list failure', { status: 500 });
      }
      return new Response(url === DOCS_MAP_URL ? docsMap : llms);
    }
    if (url === SCHEMA_URL) {
      return new Response(schema);
    }

    const document = byUrl.get(url);
    if (document === undefined) {
      throw new Error(`想定外の URL: ${url}`);
    }
    if (state.failingPaths?.has(document.path)) {
      return new Response('page failure', { status: 500 });
    }
    return new Response(document.content);
  });
}
