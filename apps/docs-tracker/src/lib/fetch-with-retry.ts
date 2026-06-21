import { getLogger } from '@claude-code-changelog-viewer/common';

const logger = getLogger({ name: 'docs-tracker' }).child({
  component: 'fetchWithRetry',
});

type FetchWithRetryOptions = {
  accept?: string;
  headers?: Record<string, string>;
  maxRetries?: number;
  retryDelayMs?: number;
  url: string;
};

export async function fetchWithRetry({
  accept = '*/*',
  headers,
  maxRetries = 3,
  retryDelayMs = 1000,
  url,
}: FetchWithRetryOptions): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Claude-Code-Changelog-Viewer/1.0',
          Accept: accept,
          ...headers,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }

      logger.msg('APLG0014', {
        attrs: {
          'retry.attempt': attempt + 1,
          'retry.max': maxRetries,
          'request.url': url,
        },
      });

      await new Promise((resolve) =>
        setTimeout(resolve, retryDelayMs * 2 ** attempt),
      );
    }
  }

  throw new Error(`リトライ回数を超えました: ${url}`);
}
