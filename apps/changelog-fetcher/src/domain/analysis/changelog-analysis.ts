import type { ChangelogVersion } from '../changelog/changelog-version';
import type { AnalyzedChangelogEntry } from './analyzed-changelog-entry';

export type ChangelogAnalysis = {
  version: ChangelogVersion;
  summary?: string;
  items: AnalyzedChangelogEntry[];
};

/**
 * 1バージョン分の解析結果を生成する。
 */
export function createChangelogAnalysis(input: {
  version: ChangelogVersion;
  summary?: string;
  items: AnalyzedChangelogEntry[];
}): ChangelogAnalysis {
  return {
    version: input.version,
    ...(input.summary !== undefined ? { summary: input.summary } : {}),
    items: input.items,
  };
}
