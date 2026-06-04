export type KeywordSet = {
  readonly original: readonly string[];
  readonly normalized: readonly string[];
};

/**
 * 重複を取り除いた検索キーワード集合を生成する。
 */
export function createKeywordSet(input: {
  readonly original: readonly string[];
  readonly normalized: readonly string[];
}): KeywordSet {
  return {
    original: [...new Set(input.original)],
    normalized: [...new Set(input.normalized)],
  };
}
