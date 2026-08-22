import type {
  ChangelogDiffEvent,
  ChangelogRelease,
} from './changelog-inference';
import {
  formatChangelogVersion,
  normalizeChangelogVersion,
} from './changelog-version';

export type ExistingChangelogItem = {
  version: string;
  itemId: string | null;
  content: string | null;
};

export type ChangelogClassification = {
  versions: ChangelogRelease[];
  diffEvents: ChangelogDiffEvent[];
  notifiableVersions: string[];
};

export type ClassifyChangelogReleasesInput = {
  releases: ChangelogRelease[];
  existingRows: ExistingChangelogItem[];
  // バージョン削除は一度きりの出来事だが「D1 にあって remote にない」状態は続くため、
  // 記録済みのバージョンを渡して再検出を抑える。
  // 削除後に再追加されたバージョンが再び消えた場合、2度目は記録されない。
  // 追跡するには削除検出時に changelog_versions の行を消す必要があり、
  // サイトの表示からバージョンが消える副作用を伴うため踏み込んでいない
  recordedRemovedVersions: string[];
  detectedAt: string;
};

export function classifyChangelogReleases({
  releases,
  existingRows,
  recordedRemovedVersions,
  detectedAt,
}: ClassifyChangelogReleasesInput): ChangelogClassification {
  const existingByVersion = new Map<string, Map<string, string | null>>();
  for (const row of existingRows) {
    const version = normalizeChangelogVersion(row.version);
    const versionItems = existingByVersion.get(version) ?? new Map();
    if (row.itemId !== null) {
      versionItems.set(row.itemId, row.content);
    }
    existingByVersion.set(version, versionItems);
  }

  let latestExistingVersion: string | null = null;
  for (const version of existingByVersion.keys()) {
    if (
      latestExistingVersion === null ||
      compareVersions(version, latestExistingVersion) > 0
    ) {
      latestExistingVersion = version;
    }
  }

  const versions: ChangelogRelease[] = [];
  const diffEvents: ChangelogDiffEvent[] = [];
  const notifiableVersions: string[] = [];
  const remoteVersionKeys = new Set<string>();

  for (const release of releases) {
    const versionKey = normalizeChangelogVersion(release.version);
    remoteVersionKeys.add(versionKey);
    const existingItems = existingByVersion.get(versionKey);
    const remoteItems = new Map(
      release.items.map((item) => [item.id, item.content]),
    );

    if (existingItems === undefined) {
      versions.push(release);
      if (
        latestExistingVersion === null ||
        compareVersions(versionKey, latestExistingVersion) > 0
      ) {
        notifiableVersions.push(release.version);
      }
      continue;
    }

    if (sameItemIds(existingItems, remoteItems)) {
      continue;
    }

    versions.push(release);
    const itemsAdded = release.items
      .filter((item) => !existingItems.has(item.id))
      .map((item) => item.content);
    const itemsRemoved = [...existingItems]
      .filter(([id]) => !remoteItems.has(id))
      .map(([, content]) => content)
      .filter((content): content is string => content !== null);
    if (itemsAdded.length > 0 || itemsRemoved.length > 0) {
      diffEvents.push({
        detectedAt,
        version: release.version,
        type: 'items_changed',
        itemsAdded,
        itemsRemoved,
      });
    }
  }

  const recordedRemovedVersionKeys = new Set(
    recordedRemovedVersions.map(normalizeChangelogVersion),
  );
  for (const version of existingByVersion.keys()) {
    if (
      remoteVersionKeys.has(version) ||
      recordedRemovedVersionKeys.has(version)
    ) {
      continue;
    }
    diffEvents.push({
      detectedAt,
      version: formatChangelogVersion(version),
      type: 'version_removed',
      itemsAdded: [],
      itemsRemoved: [],
    });
  }

  return { versions, diffEvents, notifiableVersions };
}

function sameItemIds(
  existingItems: Map<string, string | null>,
  remoteItems: Map<string, string>,
): boolean {
  return (
    existingItems.size === remoteItems.size &&
    [...existingItems.keys()].every((itemId) => remoteItems.has(itemId))
  );
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}
