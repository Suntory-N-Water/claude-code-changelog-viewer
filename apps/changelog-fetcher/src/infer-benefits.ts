import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getLogger, toError } from '@claude-code-changelog-viewer/common';
import { AnalysisSchema } from '@claude-code-changelog-viewer/types';
import { inferBenefits, type InferencePort } from './usecase/infer-benefits';
import { GeminiInferenceClient } from './infrastructure/ai/gemini-inference-client';
import { createInferredFileStore } from './infrastructure/filesystem/changelog-file-store';
import {
  toAnalysisJson,
  toChangelogAnalysis,
} from './infrastructure/serializers/analysis-serializer';

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
    await inferBenefits({
      version,
      analysis,
      skipAI,
      inference,
      store: createInferredFileStore(process.cwd()),
    }),
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
