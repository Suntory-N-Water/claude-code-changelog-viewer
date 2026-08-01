import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getLogger, toError } from '@claude-code-changelog-viewer/common';
import { AnalysisSchema } from '@claude-code-changelog-viewer/types';
import { inferBenefits, type InferencePort } from './usecase/infer-benefits';
import { GeminiInferenceClient } from './infrastructure/ai/gemini-inference-client';
import { INFERENCE_TASK_SCHEMA } from './infrastructure/ai/gemini-client';
import { buildInferenceTaskSection } from './infrastructure/ai/prompts/inference-prompt';
import { createInferredFileStore } from './infrastructure/filesystem/changelog-file-store';
import {
  toInferredJson,
  toChangelogAnalysis,
} from './infrastructure/serializers/analysis-serializer';

const log = getLogger({ name: 'benefit-inferrer' });

type CliArgs = {
  version: string;
  skipAI: boolean;
  dryRun: boolean;
  withSchema: boolean;
  ids?: string[];
};

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const skipAI = args.includes('--no-ai') || args.includes('--skip-ai');
  const dryRun = args.includes('--dry-run');
  const withSchema = args.includes('--with-schema');

  const idFlagIndex = args.indexOf('--id');
  const idValueIndex = idFlagIndex >= 0 ? idFlagIndex + 1 : -1;
  const idValue = idValueIndex >= 0 ? args[idValueIndex] : undefined;
  // --id の値(位置引数)は version 判定から除外する
  const version = args.find(
    (arg, i) => !arg.startsWith('--') && i !== idValueIndex,
  );

  if (!version) {
    log.error(
      'Usage: tsx src/infer-benefits.ts <version> [--no-ai] [--dry-run [--with-schema] [--id id1,id2]]',
    );
    process.exit(1);
  }

  if (dryRun && skipAI) {
    log.error('--dry-run と --no-ai / --skip-ai は同時に指定できません');
    process.exit(1);
  }

  if (withSchema && !dryRun) {
    log.error('--with-schema は --dry-run との併用が必須です');
    process.exit(1);
  }

  let ids: string[] | undefined;
  if (idFlagIndex >= 0) {
    ids = (idValue ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
    if (ids.length === 0) {
      log.error('--id にはカンマ区切りの id を1件以上指定してください');
      process.exit(1);
    }
  }

  return { version, skipAI, dryRun, withSchema, ...(ids ? { ids } : {}) };
}

async function main(): Promise<void> {
  const { version, skipAI, dryRun, withSchema, ids } = parseArgs();
  const appDir = process.cwd();
  const analysisDir = join(appDir, 'analysis');
  const inferredDir = join(appDir, 'inferred');
  const analysisPath = join(analysisDir, `analysis_${version}.json`);
  const inferredPath = join(inferredDir, `inferred_${version}.json`);

  log.msg('APLG0003', { params: [analysisPath] });
  const rawAnalysis = readFileSync(analysisPath, 'utf-8');
  const parsedAnalysis = JSON.parse(rawAnalysis);
  const analysisJson = AnalysisSchema.parse(parsedAnalysis);
  const analysis = toChangelogAnalysis(analysisJson);

  if (dryRun) {
    const indexed = analysis.items.map((entry) => ({ entry, id: entry.id }));
    const targets =
      ids !== undefined
        ? (() => {
            const idSet = new Set(ids);
            const missing = ids.filter(
              (id) => !indexed.some((item) => item.id === id),
            );
            if (missing.length > 0) {
              log.error(
                `存在しない id が指定されました: ${missing.join(', ')}`,
              );
              process.exit(1);
            }
            return indexed.filter((item) => idSet.has(item.id));
          })()
        : indexed;

    const dryRunDir = join(appDir, 'dry-run', version);
    mkdirSync(dryRunDir, { recursive: true });

    const promptPath = join(dryRunDir, 'prompt.md');
    writeFileSync(promptPath, buildInferenceTaskSection(targets), 'utf-8');
    log.info(`プロンプトを出力: ${promptPath}`);

    if (withSchema) {
      const schemaPath = join(dryRunDir, 'schema.json');
      writeFileSync(
        schemaPath,
        JSON.stringify(
          INFERENCE_TASK_SCHEMA,
          (key, value) =>
            key === 'type' && typeof value === 'string'
              ? value.toLowerCase()
              : value,
          2,
        ),
        'utf-8',
      );
      log.info(`スキーマを出力: ${schemaPath}`);
    }

    return;
  }

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
