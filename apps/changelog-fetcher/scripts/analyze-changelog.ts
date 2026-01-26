import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as v from 'valibot';
import { parseChangelog } from '../src/parsers/changelog-parser';
import { extractKeywords } from '../src/parsers/keyword-extractor';
import { type Analysis, AnalysisSchema } from '../src/schemas/analysis';
import { getTopDocs } from '../src/scorers/context-scorer';
import { searchDocs, shouldSkipSearch } from '../src/searchers/grep-executor';
import { extractSnippets } from '../src/searchers/snippet-extractor';
import type { AnalysisStatus } from '../src/types';

/**
 * 関連ドキュメント数から分析ステータスを判定
 */
function determineStatus(
  relatedDocsCount: number,
  isSkipped: boolean,
): AnalysisStatus {
  if (isSkipped) {
    return 'sdk_only';
  }
  if (relatedDocsCount === 0) {
    return 'no_docs_found';
  }
  if (relatedDocsCount >= 2) {
    return 'ready_for_inference';
  }
  return 'docs_pending';
}

async function main() {
  const version = process.argv[2]; // v2.1.19

  if (!version) {
    console.error('Usage: tsx scripts/analyze-changelog.ts <version>');
    process.exit(1);
  }

  console.log(`Analyzing CHANGELOG for ${version}...`);

  // 1. CHANGELOGを読み込み
  const changelogPath = path.join(process.cwd(), 'changelogs', `${version}.md`);
  const changelog = await fs.readFile(changelogPath, 'utf-8');

  // 2. パース
  const items = parseChangelog(changelog);
  console.log(`Found ${items.length} items`);

  // 3. 各項目を処理
  const analyzedItems = await Promise.all(
    items.map(async (item, index) => {
      console.log(
        `[${index + 1}/${items.length}] Processing: ${item.content.slice(0, 60)}...`,
      );

      // キーワード抽出
      const keywords = extractKeywords(item);

      // タグによる特別処理（SDK/API）
      if (shouldSkipSearch(item.tags)) {
        return {
          ...item,
          keywords,
          search_strategy: 'skip' as const,
          related_docs: [],
          analysis_status: 'sdk_only' as const,
        };
      }

      // Grep実行
      const searchResult = searchDocs(keywords);

      // スニペット取得
      const snippetResults = extractSnippets(searchResult.files, keywords);

      // スコアリング & 上位3件取得
      const topDocs = getTopDocs(snippetResults, 3);

      // ステータス判定
      const status = determineStatus(topDocs.length, false);

      return {
        ...item,
        keywords,
        search_strategy: searchResult.strategy,
        related_docs: topDocs,
        analysis_status: status,
      };
    }),
  );

  // 4. Valibot検証
  let result: Analysis;
  try {
    result = v.parse(AnalysisSchema, {
      version: version.replace('v', ''),
      analyzed_at: new Date().toISOString(),
      items: analyzedItems,
    });
  } catch (error) {
    console.error('❌ Validation failed:');
    if (error instanceof v.ValiError) {
      console.error(v.flatten(error.issues));
    }
    console.error('Data:', JSON.stringify(analyzedItems, null, 2));
    process.exit(1);
  }

  // 5. JSON出力
  const outputPath = path.join(
    process.cwd(),
    'metadata',
    `analysis_${version}.json`,
  );
  await fs.writeFile(outputPath, JSON.stringify(result, null, 2));

  console.log(`✅ Analysis complete: ${outputPath}`);
  console.log('📊 Stats:');
  console.log(`  - Total items: ${result.items.length}`);
  console.log(
    `  - Ready for inference: ${result.items.filter((i) => i.analysis_status === 'ready_for_inference').length}`,
  );
  console.log(
    `  - Docs pending: ${result.items.filter((i) => i.analysis_status === 'docs_pending').length}`,
  );
  console.log(
    `  - SDK only: ${result.items.filter((i) => i.analysis_status === 'sdk_only').length}`,
  );
  console.log(
    `  - No docs found: ${result.items.filter((i) => i.analysis_status === 'no_docs_found').length}`,
  );
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
