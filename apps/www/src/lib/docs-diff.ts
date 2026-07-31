import type { CollectionEntry } from 'astro:content';

/** Docs 差分を新しい順に並べ、表示用データへ変換する */
export function sortDocsDiffEntries(entries: CollectionEntry<'docsDiff'>[]) {
  return entries
    .map((entry) => entry.data)
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
}
