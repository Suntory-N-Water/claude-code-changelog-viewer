import { createHash } from 'node:crypto';
import { getLogger } from '@claude-code-changelog-viewer/common';
import pRetry, { AbortError } from 'p-retry';
import type { ChangelogSourcePort } from '../../usecase/fetch-changelog';
import { parseChangelogReleases } from '../docs/changelog-markdown-parser';

const CHANGELOG_URL =
  'https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md';

const DEFAULT_RETRY_DELAY_MS = 60 * 1000;
const DEFAULT_RETRIES = 3;

const log = getLogger({ name: 'changelog-fetcher' });

type RetryOptions = {
  delayMs?: number;
  retries?: number;
};

type ClientOptions = {
  // notification-worker が検知した CHANGELOG.md の sha256。
  // 本番 workflow からは workflow_dispatch inputs 経由で必ず渡される。
  // ローカル/手動実行時は未指定で、その場合はハッシュ検証をスキップし 1 回だけ取得する。
  expectedHash?: string;
  // テスト容易化用。本番は delayMs=60s, retries=3 がデフォルト。
  retryOptions?: RetryOptions;
};

export class ClaudeCodeChangelogClient implements ChangelogSourcePort {
  private readonly expectedHash?: string;
  private readonly delayMs: number;
  private readonly retries: number;

  constructor(options: ClientOptions = {}) {
    if (options.expectedHash !== undefined) {
      this.expectedHash = options.expectedHash;
    }
    this.delayMs = options.retryOptions?.delayMs ?? DEFAULT_RETRY_DELAY_MS;
    this.retries = options.retryOptions?.retries ?? DEFAULT_RETRIES;
  }

  async fetchReleases() {
    const maxAttempts = this.retries + 1;

    return pRetry(
      async () => {
        const response = await fetch(`${CHANGELOG_URL}?cb=${Date.now()}`, {
          headers: { 'Cache-Control': 'no-cache' },
        });

        if (!response.ok) {
          const message = `CHANGELOG.md の取得に失敗しました: ${response.status} ${response.statusText}`;
          // 4xx は再試行しても直らないので即中断
          if (response.status >= 400 && response.status < 500) {
            throw new AbortError(message);
          }
          throw new Error(message);
        }

        const markdown = await response.text();

        if (this.expectedHash !== undefined) {
          const actualHash = createHash('sha256')
            .update(markdown, 'utf-8')
            .digest('hex');
          if (actualHash !== this.expectedHash) {
            throw new HashMismatchError(this.expectedHash, actualHash);
          }
        }

        const releases = parseChangelogReleases(markdown);
        log.info(`取得完了: releases=${releases.length}`);
        return releases;
      },
      {
        retries: this.retries,
        onFailedAttempt: async ({ error, attemptNumber }) => {
          if (error instanceof HashMismatchError) {
            log.msg('APLG0025', {
              params: [
                attemptNumber,
                maxAttempts,
                error.expected,
                error.actual,
              ],
            });
          } else {
            log.msg('APLG0026', {
              params: [attemptNumber, maxAttempts, error.message],
            });
          }
          await new Promise((resolve) => setTimeout(resolve, this.delayMs));
        },
      },
    );
  }
}

class HashMismatchError extends Error {
  constructor(
    readonly expected: string,
    readonly actual: string,
  ) {
    super(`CHANGELOG ハッシュ不一致: expected=${expected} actual=${actual}`);
    this.name = 'HashMismatchError';
  }
}
