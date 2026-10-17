import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { sql } from 'drizzle-orm';
import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import { getLogger } from '@claude-code-changelog-viewer/common';
import { searchDocsForChangelogEntry } from '../src/infrastructure/docs-search';
import { FakeDocsD1Database } from '../src/test-support/fake-d1';

const execFileAsync = promisify(execFile);
const logger = getLogger({ name: 'docs-search-evaluation' });
const workerDirectory = fileURLToPath(new URL('..', import.meta.url));
const groundTruthPath = fileURLToPath(
  new URL('../docs-search/evaluation/changelog-relevance.json', import.meta.url),
);
// wrangler d1 execute の 1 回の応答が大きすぎると失敗するため、チャンクを分けて取得する
const DUMP_PAGE_SIZE = 1500;

type GroundTruthItem = {
  version: string;
  id: string;
  content: string;
  relevantFiles: string[];
  // 旧 Python 版 (MIN_FILE_SCORE=25) が当時保存した関連ファイル。比較の基準に使う
  legacyFiles: string[];
};

type ChunkRow = {
  path: string;
  heading: string;
  chunk_index: number;
  content: string;
};

async function queryRemote(query: string): Promise<ChunkRow[]> {
  const result = await execFileAsync(
    'pnpm',
    [
      'exec',
      'wrangler',
      'd1',
      'execute',
      'docs-search-db',
      '--remote',
      '--command',
      query,
      '--json',
    ],
    { cwd: workerDirectory, maxBuffer: 64 * 1024 * 1024 },
  );
  const [first] = JSON.parse(String(result.stdout)) as { results: ChunkRow[] }[];
  if (first === undefined) {
    throw new Error('D1 の結果を解釈できません');
  }
  return first.results;
}

// Node.js からは本番 D1 の binding を取得できないため、全チャンクを複製した手元の FTS5 で検索する。
// tokenizer は同じマイグレーションから作るので、スコアは本番と一致する
async function loadProductionChunks(): Promise<DrizzleD1Database> {
  const db = drizzle(new FakeDocsD1Database());
  for (let offset = 0; ; offset += DUMP_PAGE_SIZE) {
    const rows = await queryRemote(
      `SELECT path, heading, chunk_index, content FROM page_chunks_fts ORDER BY rowid LIMIT ${DUMP_PAGE_SIZE} OFFSET ${offset}`,
    );
    for (const row of rows) {
      await db.run(sql`
        INSERT INTO page_chunks_fts (content, path, heading, chunk_index)
        VALUES (${row.content}, ${row.path}, ${row.heading}, ${row.chunk_index})
      `);
    }
    if (rows.length < DUMP_PAGE_SIZE) {
      return db;
    }
  }
}

function measure(items: GroundTruthItem[], returnedFiles: string[][]) {
  let returned = 0;
  let relevantReturned = 0;
  let correctJudgements = 0;
  for (const [index, item] of items.entries()) {
    const files = returnedFiles[index] ?? [];
    const relevant = new Set(item.relevantFiles);
    returned += files.length;
    relevantReturned += files.filter((file) => relevant.has(file)).length;
    if (files.length > 0 === relevant.size > 0) {
      correctJudgements += 1;
    }
  }
  return {
    precision: Number((relevantReturned / returned).toFixed(3)),
    relevantReturned,
    returned,
    judgementAccuracy: Number((correctJudgements / items.length).toFixed(3)),
  };
}

async function evaluate() {
  const items = JSON.parse(await readFile(groundTruthPath, 'utf8')) as GroundTruthItem[];
  logger.info('本番 DOCS_DB のチャンクを取得しています');
  const db = await loadProductionChunks();

  const currentFiles: string[][] = [];
  for (const item of items) {
    const docs = await searchDocsForChangelogEntry(db, item.content);
    currentFiles.push(docs.map((doc) => doc.file));
  }

  logger.info('ドキュメント検索の評価結果', {
    items: items.length,
    legacy: measure(
      items,
      items.map((item) => item.legacyFiles),
    ),
    current: measure(items, currentFiles),
  });
}

try {
  await evaluate();
} catch (error) {
  logger.error(
    'ドキュメント検索の評価に失敗しました',
    error instanceof Error ? error : new Error(String(error)),
  );
  process.exitCode = 1;
}
