#!/usr/bin/env node
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLogger } from '@claude-code-changelog-viewer/common';
import { GeminiClient } from './infrastructure/ai/gemini-client';
import { buildIssuesEmbeddings } from './usecase/build-issues-embeddings';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = join(__dirname, '..');
const CORPUS_DIR = join(APP_DIR, 'issues-corpus');
const EMBEDDINGS_PATH = join(APP_DIR, 'issues-embeddings', 'embeddings.jsonl');

const log = getLogger({ name: 'build-issues-embeddings' });

const apiKey = process.env['GEMINI_API_KEY'];
if (!apiKey) {
  log.error('GEMINI_API_KEY が設定されていません');
  process.exit(1);
}

const gemini = new GeminiClient(apiKey, log);

try {
  const result = await buildIssuesEmbeddings({
    corpusDir: CORPUS_DIR,
    embeddingsPath: EMBEDDINGS_PATH,
    embeddings: gemini,
    logger: log,
  });
  log.info(
    `完了: embedded=${result.embedded} skipped=${result.skipped} total=${result.total}`,
  );
} catch (error) {
  log.error('build-issues-embeddings 失敗', { error });
  process.exit(1);
}
