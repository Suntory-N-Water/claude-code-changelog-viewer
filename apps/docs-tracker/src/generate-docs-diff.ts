#!/usr/bin/env node

import { getLogger, toError } from '@claude-code-changelog-viewer/common';
import { DocsDiffGenerator } from './lib/docs-diff-generator';
import { DocsSummaryClient } from './lib/docs-summary-client';

const logger = getLogger({ name: 'docs-diff-generator' });

async function main() {
  logger.msg('APLG0001', { params: ['英語ドキュメント diff 生成'] });

  const startTime = Date.now();

  try {
    const generator = new DocsDiffGenerator(process.cwd(), logger);

    // git diff --staged から docs/en/ の変更を取得
    const files = await generator.getEnStagedDiff();

    if (files.length === 0) {
      logger.info('英語ドキュメントに変更なし。diff 生成をスキップします。');
      process.exit(0);
    }

    const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
    const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);
    logger.info(
      `変更検知: ${files.length} ファイル (+${totalAdditions} -${totalDeletions})`,
    );

    // AI サマリ・解説生成
    const geminiApiKey = process.env['GEMINI_API_KEY'] ?? '';
    let aiSummary = '';
    let fileExplanations: { filename: string; explanation: string }[] = [];

    if (geminiApiKey) {
      logger.msg('APLG0003', { params: ['AI サマリ・解説'] });
      const summaryClient = new DocsSummaryClient(geminiApiKey, logger);
      ({ aiSummary, fileExplanations } =
        await summaryClient.generateSummaryAndExplanations(files));
      logger.msg('APLG0002', { params: ['AI サマリ・解説'] });
    } else {
      logger.warn('GEMINI_API_KEY が未設定のため AI サマリをスキップします');
      aiSummary = `Claude Code の英語ドキュメントが更新されました(${files.length} ファイル)。`;
    }

    // AI 解説をファイルごとにマージ
    // AIはプロンプト制約により .md なしで返す場合があるため正規化して比較
    const filesWithExplanations = files.map((f) => ({
      ...f,
      explanation:
        fileExplanations.find(
          (e) =>
            e.filename === f.filename ||
            e.filename === f.filename.replace(/\.md$/, ''),
        )?.explanation ?? '',
    }));

    // docs_diff.json に追記
    const id = await generator.appendDiffEntry(
      filesWithExplanations,
      aiSummary,
    );

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.msg('APLG0002', {
      params: ['diff 生成'],
      attrs: { 'elapsed.seconds': elapsed, 'diff.id': id },
    });

    process.exit(0);
  } catch (error) {
    logger.msg('APLG0018', { error: toError(error) });
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    logger.msg('APLG0019', { error: toError(error) });
    process.exit(1);
  });
}

export { main };
