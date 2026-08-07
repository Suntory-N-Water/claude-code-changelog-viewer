#!/usr/bin/env node

import * as path from 'node:path';
import { getLogger, toError } from '@claude-code-changelog-viewer/common';
import { ClaudeDocsFetcher } from './lib/doc-fetcher';
import { atomicWriteFile } from './lib/atomic-write';

const logger = getLogger({ name: 'docs-tracker' });

const MODELS_OVERVIEW_FETCH_URL =
  'https://platform.claude.com/docs/en/about-claude/models/overview.md';
const MODELS_OVERVIEW_SOURCE_URL =
  'https://platform.claude.com/docs/en/about-claude/models/overview';
const MODELS_OVERVIEW_LOCAL = path.join(
  process.cwd(),
  'docs',
  'en',
  'about-claude',
  'models',
  'overview.md',
);

async function fetchModelsOverview(): Promise<void> {
  logger.info('モデル一覧を取得しています', { url: MODELS_OVERVIEW_FETCH_URL });
  const response = await fetch(MODELS_OVERVIEW_FETCH_URL, {
    headers: {
      'User-Agent': 'Claude-Code-Changelog-Viewer/1.0',
      Accept: 'text/markdown, text/plain, */*',
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const content = await response.text();
  await atomicWriteFile(
    MODELS_OVERVIEW_LOCAL,
    `---\ntitle: Models overview\nsource: ${MODELS_OVERVIEW_SOURCE_URL}\n---\n\n${content}`,
  );
  logger.info('モデル一覧を保存しました', { path: MODELS_OVERVIEW_LOCAL });
}

/**
 * Main entry point for fetching Claude Code documentation
 */
async function main() {
  logger.msg('APLG0001', { params: ['Claude Code Documentation Tracker'] });

  const startTime = Date.now();

  try {
    const enFetcher = new ClaudeDocsFetcher(process.cwd());
    await enFetcher.fetchAllDocs();

    await fetchModelsOverview();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.msg('APLG0002', {
      params: ['処理'],
      attrs: { 'elapsed.seconds': elapsed },
    });

    process.exit(0);
  } catch (error) {
    logger.msg('APLG0018', { error: toError(error) });
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    logger.msg('APLG0019', { error: toError(error) });
    process.exit(1);
  });
}

export { main };
