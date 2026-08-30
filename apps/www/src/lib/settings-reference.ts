import { buildChangelogSearchTerms } from '@claude-code-changelog-viewer/common';
import type { InferredChangelogItem } from '@claude-code-changelog-viewer/types';

const SETTING_SUMMARY_MAX_LENGTH = 80;

/** 設定一覧カードに表示する、検索対象外の短い要約を作る。 */
export function summarizeSettingDescription(description: string): string {
  const plainText = description
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/gu, ' ')
    .trim();
  // 設定名やパスには ASCII のピリオドが含まれるため、文末判定は日本語の句点に限定する。
  const firstSentence = plainText.split(/(?<=[。！？])/u)[0] ?? plainText;
  const characters = Array.from(firstSentence);

  if (characters.length <= SETTING_SUMMARY_MAX_LENGTH) {
    return firstSentence;
  }
  return `${characters.slice(0, SETTING_SUMMARY_MAX_LENGTH - 1).join('')}…`;
}

export type ChangelogItemWithVersion = {
  version: string;
  item: InferredChangelogItem;
};

export type SettingValueOption = {
  value: string;
  isDefault: boolean;
};

/** 取りうる値の表の行を、既定値にあたる値へ印を付けて組む。 */
export function buildSettingValueOptions(
  enumValues: readonly string[],
  defaultValue: string | undefined,
): SettingValueOption[] {
  return enumValues.map((value) => ({
    value,
    isDefault: defaultValue !== undefined && value === defaultValue,
  }));
}

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

export function getOfficialDocLinkLabel(url: string): string {
  const withoutHash = url.split('#')[0] ?? url;
  const pathname = new URL(withoutHash).pathname;
  return pathname.split('/').filter(Boolean).at(-1) ?? url;
}

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
      results.push({ label: getOfficialDocLinkLabel(url), url });
    }
  }

  return results;
}

export function mergeOfficialDocUrls(
  primaryLinks: { label: string; url: string }[],
  supplementalUrls: string[],
): { label: string; url: string }[] {
  const results: { label: string; url: string }[] = [];
  const seen = new Set<string>();

  for (const link of primaryLinks) {
    if (!seen.has(link.url)) {
      seen.add(link.url);
      results.push(link);
    }
  }

  for (const url of supplementalUrls) {
    if (!seen.has(url)) {
      seen.add(url);
      results.push({ label: getOfficialDocLinkLabel(url), url });
    }
  }

  return results;
}
