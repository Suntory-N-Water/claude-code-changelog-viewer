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
          snippetScores: doc.snippet_scores ?? [],
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
        ...(item.impact !== undefined
          ? {
              impact: {
                level: item.impact.level,
                defaultBehaviorChange: item.impact.default_behavior_change,
                breaking: item.impact.breaking,
                reason: item.impact.reason,
              },
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
      id: entry.id,
      content: entry.content,
      ...(entry.contentJa !== undefined ? { content_ja: entry.contentJa } : {}),
      prefix: entry.prefix,
      feature_areas: [...entry.featureAreas],
      related_docs: entry.relatedDocs.map((doc) => ({
        file: doc.file,
        snippets: [...doc.snippets],
        snippet_scores: [...doc.snippetScores],
        hit_count: doc.hitCount,
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
      ...(entry.impact !== undefined
        ? {
            impact: {
              level: entry.impact.level,
              default_behavior_change: entry.impact.defaultBehaviorChange,
              breaking: entry.impact.breaking,
              reason: entry.impact.reason,
            },
          }
        : {}),
    })),
  });
}
