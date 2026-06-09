import {
  type Analysis,
  AnalysisSchema,
} from '@claude-code-changelog-viewer/types';
import { createAnalyzedChangelogEntry } from '../../domain/analysis/analyzed-changelog-entry';
import {
  createChangelogAnalysis,
  type ChangelogAnalysis,
} from '../../domain/analysis/changelog-analysis';
import {
  type ChangelogPrefix,
  createChangelogEntryContent,
} from '../../domain/changelog/changelog-entry';
import {
  createChangelogVersion,
  toVersionNumber,
} from '../../domain/changelog/changelog-version';
import { createInferenceResult } from '../../domain/inference/inference-result';

// schema 互換のため残す固定値。現在は意味のある評価値として使わない。
const SCHEMA_COMPATIBILITY_SCORE = 0;

export function toChangelogAnalysis(analysis: Analysis): ChangelogAnalysis {
  return createChangelogAnalysis({
    version: createChangelogVersion(analysis.version),
    ...(analysis.summary !== undefined ? { summary: analysis.summary } : {}),
    items: analysis.items.map((item) =>
      createAnalyzedChangelogEntry({
        content: createChangelogEntryContent(item.content),
        prefix: item.prefix as ChangelogPrefix,
        featureAreas: item.feature_areas ?? [],
        relatedDocs: item.related_docs.map((doc) => ({
          file: doc.file,
          snippets: doc.snippets,
          hitCount: doc.hit_count,
        })),
        ...(item.inference !== undefined
          ? {
              inference: createInferenceResult({
                before: item.inference.before,
                after: item.inference.after,
                benefit: item.inference.benefit,
              }),
            }
          : {}),
        ...(item.content_ja !== undefined
          ? { contentJa: item.content_ja }
          : {}),
      }),
    ),
  });
}

export function toAnalysisJson(analysis: ChangelogAnalysis): Analysis {
  return AnalysisSchema.parse({
    version: toVersionNumber(analysis.version),
    ...(analysis.summary !== undefined ? { summary: analysis.summary } : {}),
    items: analysis.items.map((entry) => ({
      content: entry.content,
      ...(entry.contentJa !== undefined ? { content_ja: entry.contentJa } : {}),
      prefix: entry.prefix,
      importance_score: SCHEMA_COMPATIBILITY_SCORE,
      feature_areas: [...entry.featureAreas],
      related_docs: entry.relatedDocs.map((doc) => ({
        file: doc.file,
        snippets: [...doc.snippets],
        hit_count: doc.hitCount,
        context_score: SCHEMA_COMPATIBILITY_SCORE,
        total_score: SCHEMA_COMPATIBILITY_SCORE,
      })),
      ...(entry.inference !== undefined
        ? {
            inference: {
              before: entry.inference.before,
              after: entry.inference.after,
              benefit: entry.inference.benefit,
            },
          }
        : {}),
    })),
  });
}
