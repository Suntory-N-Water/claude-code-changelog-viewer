import type {
  ChangelogEntryContent,
  ChangelogPrefix,
} from '../changelog/changelog-entry';
import type { InferenceResult } from '../inference/inference-result';
import type { RelatedDoc } from './related-doc';

export type AnalyzedChangelogEntry = {
  content: ChangelogEntryContent;
  contentJa?: string;
  prefix: ChangelogPrefix;
  featureAreas: string[];
  relatedDocs: RelatedDoc[];
  inference?: InferenceResult;
};

export type CreateAnalyzedChangelogEntryInput = {
  content: ChangelogEntryContent;
  contentJa?: string;
  prefix: ChangelogPrefix;
  featureAreas?: string[];
  relatedDocs?: RelatedDoc[];
  inference?: InferenceResult;
};

/**
 * CHANGELOG 項目に関連ドキュメントや推論結果を付与した解析項目を生成する。
 */
export function createAnalyzedChangelogEntry(
  input: CreateAnalyzedChangelogEntryInput,
): AnalyzedChangelogEntry {
  return {
    content: input.content,
    ...(input.contentJa !== undefined ? { contentJa: input.contentJa } : {}),
    prefix: input.prefix,
    featureAreas: input.featureAreas ?? [],
    relatedDocs: input.relatedDocs ?? [],
    ...(input.inference !== undefined ? { inference: input.inference } : {}),
  };
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
