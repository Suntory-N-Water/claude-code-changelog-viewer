import {
  classifyChangelogReleases,
  type ChangelogClassification,
  type ExistingChangelogItem,
} from '../domain/changelog-inference/changelog-classification';
import type {
  ChangelogDiffEvent,
  ChangelogDiffRepository,
  ChangelogInference,
  ChangelogInferenceRepository,
  ChangelogRelease,
} from '../domain/changelog-inference/changelog-inference';

export type ChangelogWorkflowParams = {
  readonly detectedHash: string;
  readonly detectedAt: string;
};

export type ChangelogMarkdownSourcePort = {
  fetchMarkdown(expectedHash: string): Promise<string>;
};

export type ChangelogParserPort = {
  parse(markdown: string): Promise<readonly ChangelogRelease[]>;
};

export type ExistingChangelogReader = {
  findExistingItems(): Promise<readonly ExistingChangelogItem[]>;
};

export type ChangelogNotificationPort = {
  send(version: string): Promise<void>;
};

export type ChangelogBuildTriggerPort = {
  trigger(): Promise<void>;
};

export type ChangelogFailureReporterPort = {
  report(input: {
    readonly params: ChangelogWorkflowParams;
    readonly instanceId: string;
    readonly error: unknown;
  }): Promise<void>;
};

export type FetchAndClassifyChangelogInput = {
  readonly source: ChangelogMarkdownSourcePort;
  readonly parser: ChangelogParserPort;
  readonly existingChangelogReader: ExistingChangelogReader;
  readonly params: ChangelogWorkflowParams;
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
  return classifyChangelogReleases(releases, existingItems, params.detectedAt);
}

export async function notifyChangelogVersions(
  notifier: ChangelogNotificationPort,
  versions: readonly string[],
): Promise<void> {
  for (const version of versions) {
    await notifier.send(version);
  }
}

export async function saveChangelogDiffs(
  repository: ChangelogDiffRepository,
  events: readonly ChangelogDiffEvent[],
): Promise<{ count: number }> {
  await repository.saveAll(events);
  return { count: events.length };
}

export async function saveChangelogInference(
  repository: ChangelogInferenceRepository,
  inference: ChangelogInference,
): Promise<{ version: string }> {
  await repository.save(inference);
  return { version: inference.version };
}

export async function triggerChangelogBuild(
  buildTrigger: ChangelogBuildTriggerPort,
): Promise<void> {
  await buildTrigger.trigger();
}

export async function reportChangelogWorkflowFailure(
  failureReporter: ChangelogFailureReporterPort,
  input: Parameters<ChangelogFailureReporterPort['report']>[0],
): Promise<void> {
  await failureReporter.report(input);
}
