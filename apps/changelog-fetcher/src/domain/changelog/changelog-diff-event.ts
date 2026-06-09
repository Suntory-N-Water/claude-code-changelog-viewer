import type { ChangelogVersion } from './changelog-version';
import type { ChangelogEntry } from './changelog-entry';

export type ChangelogDiffEventType = 'items_changed' | 'version_removed';

export type ChangelogDiffEvent = {
  detectedAt: Date;
  version: ChangelogVersion;
  type: ChangelogDiffEventType;
  itemsAdded: string[];
  itemsRemoved: string[];
};

export type ChangelogDiffEventCandidate = Omit<
  ChangelogDiffEvent,
  'detectedAt'
>;

export type ChangelogEntryDiff = {
  added: string[];
  removed: string[];
};

/**
 * 2つの CHANGELOG 項目一覧から追加・削除された項目本文を抽出する。
 *
 * 項目の順序差だけでは差分にしない。
 */
export function computeChangelogEntryDiff(
  localEntries: ChangelogEntry[],
  remoteEntries: ChangelogEntry[],
): ChangelogEntryDiff {
  const localItems = localEntries.map((entry) => entry.content);
  const remoteItems = remoteEntries.map((entry) => entry.content);
  const localSet = new Set(localItems);
  const remoteSet = new Set(remoteItems);

  return {
    added: remoteItems.filter((item) => !localSet.has(item)),
    removed: localItems.filter((item) => !remoteSet.has(item)),
  };
}

/**
 * 項目追加・削除を検知した差分イベントを生成する。
 */
export function createItemsChangedDiffEvent(input: {
  detectedAt: Date;
  version: ChangelogVersion;
  added: string[];
  removed: string[];
}): ChangelogDiffEvent {
  return {
    detectedAt: input.detectedAt,
    version: input.version,
    type: 'items_changed',
    itemsAdded: input.added,
    itemsRemoved: input.removed,
  };
}

/**
 * upstream CHANGELOG からバージョンが消えた差分イベントを生成する。
 */
export function createVersionRemovedDiffEvent(input: {
  detectedAt: Date;
  version: ChangelogVersion;
}): ChangelogDiffEvent {
  return {
    detectedAt: input.detectedAt,
    version: input.version,
    type: 'version_removed',
    itemsAdded: [],
    itemsRemoved: [],
  };
}

/**
 * 同じバージョン・種別・追加削除項目のイベントが既にあるか判定する。
 *
 * 項目の順序差だけでは別イベントにしない。
 */
export function isDuplicateDiffEvent(
  events: ChangelogDiffEvent[],
  candidate: ChangelogDiffEventCandidate,
): boolean {
  const candidateAddedSet = new Set(candidate.itemsAdded);
  const candidateRemovedSet = new Set(candidate.itemsRemoved);

  return events.some(
    (event) =>
      event.version === candidate.version &&
      event.type === candidate.type &&
      event.itemsAdded.length === candidate.itemsAdded.length &&
      event.itemsRemoved.length === candidate.itemsRemoved.length &&
      event.itemsAdded.every((item) => candidateAddedSet.has(item)) &&
      event.itemsRemoved.every((item) => candidateRemovedSet.has(item)),
  );
}
