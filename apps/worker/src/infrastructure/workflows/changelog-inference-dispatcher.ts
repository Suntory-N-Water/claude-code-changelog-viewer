import type { ChangelogWorkflow } from '../../usecases/detect-changelog-update';

/** Cloudflare Workflows の CHANGELOG 推論 Workflow を検知 usecase へ接続する adapter。 */
export function createChangelogInferenceDispatcher(
  workflow: CloudflareBindings['CHANGELOG_INFERENCE_WORKFLOW'],
): ChangelogWorkflow {
  return {
    async dispatch({ hash, detectedAt, attempts }) {
      await workflow.createBatch([
        {
          id: `${hash}-${attempts}`,
          params: { detectedHash: hash, detectedAt },
        },
      ]);
    },

    async findStatus({ hash, attempts }) {
      try {
        const instance = await workflow.get(`${hash}-${attempts}`);
        const result = await instance.status();
        if (result.status === 'complete') {
          return 'succeeded';
        }
        if (result.status === 'errored' || result.status === 'terminated') {
          return 'failed';
        }
        return 'pending';
      } catch {
        return 'failed';
      }
    },
  };
}
