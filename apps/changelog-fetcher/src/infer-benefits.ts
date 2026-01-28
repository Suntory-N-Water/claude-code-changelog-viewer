import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CopilotClient } from '@github/copilot-sdk';
import * as v from 'valibot';
import { buildInferencePrompt } from './prompts/inference-prompt';
import {
  type Analysis,
  AnalysisSchema,
  type InferenceResult,
  InferenceResultSchema,
} from './schemas/analysis';
import { extractJSON } from './utils/json-extractor';

async function inferBenefits(version: string): Promise<void> {
  const analysisDir = join(process.cwd(), 'analysis');
  const inferredDir = join(process.cwd(), 'inferred');
  const analysisPath = join(analysisDir, `analysis_${version}.json`);
  const inferredPath = join(inferredDir, `inferred_${version}.json`);

  // 1. analysis_{version}.json を読み込み
  console.log(`Reading ${analysisPath}...`);
  const rawAnalysis = readFileSync(analysisPath, 'utf-8');
  const analysis: Analysis = v.parse(AnalysisSchema, JSON.parse(rawAnalysis));

  // 2. モデル設定(環境変数から取得、デフォルトなしで事故防止)
  const model = process.env.COPILOT_MODEL || '';
  if (!model) {
    throw new Error(
      'COPILOT_MODEL environment variable is required (e.g., claude-sonnet-4.5)',
    );
  }

  // 3. ready_for_inference の項目を抽出
  const itemsToInfer = analysis.items.filter(
    (item) => item.analysis_status === 'ready_for_inference',
  );

  console.log(`Found ${itemsToInfer.length} items to infer.`);

  if (itemsToInfer.length === 0) {
    console.log('No items to infer. Exiting.');
    return;
  }

  // 4. Copilot SDK で推論
  const client = new CopilotClient();
  await client.start();

  const session = await client.createSession({ model });

  console.log(`Starting inference with model: ${model}...`);

  for (const item of analysis.items) {
    if (item.analysis_status === 'ready_for_inference') {
      try {
        const prompt = buildInferencePrompt(item);
        const response = await session.sendAndWait({ prompt }, 120 * 1000); // 2分タイムアウト

        if (!response?.data?.content) {
          throw new Error('AIレスポンスが空です');
        }

        const rawJSON = extractJSON(response.data.content);
        const inference: InferenceResult = v.parse(
          InferenceResultSchema,
          JSON.parse(rawJSON),
        );

        // 推論成功
        item.inference = inference;
        item.analysis_status = 'completed';
        console.log(`✓ Completed: ${item.content.substring(0, 50)}...`);
      } catch (error) {
        // 全エラー(通信、JSON解析、Valibot)を一括キャッチ
        console.error(
          `✗ Inference failed for: ${item.content.substring(0, 50)}...`,
        );
        console.error(error);
        item.analysis_status = 'inference_failed';
      }
    }
  }

  await session.destroy();
  await client.stop();

  // 5. inferred_{version}.json に保存
  analysis.analyzed_at = new Date().toISOString();

  // Valibot で最終検証
  const validated = v.parse(AnalysisSchema, analysis);

  mkdirSync(inferredDir, { recursive: true });
  writeFileSync(inferredPath, JSON.stringify(validated, null, 2), 'utf-8');
  console.log(`\nSaved to ${inferredPath}`);

  // 統計表示
  const completedCount = validated.items.filter(
    (item) => item.analysis_status === 'completed',
  ).length;
  const failedCount = validated.items.filter(
    (item) => item.analysis_status === 'inference_failed',
  ).length;

  console.log(`\n--- Summary ---`);
  console.log(`Completed: ${completedCount}`);
  console.log(`Failed: ${failedCount}`);
  console.log(`Total items: ${validated.items.length}`);
}

// エントリーポイント
const version = process.argv[2];
if (!version) {
  console.error('Usage: pnpm tsx src/infer-benefits.ts <version>');
  console.error('Example: pnpm tsx src/infer-benefits.ts 2.1.19');
  process.exit(1);
}

inferBenefits(version).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
