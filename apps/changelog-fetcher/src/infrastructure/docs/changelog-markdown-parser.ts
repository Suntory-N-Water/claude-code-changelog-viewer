import {
  createChangelogEntry,
  type ChangelogEntry,
} from '../../domain/changelog/changelog-entry';
import {
  createChangelogRelease,
  type ChangelogRelease,
} from '../../domain/changelog/changelog-release';
import { createChangelogVersion } from '../../domain/changelog/changelog-version';

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

export function extractChangelogItemLines(content: string): string[] {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '));
}

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

export type ChangelogItemDiff = {
  readonly added: readonly string[];
  readonly removed: readonly string[];
};

export function computeChangelogItemDiff(
  localContent: string,
  remoteContent: string,
): ChangelogItemDiff {
  const localItems = extractChangelogItemLines(localContent);
  const remoteItems = extractChangelogItemLines(remoteContent);
  const localSet = new Set(localItems);
  const remoteSet = new Set(remoteItems);

  return {
    added: remoteItems.filter((item) => !localSet.has(item)),
    removed: localItems.filter((item) => !remoteSet.has(item)),
  };
}
