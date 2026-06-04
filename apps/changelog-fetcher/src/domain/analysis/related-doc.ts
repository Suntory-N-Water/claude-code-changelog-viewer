export type SnippetSearchResult = {
  readonly file: string;
  readonly snippets: readonly string[];
  readonly hitCount: number;
};

export type RelatedDoc = {
  readonly file: string;
  readonly snippets: readonly string[];
  readonly hitCount: number;
  readonly contextScore: number;
  readonly totalScore: number;
};

/**
 * スニペット検索結果に文脈スコアと総合スコアを付与する。
 */
export function scoreSnippetResult(result: SnippetSearchResult): RelatedDoc {
  const contextScore = calculateContextScore(result.snippets);

  return {
    file: result.file,
    snippets: result.snippets,
    hitCount: result.hitCount,
    contextScore,
    totalScore: result.hitCount * contextScore,
  };
}

/**
 * 関連ドキュメント候補をスコア順に並べ、上位だけを返す。
 */
export function getTopRelatedDocs(
  results: readonly SnippetSearchResult[],
  topN = 3,
): RelatedDoc[] {
  return results
    .map(scoreSnippetResult)
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, topN);
}

function calculateContextScore(snippets: readonly string[]): number {
  if (snippets.length === 0) {
    return 0;
  }

  return snippets.reduce(
    (total, snippet) => total + calculateSnippetScore(snippet),
    0,
  );
}

function calculateSnippetScore(snippet: string): number {
  let score = 1;

  if (/^##+ /m.test(snippet)) {
    score += 5;
  }
  if (/```/.test(snippet)) {
    score += 3;
  }
  if (/(how to|example|usage|説明|使い方)/i.test(snippet)) {
    score += 2;
  }

  return score;
}
