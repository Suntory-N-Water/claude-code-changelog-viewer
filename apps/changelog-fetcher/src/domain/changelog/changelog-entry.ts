declare const changelogEntryContentBrand: unique symbol;

export type ChangelogEntryContent = string & {
  [changelogEntryContentBrand]: unknown;
};

export type ChangelogPrefix =
  | 'Added'
  | 'Fixed'
  | 'Changed'
  | 'Improved'
  | 'Updated'
  | 'Removed'
  | 'Enabled'
  | 'Deprecated'
  | 'Breaking';

export type ChangelogEntry = {
  content: ChangelogEntryContent;
  prefix: ChangelogPrefix;
  tags: string[];
};

/**
 * CHANGELOG の箇条書き1項目をドメイン値として生成する。
 */
export function createChangelogEntryContent(
  value: string,
): ChangelogEntryContent {
  const trimmed = value.trim();

  if (!trimmed.startsWith('-')) {
    throw new Error(`CHANGELOG 項目は "-" で始まる必要があります: ${value}`);
  }

  return trimmed as ChangelogEntryContent;
}

/**
 * 項目本文から変更種別を推論する。
 *
 * 既存の解析結果との互換性を保つため、明示的な動詞だけでなく
 * `now supports` などの自然文パターンも Added として扱う。
 */
export function classifyChangelogPrefix(
  content: ChangelogEntryContent,
): ChangelogPrefix {
  const normalizedContent = content.replace(/^-\s*(\[[^\]]+\]\s*)+/, '- ');

  if (/^-\s*(Added|Adding|Add)\b/i.test(normalizedContent)) {
    return 'Added';
  }
  if (/^-\s*(Fixed|Fix|Fixes)\b/i.test(normalizedContent)) {
    return 'Fixed';
  }
  if (/^-\s*(Changed|Change)\b/i.test(normalizedContent)) {
    return 'Changed';
  }
  if (/^-\s*(Improved|Improve|Improvement)\b/i.test(normalizedContent)) {
    return 'Improved';
  }
  if (/^-\s*(Updated|Update|Upgrade)\b/i.test(normalizedContent)) {
    return 'Updated';
  }
  if (/^-\s*(Removed|Remove|Removing)\b/i.test(normalizedContent)) {
    return 'Removed';
  }
  if (/^-\s*(Enabled|Enable)\b/i.test(normalizedContent)) {
    return 'Enabled';
  }
  if (/^-\s*(Deprecated|Deprecate)\b/i.test(normalizedContent)) {
    return 'Deprecated';
  }
  if (/^-\s*(Breaking|Breaking change)/i.test(normalizedContent)) {
    return 'Breaking';
  }
  if (/^-\s*(New|Introducing|Introduced)\b/i.test(normalizedContent)) {
    return 'Added';
  }
  if (
    /(can now|now supports?|now allows?|now includes?)/i.test(normalizedContent)
  ) {
    return 'Added';
  }
  if (/^-\s*(Made|Make)\b/i.test(normalizedContent)) {
    return 'Changed';
  }
  if (/^-\s*Moved\b/i.test(normalizedContent)) {
    return 'Changed';
  }

  return 'Changed';
}

/**
 * `[SDK]` など大文字始まりの角括弧タグを抽出する。
 */
export function extractChangelogTags(content: ChangelogEntryContent): string[] {
  const tagPattern = /\[([A-Z][A-Za-z]*)\]/g;
  return [...content.matchAll(tagPattern)]
    .map((match) => match[1])
    .filter((tag): tag is string => tag != null);
}

/**
 * CHANGELOG 項目を prefix / tags 付きのドメイン値に変換する。
 */
export function createChangelogEntry(value: string): ChangelogEntry {
  const content = createChangelogEntryContent(value);
  const prefix = classifyChangelogPrefix(content);
  const tags = extractChangelogTags(content);

  return {
    content,
    prefix,
    tags,
  };
}
