import { createAnalyzedChangelogEntry } from '../domain/analysis/analyzed-changelog-entry';
import {
  type ChangelogAnalysis,
  createChangelogAnalysis,
} from '../domain/analysis/changelog-analysis';

export function transferExistingInference(
  currentAnalysis: ChangelogAnalysis,
  existingInferred: ChangelogAnalysis | null,
): ChangelogAnalysis {
  if (existingInferred === null) {
    return currentAnalysis;
  }

  return createChangelogAnalysis({
    version: currentAnalysis.version,
    ...((currentAnalysis.summary ?? existingInferred.summary) !== undefined
      ? { summary: currentAnalysis.summary ?? existingInferred.summary }
      : {}),
    items: currentAnalysis.items.map((entry, index) => {
      const existingEntry = existingInferred.items[index];

      if (
        existingEntry === undefined ||
        existingEntry.content !== entry.content
      ) {
        return entry;
      }

      return createAnalyzedChangelogEntry({
        ...entry,
        ...(existingEntry.contentJa !== undefined
          ? { contentJa: existingEntry.contentJa }
          : {}),
        featureAreas: existingEntry.featureAreas,
        ...(existingEntry.inference !== undefined
          ? { inference: existingEntry.inference }
          : {}),
      });
    }),
  });
}
