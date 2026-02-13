import type { RelatedDoc } from '@claude-code-changelog-viewer/types';
import type { Keywords, SnippetResult } from '../types';
import {
  type DocCorpus,
  buildIdfTable,
  calculateTfidfSimilarity,
} from './tfidf-scorer';

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
 * 総合スコアを計算（TF-IDF類似度 × コンテキストスコア）
 *
 * 旧: hit_count × context_score（全キーワードが同一重み）
 * 新: tfidf_similarity × context_score（希少キーワードほど高重み）
 */
export function calculateTotalScore(
  tfidfSimilarity: number,
  context_score: number,
): number {
  return tfidfSimilarity * context_score;
}

/**
 * スニペット結果をRelatedDocに変換（TF-IDFスコア付き）
 */
export function scoreSnippetResult(
  snippetResult: SnippetResult,
  tfidfScore: number,
): RelatedDoc {
  const { file, snippets, hit_count } = snippetResult;
  const context_score = calculateContextScore(snippetResult);
  const total_score = calculateTotalScore(tfidfScore, context_score);

  return {
    file,
    snippets,
    hit_count,
    context_score,
    total_score,
  };
}

/**
 * スニペット結果リストをTF-IDFスコアリングして上位N件を取得
 *
 * 1. キーワードの IDF テーブルを構築（珍しいキーワードほど高重み）
 * 2. 各ドキュメントの TF-IDF Cosine Similarity を計算
 * 3. コンテキストスコアと掛け合わせて総合スコアを算出
 * 4. スコア降順で上位N件を返却
 */
export function getTopDocs(
  snippetResults: SnippetResult[],
  keywords: Keywords,
  corpus: DocCorpus,
  topN = 3,
): RelatedDoc[] {
  const idfTable = buildIdfTable(keywords, corpus);

  return snippetResults
    .map((result) => {
      const tfidfScore = calculateTfidfSimilarity(
        result.file,
        corpus,
        idfTable,
      );
      return scoreSnippetResult(result, tfidfScore);
    })
    .sort((a, b) => b.total_score - a.total_score)
    .slice(0, topN);
}
