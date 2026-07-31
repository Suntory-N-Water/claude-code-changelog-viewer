import type { CollectionEntry } from 'astro:content';
import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';

export type DiffEvent = CollectionEntry<'diff'>['data']['events'][number];

/** ISO文字列をJSTの「yyyy年M月d日 H時m分」形式にフォーマット */
export function formatDiffDateTime(iso: string): string {
  const jst = new TZDate(iso, 'Asia/Tokyo');
  return format(jst, 'yyyy年M月d日 H時m分');
}

/** diff コレクションのエントリからバージョンをキーにした Map を構築する */
export function buildDiffMap(
  entries: CollectionEntry<'diff'>[],
): Map<string, DiffEvent[]> {
  const map = new Map<string, DiffEvent[]>();
  for (const entry of entries) {
    for (const event of entry.data.events) {
      const existing = map.get(event.version);
      if (existing) {
        existing.push(event);
      } else {
        map.set(event.version, [event]);
      }
    }
  }
  return map;
}

/** changelog と diff から一覧カード用データを構築する */
export function buildVersionData(
  changelogs: CollectionEntry<'changelog'>[],
  diffMap: Map<string, DiffEvent[]>,
) {
  return changelogs.map((entry) => {
    const events = diffMap.get(`v${entry.data.version}`);
    const diffStatus = events?.some((event) => event.type === 'version_removed')
      ? ('removed' as const)
      : events?.some((event) => event.type === 'items_changed')
        ? ('changed' as const)
        : undefined;
    return {
      version: entry.data.version,
      itemCount: entry.data.items.length,
      summary: entry.data.summary,
      diffStatus,
    };
  });
}
