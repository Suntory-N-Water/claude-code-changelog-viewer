import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  AnalysisSchema,
  InferredAnalysisSchema,
} from '@claude-code-changelog-viewer/types';
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
      const filename = `analysis_${version}.json`;
      const filePath = join(appDir, 'analysis', filename);
      const analysis = await loadAnalysisFile(filePath);

      return analysis;
    },
    async save(analysis: ChangelogAnalysis, version: string): Promise<void> {
      const output = toAnalysisJson(analysis);
      const filename = `analysis_${version}.json`;
      const outputPath = join(appDir, 'analysis', filename);
      const serializedOutput = JSON.stringify(output, null, 2);

      await writeFile(outputPath, serializedOutput);
    },
  };
}

export function createInferredFileStore(appDir: string): InferredStorePort {
  return {
    async load(version: string): Promise<ChangelogAnalysis | null> {
      const filename = `inferred_${version}.json`;
      const filePath = join(appDir, 'inferred', filename);
      const analysis = await loadInferredFile(filePath);

      return analysis;
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

    const rawMetadata = await readFile(this.#metadataFile, 'utf-8');
    const metadata = JSON.parse(rawMetadata) as ChangelogMetadata;

    return metadata;
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
    const events = data.events.map(toDomainDiffEvent);

    return events;
  }

  async saveDiffEvents(events: ChangelogDiffEvent[]): Promise<void> {
    const diffEvents = events.map(toDiffEventJson);
    const data = {
      events: diffEvents,
    };

    await saveChangelogDiffFile(this.#diffFile, data);
  }

  async loadRelease(
    version: ChangelogVersion,
  ): Promise<ChangelogRelease | null> {
    const filePath = join(this.#outputDir, toVersionFilename(version));
    if (!existsSync(filePath)) {
      return null;
    }

    const markdown = await readFile(filePath, 'utf-8');
    const releases = parseChangelogReleases(markdown);
    const release = releases[0] ?? null;

    return release;
  }

  async saveRelease(release: ChangelogRelease): Promise<void> {
    await mkdir(this.#outputDir, { recursive: true });
    const versionNumber = toVersionNumber(release.version);
    const filename = toVersionFilename(release.version);
    const filePath = join(this.#outputDir, filename);
    const markdown = `## ${versionNumber}\n\n${release.content}\n`;

    await writeFile(filePath, markdown, 'utf-8');
  }
}

export async function loadChangelogDiffFile(
  filePath: string,
): Promise<ChangelogDiffJson> {
  if (!existsSync(filePath)) {
    return { events: [] };
  }

  const rawData = await readFile(filePath, 'utf-8');
  const data = JSON.parse(rawData) as ChangelogDiffJson;

  return data;
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

  const rawAnalysis = await readFile(filePath, 'utf-8');
  const parsedAnalysis = JSON.parse(rawAnalysis);
  const analysisJson = AnalysisSchema.parse(parsedAnalysis);
  const analysis = toChangelogAnalysis(analysisJson);

  return analysis;
}

async function loadInferredFile(
  filePath: string,
): Promise<ChangelogAnalysis | null> {
  if (!existsSync(filePath)) {
    return null;
  }

  const rawAnalysis = await readFile(filePath, 'utf-8');
  const parsedAnalysis = JSON.parse(rawAnalysis);
  const inferredAnalysisJson = InferredAnalysisSchema.parse(parsedAnalysis);
  const analysisJson = AnalysisSchema.parse({
    version: inferredAnalysisJson.version,
    ...(inferredAnalysisJson.summary !== undefined
      ? { summary: inferredAnalysisJson.summary }
      : {}),
    items: inferredAnalysisJson.items.map((item) => ({
      id: item.id,
      content: item.content,
      ...(item.content_ja !== undefined ? { content_ja: item.content_ja } : {}),
      prefix: item.prefix,
      ...(item.feature_areas !== undefined
        ? { feature_areas: item.feature_areas }
        : {}),
      related_docs: item.related_docs.map((doc) => ({
        file: doc.file,
        snippets: [],
        snippet_scores: [],
        hit_count: 0,
      })),
      ...(item.inference !== undefined ? { inference: item.inference } : {}),
      ...(item.impact !== undefined ? { impact: item.impact } : {}),
    })),
  });
  const analysis = toChangelogAnalysis(analysisJson);

  return analysis;
}
