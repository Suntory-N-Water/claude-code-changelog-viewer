import { createHash } from 'node:crypto';
import { getLogger } from '@claude-code-changelog-viewer/common';
import type { ChangelogSourcePort } from '../../usecase/fetch-changelog';
import { parseChangelogReleases } from '../docs/changelog-markdown-parser';

const CHANGELOG_URL =
  'https://api.github.com/repos/anthropics/claude-code/contents/CHANGELOG.md?ref=main';

const log = getLogger({ name: 'changelog-fetcher' });

type ClientOptions = {
  githubToken: string;
  // changelog-viewer-worker が検知した CHANGELOG.md の sha256。
  // 本番 workflow からは workflow_dispatch inputs 経由で必ず渡される。
  // ローカル実行時は未指定にでき、その場合はハッシュ検証をスキップする。
  expectedHash?: string;
};

export class ClaudeCodeChangelogClient implements ChangelogSourcePort {
  private readonly githubToken: string;
  private readonly expectedHash?: string;

  constructor(options: ClientOptions) {
    this.githubToken = options.githubToken;
    if (options.expectedHash !== undefined) {
      this.expectedHash = options.expectedHash;
    }
  }

  async fetchReleases() {
    // raw.githubusercontent.com はクエリ文字列を共有キャッシュキーに含めないため使わない。
    const response = await fetch(CHANGELOG_URL, {
      headers: {
        Accept: 'application/vnd.github.raw',
        Authorization: `Bearer ${this.githubToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'claude-code-changelog-viewer',
      },
    });

    if (!response.ok) {
      throw new Error(
        `CHANGELOG.md の取得に失敗しました: ${response.status} ${response.statusText}`,
      );
    }

    const markdown = await response.text();

    if (this.expectedHash !== undefined) {
      const actualHash = createHash('sha256')
        .update(markdown, 'utf-8')
        .digest('hex');
      if (actualHash !== this.expectedHash) {
        // 検知後に上流が更新された場合、再取得しても古い期待値には一致しないため即時失敗する。
        log.msg('APLG0025', {
          params: [this.expectedHash, actualHash],
        });
        throw new HashMismatchError(this.expectedHash, actualHash);
      }
    }

    const releases = parseChangelogReleases(markdown);
    log.info(`取得完了: releases=${releases.length}`);
    return releases;
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
