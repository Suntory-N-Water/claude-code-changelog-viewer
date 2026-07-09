import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getLogger, toError } from '@claude-code-changelog-viewer/common';
import { AnalysisSchema } from '@claude-code-changelog-viewer/types';
import { inferBenefits, type InferencePort } from './usecase/infer-benefits';
import type { MaintainerCandidate } from './usecase/extract-maintainer-declared-issues';
import { GeminiInferenceClient } from './infrastructure/ai/gemini-inference-client';
import { createInferredFileStore } from './infrastructure/filesystem/changelog-file-store';
import { createTiedFileStore } from './infrastructure/filesystem/tied-store';
import {
  toInferredJson,
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
  const appDir = process.cwd();
  const analysisDir = join(appDir, 'analysis');
  const inferredDir = join(appDir, 'inferred');
  const analysisPath = join(analysisDir, `analysis_${version}.json`);
  const tiedPath = join(appDir, 'tied', `tied_${version}.json`);
  const inferredPath = join(inferredDir, `inferred_${version}.json`);

  const tiedStore = createTiedFileStore(appDir);
  const tiedData = await tiedStore.load(version);

  const { analysis, candidates } = await (async () => {
    if (tiedData) {
      log.info(
        `tied ファイルから読込: tied_${version}.json (候補 ${tiedData.maintainerCandidates.length}件)`,
      );
      return {
        analysis: tiedData.analysis,
        candidates: tiedData.maintainerCandidates,
      };
    }
    const inputPath = existsSync(tiedPath) ? tiedPath : analysisPath;
    log.msg('APLG0003', { params: [inputPath] });
    const rawAnalysis = readFileSync(inputPath, 'utf-8');
    const parsedAnalysis = JSON.parse(rawAnalysis);
    const analysisJson = AnalysisSchema.parse(parsedAnalysis);
    return {
      analysis: toChangelogAnalysis(analysisJson),
      candidates: undefined as MaintainerCandidate[] | undefined,
    };
  })();

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

  const store = createInferredFileStore(appDir);
  const inferredAnalysis = await inferBenefits({
    version,
    analysis,
    skipAI,
    inference,
    store,
    ...(candidates !== undefined ? { candidates } : {}),
  });
  const inferred = toInferredJson(inferredAnalysis);

  mkdirSync(inferredDir, { recursive: true });
  const serializedInferred = JSON.stringify(inferred, null, 2);
  writeFileSync(inferredPath, serializedInferred, 'utf-8');
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
