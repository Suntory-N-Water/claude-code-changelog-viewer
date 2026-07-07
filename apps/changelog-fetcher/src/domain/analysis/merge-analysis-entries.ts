import type { ChangelogEntry } from '../changelog/changelog-entry';
import {
  type AnalyzedChangelogEntry,
  toAnalyzedChangelogEntryId,
} from './analyzed-changelog-entry';
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
  const existingById = new Map<string, AnalyzedChangelogEntry>();
  for (const entry of existingAnalysis?.items ?? []) {
    if (!existingById.has(entry.id)) {
      existingById.set(entry.id, entry);
    }
  }

  const entriesNeedingSearch: ChangelogEntry[] = [];
  const decisions: AnalysisEntryMergeDecision[] = [];

  for (const entry of currentEntries) {
    const id = toAnalyzedChangelogEntryId(entry.content);
    const existingEntry = existingById.get(id);

    if (existingEntry !== undefined) {
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
