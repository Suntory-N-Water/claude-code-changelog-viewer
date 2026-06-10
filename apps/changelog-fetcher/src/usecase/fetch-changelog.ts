import { createHash } from 'node:crypto';
import { getLogger } from '@claude-code-changelog-viewer/common';
import {
  computeChangelogEntryDiff,
  createItemsChangedDiffEvent,
  createVersionRemovedDiffEvent,
  isDuplicateDiffEvent,
  type ChangelogDiffEvent,
} from '../domain/changelog/changelog-diff-event';
import type { ChangelogRelease } from '../domain/changelog/changelog-release';
import {
  createChangelogVersion,
  type ChangelogVersion,
} from '../domain/changelog/changelog-version';

const log = getLogger({ name: 'changelog-fetcher' });

export type ChangelogMetadata = {
  lastFetchTime: string;
  versions: Record<string, string>;
};

export type ChangelogSourcePort = {
  fetchReleases: () => Promise<ChangelogRelease[]>;
};

export type ChangelogStorePort = {
  loadMetadata: () => Promise<ChangelogMetadata>;
  saveMetadata: (metadata: ChangelogMetadata) => Promise<void>;
  loadDiffEvents: () => Promise<ChangelogDiffEvent[]>;
  saveDiffEvents: (events: ChangelogDiffEvent[]) => Promise<void>;
  loadRelease: (version: ChangelogVersion) => Promise<ChangelogRelease | null>;
  saveRelease: (release: ChangelogRelease) => Promise<void>;
};

export type FetchChangelogResult = {
  newCount: number;
  updatedCount: number;
};

export async function fetchChangelog(input: {
  source: ChangelogSourcePort;
  store: ChangelogStorePort;
  detectedAt?: Date;
}): Promise<FetchChangelogResult> {
  log.msg('APLG0003', { params: ['CHANGELOG.md'] });
  const releases = await input.source.fetchReleases();

  log.msg('APLG0020', { params: ['CHANGELOG エントリー'] });
  const existingMetadata = await input.store.loadMetadata();
  const diffEvents = [...(await input.store.loadDiffEvents())];
  const detectedAt = input.detectedAt ?? new Date();

  let newCount = 0;
  let updatedCount = 0;
  const newMetadata: Record<string, string> = {};
  const remoteVersionKeys = new Set<string>();

  for (const release of releases) {
    const versionKey = release.version;
    remoteVersionKeys.add(versionKey);

    const contentHash = createHash('sha256')
      .update(release.content, 'utf-8')
      .digest('hex');
    const existingHash = existingMetadata.versions[versionKey] ?? '';
    const localRelease = await input.store.loadRelease(release.version);

    if (contentHash !== existingHash && localRelease) {
      const diff = computeChangelogEntryDiff(
        localRelease.entries,
        release.entries,
      );

      if (diff.added.length > 0 || diff.removed.length > 0) {
        const candidate = createItemsChangedDiffEvent({
          detectedAt,
          version: release.version,
          added: diff.added,
          removed: diff.removed,
        });

        if (!isDuplicateDiffEvent(diffEvents, candidate)) {
          diffEvents.push(candidate);
          log.msg('APLG0007', { params: [`${versionKey} の項目差分`] });
        }
      }
    }

    if (contentHash === existingHash && localRelease) {
      log.debug(`${versionKey}: 変更なし`);
      newMetadata[versionKey] = contentHash;
      continue;
    }

    await input.store.saveRelease(release);

    if (existingHash) {
      log.info(`${versionKey}: 更新あり`);
      updatedCount += 1;
    } else {
      log.info(`${versionKey}: 新規`);
      newCount += 1;
    }

    newMetadata[versionKey] = contentHash;
  }

  for (const metadataVersionKey of Object.keys(existingMetadata.versions)) {
    if (remoteVersionKeys.has(metadataVersionKey)) {
      continue;
    }

    const candidate = createVersionRemovedDiffEvent({
      detectedAt,
      version: createChangelogVersion(metadataVersionKey),
    });

    if (!isDuplicateDiffEvent(diffEvents, candidate)) {
      diffEvents.push(candidate);
      log.msg('APLG0010', { params: [`${metadataVersionKey} の削除`] });
    }
  }

  await input.store.saveDiffEvents(diffEvents);
  await input.store.saveMetadata({
    lastFetchTime: detectedAt.toISOString(),
    versions: newMetadata,
  });

  log.msg('APLG0002', { params: ['CHANGELOG の取得'] });

  return { newCount, updatedCount };
}
