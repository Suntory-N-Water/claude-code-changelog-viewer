import { getLogger, toError } from '@claude-code-changelog-viewer/common';
import { reportWorkflowFailureIssue } from './workflow-failure-issue';
import type { ChangelogFailureReporterPort } from '../../usecases/changelog-inference-workflow';

const logger = getLogger({
  name: 'infrastructure.github.changelog-failure-reporter',
  serviceName: 'changelog-viewer-worker',
  level: 'INFO',
  format: 'json',
});
export function createChangelogWorkflowFailureReporter(
  githubToken: string,
): ChangelogFailureReporterPort {
  return {
    async report({ params, instanceId, error }) {
      const detail =
        error instanceof Error ? (error.stack ?? error.message) : String(error);
      try {
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
