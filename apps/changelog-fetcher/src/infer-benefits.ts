import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AnalysisSchema } from '@claude-code-changelog-viewer/types';
import { GeminiClient } from './ai/gemini-client';
import { buildBatchInferencePrompt } from './ai/prompts/inference-prompt';

type CliArgs = {
  version: string;
  skipAI: boolean;
};

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const version = args.find((arg) => !arg.startsWith('--'));
  const skipAI = args.includes('--no-ai') || args.includes('--skip-ai');

  if (!version) {
    console.error('Usage: pnpm tsx src/infer-benefits.ts <version> [--no-ai]');
    console.error('Example: pnpm tsx src/infer-benefits.ts 2.1.19');
    console.error(
      'Example (no AI): pnpm tsx src/infer-benefits.ts 2.1.19 --no-ai',
    );
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
  console.log(`Reading ${analysisPath}...`);
  const rawAnalysis = readFileSync(analysisPath, 'utf-8');
  const analysis = AnalysisSchema.parse(JSON.parse(rawAnalysis));

  // AI推論スキップモード
  if (skipAI) {
    console.log('Running in no-AI mode (copy only)...');
    console.log(`Total items: ${analysis.items.length}`);

    // analysisをそのままバリデーションして保存
    const validated = AnalysisSchema.parse(analysis);

    mkdirSync(inferredDir, { recursive: true });
    writeFileSync(inferredPath, JSON.stringify(validated, null, 2), 'utf-8');
    console.log(`\nSaved to ${inferredPath} (no AI processing)`);

    console.log(`\n--- Summary ---`);
    console.log(`Total items: ${validated.items.length}`);
    console.log(`AI inference: Skipped`);
    return;
  }

  // 2. Gemini API キー取得
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }

  // 3. Gemini クライアント初期化
  const client = new GeminiClient(apiKey);

  console.log('Starting processing with model: gemini-3-flash-preview...');
  console.log(`Total items: ${analysis.items.length}`);

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
      console.log(
        `✓ Translation + Inference: ${item.content.substring(0, 50)}...`,
      );
    }
  }

  // 翻訳のみ結果をマッピング
  for (const translated of result.translated_items) {
    const item = analysis.items[translated.id];
    if (item) {
      item.content_ja = translated.content_ja;
      console.log(`✓ Translation only: ${item.content.substring(0, 50)}...`);
    }
  }

  // 機能領域タグの AI 補正をマージ
  if (result.feature_area_corrections) {
    for (const correction of result.feature_area_corrections) {
      const item = analysis.items[correction.id];
      if (item) {
        item.feature_areas = correction.feature_areas;
        console.log(
          `✓ Feature area correction: ${item.content.substring(0, 50)}... → [${correction.feature_areas.join(', ')}]`,
        );
      }
    }
  }

  // サマリーを設定
  analysis.summary = result.summary;
  console.log('✓ Version summary generated');

  // 5. inferred_{version}.json に保存
  // Zod で最終検証
  const validated = AnalysisSchema.parse(analysis);

  mkdirSync(inferredDir, { recursive: true });
  writeFileSync(inferredPath, JSON.stringify(validated, null, 2), 'utf-8');
  console.log(`\nSaved to ${inferredPath}`);

  // 統計表示
  const completedCount = validated.items.filter(
    (item) => item.inference !== undefined && item.content_ja !== undefined,
  ).length;

  console.log(`\n--- Summary ---`);
  console.log(`Completed: ${completedCount}`);
  console.log(`Version summary: ${validated.summary ? 'Yes' : 'No'}`);
  console.log(`Total items: ${validated.items.length}`);
}

// エントリーポイント
const { version, skipAI } = parseArgs();

inferBenefits(version, skipAI).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
