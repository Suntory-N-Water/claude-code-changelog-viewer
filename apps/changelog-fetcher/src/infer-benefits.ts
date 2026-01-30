import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AnalysisSchema } from '@claude-code-changelog-viewer/types';
import { GeminiClient } from './ai/gemini-client';
import { buildInferencePrompt } from './ai/prompts/inference-prompt';
import { buildSummaryPrompt } from './ai/prompts/summary-prompt';
import { buildTranslationPrompt } from './ai/prompts/translation-prompt';

async function inferBenefits(version: string): Promise<void> {
  const analysisDir = join(process.cwd(), 'analysis');
  const inferredDir = join(process.cwd(), 'inferred');
  const analysisPath = join(analysisDir, `analysis_${version}.json`);
  const inferredPath = join(inferredDir, `inferred_${version}.json`);

  // 1. analysis_{version}.json を読み込み
  console.log(`Reading ${analysisPath}...`);
  const rawAnalysis = readFileSync(analysisPath, 'utf-8');
  const analysis = AnalysisSchema.parse(JSON.parse(rawAnalysis));

  // 2. Gemini API キー取得
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }

  // 3. Gemini クライアント初期化
  const client = new GeminiClient(apiKey);

  console.log('Starting processing with model: gemini-3-flash-preview...');
  console.log(`Total items: ${analysis.items.length}`);

  // 4. 全項目を処理（レート制限を遵守しつつ個別リクエスト）
  for (const item of analysis.items) {
    // 既に処理済みの項目はスキップ
    if (item.content_ja && item.inference) {
      console.log(
        `⊘ Skipped (already processed): ${item.content.substring(0, 50)}...`,
      );
      continue;
    }

    try {
      // related_docs が2件以上: 翻訳 + 推論
      if (item.related_docs.length >= 2) {
        const prompt = buildInferencePrompt(item);
        const result = await client.inferWithTranslation(prompt);
        item.content_ja = result.content_ja;
        item.inference = {
          before: result.before,
          after: result.after,
          benefit: result.benefit,
        };
        console.log(
          `✓ Translation + Inference: ${item.content.substring(0, 50)}...`,
        );
      } else {
        // related_docs が2件未満: 翻訳のみ
        const prompt = buildTranslationPrompt(item);
        const contentJa = await client.translateOnly(prompt);
        item.content_ja = contentJa;
        console.log(`✓ Translation only: ${item.content.substring(0, 50)}...`);
      }
    } catch (error) {
      console.error(
        `✗ Processing failed for: ${item.content.substring(0, 50)}...`,
      );
      console.error(error);
    }
  }

  // 4-2. バージョンサマリー生成
  if (!analysis.summary) {
    console.log('\nGenerating version summary...');
    try {
      const summaryPrompt = buildSummaryPrompt(
        analysis.items.map((item) => ({
          content: item.content,
          prefix: item.prefix,
        })),
        version,
      );
      const summary = await client.generateVersionSummary(summaryPrompt);
      analysis.summary = summary;
      console.log('✓ Version summary generated');
    } catch (error) {
      console.error('✗ Version summary generation failed');
      console.error(error);
    }
  }

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
