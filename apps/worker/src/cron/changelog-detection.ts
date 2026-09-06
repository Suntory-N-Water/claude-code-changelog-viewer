import { workerLogger } from '../logger';
import { createGitHubChangelogSource } from '../infrastructure/github/changelog-source';
import { createChangelogDetectionStateRepository } from '../infrastructure/kv/changelog-detection-state-store';
import { createChangelogInferenceDispatcher } from '../infrastructure/workflows/changelog-inference-dispatcher';
import { detectChangelogUpdate as detectChangelogUpdateUsecase } from '../usecases/detect-changelog-update';

const logger = workerLogger('cron.changelog-detection');

/** ScheduledEvent と Cloudflare binding を検知 usecase へ接続する entry point。 */
export async function detectChangelogUpdate(
  bindings: CloudflareBindings,
  now: Date = new Date(),
): Promise<void> {
  const result = await detectChangelogUpdateUsecase(
    {
      source: createGitHubChangelogSource(bindings.GITHUB_DISPATCH_TOKEN),
      workflow: createChangelogInferenceDispatcher(
        bindings.CHANGELOG_INFERENCE_WORKFLOW,
      ),
      stateRepository: createChangelogDetectionStateRepository(
        bindings.CHANGELOG_DETECTION_KV,
      ),
    },
    { now },
  );

  if (result.action === 'dispatched') {
    logger.info('CHANGELOG の変化を検知、推論 Workflow を起動', {
      'changelog.previous_hash': result.previousHash,
      'changelog.content_hash': result.contentHash,
    });
    return;
  }

  logger.info('CHANGELOG に変化なし', {
    'changelog.content_hash': result.contentHash,
  });
}
