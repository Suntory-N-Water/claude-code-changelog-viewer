import { AnalysisSchema } from '@claude-code-changelog-viewer/types';
import type { AnalysisSourcePort } from '../../usecases/dispatch-changelog-notifications';

const GITHUB_RAW_BASE =
  'https://raw.githubusercontent.com/Suntory-N-Water/claude-code-changelog-viewer/main/apps/changelog-fetcher/inferred';

export function createGitHubInferredDataClient(): AnalysisSourcePort {
  return {
    async fetch(version: string) {
      const url = `${GITHUB_RAW_BASE}/inferred_${version}.json`;
      const response = await globalThis.fetch(url);
      if (!response.ok) {
        throw new Error(
          `inferred JSONの取得に失敗: ${url} (status=${response.status})`,
        );
      }
      const raw = await response.json();
      const result = AnalysisSchema.safeParse(raw);
      if (!result.success) {
        throw new Error(`inferred JSONのパースに失敗: ${result.error.message}`);
      }
      return result.data;
    },
  };
}
