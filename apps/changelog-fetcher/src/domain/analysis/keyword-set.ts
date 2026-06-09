export type KeywordSet = {
  original: string[];
  normalized: string[];
};

/**
 * 重複を取り除いた検索キーワード集合を生成する。
 */
export function createKeywordSet(input: {
  original: string[];
  normalized: string[];
}): KeywordSet {
  return {
    original: [...new Set(input.original)],
    normalized: [...new Set(input.normalized)],
  };
}
