import type { ChangelogSource } from '../../usecases/detect-changelog-update';
import { sha256Hex } from '../crypto/sha256-hex';
import { createGitHubHeaders } from './github-headers';

const CHANGELOG_URL =
  'https://api.github.com/repos/anthropics/claude-code/contents/CHANGELOG.md?ref=main';

/** GitHub 上の Claude Code CHANGELOG を取得する source adapter。 */
export function createGitHubChangelogSource(token: string): ChangelogSource {
  return {
    async fetchContentHash(): Promise<string> {
      const response = await fetch(CHANGELOG_URL, {
        headers: createGitHubHeaders(token, 'application/vnd.github.raw'),
      });
      if (!response.ok) {
        throw new Error(
          `CHANGELOG.md の取得に失敗しました: ${response.status} ${response.statusText}`,
        );
      }

      return sha256Hex(await response.text());
    },
  };
}
