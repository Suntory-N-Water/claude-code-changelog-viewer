import { reportWorkflowFailureIssue } from './workflow-failure-issue';
import type { ChangelogFailureReporterPort } from '../../usecases/changelog-inference-workflow';

export function createChangelogWorkflowFailureReporter(
  githubToken: string,
): ChangelogFailureReporterPort {
  return {
    async report({ params, instanceId, error }) {
      const detail =
        error instanceof Error ? (error.stack ?? error.message) : String(error);
      await reportWorkflowFailureIssue(githubToken, {
        title: 'CHANGELOG 推論 Workflow に失敗',
        workflowLabel: 'workflow:changelog-auto-inference',
        description: [
          '## エラー詳細',
          '',
          'CHANGELOG 推論 Workflow が失敗しました。',
          '',
          '**ワークフロー**: CHANGELOG 推論 Workflow',
          `**Workflow instance**: ${instanceId}`,
          `**検出時刻**: ${params.detectedAt}`,
          `**検出ハッシュ**: ${params.detectedHash}`,
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
