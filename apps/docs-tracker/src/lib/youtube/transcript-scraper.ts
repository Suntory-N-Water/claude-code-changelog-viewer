import { fetchTranscript } from 'youtube-transcript';
import {
  getLogger,
  type AppLogger,
} from '@claude-code-changelog-viewer/common';

export class YoutubeTranscriptScraper {
  private readonly log: AppLogger;

  constructor() {
    this.log = getLogger({ name: 'docs-tracker' }).child({
      component: 'YoutubeTranscriptScraper',
    });
  }

  async fetch(videoIds: string[]): Promise<Map<string, string | null>> {
    const results = new Map<string, string | null>();

    for (const videoId of videoIds) {
      try {
        const items = await fetchTranscript(videoId);
        if (items.length === 0) {
          this.log.warn('YouTube transcript が空でした', {
            'youtube.videoId': videoId,
          });
          results.set(videoId, null);
          continue;
        }

        let transcript = items
          .map((item) => item.text)
          .join(' ')
          .normalize('NFKC');
        transcript = transcript.replace(/\[.+?\]/g, '');
        transcript = transcript.replace(
          /([^\x20-\x7E])\s+([^\x20-\x7E])/g,
          '$1$2',
        );
        transcript = transcript.replace(/ {2,}/g, ' ').trim();

        if (transcript.length === 0) {
          this.log.warn('YouTube transcript がクリーニング後に空でした', {
            'youtube.videoId': videoId,
          });
          results.set(videoId, null);
          continue;
        }

        results.set(videoId, transcript);
        this.log.info('YouTube transcript を取得しました', {
          'youtube.videoId': videoId,
          'youtube.transcriptLength': transcript.length,
        });
      } catch (error) {
        this.log.error('YouTube transcript の取得に失敗しました', {
          'youtube.videoId': videoId,
          'exception.message':
            error instanceof Error ? error.message : String(error),
        });
        results.set(videoId, null);
      }
    }

    return results;
  }
}
