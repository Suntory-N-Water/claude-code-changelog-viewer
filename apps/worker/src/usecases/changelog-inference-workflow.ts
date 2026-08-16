import {
  ClaudeCodeVersionSchema,
  NotificationAnalysisSchema,
  type IngestChangelogDiffEvent,
  type NotificationAnalysis,
} from '@claude-code-changelog-viewer/types';
import {
  classifyChangelogReleases,
  type ChangelogClassification,
  type ExistingChangelogItem,
} from '../domain/changelog-inference/changelog-classification';
import type {
  ChangelogInference,
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

export type ChangelogNotificationRow = {
  readonly version: string;
  readonly summary: string | null;
  readonly itemId: string | null;
  readonly content: string | null;
  readonly contentJa: string | null;
  readonly prefix: string | null;
};

export type ChangelogWorkflowRepository = {
  findExistingItems(): Promise<readonly ExistingChangelogItem[]>;
  saveDiffEvents(events: readonly IngestChangelogDiffEvent[]): Promise<void>;
  saveVersion(inference: ChangelogInference): Promise<void>;
  findNotificationRows(
    version: string,
  ): Promise<readonly ChangelogNotificationRow[]>;
};

export type ChangelogNotificationPort = {
  send(message: {
    readonly version: string;
    readonly analysis: NotificationAnalysis;
  }): Promise<void>;
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
  readonly repository: ChangelogWorkflowRepository;
  readonly params: ChangelogWorkflowParams;
};

export async function fetchAndClassifyChangelog({
  source,
  parser,
  repository,
  params,
}: FetchAndClassifyChangelogInput): Promise<ChangelogClassification> {
  const markdown = await source.fetchMarkdown(params.detectedHash);
  const releases = await parser.parse(markdown);
  const existingItems = await repository.findExistingItems();
  return classifyChangelogReleases(releases, existingItems, params.detectedAt);
}

export async function notifyChangelogVersions(
  repository: ChangelogWorkflowRepository,
  notifier: ChangelogNotificationPort,
  versions: readonly string[],
): Promise<void> {
  for (const version of versions) {
    const rows = await repository.findNotificationRows(version);
    const first = rows[0];
    if (first === undefined) {
      throw new Error(`通知対象のバージョンが D1 にありません: ${version}`);
    }

    const notificationVersion = ClaudeCodeVersionSchema.parse(
      `v${first.version.replace(/^v/, '')}`,
    );
    const analysis = NotificationAnalysisSchema.parse({
      version: notificationVersion,
      summary: first.summary,
      items: rows
        .filter(
          (
            row,
          ): row is ChangelogNotificationRow & {
            readonly itemId: string;
            readonly content: string;
            readonly prefix: string;
          } =>
            row.itemId !== null && row.content !== null && row.prefix !== null,
        )
        .map((row) => ({
          content: row.content,
          content_ja: row.contentJa,
          prefix: row.prefix,
        })),
    });
    await notifier.send({ version: notificationVersion, analysis });
  }
}
