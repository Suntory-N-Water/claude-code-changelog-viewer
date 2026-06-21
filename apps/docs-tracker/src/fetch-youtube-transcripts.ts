#!/usr/bin/env node

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { getLogger, toError } from '@claude-code-changelog-viewer/common';
import { z } from 'zod';
import { atomicWriteFile } from './lib/atomic-write';
import {
  parseSourceFrontmatter,
  serializeSourceDocument,
  type SourceFrontmatter,
} from './lib/source-frontmatter';
import { YoutubeTranscriptScraper } from './lib/youtube/transcript-scraper';

const logger = getLogger({ name: 'docs-tracker' });
const videoIdsFileSchema = z.array(z.string());

function parseVideoIdsFile(argv: string[]): string {
  const flagIndex = argv.indexOf('--video-ids-file');
  if (flagIndex === -1) {
    throw new Error('--video-ids-file 引数が必要です');
  }

  const filePath = argv[flagIndex + 1];
  if (!filePath) {
    throw new Error('--video-ids-file の値が不足しています');
  }

  return filePath;
}

async function main() {
  const videoIdsPath = parseVideoIdsFile(process.argv.slice(2));
  const sourceDir = path.join(process.cwd(), 'sources', 'youtube');
  await fs.mkdir(sourceDir, { recursive: true });

  const existingByVideoId = new Map<
    string,
    {
      filePath: string;
      frontmatter: Extract<SourceFrontmatter, { source: 'youtube' }>;
    }
  >();

  for (const entry of await fs.readdir(sourceDir)) {
    if (!entry.endsWith('.md')) {
      continue;
    }

    const filePath = path.join(sourceDir, entry);
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = parseSourceFrontmatter(content);
    if (!parsed.success) {
      logger.warn('YouTube frontmatter の読み込みをスキップしました', {
        'file.path': filePath,
        'exception.message': parsed.error,
      });
      continue;
    }
    if (parsed.data.source !== 'youtube') {
      continue;
    }

    existingByVideoId.set(parsed.data.video_id, {
      filePath,
      frontmatter: parsed.data,
    });
  }

  const rawVideoIds = videoIdsFileSchema.parse(
    JSON.parse(await fs.readFile(videoIdsPath, 'utf-8')),
  );
  const videoIds = [...new Set(rawVideoIds)];
  if (videoIds.length === 0) {
    logger.info('対象の新規 YouTube 動画はありません');
    return;
  }

  const scraper = new YoutubeTranscriptScraper();
  const transcripts = await scraper.fetch(videoIds);

  let successCount = 0;
  let failedCount = 0;
  for (const videoId of videoIds) {
    const transcript = transcripts.get(videoId);
    if (!transcript) {
      failedCount += 1;
      continue;
    }

    const current = existingByVideoId.get(videoId);
    if (!current) {
      logger.warn(
        '既存の YouTube markdown が見つからないためスキップしました',
        {
          'youtube.videoId': videoId,
        },
      );
      failedCount += 1;
      continue;
    }

    const nextFrontmatter: SourceFrontmatter = {
      ...current.frontmatter,
      has_transcript: true,
      content_hash: createHash('sha256').update(transcript).digest('hex'),
    };
    await atomicWriteFile(
      current.filePath,
      serializeSourceDocument(nextFrontmatter, transcript),
    );

    successCount += 1;
    logger.info('YouTube transcript を保存しました', {
      'youtube.videoId': videoId,
      'file.path': current.filePath,
    });
  }

  logger.info('YouTube transcript の取得を完了しました', {
    'youtube.successCount': successCount,
    'youtube.failedCount': failedCount,
  });

  // 全件失敗は noteey.com の DOM 変更・障害を示唆するため failure Issue を発火させる
  if (successCount === 0 && failedCount > 0) {
    throw new Error(
      `YouTube transcript が ${failedCount} 件すべて取得できませんでした`,
    );
  }
}

void main().catch((error) => {
  logger.error(
    'fetch-youtube-transcripts の実行に失敗しました',
    toError(error),
  );
  process.exit(1);
});
