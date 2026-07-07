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

export type InferenceBatch = {
  inferredItems: InferredBatchItem[];
  translatedItems: TranslatedBatchItem[];
  featureAreaCorrections: FeatureAreaCorrection[];
  impactItems: ImpactBatchItem[];
  summary?: string;
};

export type IndexedAnalyzedEntry = {
  entry: AnalyzedChangelogEntry;
  id: AnalyzedChangelogEntryId;
};

/**
 * AI 応答から得た一括推論結果を生成する。
 */
export function createInferenceBatch(input: {
  inferredItems?: InferredBatchItem[];
  translatedItems?: TranslatedBatchItem[];
  featureAreaCorrections?: FeatureAreaCorrection[];
  impactItems?: ImpactBatchItem[];
  summary?: string;
}): InferenceBatch {
  return {
    inferredItems: input.inferredItems ?? [],
    translatedItems: input.translatedItems ?? [],
    featureAreaCorrections: input.featureAreaCorrections ?? [],
    impactItems: input.impactItems ?? [],
    ...(input.summary !== undefined ? { summary: input.summary } : {}),
  };
}

/**
 * AI 再実行が必要な解析項目を id 付きで抽出する。
 */
export function findMissingInferenceItems(
  analysis: ChangelogAnalysis,
): IndexedAnalyzedEntry[] {
  return analysis.items
    .map((entry) => ({ entry, id: entry.id }))
    .filter(({ entry }) => needsInference(entry));
}

/**
 * AI の翻訳・推論・機能領域補正を解析結果へ反映する。
 */
export function applyInferenceBatch(
  analysis: ChangelogAnalysis,
  batch: InferenceBatch,
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

  const items = analysis.items.map((entry) => {
    const correction = correctionById.get(entry.id);
    const featureAreas = correction?.featureAreas ?? entry.featureAreas;
    const impact = impactById.get(entry.id);
    const inferred = inferredById.get(entry.id);

    if (inferred) {
      return applyInferenceToAnalyzedEntry(entry, {
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
      return applyInferenceToAnalyzedEntry(entry, {
        contentJa: translated.contentJa,
        featureAreas,
        ...(impact !== undefined ? { impact } : {}),
      });
    }

    return applyInferenceToAnalyzedEntry(entry, {
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
