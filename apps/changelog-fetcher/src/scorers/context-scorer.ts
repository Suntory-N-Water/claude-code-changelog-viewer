import type { RelatedDoc } from '@claude-code-changelog-viewer/types';
import type { SnippetResult } from '../types';

// context_score / total_score は出力 schema 互換のためだけに残す。現在は意味のある評価値として使わない。
const SCHEMA_COMPATIBILITY_SCORE = 0;

/**
 * スニペット結果リストから先頭N件を取得する。
 */
export function getTopDocs(
  snippetResults: SnippetResult[],
  topN = 3,
): RelatedDoc[] {
  return snippetResults.slice(0, topN).map(({ file, snippets, hit_count }) => ({
    file,
    snippets,
    hit_count,
    context_score: SCHEMA_COMPATIBILITY_SCORE,
    total_score: SCHEMA_COMPATIBILITY_SCORE,
  }));
}
