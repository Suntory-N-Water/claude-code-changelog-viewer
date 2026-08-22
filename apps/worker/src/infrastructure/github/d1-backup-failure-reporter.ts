import { getLogger, toError } from '@claude-code-changelog-viewer/common';
import { reportWorkflowFailureIssue } from './workflow-failure-issue';
import type { BackupFailureReporterPort } from '../../usecases/d1-backup-workflow';

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
      try {
        await reportWorkflowFailureIssue(githubToken, {
          title: 'D1 バックアップ Workflow に失敗',
          workflowLabel: 'workflow:d1-backup',
          description: [
            '## エラー詳細',
            '',
            '正データ用 D1 の R2 への export が失敗しました。',
            '',
            '**ワークフロー**: D1 バックアップ Workflow',
            `**Workflow instance**: ${instanceId}`,
            '',
            '```text',
            detail,
            '```',
            '',
            '詳細は Cloudflare Workflow のログを確認してください。',
          ].join('\n'),
        });
        logger.info('失敗通知 Issue を作成しました', {
          'workflow.instance_id': instanceId,
        });
      } catch (error) {
        logger.error('失敗通知 Issue の作成に失敗しました', {
          'workflow.instance_id': instanceId,
          error: toError(error),
        });
        throw error;
      }
    },
  };
}
