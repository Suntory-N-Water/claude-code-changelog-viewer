import type { ChangelogVersion } from './changelog-version';

export type ChangelogDiffEventType = 'items_changed' | 'version_removed';

export type ChangelogDiffEvent = {
  readonly detectedAt: Date;
  readonly version: ChangelogVersion;
  readonly type: ChangelogDiffEventType;
  readonly itemsAdded: readonly string[];
  readonly itemsRemoved: readonly string[];
};

export type ChangelogDiffEventCandidate = Omit<
  ChangelogDiffEvent,
  'detectedAt'
>;

/**
 * 項目追加・削除を検知した差分イベントを生成する。
 */
export function createItemsChangedDiffEvent(input: {
  readonly detectedAt: Date;
  readonly version: ChangelogVersion;
  readonly added: readonly string[];
  readonly removed: readonly string[];
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
  readonly detectedAt: Date;
  readonly version: ChangelogVersion;
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
  events: readonly ChangelogDiffEvent[],
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
