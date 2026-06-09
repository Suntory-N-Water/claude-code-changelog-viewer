import { execFileSync } from 'node:child_process';
import { getLogger } from '@claude-code-changelog-viewer/common';
import type { ChangelogSourcePort } from '../../application/fetch-changelog';
import { parseChangelogReleases } from '../docs/changelog-markdown-parser';

const log = getLogger({ name: 'changelog-fetcher' });

export class ClaudeCodeChangelogClient implements ChangelogSourcePort {
  async fetchReleases() {
    const downloadUrl = execFileSync(
      'gh',
      [
        'api',
        'repos/anthropics/claude-code/contents/CHANGELOG.md',
        '--jq',
        '.download_url',
      ],
      { encoding: 'utf-8' },
    ).trim();

    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(
        `CHANGELOG.md の取得に失敗しました: ${response.status} ${response.statusText}`,
      );
    }

    const markdown = await response.text();
    const releases = parseChangelogReleases(markdown);
    log.info(`取得完了: releases=${releases.length}`);
    return releases;
  }
}
