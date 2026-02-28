import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { getLogger } from '@claude-code-changelog-viewer/common';
import {
  type Analysis,
  AnalysisSchema,
} from '@claude-code-changelog-viewer/types';
import { parseChangelog } from './parsers/changelog-parser';
import { tagFeatureAreas } from './parsers/feature-area-tagger';
import { extractKeywords } from './parsers/keyword-extractor';
import { getTopDocs } from './scorers/context-scorer';
import { searchDocs } from './searchers/grep-executor';
import { extractSnippets } from './searchers/snippet-extractor';

const log = getLogger({ name: 'changelog-analyzer' });

async function main() {
  const version = process.argv[2]; // v2.1.19

  if (!version) {
    log.error('Usage: tsx scripts/analyze-changelog.ts <version>');
    process.exit(1);
  }

  log.msg('APLG0001', { params: [`CHANGELOG 解析 (${version})`] });

  // 1. CHANGELOGを読み込み
  const changelogPath = path.join(process.cwd(), 'changelogs', `${version}.md`);
  const changelog = await fs.readFile(changelogPath, 'utf-8');

  // 2. パース
  const items = parseChangelog(changelog);
  log.msg('APLG0010', { params: [`${items.length} 件の項目`] });

  // 3. 各項目を処理
  const analyzedItems = await Promise.all(
    items.map(async (item, index) => {
      log.info(
        `[${index + 1}/${items.length}] ${item.content.slice(0, 60)}...`,
      );

      // キーワード抽出
      const keywords = extractKeywords(item);

      // ドキュメント検索
      const searchResult = await searchDocs(keywords);

      // スニペット取得
      const snippetResults = await extractSnippets(
        searchResult.files,
        keywords,
      );

      // スコアリング & 上位3件取得
      const topDocs = getTopDocs(snippetResults, 3);

      return {
        content: item.content,
        prefix: item.prefix,
        importance_score: item.importance_score,
        feature_areas: tagFeatureAreas(item.content),
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
    log.msg('APLG0022', {
      params: ['解析結果'],
      error: error instanceof Error ? error : new Error(String(error)),
      attrs: { data: JSON.stringify(analyzedItems, null, 2) },
    });
    process.exit(1);
  }

  // 5. JSON出力
  const outputPath = path.join(
    process.cwd(),
    'analysis',
    `analysis_${version}.json`,
  );
  await fs.writeFile(outputPath, JSON.stringify(result, null, 2));

  log.msg('APLG0002', {
    params: ['解析'],
    attrs: { outputPath, totalItems: result.items.length },
  });
}

main().catch((error) => {
  log.msg('APLG0018', {
    error: error instanceof Error ? error : new Error(String(error)),
  });
  process.exit(1);
});
