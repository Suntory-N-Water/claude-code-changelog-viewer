import {
  cleanMarkdown,
  getLogger,
  toError,
} from '@claude-code-changelog-viewer/common';
import {
  chunkMarkdown,
  flattenSettingSchema,
  isSettingSchema,
  mergeDocumentLists,
  parseDocsMap,
  parseLlmsTxt,
  type DocumentInfo,
  type PageChunk,
} from './docs-sync-content';

const DOCS_MAP_URL = 'https://code.claude.com/docs/en/claude_code_docs_map.md';
const LLMS_URL = 'https://code.claude.com/docs/llms.txt';
const SCHEMA_URL = 'https://www.schemastore.org/claude-code-settings.json';
const USER_AGENT = 'changelog-viewer-worker-docs-sync';
const PAGE_BATCH_SIZE = 5;
const CHUNKS_PER_INSERT = 25;
const SETTINGS_PER_INSERT = 14;
const MAX_BATCH_STATEMENTS = 100;

const logger = getLogger({
  name: 'docs-search-sync',
  level: 'INFO',
  format: 'json',
});

type ExistingPage = {
  path: string;
  content_hash: string;
};

type StoredPage = DocumentInfo & {
  content: string;
  contentHash: string;
};

type PageFetchOutcome =
  | { page: StoredPage }
  | { document: DocumentInfo; error: Error };

type SettingSchemaMeta = {
  content_hash: string;
};

type PageChunkRow = PageChunk & {
  chunkIndex: number;
};

type DeleteResult = {
  deletedCount: number;
  skippedBySafetyGuard: boolean;
};

export async function syncDocs(
  bindings: CloudflareBindings,
  now = new Date(),
): Promise<void> {
  const documents = await fetchDocumentList();
  if (documents.length === 0) {
    logger.warn('ドキュメント一覧が空のため、D1 の変更をスキップしました');
    return;
  }

  const existingPages = await loadExistingPages(bindings.DOCS_DB);
  const outcomes = await fetchPages(documents);
  const existingHashes = new Map(
    existingPages.map((page) => [page.path, page.content_hash]),
  );
  const changedPages: StoredPage[] = [];
  let skippedCount = 0;
  let failedCount = 0;

  for (const outcome of outcomes) {
    if ('error' in outcome) {
      failedCount += 1;
      continue;
    }

    if (existingHashes.get(outcome.page.path) === outcome.page.contentHash) {
      skippedCount += 1;
      continue;
    }

    changedPages.push(outcome.page);
  }

  await writeChangedPages(bindings.DOCS_DB, changedPages, now);

  const expectedPaths = new Set(documents.map((document) => document.path));
  const deleteResult = await deleteStalePages(
    bindings.DOCS_DB,
    existingPages,
    expectedPaths,
  );
  const schemaUpdated = await syncSettingSchema(bindings.DOCS_DB, now);

  logger.info('ドキュメント同期が完了しました', {
    'fetch.successful': outcomes.length - failedCount,
    'fetch.failed': failedCount,
    'write.changed': changedPages.length,
    'write.skipped': skippedCount,
    'delete.count': deleteResult.deletedCount,
    'delete.skippedBySafetyGuard': deleteResult.skippedBySafetyGuard,
    'schema.updated': schemaUpdated,
  });
}

async function fetchDocumentList(): Promise<DocumentInfo[]> {
  const [docsMapContent, llmsContent] = await Promise.all([
    fetchText(DOCS_MAP_URL, 'text/markdown, text/plain, */*'),
    fetchText(LLMS_URL, 'text/markdown, text/plain, */*'),
  ]);

  return mergeDocumentLists(
    parseDocsMap(docsMapContent),
    parseLlmsTxt(llmsContent),
  );
}

async function fetchPages(
  documents: DocumentInfo[],
): Promise<PageFetchOutcome[]> {
  const outcomes: PageFetchOutcome[] = [];

  for (let index = 0; index < documents.length; index += PAGE_BATCH_SIZE) {
    const batch = documents.slice(index, index + PAGE_BATCH_SIZE);
    outcomes.push(...(await Promise.all(batch.map(fetchPage))));

    if (index + PAGE_BATCH_SIZE < documents.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return outcomes;
}

async function fetchPage(document: DocumentInfo): Promise<PageFetchOutcome> {
  try {
    const markdown = await fetchText(
      document.url,
      'text/markdown, text/plain, */*',
    );
    const content =
      `---\ntitle: ${document.title}\nsource: ${document.url}\n---\n\n` +
      (await cleanMarkdown(markdown));

    return {
      page: {
        ...document,
        content,
        contentHash: await sha256Hex(content),
      },
    };
  } catch (error) {
    const normalizedError = toError(error);
    logger.warn('ドキュメントの取得をスキップしました', {
      path: document.path,
      'exception.message': normalizedError.message,
    });
    return { document, error: normalizedError };
  }
}

async function fetchText(url: string, accept: string): Promise<string> {
  const maxRetries = 3;
  const retryDelayMs = 1000;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: accept,
          'User-Agent': USER_AGENT,
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.text();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }

      logger.warn('HTTP 取得を再試行します', {
        url,
        attempt: attempt + 1,
        maxRetries,
      });
      await new Promise((resolve) =>
        setTimeout(resolve, retryDelayMs * 2 ** attempt),
      );
    }
  }

  throw new Error(`HTTP 取得のリトライに失敗しました: ${url}`);
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function loadExistingPages(db: D1Database): Promise<ExistingPage[]> {
  const result = await db
    .prepare('SELECT path, content_hash FROM pages')
    .all<ExistingPage>();
  return result.results;
}

