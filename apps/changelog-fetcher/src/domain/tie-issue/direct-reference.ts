// CHANGELOG 項目本文から #NNN 形式の GitHub issue 参照を抽出する。
// - `#123` は `(?:^|[\s(])` prefix を要求（`X-123` のようなハイフン付き番号を捨てる）
// - `anthropics/claude-code#123` は full ref
// - `other-org/other-repo#123` のような他リポジトリ参照は除外

const REPO_QUALIFIED_PATTERN = /\banthropics\/claude-code#(\d{1,6})\b/g;
const OTHER_REPO_PATTERN = /\b[\w.-]+\/[\w.-]+#\d{1,6}\b/g;
const SHORT_HASH_PATTERN = /(?:^|[\s(])#(\d{1,6})\b/g;

export function extractDirectIssueReferences(text: string): number[] {
  const results = new Set<number>();

  for (const match of text.matchAll(REPO_QUALIFIED_PATTERN)) {
    const n = Number.parseInt(match[1] ?? '', 10);
    if (Number.isInteger(n) && n > 0) {
      results.add(n);
    }
  }

  // anthropics/claude-code# 以外の owner/repo# を素通しさせないため、
  // その部分を空白に置き換えて `#NNN` パターンから外す。
  const scrubbed = text.replace(OTHER_REPO_PATTERN, (frag) =>
    frag.startsWith('anthropics/claude-code#') ? frag : ' '.repeat(frag.length),
  );
  for (const match of scrubbed.matchAll(SHORT_HASH_PATTERN)) {
    const n = Number.parseInt(match[1] ?? '', 10);
    if (Number.isInteger(n) && n > 0) {
      results.add(n);
    }
  }

  return [...results];
}
