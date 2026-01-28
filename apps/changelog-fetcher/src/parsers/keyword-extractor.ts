import type { Keywords } from '../schemas/analysis';
import type { ParsedItem } from '../types';

// 除外ワード(ブラックリスト)
const EXCLUDED_WORDS = new Set([
  // 動詞
  'Added',
  'Fixed',
  'Changed',
  'Improved',
  'Updated',
  'Removed',
  'Enabled',
  // 汎用名詞
  'bug',
  'issue',
  'error',
  'feature',
  'performance',
  'overall',
  'system',
  // 冠詞・接続詞
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
 * キーワードを正規化(記号除去 + 分割)
 * @example
 * "$ARGUMENTS[0]" → ["ARGUMENTS", "0"]
 * "/rename" → ["rename"]
 * "CLAUDE_CODE_ENABLE_TASKS" → ["CLAUDE", "CODE", "ENABLE", "TASKS"]
 */
function normalizeKeyword(keyword: string): string[] {
  // 記号を除去してスペースに変換
  const cleaned = keyword.replace(/[^a-zA-Z0-9]/g, ' ');
  // スペースで分割して空文字を除去
  return cleaned.split(/\s+/).filter(Boolean);
}

/**
 * バッククォート内のキーワードを抽出
 */
function extractBacktickKeywords(content: string): string[] {
  const backtickPattern = /`([^`]+)`/g;
  const matches = [...content.matchAll(backtickPattern)];
  return matches.map((match) => match[1]);
}

/**
 * 技術用語を抽出(連続大文字2文字以上)
 */
function extractTechnicalTerms(content: string): string[] {
  // バッククォートとタグを除外した文字列から抽出
  const withoutBackticks = content.replace(/`[^`]+`/g, '');
  const withoutTags = withoutBackticks.replace(/\[[^\]]+\]/g, '');

  const termPattern = /\b([A-Z]{2,})\b/g;
  const matches = [...withoutTags.matchAll(termPattern)];
  return matches
    .map((match) => match[1])
    .filter((term) => !EXCLUDED_WORDS.has(term));
}

/**
 * CHANGELOG項目からキーワードを抽出
 */
export function extractKeywords(item: ParsedItem): Keywords {
  const { content } = item;

  // 優先度1: バッククォート(最優先)
  const backtickKeywords = extractBacktickKeywords(content);

  // 優先度2: タグ(既にitem.tagsに含まれている)

  // 優先度3: 技術用語
  const technicalTerms = extractTechnicalTerms(content);

  // original: バッククォート + 技術用語
  const original = [...backtickKeywords, ...technicalTerms];

  // normalized: 各キーワードを正規化
  const normalized = original.flatMap((keyword) => normalizeKeyword(keyword));

  // 除外ワードをフィルタリング
  const filteredNormalized = normalized.filter(
    (word) => !EXCLUDED_WORDS.has(word),
  );

  return {
    original,
    normalized: filteredNormalized,
  };
}
