import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getLogger } from '@claude-code-changelog-viewer/common';
import { AnalysisSchema } from '@claude-code-changelog-viewer/types';
import { GeminiClient } from './ai/gemini-client';
import { buildBatchInferencePrompt } from './ai/prompts/inference-prompt';

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

async function inferBenefits(version: string, skipAI: boolean): Promise<void> {
  const analysisDir = join(process.cwd(), 'analysis');
  const inferredDir = join(process.cwd(), 'inferred');
  const analysisPath = join(analysisDir, `analysis_${version}.json`);
  const inferredPath = join(inferredDir, `inferred_${version}.json`);

  // 1. analysis_{version}.json を読み込み
  log.msg('APLG0003', { params: [analysisPath] });
  const rawAnalysis = readFileSync(analysisPath, 'utf-8');
  const analysis = AnalysisSchema.parse(JSON.parse(rawAnalysis));

  // AI推論スキップモード
  if (skipAI) {
    log.info('AI推論をスキップ (コピーモード)', {
      totalItems: analysis.items.length,
    });

    // analysisをそのままバリデーションして保存
    const validated = AnalysisSchema.parse(analysis);

    mkdirSync(inferredDir, { recursive: true });
    writeFileSync(inferredPath, JSON.stringify(validated, null, 2), 'utf-8');
    log.msg('APLG0021', { params: [inferredPath] });

    log.msg('APLG0009', {
      attrs: {
        totalItems: validated.items.length,
        aiInference: 'Skipped',
      },
    });
    return;
  }

  // 2. Gemini API キー取得
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }

  // 3. Gemini クライアント初期化
  const client = new GeminiClient(apiKey, log.child({ component: 'gemini' }));

  log.msg('APLG0001', {
    params: ['AI推論'],
    attrs: {
      model: 'gemini-3-flash-preview',
      totalItems: analysis.items.length,
    },
  });

  // 4. 全項目を1回のリクエストで処理
  const prompt = buildBatchInferencePrompt(analysis.items, version);
  const result = await client.inferAll(prompt);

  // 推論+翻訳結果をマッピング
  for (const inferred of result.inferred_items) {
    const item = analysis.items[inferred.id];
    if (item) {
      item.content_ja = inferred.content_ja;
      item.inference = {
        before: inferred.before,
        after: inferred.after,
        benefit: inferred.benefit,
      };
      log.info(`翻訳+推論完了: ${item.content.substring(0, 50)}...`);
    }
  }

  // 翻訳のみ結果をマッピング
  for (const translated of result.translated_items) {
    const item = analysis.items[translated.id];
    if (item) {
      item.content_ja = translated.content_ja;
      log.info(`翻訳完了: ${item.content.substring(0, 50)}...`);
    }
  }

  // 機能領域タグの AI 補正をマージ
  if (result.feature_area_corrections) {
    for (const correction of result.feature_area_corrections) {
      const item = analysis.items[correction.id];
      if (item) {
        item.feature_areas = correction.feature_areas;
        log.info(
          `機能領域補正: ${item.content.substring(0, 50)}... → [${correction.feature_areas.join(', ')}]`,
        );
      }
    }
  }

  // サマリーを設定
  analysis.summary = result.summary;
  log.msg('APLG0002', { params: ['バージョンサマリー生成'] });

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
  log.msg('APLG0018', {
    error: error instanceof Error ? error : new Error(String(error)),
  });
  process.exit(1);
});
