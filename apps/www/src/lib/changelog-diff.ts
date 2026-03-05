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
