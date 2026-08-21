import { reportWorkflowFailureIssue } from './workflow-failure-issue';
import type { BackupFailureReporterPort } from '../../usecases/d1-backup-workflow';

export function createD1BackupFailureReporter(
  githubToken: string,
): BackupFailureReporterPort {
  return {
    async report({ instanceId, error }) {
      const detail =
        error instanceof Error ? (error.stack ?? error.message) : String(error);
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
    },
  };
}
