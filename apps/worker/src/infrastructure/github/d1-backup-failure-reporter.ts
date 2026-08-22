import { getLogger } from '@claude-code-changelog-viewer/common';
import { createGitHubHeaders } from './github-headers';
import type { BackupFailureReporterPort } from '../../usecases/d1-backup-workflow';

const FAILURE_ISSUE_URL =
  'https://api.github.com/repos/Suntory-N-Water/claude-code-changelog-viewer/issues';

const logger = getLogger({
  name: 'infrastructure.github.d1-backup-failure-reporter',
  serviceName: 'changelog-viewer-worker',
  level: 'INFO',
  format: 'json',
});

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
        logger.error('失敗通知 Issue の作成に失敗しました', {
          'workflow.instance_id': instanceId,
          'http.response.status_code': response.status,
        });
        throw new Error(
          `失敗通知 Issue の作成に失敗しました: ${response.status} ${response.statusText}`,
        );
      }
      logger.info('失敗通知 Issue を作成しました', {
        'workflow.instance_id': instanceId,
        'http.response.status_code': response.status,
      });
    },
  };
}
