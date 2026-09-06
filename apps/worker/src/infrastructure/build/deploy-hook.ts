import { workerLogger } from '../../logger';
import { toError } from '@claude-code-changelog-viewer/common';
import type { BuildTriggerPort } from '../../usecases/build-trigger';

const logger = workerLogger('infrastructure.build.deploy-hook');

export function createDeployHookBuildTrigger(
  deployHookUrl: string,
): BuildTriggerPort {
  return {
    async trigger() {
      let response: Response;
      try {
        response = await fetch(deployHookUrl, { method: 'POST' });
      } catch (error) {
        logger.error('Deploy Hook の起動に失敗しました', {
          error: toError(error),
        });
        throw error;
      }
      if (!response.ok) {
        logger.error('Deploy Hook の起動に失敗しました', {
          'http.response.status_code': response.status,
        });
        throw new Error(
          `Deploy Hook の起動に失敗しました: ${response.status} ${response.statusText}`,
        );
      }
      logger.info('Deploy Hook を起動しました', {
        'http.response.status_code': response.status,
      });
    },
  };
}
