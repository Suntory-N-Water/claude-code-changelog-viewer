import {
  createChangelogEntry,
  type ChangelogEntry,
} from '../../domain/changelog/changelog-entry';
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
