import type { IngestChangelogDiffEvent } from '@claude-code-changelog-viewer/types';
import type { ChangelogRelease } from './changelog-inference';

export type ExistingChangelogItem = {
  readonly version: string;
  readonly itemId: string | null;
  readonly content: string | null;
};

export type ChangelogClassification = {
  readonly versions: readonly ChangelogRelease[];
  readonly diffEvents: readonly IngestChangelogDiffEvent[];
  readonly notifiableVersions: readonly string[];
};

export function classifyChangelogReleases(
  releases: readonly ChangelogRelease[],
  existingRows: readonly ExistingChangelogItem[],
  detectedAt: string,
): ChangelogClassification {
  const existingByVersion = new Map<string, Map<string, string | null>>();
  for (const row of existingRows) {
    const version = normalizeVersion(row.version);
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
  const diffEvents: IngestChangelogDiffEvent[] = [];
  const notifiableVersions: string[] = [];
  const remoteVersionKeys = new Set<string>();

  for (const release of releases) {
    const versionKey = normalizeVersion(release.version);
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
        detected_at: detectedAt,
        version: release.version,
        type: 'items_changed',
        items_added: itemsAdded,
        items_removed: itemsRemoved,
      });
    }
  }

  for (const version of existingByVersion.keys()) {
    if (remoteVersionKeys.has(version)) {
      continue;
    }
    diffEvents.push({
      detected_at: detectedAt,
      version: `v${version}`,
      type: 'version_removed',
      items_added: [],
      items_removed: [],
    });
  }

  return { versions, diffEvents, notifiableVersions };
}

function normalizeVersion(version: string): string {
  return version.replace(/^v/, '');
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
