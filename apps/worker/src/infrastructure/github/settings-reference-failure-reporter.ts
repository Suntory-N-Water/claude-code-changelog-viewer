import { reportWorkflowFailureIssue } from './workflow-failure-issue';
import type { SettingsReferenceFailureReporterPort } from '../../usecases/settings-reference';

export function createSettingsReferenceFailureReporter(
  githubToken: string,
): SettingsReferenceFailureReporterPort {
  return {
    async report({ params, instanceId, error }) {
      const detail =
        error instanceof Error ? (error.stack ?? error.message) : String(error);
      const targetKeys = params.targetKeys?.join(', ') ?? '指定なし';
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
    },
  };
}
