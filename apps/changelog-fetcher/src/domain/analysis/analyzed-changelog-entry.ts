import { createHash } from 'node:crypto';
import type {
  ChangelogEntryContent,
  ChangelogPrefix,
} from '../changelog/changelog-entry';
import {
  type InferenceResult,
  createInferenceResult,
} from '../inference/inference-result';
import type { RelatedDoc } from './related-doc';

export type ImpactAssessment = {
  level: 'high' | 'medium' | 'low';
  defaultBehaviorChange: boolean;
  breaking: boolean;
  reason: string;
};

export type AnalyzedChangelogEntryId = string & {
  readonly __brand: 'AnalyzedChangelogEntryId';
};

export type AnalyzedChangelogEntry = {
  id: AnalyzedChangelogEntryId;
  content: ChangelogEntryContent;
  contentJa?: string;
  prefix: ChangelogPrefix;
  featureAreas: string[];
  relatedDocs: RelatedDoc[];
  inference?: InferenceResult;
  impact?: ImpactAssessment;
};

export type CreateAnalyzedChangelogEntryInput = {
  content: ChangelogEntryContent;
  contentJa?: string;
  prefix: ChangelogPrefix;
  featureAreas?: string[];
  relatedDocs?: RelatedDoc[];
  inference?: InferenceResult;
  impact?: ImpactAssessment;
};

export type ApplyInferenceToAnalyzedEntryInput = {
  contentJa?: string;
  featureAreas?: string[];
  inference?: InferenceResult;
  impact?: ImpactAssessment;
};

// sha256(content)[0:12] を entry_id として採番する
export function toAnalyzedChangelogEntryId(
  content: ChangelogEntryContent,
): AnalyzedChangelogEntryId {
  const hash = createHash('sha256').update(content, 'utf-8').digest('hex');
  return hash.slice(0, 12) as AnalyzedChangelogEntryId;
}

/**
 * CHANGELOG 項目に関連ドキュメントや推論結果を付与した解析項目を生成する。
 */
export function createAnalyzedChangelogEntry(
  input: CreateAnalyzedChangelogEntryInput,
): AnalyzedChangelogEntry {
  return {
    id: toAnalyzedChangelogEntryId(input.content),
    content: input.content,
    ...(input.contentJa !== undefined ? { contentJa: input.contentJa } : {}),
    prefix: input.prefix,
    featureAreas: input.featureAreas ?? [],
    relatedDocs: input.relatedDocs ?? [],
    ...(input.inference !== undefined ? { inference: input.inference } : {}),
    ...(input.impact !== undefined ? { impact: input.impact } : {}),
  };
}

/**
 * AI の翻訳・推論・機能領域補正を解析済み項目へ適用する。
 */
export function applyInferenceToAnalyzedEntry(
  entry: AnalyzedChangelogEntry,
  input: ApplyInferenceToAnalyzedEntryInput,
): AnalyzedChangelogEntry {
  const contentJa = input.contentJa ?? entry.contentJa;
  const inference =
    input.inference !== undefined
      ? createInferenceResult(input.inference)
      : entry.inference;
  const impact = input.impact ?? entry.impact;

  return createAnalyzedChangelogEntry({
    content: entry.content,
    prefix: entry.prefix,
    relatedDocs: entry.relatedDocs,
    ...(contentJa !== undefined ? { contentJa } : {}),
    featureAreas: input.featureAreas ?? entry.featureAreas,
    ...(inference !== undefined ? { inference } : {}),
    ...(impact !== undefined ? { impact } : {}),
  });
}

/**
 * 翻訳または利用者メリット推論が未完了かどうかを判定する。
 */
export function needsInference(entry: AnalyzedChangelogEntry): boolean {
  return (
    entry.contentJa === undefined ||
    (entry.relatedDocs.length >= 1 && entry.inference === undefined)
  );
}
