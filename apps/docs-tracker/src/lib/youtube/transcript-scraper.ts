import { chromium } from 'playwright';
import {
  getLogger,
  type AppLogger,
} from '@claude-code-changelog-viewer/common';
import { extractTranscriptFromHtml } from './transcript-extractor';

export class YoutubeTranscriptScraper {
  private readonly log: AppLogger;

  constructor() {
    this.log = getLogger({ name: 'docs-tracker' }).child({
      component: 'YoutubeTranscriptScraper',
    });
  }

  async fetch(videoIds: string[]): Promise<Map<string, string | null>> {
    const results = new Map<string, string | null>();
    const browser = await chromium.launch({ headless: true });

    try {
      const page = await browser.newPage({
        viewport: { width: 1280, height: 720 },
      });

      for (const videoId of videoIds) {
        try {
          await page.goto('https://www.noteey.com/ja/youtube-to-transcript', {
            waitUntil: 'load',
          });
          await page
            .getByPlaceholder('YouTubeのURLを入力')
            .fill(`https://www.youtube.com/watch?v=${videoId}`);
          await page.getByRole('button', { name: '文字起こしを取得' }).click();

          const transcriptItems = page.locator(
            '.desktop-transcript-container .transcript-item',
          );
          await transcriptItems.first().waitFor({ timeout: 30_000 });

          const transcript = extractTranscriptFromHtml(await page.content());
          if (transcript) {
            results.set(videoId, transcript);
            this.log.info('YouTube transcript を取得しました', {
              'youtube.videoId': videoId,
              'youtube.transcriptLength': transcript.length,
            });
            continue;
          }

          this.log.warn('YouTube transcript が空でした', {
            'youtube.videoId': videoId,
          });
          results.set(videoId, null);
        } catch (error) {
          this.log.error('YouTube transcript の取得に失敗しました', {
            'youtube.videoId': videoId,
            'exception.message':
              error instanceof Error ? error.message : String(error),
          });
          results.set(videoId, null);
        }
      }
    } finally {
      await browser.close();
    }

    return results;
  }
}
