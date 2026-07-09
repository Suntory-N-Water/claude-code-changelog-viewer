import { getLogger } from '@claude-code-changelog-viewer/common';
import {
  type AnalyzedChangelogEntry,
  type AnalyzedChangelogEntryId,
  type ImpactAssessment,
  applyInferenceToAnalyzedEntry,
  needsInference,
} from '../domain/analysis/analyzed-changelog-entry';
import {
  type ChangelogAnalysis,
  createChangelogAnalysis,
} from '../domain/analysis/changelog-analysis';
import type { RelatedIssue } from '../domain/analysis/related-issue';
import type { MaintainerCandidate } from './extract-maintainer-declared-issues';

const log = getLogger({ name: 'inference-batch' });

export type InferredBatchItem = {
  id: string;
  contentJa: string;
  before: string;
  after: string;
  benefit: string;
};

export type TranslatedBatchItem = {
  id: string;
  contentJa: string;
};

export type FeatureAreaCorrection = {
  id: string;
  featureAreas: string[];
};

export type ImpactBatchItem = {
  id: string;
} & ImpactAssessment;

export type MatchedIssuesBatchItem = {
  id: string;
  issueNumbers: number[];
};

export type InferenceBatch = {
  inferredItems: InferredBatchItem[];
  translatedItems: TranslatedBatchItem[];
  featureAreaCorrections: FeatureAreaCorrection[];
  impactItems: ImpactBatchItem[];
  matchedIssuesItems: MatchedIssuesBatchItem[];
  summary?: string;
};

export type IndexedAnalyzedEntry = {
  entry: AnalyzedChangelogEntry;
  id: AnalyzedChangelogEntryId;
};

export function createInferenceBatch(input: {
  inferredItems?: InferredBatchItem[];
  translatedItems?: TranslatedBatchItem[];
  featureAreaCorrections?: FeatureAreaCorrection[];
  impactItems?: ImpactBatchItem[];
  matchedIssuesItems?: MatchedIssuesBatchItem[];
  summary?: string;
}): InferenceBatch {
  return {
    inferredItems: input.inferredItems ?? [],
    translatedItems: input.translatedItems ?? [],
    featureAreaCorrections: input.featureAreaCorrections ?? [],
    impactItems: input.impactItems ?? [],
    matchedIssuesItems: input.matchedIssuesItems ?? [],
    ...(input.summary !== undefined ? { summary: input.summary } : {}),
  };
}

export function findMissingInferenceItems(
  analysis: ChangelogAnalysis,
): IndexedAnalyzedEntry[] {
  return analysis.items
    .map((entry) => ({ entry, id: entry.id }))
    .filter(({ entry }) => needsInference(entry));
}

export function applyInferenceBatch(
  analysis: ChangelogAnalysis,
  batch: InferenceBatch,
  candidates?: MaintainerCandidate[],
): ChangelogAnalysis {
  const inferredById = new Map(
    batch.inferredItems.map((item) => [item.id, item]),
  );
  const translatedById = new Map(
    batch.translatedItems.map((item) => [item.id, item]),
  );
  const correctionById = new Map(
    batch.featureAreaCorrections.map((item) => [item.id, item]),
  );
  const impactById = new Map(
    batch.impactItems.map(({ id, ...impact }) => [id, impact]),
  );
  const matchedById = new Map(
    batch.matchedIssuesItems.map((item) => [item.id, item]),
  );

  const candidateByNumber = new Map(
    (candidates ?? []).map((c) => [c.number, c]),
  );
  const candidateNumberSet = new Set(candidateByNumber.keys());

  const items = analysis.items.map((entry) => {
    const correction = correctionById.get(entry.id);
    const featureAreas = correction?.featureAreas ?? entry.featureAreas;
    const impact = impactById.get(entry.id);
    const inferred = inferredById.get(entry.id);
    const matched = matchedById.get(entry.id);

    let relatedIssues: RelatedIssue[] = entry.relatedIssues;
    if (matched && candidates && candidates.length > 0) {
      const validNumbers = matched.issueNumbers.filter((n) =>
        candidateNumberSet.has(n),
      );
      const droppedCount = matched.issueNumbers.length - validNumbers.length;
      if (droppedCount > 0) {
        const dropped = matched.issueNumbers.filter(
          (n) => !candidateNumberSet.has(n),
        );
        log.warn(
          `候補外 issue を除外: ${droppedCount}件 (id=${entry.id}, dropped=${dropped.join(',')})`,
        );
      }
      relatedIssues = validNumbers
        .map((n) => {
          const c = candidateByNumber.get(n);
          if (!c) {
            return null;
          }
          return {
            number: c.number,
            title: c.title,
            url: c.url,
            state: c.state,
            reactionsTotal: c.reactionsTotal,
            commentsCount: c.commentsCount,
            isMaintainerInvolved: c.isMaintainerInvolved,
            maintainerDeclaration: c.maintainerDeclaration,
          } satisfies RelatedIssue;
        })
        .filter((x): x is RelatedIssue => x !== null);
    }

    const base = { ...entry, relatedIssues };

    if (inferred) {
      return applyInferenceToAnalyzedEntry(base, {
        contentJa: inferred.contentJa,
        featureAreas,
        inference: {
          before: inferred.before,
          after: inferred.after,
          benefit: inferred.benefit,
        },
        ...(impact !== undefined ? { impact } : {}),
      });
    }

    const translated = translatedById.get(entry.id);
    if (translated) {
      return applyInferenceToAnalyzedEntry(base, {
        contentJa: translated.contentJa,
        featureAreas,
        ...(impact !== undefined ? { impact } : {}),
      });
    }

    return applyInferenceToAnalyzedEntry(base, {
      featureAreas,
      ...(impact !== undefined ? { impact } : {}),
    });
  });

  const summary = batch.summary ?? analysis.summary;

  return createChangelogAnalysis({
    version: analysis.version,
    items,
    ...(summary !== undefined ? { summary } : {}),
  });
}
