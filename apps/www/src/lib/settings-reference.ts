import { buildChangelogSearchTerms } from '@claude-code-changelog-viewer/common';
import type { InferredChangelogItem } from '@claude-code-changelog-viewer/types';

export type ChangelogItemWithVersion = {
  version: string;
  item: InferredChangelogItem;
};

export function getSourceLabel(source: 'settings' | 'env'): string {
  return source === 'settings' ? 'settings.json' : '環境変数';
}

/**
 * 全 changelog を走査し、key が content/content_ja に含まれるアイテムを抽出する。
 * settings JSON の related_changelog は使わない(ビルド時に常に最新を動的収集)。
 */
export function findRelatedChangelogs(
  key: string,
  changelogs: { version: string; items: InferredChangelogItem[] }[],
): ChangelogItemWithVersion[] {
  const searchTerms = buildChangelogSearchTerms(key);
  const results: ChangelogItemWithVersion[] = [];
  for (const { version, items } of changelogs) {
    for (const item of items) {
      if (
        searchTerms.some(
          (term) =>
            item.content.includes(term) ||
            (item.content_ja?.includes(term) ?? false),
        )
      ) {
        results.push({ version, item });
      }
    }
  }
  return results;
}

export function collectFeatureAreas(
  items: ChangelogItemWithVersion[],
): Set<string> {
  const areas = new Set<string>();
  for (const { item } of items) {
    for (const area of item.feature_areas ?? []) {
      areas.add(area);
    }
  }
  return areas;
}

const CLAUDE_CODE_DOCS_BASE = 'https://code.claude.com/docs';

/**
 * description_en から公式ドキュメントURLとラベルを抽出する。
 * - Markdown リンク [text](/en/path) / [text](https://...)
 * - 裸の URL: See https://...
 */
export function extractOfficialDocUrls(
  descriptionEn: string,
): { label: string; url: string }[] {
  const results: { label: string; url: string }[] = [];
  const seen = new Set<string>();

  for (const match of descriptionEn.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
    let url = match[2];
    if (url.startsWith('/en/')) {
      url = `${CLAUDE_CODE_DOCS_BASE}${url}`;
    } else if (!url.startsWith('http')) {
      continue;
    }
    if (!seen.has(url)) {
      seen.add(url);
      results.push({ label: match[1], url });
    }
  }

  for (const match of descriptionEn.matchAll(/See (https?:\/\/[^\s)]+)/g)) {
    const url = match[1];
    if (!seen.has(url)) {
      seen.add(url);
      results.push({ label: '公式ドキュメントを参照', url });
    }
  }

  return results;
}
