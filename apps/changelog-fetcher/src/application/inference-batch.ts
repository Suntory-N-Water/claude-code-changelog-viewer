import {
  type AnalyzedChangelogEntry,
  createAnalyzedChangelogEntry,
  needsInference,
} from '../domain/analysis/analyzed-changelog-entry';
import {
  type ChangelogAnalysis,
  createChangelogAnalysis,
} from '../domain/analysis/changelog-analysis';
import { createInferenceResult } from '../domain/inference/inference-result';

export type InferredBatchItem = {
  readonly id: number;
  readonly contentJa: string;
  readonly before: string;
  readonly after: string;
  readonly benefit: string;
};

export type TranslatedBatchItem = {
  readonly id: number;
  readonly contentJa: string;
};

export type FeatureAreaCorrection = {
  readonly id: number;
  readonly featureAreas: readonly string[];
};

export type InferenceBatch = {
  readonly inferredItems: readonly InferredBatchItem[];
  readonly translatedItems: readonly TranslatedBatchItem[];
  readonly featureAreaCorrections: readonly FeatureAreaCorrection[];
  readonly summary?: string;
};

export type IndexedAnalyzedEntry = {
  readonly entry: AnalyzedChangelogEntry;
  readonly originalIndex: number;
};

/**
 * AI 応答から得た一括推論結果を生成する。
 */
export function createInferenceBatch(input: {
  readonly inferredItems?: readonly InferredBatchItem[];
  readonly translatedItems?: readonly TranslatedBatchItem[];
  readonly featureAreaCorrections?: readonly FeatureAreaCorrection[];
  readonly summary?: string;
}): InferenceBatch {
  return {
    inferredItems: input.inferredItems ?? [],
    translatedItems: input.translatedItems ?? [],
    featureAreaCorrections: input.featureAreaCorrections ?? [],
    ...(input.summary !== undefined ? { summary: input.summary } : {}),
  };
}

/**
 * AI 再実行が必要な解析項目を元の配列 index 付きで抽出する。
 */
export function findMissingInferenceItems(
  analysis: ChangelogAnalysis,
): IndexedAnalyzedEntry[] {
  return analysis.items
    .map((entry, originalIndex) => ({ entry, originalIndex }))
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

  const items = analysis.items.map((entry, index) => {
    const correction = correctionById.get(index);
    const featureAreas = correction?.featureAreas ?? entry.featureAreas;
    const inferred = inferredById.get(index);

    if (inferred) {
      return createAnalyzedChangelogEntry({
        ...entry,
        contentJa: inferred.contentJa,
        featureAreas,
        inference: createInferenceResult({
          before: inferred.before,
          after: inferred.after,
          benefit: inferred.benefit,
        }),
      });
    }

    const translated = translatedById.get(index);
    if (translated) {
      return createAnalyzedChangelogEntry({
        ...entry,
        contentJa: translated.contentJa,
        featureAreas,
      });
    }

    return createAnalyzedChangelogEntry({ ...entry, featureAreas });
  });

  const summary = batch.summary ?? analysis.summary;

  return createChangelogAnalysis({
    version: analysis.version,
    items,
    ...(summary !== undefined ? { summary } : {}),
  });
}
