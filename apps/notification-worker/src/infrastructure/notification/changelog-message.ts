import { PREFIX_ORDER } from '@claude-code-changelog-viewer/common';
import type { NotificationAnalysis } from '@claude-code-changelog-viewer/types';

export type ChangelogMessageItemGroup = {
  prefix: string;
  items: NotificationAnalysis['items'];
};

export function groupChangelogItemsByPrefix(
  items: NotificationAnalysis['items'],
): ChangelogMessageItemGroup[] {
  const groupMap = new Map<string, NotificationAnalysis['items']>();
  const knownPrefixes = new Set<string>(PREFIX_ORDER);
  const unknownPrefixes: string[] = [];

  for (const item of items) {
    const group = groupMap.get(item.prefix) ?? [];
    if (group.length === 0 && !knownPrefixes.has(item.prefix)) {
      unknownPrefixes.push(item.prefix);
    }
    group.push(item);
    groupMap.set(item.prefix, group);
  }

  const groups: ChangelogMessageItemGroup[] = [];
  for (const prefix of PREFIX_ORDER) {
    const group = groupMap.get(prefix);
    if (group) {
      groups.push({ prefix, items: group });
    }
  }

  for (const prefix of unknownPrefixes) {
    const group = groupMap.get(prefix);
    if (group) {
      groups.push({ prefix, items: group });
    }
  }

  return groups;
}
