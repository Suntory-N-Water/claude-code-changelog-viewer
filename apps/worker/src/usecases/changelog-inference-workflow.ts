import {
  classifyChangelogReleases,
  type ChangelogClassification,
  type ExistingChangelogItem,
} from '../domain/changelog-inference/changelog-classification';
import type {
  ChangelogDiffEvent,
  ChangelogDiffRepository,
  ChangelogInferenceInput,
  ChangelogInferenceRepository,
  ChangelogItemInference,
  ChangelogRelease,
} from '../domain/changelog-inference/changelog-inference';

export type ChangelogWorkflowParams = {
  detectedHash: string;
  detectedAt: string;
};

export type ChangelogMarkdownSourcePort = {
  fetchMarkdown(expectedHash: string): Promise<string>;
};

export type ChangelogParserPort = {
  parse(markdown: string): Promise<ChangelogRelease[]>;
};

export type ExistingChangelogReader = {
  findExistingItems(): Promise<ExistingChangelogItem[]>;
  findRecordedRemovedVersions(): Promise<string[]>;
};

export type ChangelogNotificationPort = {
  send(version: string): Promise<void>;
};

export type ChangelogFailureReporterPort = {
  report(input: {
    params: ChangelogWorkflowParams;
    instanceId: string;
    error: unknown;
  }): Promise<void>;
};

export type FetchAndClassifyChangelogInput = {
  source: ChangelogMarkdownSourcePort;
  parser: ChangelogParserPort;
  existingChangelogReader: ExistingChangelogReader;
  params: ChangelogWorkflowParams;
};

export async function fetchAndClassifyChangelog({
  source,
  parser,
  existingChangelogReader,
  params,
}: FetchAndClassifyChangelogInput): Promise<ChangelogClassification> {
  const markdown = await source.fetchMarkdown(params.detectedHash);
  const releases = await parser.parse(markdown);
  // 保存前の D1 スナップショットを基準に、新規バージョンの通知対象を決める。
  const existingItems = await existingChangelogReader.findExistingItems();
  const recordedRemovedVersions =
    await existingChangelogReader.findRecordedRemovedVersions();
  return classifyChangelogReleases({
    releases,
    existingRows: existingItems,
    recordedRemovedVersions,
    detectedAt: params.detectedAt,
  });
}

export async function notifyChangelogVersions(
  notifier: ChangelogNotificationPort,
  versions: string[],
): Promise<void> {
  for (const version of versions) {
    await notifier.send(version);
  }
}

export async function saveChangelogDiffs(
  repository: ChangelogDiffRepository,
  events: ChangelogDiffEvent[],
): Promise<{ count: number }> {
  await repository.saveAll(events);
  return { count: events.length };
}

export type SaveChangelogInferenceInput = {
  input: ChangelogInferenceInput;
  itemInferences: ChangelogItemInference[];
  summary: string;
};

export async function saveChangelogInference(
  repository: ChangelogInferenceRepository,
  { input, itemInferences, summary }: SaveChangelogInferenceInput,
): Promise<{ version: string }> {
  const inferenceById = new Map(
    itemInferences.map((itemInference) => [itemInference.id, itemInference]),
  );

  await repository.save({
    version: input.version,
    summary,
    items: input.items.map((item) => {
      const itemInference = inferenceById.get(item.id);
      return {
        ...item,
        contentJa: itemInference?.contentJa ?? '',
        featureAreas: itemInference?.featureAreas ?? [],
        ...(itemInference?.inference === undefined
          ? {}
          : { inference: itemInference.inference }),
      };
    }),
  });
  return { version: input.version };
}

export async function reportChangelogWorkflowFailure(
  failureReporter: ChangelogFailureReporterPort,
  input: Parameters<ChangelogFailureReporterPort['report']>[0],
): Promise<void> {
  await failureReporter.report(input);
}
