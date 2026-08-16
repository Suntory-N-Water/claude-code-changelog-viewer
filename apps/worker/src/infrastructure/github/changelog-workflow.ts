import { z } from 'zod';
import type { ChangelogWorkflow } from '../../usecases/detect-changelog-update';
import { createGitHubHeaders } from './github-headers';

const DISPATCH_URL =
  'https://api.github.com/repos/Suntory-N-Water/claude-code-changelog-viewer/actions/workflows/changelog-auto-inference.yml/dispatches';
const RUNS_URL =
  'https://api.github.com/repos/Suntory-N-Water/claude-code-changelog-viewer/actions/workflows/changelog-auto-inference.yml/runs?event=workflow_dispatch&per_page=100';

const WorkflowRunSchema = z.object({
  name: z.string(),
  status: z.string(),
  conclusion: z.string().nullable(),
});
const WorkflowRunsResponseSchema = z.object({
  workflow_runs: z.array(WorkflowRunSchema),
});

/** GitHub Actions workflow の起動・実行状態取得を担う adapter。 */
export function createGitHubChangelogWorkflow(
  token: string,
): ChangelogWorkflow {
  return {
    async findStatus(dispatchedHash) {
      const response = await fetch(RUNS_URL, {
        headers: createGitHubHeaders(token, 'application/vnd.github+json'),
      });
      if (!response.ok) {
        throw new Error(
          `workflow run の取得に失敗しました: ${response.status} ${response.statusText}`,
        );
      }

      const result = WorkflowRunsResponseSchema.parse(await response.json());
      const run = result.workflow_runs.find((candidate) =>
        candidate.name.includes(dispatchedHash),
      );
      if (run?.status !== 'completed') {
        return 'pending';
      }

      return run.conclusion === 'success' ? 'succeeded' : 'failed';
    },

    async dispatch(input) {
      const response = await fetch(DISPATCH_URL, {
        method: 'POST',
        headers: {
          ...createGitHubHeaders(token, 'application/vnd.github+json'),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: {
            detected_hash: input.hash,
            detected_at: input.detectedAt,
          },
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(
          `workflow_dispatch の呼び出しに失敗しました: ${response.status} ${response.statusText} ${detail}`,
        );
      }
    },
  };
}
