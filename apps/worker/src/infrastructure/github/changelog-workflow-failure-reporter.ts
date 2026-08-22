import { getLogger } from '@claude-code-changelog-viewer/common';
import { createGitHubHeaders } from './github-headers';
import type { ChangelogFailureReporterPort } from '../../usecases/changelog-inference-workflow';

const FAILURE_ISSUE_URL =
  'https://api.github.com/repos/Suntory-N-Water/claude-code-changelog-viewer/issues';

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
      const response = await fetch(FAILURE_ISSUE_URL, {
        method: 'POST',
        headers: {
          ...createGitHubHeaders(githubToken, 'application/vnd.github+json'),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'CHANGELOG 推論 Workflow に失敗',
          body: [
            'CHANGELOG 推論 Workflow が失敗しました。',
            '',
            `- Workflow instance: ${instanceId}`,
            `- detectedAt: ${params.detectedAt}`,
            `- detectedHash: ${params.detectedHash}`,
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
