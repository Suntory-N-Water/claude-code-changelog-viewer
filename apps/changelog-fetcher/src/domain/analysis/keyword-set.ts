export type KeywordSet = {
  readonly original: readonly string[];
  readonly normalized: readonly string[];
};

const EXCLUDED_WORDS = new Set([
  'Added',
  'Fixed',
  'Changed',
  'Improved',
  'Updated',
  'Removed',
  'Enabled',
  'bug',
  'issue',
  'error',
  'feature',
  'performance',
  'overall',
  'system',
  'the',
  'and',
  'or',
  'with',
  'for',
  'to',
  'in',
  'on',
  'when',
  'by',
]);

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

/**
 * CHANGELOG 項目本文から docs 検索用キーワードを抽出する。
 */
export function extractKeywordSetFromContent(content: string): KeywordSet {
  const original = [
    ...extractBacktickKeywords(content),
    ...extractTechnicalTerms(content),
  ];
  const normalized = original
    .flatMap((keyword) => normalizeKeyword(keyword))
    .filter((word) => !EXCLUDED_WORDS.has(word));

  return createKeywordSet({ original, normalized });
}

function extractBacktickKeywords(content: string): string[] {
  return [...content.matchAll(/`([^`]+)`/g)]
    .map((match) => match[1])
    .filter((keyword): keyword is string => keyword != null);
}

function extractTechnicalTerms(content: string): string[] {
  const withoutBackticks = content.replace(/`[^`]+`/g, '');
  const withoutTags = withoutBackticks.replace(/\[[^\]]+\]/g, '');

  return [...withoutTags.matchAll(/\b([A-Z]{2,})\b/g)]
    .map((match) => match[1])
    .filter(
      (term): term is string => term != null && !EXCLUDED_WORDS.has(term),
    );
}

function normalizeKeyword(keyword: string): string[] {
  return keyword
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}