async function writeChangedPages(
  db: D1Database,
  pages: StoredPage[],
  now: Date,
): Promise<void> {
  const updatedAt = now.toISOString();
  const statementGroups = pages.map((page) => {
    const chunks = chunkMarkdown(page.content).map(
      (chunk, chunkIndex): PageChunkRow => ({ ...chunk, chunkIndex }),
    );
    const statements: D1PreparedStatement[] = [
      db
        .prepare(
          `INSERT INTO pages
             (path, title, source_url, content, content_hash, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(path) DO UPDATE SET
             title = excluded.title,
             source_url = excluded.source_url,
             content = excluded.content,
             content_hash = excluded.content_hash,
             updated_at = excluded.updated_at`,
        )
        .bind(
          page.path,
          page.title,
          page.url,
          page.content,
          page.contentHash,
          updatedAt,
        ),
      db.prepare('DELETE FROM page_chunks_fts WHERE path = ?').bind(page.path),
    ];

    for (const chunkRows of splitIntoChunks(chunks, CHUNKS_PER_INSERT)) {
      const placeholders = chunkRows.map(() => '(?, ?, ?, ?)').join(', ');
      const values = chunkRows.flatMap((chunk) => [
        chunk.text,
        page.path,
        chunk.heading,
        chunk.chunkIndex,
      ]);
      statements.push(
        db
          .prepare(
            `INSERT INTO page_chunks_fts
               (content, path, heading, chunk_index)
             VALUES ${placeholders}`,
          )
          .bind(...values),
      );
    }

    return statements;
  });

  await runBatchedStatements(db, statementGroups);
}

async function deleteStalePages(
  db: D1Database,
  existingPages: ExistingPage[],
  expectedPaths: Set<string>,
): Promise<DeleteResult> {
  const stalePaths = existingPages
    .map((page) => page.path)
    .filter((path) => !expectedPaths.has(path));
  if (stalePaths.length === 0) {
    return { deletedCount: 0, skippedBySafetyGuard: false };
  }

  if (expectedPaths.size < existingPages.length / 2) {
    logger.warn('ドキュメント一覧が急減したため削除をスキップしました', {
      'fetch.expected': expectedPaths.size,
      'db.existing': existingPages.length,
    });
    return { deletedCount: 0, skippedBySafetyGuard: true };
  }

  await runBatchedStatements(
    db,
    stalePaths.map((path) => [
      db.prepare('DELETE FROM page_chunks_fts WHERE path = ?').bind(path),
      db.prepare('DELETE FROM pages WHERE path = ?').bind(path),
    ]),
  );
  return { deletedCount: stalePaths.length, skippedBySafetyGuard: false };
}

async function syncSettingSchema(db: D1Database, now: Date): Promise<boolean> {
  const rawSchema = await fetchText(SCHEMA_URL, 'application/json, */*');
  const contentHash = await sha256Hex(rawSchema);
  const previous = await db
    .prepare('SELECT content_hash FROM setting_schema_meta WHERE id = 1')
    .first<SettingSchemaMeta>();
  if (previous?.content_hash === contentHash) {
    return false;
  }

  let schema: unknown;
  try {
    schema = JSON.parse(rawSchema) as unknown;
  } catch (error) {
    throw new Error(
      `設定スキーマの JSON パースに失敗しました: ${toError(error).message}`,
    );
  }

  if (!isSettingSchema(schema)) {
    throw new Error('設定スキーマの形式が不正です');
  }

  const entries = flattenSettingSchema(schema);
  const statements: D1PreparedStatement[] = [
    db.prepare('DELETE FROM setting_schema_entries'),
  ];
  for (const rows of splitIntoChunks(entries, SETTINGS_PER_INSERT)) {
    const placeholders = rows.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
    const values = rows.flatMap((entry) => [
      entry.key,
      entry.source,
      entry.description,
      entry.parentDescriptions,
      entry.valueType,
      entry.defaultValue,
      entry.enumValues,
    ]);
    statements.push(
      db
        .prepare(
          `INSERT INTO setting_schema_entries
             (key, source, description, parent_descriptions, value_type, default_value, enum_values)
           VALUES ${placeholders}`,
        )
        .bind(...values),
    );
  }
  statements.push(
    db
      .prepare(
        `INSERT INTO setting_schema_meta (id, content_hash, updated_at)
         VALUES (1, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           content_hash = excluded.content_hash,
           updated_at = excluded.updated_at`,
      )
      .bind(contentHash, now.toISOString()),
  );

  await db.batch(statements);
  return true;
}

async function runBatchedStatements(
  db: D1Database,
  statementGroups: D1PreparedStatement[][],
): Promise<void> {
  let currentBatch: D1PreparedStatement[] = [];

  for (const group of statementGroups) {
    if (
      currentBatch.length > 0 &&
      currentBatch.length + group.length > MAX_BATCH_STATEMENTS
    ) {
      await db.batch(currentBatch);
      currentBatch = [];
    }
    currentBatch.push(...group);
  }

  if (currentBatch.length > 0) {
    await db.batch(currentBatch);
  }
}

function splitIntoChunks<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
