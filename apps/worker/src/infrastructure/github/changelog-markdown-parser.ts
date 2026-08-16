import { sha256Hex } from '../crypto/sha256-hex';
import type {
  ChangelogItem,
  ChangelogRelease,
} from '../../domain/changelog-inference/changelog-inference';

export async function parseChangelogReleases(
  markdown: string,
): Promise<readonly ChangelogRelease[]> {
  const releases: Array<{ version: string; content: string }> = [];
  let currentVersion: string | null = null;
  const lines: string[] = [];

  for (const line of markdown.split('\n')) {
    const match = line.match(/^## (\d+\.\d+\.\d+)/);

    if (match === null) {
      if (currentVersion !== null) {
        lines.push(line);
      }
      continue;
    }

    if (currentVersion !== null) {
      releases.push({
        version: currentVersion,
        content: lines.join('\n').trim(),
      });
      lines.length = 0;
    }
    currentVersion = match[1] ?? null;
  }

  if (currentVersion !== null) {
    releases.push({
      version: currentVersion,
      content: lines.join('\n').trim(),
    });
  }

  return Promise.all(
    releases.map(async (release) => ({
      version: `v${release.version}`,
      items: await Promise.all(
        parseChangelogEntries(release.content).map((content) =>
          createChangelogItem(content),
        ),
      ),
    })),
  );
}

async function createChangelogItem(content: string): Promise<ChangelogItem> {
  return {
    id: (await sha256Hex(content)).slice(0, 12),
    content,
    prefix: classifyChangelogPrefix(content),
  };
}

function parseChangelogEntries(content: string): string[] {
  const items: string[] = [];
  let currentItem: string | null = null;

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    if (trimmed === '' || trimmed.startsWith('##')) {
      continue;
    }

    if (trimmed.startsWith('-')) {
      if (currentItem !== null) {
        items.push(currentItem);
      }
      currentItem = trimmed;
      continue;
    }

    if (currentItem !== null) {
      currentItem += ` ${trimmed}`;
    }
  }

  if (currentItem !== null) {
    items.push(currentItem);
  }

  return items;
}

function classifyChangelogPrefix(content: string): string {
  const normalizedContent = content.replace(/^-(\s*)(\[[^\]]+\]\s*)+/, '- ');

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
