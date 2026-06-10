import type { ChangelogEntry } from '../changelog/changelog-entry';
import type { AnalyzedChangelogEntry } from './analyzed-changelog-entry';
import type { ChangelogAnalysis } from './changelog-analysis';

export type AnalysisEntryMergeDecision =
  | {
      kind: 'existing';
      entry: AnalyzedChangelogEntry;
    }
  | {
      kind: 'searched';
      searchedIndex: number;
    };

export type AnalysisMergeResult = {
  entriesNeedingSearch: ChangelogEntry[];
  decisions: AnalysisEntryMergeDecision[];
};

export function mergeAnalysisEntries(
  currentEntries: ChangelogEntry[],
  existingAnalysis: ChangelogAnalysis | null,
): AnalysisMergeResult {
  const entriesNeedingSearch: ChangelogEntry[] = [];
  const decisions: AnalysisEntryMergeDecision[] = [];

  for (const [index, entry] of currentEntries.entries()) {
    const existingEntry = existingAnalysis?.items[index];

    if (
      existingEntry !== undefined &&
      existingEntry.content === entry.content
    ) {
      decisions.push({ kind: 'existing', entry: existingEntry });
      continue;
    }

    decisions.push({
      kind: 'searched',
      searchedIndex: entriesNeedingSearch.length,
    });
    entriesNeedingSearch.push(entry);
  }

  return {
    entriesNeedingSearch,
    decisions,
  };
}
