import { type ChangelogEntry, createChangelogEntry } from './changelog-entry';
import {
  type ChangelogRelease,
  createChangelogRelease,
} from './changelog-release';
import { createChangelogVersion } from './changelog-version';

/**
 * 1つの CHANGELOG 本文から箇条書き項目だけを抽出してパースする。
 */
export function parseChangelogEntries(changelog: string): ChangelogEntry[] {
  const items: ChangelogEntry[] = [];
  let currentItem: string | null = null;

  for (const line of changelog.split('\n')) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('##')) {
      continue;
    }

    if (trimmed.startsWith('-')) {
      if (currentItem) {
        items.push(createChangelogEntry(currentItem));
      }
      currentItem = trimmed;
      continue;
    }

    if (currentItem) {
      currentItem += ` ${trimmed}`;
    }
  }

  if (currentItem) {
    items.push(createChangelogEntry(currentItem));
  }

  return items;
}

/**
 * 差分検知で使う `- ` 始まりの項目行だけを抽出する。
 */
export function extractChangelogItemLines(content: string): string[] {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '));
}

/**
 * upstream CHANGELOG 全体をバージョン単位のリリースに分割する。
 */
export function parseChangelogReleases(markdown: string): ChangelogRelease[] {
  const releases: ChangelogRelease[] = [];
  let currentVersion: string | null = null;
  const lines: string[] = [];

  for (const line of markdown.split('\n')) {
    const match = line.match(/^## (\d+\.\d+\.\d+)/);

    if (!match) {
      if (currentVersion) {
        lines.push(line);
      }
      continue;
    }

    if (currentVersion) {
      const content = lines.join('\n').trim();
      releases.push(
        createChangelogRelease({
          version: createChangelogVersion(currentVersion),
          content,
          entries: parseChangelogEntries(content),
        }),
      );
      lines.length = 0;
    }

    currentVersion = match[1] ?? null;
  }

  if (currentVersion) {
    const content = lines.join('\n').trim();
    releases.push(
      createChangelogRelease({
        version: createChangelogVersion(currentVersion),
        content,
        entries: parseChangelogEntries(content),
      }),
    );
  }

  return releases;
}
