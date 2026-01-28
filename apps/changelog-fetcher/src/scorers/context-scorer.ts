import type { RelatedDoc } from '../schemas/analysis';
import type { SnippetResult } from '../types';

/**
 * 単一のスニペットのコンテキストスコアを計算
 */
function calculateSnippetScore(snippet: string): number {
  let score = 1; // 基本スコア

  // 見出しを含む(## で始まる行)
  if (/^##+ /m.test(snippet)) {
    score += 5;
  }

  // コードブロックを含む(```)
  if (/```/.test(snippet)) {
    score += 3;
  }

  // 解説キーワードを含む
  if (/(how to|example|usage|説明|使い方)/i.test(snippet)) {
    score += 2;
  }

  return score;
}

/**
 * スニペット結果からコンテキストスコアを計算
 */
export function calculateContextScore(snippetResult: SnippetResult): number {
  const { snippets } = snippetResult;

  if (snippets.length === 0) {
    return 0;
  }

  // 各スニペットのスコアを合計
  return snippets.reduce((total, snippet) => {
    return total + calculateSnippetScore(snippet);
  }, 0);
}

/**
 * 総合スコアを計算(ヒット数 × コンテキストスコア)
 */
export function calculateTotalScore(
  hit_count: number,
  context_score: number,
): number {
  return hit_count * context_score;
}

/**
 * スニペット結果をRelatedDocに変換(スコア付き)
 */
export function scoreSnippetResult(snippetResult: SnippetResult): RelatedDoc {
  const { file, snippets, hit_count } = snippetResult;
  const context_score = calculateContextScore(snippetResult);
  const total_score = calculateTotalScore(hit_count, context_score);

  return {
    file,
    snippets,
    hit_count,
    context_score,
    total_score,
  };
}

/**
 * スニペット結果リストをスコアリングして上位N件を取得
 */
export function getTopDocs(
  snippetResults: SnippetResult[],
  topN = 3,
): RelatedDoc[] {
  return snippetResults
    .map(scoreSnippetResult)
    .sort((a, b) => b.total_score - a.total_score)
    .slice(0, topN);
}
