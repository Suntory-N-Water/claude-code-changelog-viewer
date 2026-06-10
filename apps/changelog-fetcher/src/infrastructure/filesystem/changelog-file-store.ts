import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { AnalysisSchema } from '@claude-code-changelog-viewer/types';
import type {
  ChangelogMetadata,
  ChangelogStorePort,
  FetchChangelogSummary,
} from '../../usecase/fetch-changelog';
import type { AnalysisStorePort } from '../../usecase/analyze-changelog';
import type { InferredStorePort } from '../../usecase/infer-benefits';
import type { ChangelogAnalysis } from '../../domain/analysis/changelog-analysis';
import type { ChangelogDiffEvent } from '../../domain/changelog/changelog-diff-event';
import type { ChangelogRelease } from '../../domain/changelog/changelog-release';
import {
  createChangelogVersion,
  toVersionNumber,
  type ChangelogVersion,
} from '../../domain/changelog/changelog-version';
import type { ChangelogDiffEventType } from '../../domain/changelog/changelog-diff-event';
import { parseChangelogReleases } from '../docs/changelog-markdown-parser';
import {
  toAnalysisJson,
  toChangelogAnalysis,
} from '../serializers/analysis-serializer';

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

export function createAnalysisFileStore(appDir: string): AnalysisStorePort {
  return {
    async load(version: string): Promise<ChangelogAnalysis | null> {
      return loadAnalysisFile(
        join(appDir, 'analysis', `analysis_${version}.json`),
      );
    },
    async save(analysis: ChangelogAnalysis, version: string): Promise<void> {
      const output = toAnalysisJson(analysis);
      const outputPath = join(appDir, 'analysis', `analysis_${version}.json`);
      await writeFile(outputPath, JSON.stringify(output, null, 2));
    },
  };
}

export function createInferredFileStore(appDir: string): InferredStorePort {
  return {
    async load(version: string): Promise<ChangelogAnalysis | null> {
      return loadAnalysisFile(
        join(appDir, 'inferred', `inferred_${version}.json`),
      );
    },
  };
}

export class ChangelogFileStore implements ChangelogStorePort {
  #outputDir: string;
  #metadataFile: string;
  #summaryFile: string;
  #diffFile: string;

  constructor(appDir: string) {
    this.#outputDir = join(appDir, 'changelogs');
    this.#metadataFile = join(appDir, 'metadata', 'last_fetch.json');
    this.#summaryFile = join(appDir, 'metadata', 'last_fetch_summary.json');
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

  async deleteFetchSummary(): Promise<void> {
    await rm(this.#summaryFile, { force: true });
  }

  async saveFetchSummary(summary: FetchChangelogSummary): Promise<void> {
    await mkdir(dirname(this.#summaryFile), { recursive: true });
    await writeFile(
      this.#summaryFile,
      `${JSON.stringify(summary, null, 2)}\n`,
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

function toVersionFilename(version: ChangelogVersion): string {
  return `${version}.md`;
}

async function loadAnalysisFile(
  filePath: string,
): Promise<ChangelogAnalysis | null> {
  if (!existsSync(filePath)) {
    return null;
  }

  return toChangelogAnalysis(
    AnalysisSchema.parse(JSON.parse(await readFile(filePath, 'utf-8'))),
  );
}
