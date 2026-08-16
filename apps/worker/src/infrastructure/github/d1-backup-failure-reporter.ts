import { createGitHubHeaders } from './github-headers';
import type { BackupFailureReporterPort } from '../../usecases/d1-backup-workflow';

const FAILURE_ISSUE_URL =
  'https://api.github.com/repos/Suntory-N-Water/claude-code-changelog-viewer/issues';

export function createD1BackupFailureReporter(
  githubToken: string,
): BackupFailureReporterPort {
  return {
    async report({ instanceId, error }) {
      const detail =
        error instanceof Error ? (error.stack ?? error.message) : String(error);
      const response = await fetch(FAILURE_ISSUE_URL, {
        method: 'POST',
        headers: {
          ...createGitHubHeaders(githubToken, 'application/vnd.github+json'),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'D1 バックアップ Workflow に失敗',
          body: [
            '正データ用 D1 の R2 への export が失敗しました。',
            '',
            `- Workflow instance: ${instanceId}`,
            '',
            '```text',
            detail,
            '```',
          ].join('\n'),
          labels: ['automated-failure', 'bug'],
        }),
      });
      if (!response.ok) {
        throw new Error(
          `失敗通知 Issue の作成に失敗しました: ${response.status} ${response.statusText}`,
        );
      }
    },
  };
}
