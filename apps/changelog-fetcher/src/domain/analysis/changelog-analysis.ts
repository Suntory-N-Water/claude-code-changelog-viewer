import type { ChangelogVersion } from '../changelog/changelog-version';
import type { AnalyzedChangelogEntry } from './analyzed-changelog-entry';

export type ChangelogAnalysis = {
  readonly version: ChangelogVersion;
  readonly summary?: string;
  readonly items: readonly AnalyzedChangelogEntry[];
};

/**
 * 1バージョン分の解析結果を生成する。
 */
export function createChangelogAnalysis(input: {
  readonly version: ChangelogVersion;
  readonly summary?: string;
  readonly items: readonly AnalyzedChangelogEntry[];
}): ChangelogAnalysis {
  return {
    version: input.version,
    ...(input.summary !== undefined ? { summary: input.summary } : {}),
    items: input.items,
  };
}
