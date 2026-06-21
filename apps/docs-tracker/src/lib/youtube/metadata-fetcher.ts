import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import {
  getLogger,
  type AppLogger,
} from '@claude-code-changelog-viewer/common';
import { z } from 'zod';
import { atomicWriteFile } from '../atomic-write';
import { fetchWithRetry } from '../fetch-with-retry';
import {
  loadSourceFrontmatters,
  serializeSourceDocument,
  type SourceFrontmatter,
} from '../source-frontmatter';

type YoutubeMetadataResult = {
  source: 'youtube';
  newVideoIds: string[];
};

const CHANNEL_ID = 'UCrDwWp7EBBv4NwvScIpBDOA';

const youtubeSearchItemSchema = z.object({
  id: z
    .object({
      videoId: z.string().optional(),
    })
    .optional(),
  snippet: z
    .object({
      publishedAt: z.string().optional(),
      title: z.string().optional(),
    })
    .optional(),
});

const youtubeSearchResponseSchema = z.object({
  items: z.array(youtubeSearchItemSchema).optional(),
  nextPageToken: z.string().optional(),
});

const youtubeVideoItemSchema = z.object({
  id: z.string().optional(),
  contentDetails: z
    .object({
      duration: z.string().optional(),
    })
    .optional(),
  snippet: z
    .object({
      channelId: z.string().optional(),
    })
    .optional(),
});

const youtubeVideosResponseSchema = z.object({
  items: z.array(youtubeVideoItemSchema).optional(),
});

type YoutubeApiSearchItem = z.infer<typeof youtubeSearchItemSchema>;
type YoutubeApiVideoItem = z.infer<typeof youtubeVideoItemSchema>;

export class YoutubeMetadataFetcher {
  private readonly log: AppLogger;
  private readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
    this.log = getLogger({ name: 'docs-tracker' }).child({
      component: 'YoutubeMetadataFetcher',
    });
  }

  async fetch(): Promise<YoutubeMetadataResult> {
    const apiKey = process.env['YOUTUBE_API_KEY'];
    if (!apiKey) {
      throw new Error('YOUTUBE_API_KEY が設定されていません');
    }

    const sourceDir = path.join(this.rootDir, 'sources', 'youtube');
    await fs.mkdir(sourceDir, { recursive: true });

    const existingRecords = await loadSourceFrontmatters(sourceDir);
    const knownUrls = new Set(existingRecords.map((record) => record.url));

    const searchItems = await this.fetchAllSearchItems(apiKey, knownUrls);
    const newSearchItems = searchItems.filter((item) => {
      const videoId = item.id?.videoId;
      if (!videoId) {
        return false;
      }
      return !knownUrls.has(`https://www.youtube.com/watch?v=${videoId}`);
    });
    const detailMap = await this.fetchVideoDetails(
      newSearchItems
        .map((item) => item.id?.videoId)
        .filter((videoId): videoId is string => Boolean(videoId)),
      apiKey,
    );

    const newVideoIds: string[] = [];

    for (const item of newSearchItems) {
      const videoId = item.id?.videoId;
      const publishedAt = item.snippet?.publishedAt;
      const title = item.snippet?.title;

      if (!videoId || !publishedAt || !title) {
        continue;
      }

      const url = `https://www.youtube.com/watch?v=${videoId}`;

      const detail = detailMap.get(videoId);
      if (!detail?.contentDetails?.duration || !detail.snippet?.channelId) {
        this.log.warn('動画詳細が不足しているためスキップしました', {
          'youtube.videoId': videoId,
        });
        continue;
      }

      const body = '';
      const frontmatter: SourceFrontmatter = {
        source: 'youtube',
        url,
        title,
        published_at: new Date(publishedAt).toISOString(),
        content_hash: createHash('sha256').update(body).digest('hex'),
        lang: 'en',
        video_id: videoId,
        channel_id: detail.snippet.channelId,
        duration_sec: this.parseDurationToSeconds(
          detail.contentDetails.duration,
        ),
        has_transcript: false,
      };

      const fileName = `${frontmatter.published_at.slice(0, 10)}_${videoId}.md`;
      await atomicWriteFile(
        path.join(sourceDir, fileName),
        serializeSourceDocument(frontmatter, body),
      );

      newVideoIds.push(videoId);
      this.log.info('YouTube 動画メタデータを保存しました', {
        'youtube.videoId': videoId,
      });
    }

    return {
      source: 'youtube',
      newVideoIds,
    };
  }

  private async fetchAllSearchItems(
    apiKey: string,
    knownUrls: Set<string>,
  ): Promise<YoutubeApiSearchItem[]> {
    const items: YoutubeApiSearchItem[] = [];
    let pageToken: string | undefined;

    for (;;) {
      const params = new URLSearchParams({
        part: 'snippet',
        channelId: CHANNEL_ID,
        maxResults: '50',
        order: 'date',
        type: 'video',
        key: apiKey,
      });

      if (pageToken) {
        params.set('pageToken', pageToken);
      }

      const response = await fetchWithRetry({
        accept: 'application/json',
        url: `https://www.googleapis.com/youtube/v3/search?${params.toString()}`,
      });
      const data = youtubeSearchResponseSchema.parse(await response.json());

      const pageItems = data.items ?? [];
      items.push(...pageItems);

      // order=date で新しい順に返るため、既知動画に到達した時点で以降は全て既知。
      // search.list は 100 quota/page と高コストなので早期に打ち切る。
      const reachedKnown = pageItems.some((item) => {
        const videoId = item.id?.videoId;
        return videoId
          ? knownUrls.has(`https://www.youtube.com/watch?v=${videoId}`)
          : false;
      });
      if (reachedKnown || !data.nextPageToken) {
        return items;
      }

      pageToken = data.nextPageToken;
    }
  }

  private async fetchVideoDetails(
    videoIds: string[],
    apiKey: string,
  ): Promise<Map<string, YoutubeApiVideoItem>> {
    const details = new Map<string, YoutubeApiVideoItem>();

    for (let index = 0; index < videoIds.length; index += 50) {
      const chunk = videoIds.slice(index, index + 50);
      const params = new URLSearchParams({
        part: 'contentDetails,snippet',
        id: chunk.join(','),
        key: apiKey,
      });

      const response = await fetchWithRetry({
        accept: 'application/json',
        url: `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`,
      });
      const data = youtubeVideosResponseSchema.parse(await response.json());

      for (const item of data.items ?? []) {
        if (!item.id) {
          continue;
        }
        details.set(item.id, item);
      }
    }

    return details;
  }

  private parseDurationToSeconds(duration: string): number {
    const match = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(
      duration,
    );
    if (!match) {
      throw new Error(`YouTube duration の形式が不正です: ${duration}`);
    }

    const days = Number(match[1] ?? 0);
    const hours = Number(match[2] ?? 0);
    const minutes = Number(match[3] ?? 0);
    const seconds = Number(match[4] ?? 0);

    return days * 24 * 60 * 60 + hours * 60 * 60 + minutes * 60 + seconds;
  }
}

export { CHANNEL_ID };
export type { YoutubeMetadataResult };
