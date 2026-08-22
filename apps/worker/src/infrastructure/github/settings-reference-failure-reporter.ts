import { getLogger, toError } from '@claude-code-changelog-viewer/common';
import { reportWorkflowFailureIssue } from './workflow-failure-issue';
import type { SettingsReferenceFailureReporterPort } from '../../usecases/settings-reference';

const logger = getLogger({
  name: 'infrastructure.github.settings-reference-failure-reporter',
  serviceName: 'changelog-viewer-worker',
  level: 'INFO',
  format: 'json',
});
export function createSettingsReferenceFailureReporter(
  githubToken: string,
): SettingsReferenceFailureReporterPort {
  return {
    async report({ params, instanceId, error }) {
      const detail =
        error instanceof Error ? (error.stack ?? error.message) : String(error);
      const targetKeys = params.targetKeys?.join(', ') ?? '指定なし';
      try {
        await reportWorkflowFailureIssue(githubToken, {
          title: '設定リファレンス生成 Workflow に失敗',
          workflowLabel: 'workflow:generate-settings-reference',
          description: [
            '## エラー詳細',
            '',
            '設定リファレンス生成 Workflow が失敗しました。',
            '',
            '**ワークフロー**: 設定リファレンス生成 Workflow',
            `**Workflow instance**: ${instanceId}`,
            `**対象キー**: ${targetKeys}`,
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
