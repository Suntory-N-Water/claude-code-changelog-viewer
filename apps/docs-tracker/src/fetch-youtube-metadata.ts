#!/usr/bin/env node

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { getLogger, toError } from '@claude-code-changelog-viewer/common';
import { YoutubeMetadataFetcher } from './lib/youtube/metadata-fetcher';

const logger = getLogger({ name: 'docs-tracker' });

function parseOutPath(argv: string[]): string {
  const outIndex = argv.indexOf('--out');
  if (outIndex === -1) {
    throw new Error('--out 引数が必要です');
  }

  const outPath = argv[outIndex + 1];
  if (!outPath) {
    throw new Error('--out の値が不足しています');
  }

  return outPath;
}

async function main() {
  const outPath = parseOutPath(process.argv.slice(2));
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  const fetcher = new YoutubeMetadataFetcher(process.cwd());
  const result = await fetcher.fetch();
  await fs.writeFile(
    outPath,
    JSON.stringify(result.newVideoIds, null, 2),
    'utf-8',
  );
  logger.info('新規 YouTube 動画 ID を書き出しました', {
    'file.path': outPath,
    'youtube.newCount': result.newVideoIds.length,
  });
}

void main().catch((error) => {
  logger.error('fetch-youtube-metadata の実行に失敗しました', toError(error));
  process.exit(1);
});
