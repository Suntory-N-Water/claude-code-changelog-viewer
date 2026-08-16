import type { ChangelogBuildTriggerPort } from '../../usecases/changelog-inference-workflow';

export function createDeployHookBuildTrigger(
  deployHookUrl: string,
): ChangelogBuildTriggerPort {
  return {
    async trigger() {
      const response = await fetch(deployHookUrl, { method: 'POST' });
      if (!response.ok) {
        throw new Error(
          `Deploy Hook の起動に失敗しました: ${response.status} ${response.statusText}`,
        );
      }
    },
  };
}
