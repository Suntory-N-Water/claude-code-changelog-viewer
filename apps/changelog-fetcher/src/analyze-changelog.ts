import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  type Analysis,
  AnalysisSchema,
} from '@claude-code-changelog-viewer/types';
import { parseChangelog } from './parsers/changelog-parser';
import { extractKeywords } from './parsers/keyword-extractor';
import { getTopDocs } from './scorers/context-scorer';
import { searchDocs, shouldSkipSearch } from './searchers/grep-executor';
import { extractSnippets } from './searchers/snippet-extractor';

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

      // タグによる特別処理(SDK/API)
      if (shouldSkipSearch(item.tags)) {
        return {
          content: item.content,
          prefix: item.prefix,
          importance_score: item.importance_score,
          related_docs: [],
        };
      }

      // Grep実行
      const searchResult = searchDocs(keywords);

      // スニペット取得
      const snippetResults = extractSnippets(searchResult.files, keywords);

      // スコアリング & 上位3件取得
      const topDocs = getTopDocs(snippetResults, 3);

      return {
        content: item.content,
        prefix: item.prefix,
        importance_score: item.importance_score,
        related_docs: topDocs,
      };
    }),
  );

  // 4. Zod検証
  let result: Analysis;
  try {
    result = AnalysisSchema.parse({
      version: version.replace('v', ''),
      items: analyzedItems,
    });
  } catch (error) {
    console.error('❌ Validation failed:');
    console.error(error);
    console.error('Data:', JSON.stringify(analyzedItems, null, 2));
    process.exit(1);
  }

  // 5. JSON出力
  const outputPath = path.join(
    process.cwd(),
    'analysis',
    `analysis_${version}.json`,
  );
  await fs.writeFile(outputPath, JSON.stringify(result, null, 2));

  console.log(`✅ Analysis complete: ${outputPath}`);
  console.log('📊 Stats:');
  console.log(`  - Total items: ${result.items.length}`);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
