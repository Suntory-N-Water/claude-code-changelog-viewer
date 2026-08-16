import {
  classifyChangelogReleases,
  type ChangelogClassification,
  type ExistingChangelogItem,
} from '../domain/changelog-inference/changelog-classification';
import type { ChangelogRelease } from '../domain/changelog-inference/changelog-inference';

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

export type ChangelogWorkflowDataPort = {
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
  readonly workflowData: ChangelogWorkflowDataPort;
  readonly params: ChangelogWorkflowParams;
};

export async function fetchAndClassifyChangelog({
  source,
  parser,
  workflowData,
  params,
}: FetchAndClassifyChangelogInput): Promise<ChangelogClassification> {
  const markdown = await source.fetchMarkdown(params.detectedHash);
  const releases = await parser.parse(markdown);
  const existingItems = await workflowData.findExistingItems();
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
