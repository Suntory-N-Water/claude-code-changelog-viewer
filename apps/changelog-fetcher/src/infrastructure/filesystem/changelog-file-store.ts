import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type {
  ChangelogMetadata,
  ChangelogStorePort,
} from '../../application/fetch-changelog';
import type { ChangelogDiffEvent } from '../../domain/changelog/changelog-diff-event';
import type { ChangelogRelease } from '../../domain/changelog/changelog-release';
import {
  createChangelogVersion,
  toVersionFilename,
  toVersionNumber,
  type ChangelogVersion,
} from '../../domain/changelog/changelog-version';
import type { ChangelogDiffEventType } from '../../domain/changelog/changelog-diff-event';
import { parseChangelogReleases } from '../docs/changelog-markdown-parser';

export type ChangelogDiffJson = {
  events: DiffEventJson[];
};

export type DiffEventJson = {
  detected_at: string;
  version: string;
  type: ChangelogDiffEventType;
  items_added: string[];
  items_removed: string[];
};

export class ChangelogFileStore implements ChangelogStorePort {
  #outputDir: string;
  #metadataFile: string;
  #diffFile: string;

  constructor(appDir: string) {
    this.#outputDir = join(appDir, 'changelogs');
    this.#metadataFile = join(appDir, 'metadata', 'last_fetch.json');
    this.#diffFile = join(appDir, 'diff', 'changelog_diff.json');
  }

  async loadMetadata(): Promise<ChangelogMetadata> {
    if (!existsSync(this.#metadataFile)) {
      return { lastFetchTime: '', versions: {} };
    }

    return JSON.parse(
      await readFile(this.#metadataFile, 'utf-8'),
    ) as ChangelogMetadata;
  }

  async saveMetadata(metadata: ChangelogMetadata): Promise<void> {
    await mkdir(dirname(this.#metadataFile), { recursive: true });
    await writeFile(
      this.#metadataFile,
      `${JSON.stringify(metadata, null, 2)}\n`,
      'utf-8',
    );
  }

  async loadDiffEvents(): Promise<ChangelogDiffEvent[]> {
    const data = await loadChangelogDiffFile(this.#diffFile);
    return data.events.map(toDomainDiffEvent);
  }

  async saveDiffEvents(events: ChangelogDiffEvent[]): Promise<void> {
    await saveChangelogDiffFile(this.#diffFile, {
      events: events.map(toDiffEventJson),
    });
  }

  async loadRelease(
    version: ChangelogVersion,
  ): Promise<ChangelogRelease | null> {
    const filePath = join(this.#outputDir, toVersionFilename(version));
    if (!existsSync(filePath)) {
      return null;
    }

    const markdown = await readFile(filePath, 'utf-8');
    return parseChangelogReleases(markdown)[0] ?? null;
  }

  async saveRelease(release: ChangelogRelease): Promise<void> {
    await mkdir(this.#outputDir, { recursive: true });
    const versionNumber = toVersionNumber(release.version);
    await writeFile(
      join(this.#outputDir, toVersionFilename(release.version)),
      `## ${versionNumber}\n\n${release.content}\n`,
      'utf-8',
    );
  }
}

export async function loadChangelogDiffFile(
  filePath: string,
): Promise<ChangelogDiffJson> {
  if (!existsSync(filePath)) {
    return { events: [] };
  }

  return JSON.parse(await readFile(filePath, 'utf-8')) as ChangelogDiffJson;
}

export async function saveChangelogDiffFile(
  filePath: string,
  data: ChangelogDiffJson,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
}

function toDomainDiffEvent(event: DiffEventJson): ChangelogDiffEvent {
  return {
    detectedAt: new Date(event.detected_at),
    version: createChangelogVersion(event.version),
    type: event.type,
    itemsAdded: event.items_added,
    itemsRemoved: event.items_removed,
  };
}

function toDiffEventJson(event: ChangelogDiffEvent): DiffEventJson {
  return {
    detected_at: event.detectedAt.toISOString(),
    version: event.version,
    type: event.type,
    items_added: [...event.itemsAdded],
    items_removed: [...event.itemsRemoved],
  };
}
