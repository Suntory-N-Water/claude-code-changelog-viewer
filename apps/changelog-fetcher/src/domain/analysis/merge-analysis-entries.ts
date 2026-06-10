import type { ChangelogEntry } from '../changelog/changelog-entry';
import type { AnalyzedChangelogEntry } from './analyzed-changelog-entry';
import type { ChangelogAnalysis } from './changelog-analysis';

export type AnalysisMergeSlot =
  | {
      kind: 'reused';
      reusedIndex: number;
    }
  | {
      kind: 'needsSearch';
      needsSearchIndex: number;
    };

export type AnalysisMergeResult = {
  reused: AnalyzedChangelogEntry[];
  needsSearch: ChangelogEntry[];
  orderedSlots: AnalysisMergeSlot[];
};

export function mergeAnalysisEntries(
  currentEntries: ChangelogEntry[],
  existingAnalysis: ChangelogAnalysis | null,
): AnalysisMergeResult {
  const reused: AnalyzedChangelogEntry[] = [];
  const needsSearch: ChangelogEntry[] = [];
  const orderedSlots: AnalysisMergeSlot[] = [];

  for (const [index, entry] of currentEntries.entries()) {
    const existingEntry = existingAnalysis?.items[index];

    if (
      existingEntry !== undefined &&
      existingEntry.content === entry.content
    ) {
      orderedSlots.push({ kind: 'reused', reusedIndex: reused.length });
      reused.push(existingEntry);
      continue;
    }

    orderedSlots.push({
      kind: 'needsSearch',
      needsSearchIndex: needsSearch.length,
    });
    needsSearch.push(entry);
  }

  return { reused, needsSearch, orderedSlots };
}
