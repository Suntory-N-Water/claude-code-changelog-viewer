import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getLogger, toError } from '@claude-code-changelog-viewer/common';
import {
  type Analysis,
  AnalysisSchema,
} from '@claude-code-changelog-viewer/types';
import {
  inferBenefits,
  type InferencePort,
} from './application/infer-benefits';
import { createAnalyzedChangelogEntry } from './domain/analysis/analyzed-changelog-entry';
import {
  createChangelogAnalysis,
  type ChangelogAnalysis,
} from './domain/analysis/changelog-analysis';
import {
  type ChangelogPrefix,
  createChangelogEntryContent,
} from './domain/changelog/changelog-entry';
import {
  createChangelogVersion,
  toVersionNumber,
} from './domain/changelog/changelog-version';
import { createInferenceResult } from './domain/inference/inference-result';
import { GeminiInferenceClient } from './infrastructure/ai/gemini-inference-client';

// schema 互換のため残す固定値。現在は意味のある評価値として使わない。
const SCHEMA_COMPATIBILITY_SCORE = 0;

const log = getLogger({ name: 'benefit-inferrer' });

type CliArgs = {
  version: string;
  skipAI: boolean;
};

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const version = args.find((arg) => !arg.startsWith('--'));
  const skipAI = args.includes('--no-ai') || args.includes('--skip-ai');

  if (!version) {
    log.error('Usage: bun src/infer-benefits.ts <version> [--no-ai]');
    process.exit(1);
  }

  return { version, skipAI };
}

function toChangelogAnalysis(analysis: Analysis): ChangelogAnalysis {
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

function toAnalysisJson(analysis: ChangelogAnalysis): Analysis {
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

async function main(): Promise<void> {
  const { version, skipAI } = parseArgs();
  const analysisDir = join(process.cwd(), 'analysis');
  const inferredDir = join(process.cwd(), 'inferred');
  const analysisPath = join(analysisDir, `analysis_${version}.json`);
  const inferredPath = join(inferredDir, `inferred_${version}.json`);

  log.msg('APLG0003', { params: [analysisPath] });
  const rawAnalysis = readFileSync(analysisPath, 'utf-8');
  const analysis = toChangelogAnalysis(
    AnalysisSchema.parse(JSON.parse(rawAnalysis)),
  );

  const inference: InferencePort = skipAI
    ? {
        infer: async () => {
          throw new Error('AI推論スキップ時に inference port が呼ばれました');
        },
      }
    : new GeminiInferenceClient(
        process.env['GEMINI_API_KEY'] || '',
        log.child({ component: 'gemini' }),
      );

  const inferred = toAnalysisJson(
    await inferBenefits({ version, analysis, skipAI, inference }),
  );

  mkdirSync(inferredDir, { recursive: true });
  writeFileSync(inferredPath, JSON.stringify(inferred, null, 2), 'utf-8');
  log.msg('APLG0021', { params: [inferredPath] });

  const completedCount = inferred.items.filter(
    (item) => item.inference !== undefined && item.content_ja !== undefined,
  ).length;
  log.msg('APLG0009', {
    attrs: skipAI
      ? { totalItems: inferred.items.length, aiInference: 'Skipped' }
      : {
          completed: completedCount,
          versionSummary: inferred.summary ? 'Yes' : 'No',
          totalItems: inferred.items.length,
        },
  });
}

main().catch((error) => {
  log.msg('APLG0018', { error: toError(error) });
  process.exit(1);
});
