import { getLogger } from '@claude-code-changelog-viewer/common';
import type { ChangelogSourcePort } from '../../usecase/fetch-changelog';
import { parseChangelogReleases } from '../docs/changelog-markdown-parser';

const CHANGELOG_URL =
  'https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md';

const log = getLogger({ name: 'changelog-fetcher' });

export class ClaudeCodeChangelogClient implements ChangelogSourcePort {
  async fetchReleases() {
    const response = await fetch(`${CHANGELOG_URL}?cb=${Date.now()}`, {
      headers: { 'Cache-Control': 'no-cache' },
    });
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
