import { getLogger } from '@claude-code-changelog-viewer/common';
import { createGitHubChangelogSource } from '../infrastructure/github/changelog-source';
import { createGitHubChangelogWorkflow } from '../infrastructure/github/changelog-workflow';
import { createChangelogDetectionStateRepository } from '../infrastructure/kv/changelog-detection-state-store';
import { detectChangelogUpdate as detectChangelogUpdateUsecase } from '../usecases/detect-changelog-update';

const logger = getLogger({
  name: 'changelog-detection',
  level: 'INFO',
  format: 'json',
});

/** ScheduledEvent と Cloudflare binding を検知 usecase へ接続する entry point。 */
export async function detectChangelogUpdate(
  bindings: CloudflareBindings,
  now: Date = new Date(),
): Promise<void> {
  const result = await detectChangelogUpdateUsecase(
    {
      source: createGitHubChangelogSource(bindings.GITHUB_DISPATCH_TOKEN),
      workflow: createGitHubChangelogWorkflow(bindings.GITHUB_DISPATCH_TOKEN),
      stateRepository: createChangelogDetectionStateRepository(
        bindings.CHANGELOG_DETECTION_KV,
      ),
    },
    { now },
  );

  if (result.action === 'dispatched') {
    logger.info('CHANGELOG の変化を検知、workflow_dispatch を起動', {
      previousHash: result.previousHash,
      newHash: result.contentHash,
    });
    return;
  }

  logger.info('CHANGELOG に変化なし', { hash: result.contentHash });
}
