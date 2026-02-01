import type { ParsedItem } from '../types';

// プリフィックスごとの重要度スコア
const IMPORTANCE_SCORES: Record<string, number> = {
  Added: 8,
  Fixed: 4,
  Changed: 6,
  Improved: 6,
  Updated: 6,
  Removed: 5,
  Enabled: 6,
  Deprecated: 7,
  Breaking: 9,
};

/**
 * プリフィックスとタグから重要度スコアを算出
 */
function calculateImportance(prefix: string, tags: string[]): number {
  const baseScore = IMPORTANCE_SCORES[prefix] || 5;
  const breakingBonus = tags.includes('Breaking') ? 3 : 0;
  return baseScore + breakingBonus;
}

/**
 * プリフィックスを抽出(Added, Fixed など)
 * コンテンツ全体を解析して変更タイプを推論
 */
function extractPrefix(content: string): string {
  // 明示的な変更タイプキーワードで開始する場合
  if (/^-\s*(Added|Adding|Add)\b/i.test(content)) {
    return 'Added';
  }
  if (/^-\s*(Fixed|Fix|Fixes)\b/i.test(content)) {
    return 'Fixed';
  }
  if (/^-\s*(Changed|Change)\b/i.test(content)) {
    return 'Changed';
  }
  if (/^-\s*(Improved|Improve|Improvement)\b/i.test(content)) {
    return 'Improved';
  }
  if (/^-\s*(Updated|Update|Upgrade)\b/i.test(content)) {
    return 'Updated';
  }
  if (/^-\s*(Removed|Remove|Removing)\b/i.test(content)) {
    return 'Removed';
  }
  if (/^-\s*(Enabled|Enable)\b/i.test(content)) {
    return 'Enabled';
  }
  if (/^-\s*(Deprecated|Deprecate)\b/i.test(content)) {
    return 'Deprecated';
  }
  if (/^-\s*(Breaking|Breaking change)/i.test(content)) {
    return 'Breaking';
  }

  // 新機能追加を示すパターン
  if (/^-\s*(New|Introducing|Introduced)\b/i.test(content)) {
    return 'Added';
  }
  if (/(can now|now supports?|now allows?|now includes?)/i.test(content)) {
    return 'Added';
  }

  // その他のパターン
  if (/^-\s*(Made|Make)\b/i.test(content)) {
    return 'Changed';
  }
  if (/^-\s*Moved\b/i.test(content)) {
    return 'Changed';
  }

  // デフォルト
  return 'Changed';
}

/**
 * タグを抽出([SDK], [VSCode] など)
 */
function extractTags(content: string): string[] {
  const tagPattern = /\[([A-Z][A-Za-z]*)\]/g;
  const matches = [...content.matchAll(tagPattern)];
  return matches.map((match) => match[1]);
}

/**
 * CHANGELOGをパースして項目リストに分割
 */
export function parseChangelog(changelog: string): ParsedItem[] {
  const lines = changelog.split('\n');
  const items: ParsedItem[] = [];
  let currentItem: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // 空行やバージョン見出しをスキップ
    if (!trimmed || trimmed.startsWith('##')) {
      continue;
    }

    // 項目の開始(- で始まる行)
    if (trimmed.startsWith('-')) {
      // 前の項目を保存
      if (currentItem) {
        items.push(parseItem(currentItem));
      }
      // 新しい項目を開始
      currentItem = trimmed;
    } else if (currentItem) {
      // 複数行にまたがる項目の続き
      currentItem += ` ${trimmed}`;
    }
  }

  // 最後の項目を保存
  if (currentItem) {
    items.push(parseItem(currentItem));
  }

  return items;
}

/**
 * 単一の項目をパース
 */
function parseItem(itemText: string): ParsedItem {
  const prefix = extractPrefix(itemText);
  const tags = extractTags(itemText);
  const importance_score = calculateImportance(prefix, tags);

  return {
    content: itemText,
    prefix,
    tags,
    importance_score,
  };
}

/**
 * バージョン番号を抽出
 */
export function extractVersion(changelog: string): string | null {
  const match = changelog.match(/##\s*\[?([0-9.]+)\]?/);
  return match ? match[1] : null;
}
