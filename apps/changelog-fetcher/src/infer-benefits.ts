import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getLogger, toError } from '@claude-code-changelog-viewer/common';
import {
  type Analysis,
  AnalysisSchema,
  type InferenceBatchResult,
} from '@claude-code-changelog-viewer/types';
import pRetry, { AbortError } from 'p-retry';
import { GeminiClient } from './ai/gemini-client';
import { loadModelContext } from './ai/model-context';
import {
  buildBatchInferencePrompt,
  type IndexedItem,
} from './ai/prompts/inference-prompt';

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

function applyResult(
  analysis: Analysis,
  result: InferenceBatchResult,
): Analysis {
  const inferredById = new Map(result.inferred_items.map((r) => [r.id, r]));
  const translatedById = new Map(result.translated_items.map((r) => [r.id, r]));
  const correctionById = new Map(
    (result.feature_area_corrections ?? []).map((c) => [c.id, c]),
  );

  const items = analysis.items.map((item, i) => {
    const correction = correctionById.get(i);
    const featureAreas = correction
      ? { feature_areas: correction.feature_areas }
      : {};

    const inferred = inferredById.get(i);
    if (inferred) {
      log.info(`翻訳+推論完了: ${item.content.substring(0, 50)}...`);
      return {
        ...item,
        ...featureAreas,
        content_ja: inferred.content_ja,
        inference: {
          before: inferred.before,
          after: inferred.after,
          benefit: inferred.benefit,
        },
      };
    }

    const translated = translatedById.get(i);
    if (translated) {
      log.info(`翻訳完了: ${item.content.substring(0, 50)}...`);
      return { ...item, ...featureAreas, content_ja: translated.content_ja };
    }

    return correction ? { ...item, ...featureAreas } : item;
  });

  return { ...analysis, items, summary: result.summary ?? analysis.summary };
}

function findMissingItems(analysis: Analysis): IndexedItem[] {
  return analysis.items
    .map((item, i) => ({ item, originalIndex: i }))
    .filter(
      ({ item }) =>
        item.content_ja === undefined ||
        (item.related_docs.length >= 1 && item.inference === undefined),
    );
}

async function inferBenefits(version: string, skipAI: boolean): Promise<void> {
  const analysisDir = join(process.cwd(), 'analysis');
  const inferredDir = join(process.cwd(), 'inferred');
  const analysisPath = join(analysisDir, `analysis_${version}.json`);
  const inferredPath = join(inferredDir, `inferred_${version}.json`);

  // 1. analysis_{version}.json を読み込み
  log.msg('APLG0003', { params: [analysisPath] });
  const rawAnalysis = readFileSync(analysisPath, 'utf-8');
  let analysis = AnalysisSchema.parse(JSON.parse(rawAnalysis));

  // AI推論スキップモード
  if (skipAI) {
    log.info('AI推論をスキップ (コピーモード)', {
      totalItems: analysis.items.length,
    });

    mkdirSync(inferredDir, { recursive: true });
    writeFileSync(inferredPath, JSON.stringify(analysis, null, 2), 'utf-8');
    log.msg('APLG0021', { params: [inferredPath] });

    log.msg('APLG0009', {
      attrs: {
        totalItems: analysis.items.length,
        aiInference: 'Skipped',
      },
    });
    return;
  }

  // 2. Gemini API キー取得
  const apiKey = process.env['GEMINI_API_KEY'] || '';
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }

  // 3. Gemini クライアント初期化
  const client = new GeminiClient(apiKey, log.child({ component: 'gemini' }));

  log.msg('APLG0001', {
    params: ['AI推論'],
    attrs: { totalItems: analysis.items.length },
  });

  // 4. 全項目を1回のリクエストで処理(未処理分は p-retry でリトライ)
  const modelContext = loadModelContext();
  const allIndexedItems = analysis.items.map((item, i) => ({
    item,
    originalIndex: i,
  }));

  const initialPrompt = buildBatchInferencePrompt(
    allIndexedItems,
    version,
    modelContext,
  );
  const initialResult = await client.inferAll(initialPrompt);
  analysis = applyResult(analysis, initialResult);
  log.msg('APLG0002', { params: ['バージョンサマリー生成'] });

  // 未処理項目のリトライ
  const missingAfterInitial = findMissingItems(analysis);
  if (missingAfterInitial.length > 0) {
    log.info(`未処理項目あり: ${missingAfterInitial.length}件、リトライ開始`, {
      missingIds: missingAfterInitial.map((m) => m.originalIndex),
    });

    await pRetry(
      async () => {
        const missing = findMissingItems(analysis);
        if (missing.length === 0) {
          return;
        }

        const retryPrompt = buildBatchInferencePrompt(
          missing,
          version,
          modelContext,
        );
        try {
          const retryResult = await client.inferAll(retryPrompt);
          analysis = applyResult(analysis, retryResult);
        } catch (error) {
          // GeminiClient が全モデルのリトライ・フォールバック済みのためここで諦める
          throw new AbortError(
            error instanceof Error ? error.message : String(error),
          );
        }

        const stillMissing = findMissingItems(analysis);
        if (stillMissing.length > 0) {
          throw new Error(
            `未処理項目が残存: ${stillMissing.length}件 (ids: ${stillMissing.map((m) => m.originalIndex).join(', ')})`,
          );
        }
      },
      {
        retries: 3,
        onFailedAttempt: (context) => {
          log.info(
            `リトライ ${context.attemptNumber}/3 失敗: ${context.error.message}`,
            { retriesLeft: context.retriesLeft },
          );
        },
      },
    ).catch(() => {
      const stillMissing = findMissingItems(analysis);
      log.info(`リトライ上限到達、未処理項目が残存: ${stillMissing.length}件`, {
        missingIds: stillMissing.map((m) => m.originalIndex),
      });
    });
  }

  // 5. inferred_{version}.json に保存
  // Zod で最終検証
  const validated = AnalysisSchema.parse(analysis);

  mkdirSync(inferredDir, { recursive: true });
  writeFileSync(inferredPath, JSON.stringify(validated, null, 2), 'utf-8');
  log.msg('APLG0021', { params: [inferredPath] });

  // 統計表示
  const completedCount = validated.items.filter(
    (item) => item.inference !== undefined && item.content_ja !== undefined,
  ).length;

  log.msg('APLG0009', {
    attrs: {
      completed: completedCount,
      versionSummary: validated.summary ? 'Yes' : 'No',
      totalItems: validated.items.length,
    },
  });
}

// エントリーポイント
const { version, skipAI } = parseArgs();

inferBenefits(version, skipAI).catch((error) => {
  log.msg('APLG0018', { error: toError(error) });
  process.exit(1);
});
