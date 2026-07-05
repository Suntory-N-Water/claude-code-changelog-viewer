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

  const existingById = new Map(
    existingInferred.items.map((entry) => [entry.id, entry]),
  );

  return createChangelogAnalysis({
    version: currentAnalysis.version,
    ...((currentAnalysis.summary ?? existingInferred.summary) !== undefined
      ? { summary: currentAnalysis.summary ?? existingInferred.summary }
      : {}),
    items: currentAnalysis.items.map((entry) => {
      const existingEntry = existingById.get(entry.id);

      if (existingEntry === undefined) {
        return entry;
      }

      return createAnalyzedChangelogEntry({
        content: entry.content,
        prefix: entry.prefix,
        relatedDocs: entry.relatedDocs,
        relatedIssues: entry.relatedIssues,
        ...(existingEntry.contentJa !== undefined
          ? { contentJa: existingEntry.contentJa }
          : {}),
        featureAreas: existingEntry.featureAreas,
        ...(existingEntry.inference !== undefined
          ? { inference: existingEntry.inference }
          : {}),
        ...(existingEntry.impact !== undefined
          ? { impact: existingEntry.impact }
          : {}),
      });
    }),
  });
}
