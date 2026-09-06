import { workerLogger } from '../../logger';
import { toError } from '@claude-code-changelog-viewer/common';
import type { ChangelogSource } from '../../usecases/detect-changelog-update';
import type { ChangelogMarkdownSourcePort } from '../../usecases/changelog-inference-workflow';
import { sha256Hex } from '../crypto/sha256-hex';
import { createGitHubHeaders } from './github-headers';

const CHANGELOG_URL =
  'https://api.github.com/repos/anthropics/claude-code/contents/CHANGELOG.md?ref=main';

const logger = workerLogger('infrastructure.github.changelog-source');

export async function fetchChangelogMarkdown(
  token: string,
  expectedHash?: string,
): Promise<string> {
  try {
    const response = await fetch(CHANGELOG_URL, {
      headers: createGitHubHeaders(token, 'application/vnd.github.raw'),
    });
    if (!response.ok) {
      throw new Error(
        `CHANGELOG.md の取得に失敗しました: ${response.status} ${response.statusText}`,
      );
    }

    const markdown = await response.text();
    if (expectedHash !== undefined) {
      const actualHash = await sha256Hex(markdown);
      if (actualHash !== expectedHash) {
        logger.msg('APLG0025', {
          attrs: {
            'hash.expected': expectedHash,
            'hash.actual': actualHash,
          },
        });
        throw new Error(
          `CHANGELOG ハッシュ不一致: expected=${expectedHash} actual=${actualHash}`,
        );
      }
    }

    logger.info('CHANGELOG を取得しました', {
      'resource.name': 'CHANGELOG.md',
      'http.response.status_code': response.status,
      'content.size': markdown.length,
    });
    return markdown;
  } catch (error) {
    logger.error('GitHub から CHANGELOG の取得に失敗しました', {
      'resource.name': 'CHANGELOG.md',
      error: toError(error),
    });
    throw error;
  }
}

/** GitHub 上の Claude Code CHANGELOG を取得する source adapter。 */
export function createGitHubChangelogSource(token: string): ChangelogSource {
  return {
    async fetchContentHash(): Promise<string> {
      return sha256Hex(await fetchChangelogMarkdown(token));
    },
  };
}

/** CHANGELOG 本文を Workflow 用 port として取得する source adapter。 */
export function createGitHubChangelogMarkdownSource(
  token: string,
): ChangelogMarkdownSourcePort {
  return {
    fetchMarkdown: (expectedHash) =>
      fetchChangelogMarkdown(token, expectedHash),
  };
}
