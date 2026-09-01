import { getLogger, toError } from '@claude-code-changelog-viewer/common';
import { mergeSettingSchemaEntries } from '../domain/docs-sync/setting-schema';
import { isSafeToDeleteStaleDocuments } from '../domain/docs-sync/document-sync';

const logger = getLogger({
  name: 'usecases.sync-docs',
  serviceName: 'changelog-viewer-worker',
  level: 'INFO',
  format: 'json',
});

export type DocumentInfo = {
  title: string;
  url: string;
  path: string;
};

export type StoredPage = DocumentInfo & {
  content: string;
  contentHash: string;
};

export type SettingSchemaEntry = {
  key: string;
  source: 'settings' | 'env';
  description: string;
  parentDescriptions: string;
  valueType: string;
  defaultValue: string | null;
  enumValues: string | null;
  enumDescriptions: string | null;
  scope: string | null;
  example: string | null;
  defaultNote: string | null;
};

export type SettingSchemaSnapshot = {
  contentHash: string;
  entries: SettingSchemaEntry[];
};

/** 公式ドキュメントと設定スキーマの取得を抽象化する port。 */
export type OfficialDocsSource = {
  fetchDocumentList(): Promise<DocumentInfo[]>;
  fetchPage(document: DocumentInfo): Promise<StoredPage>;
  fetchSettingSchema(): Promise<SettingSchemaSnapshot>;
};

export type ExistingPage = {
  path: string;
  contentHash: string;
};

/** docs-search 用 D1 への読み書きを抽象化する port。 */
export type DocsSearchStore = {
  loadExistingPages(): Promise<ExistingPage[]>;
  writeChangedPages(pages: StoredPage[], now: Date): Promise<void>;
  deletePages(paths: string[]): Promise<void>;
  loadSettingSchemaHash(): Promise<string | null>;
  replaceSettingSchema(schema: SettingSchemaSnapshot, now: Date): Promise<void>;
};

export type SettingSchemaContentParser = {
  parseEnvVarsMd(
    markdown: string,
    pages: ReadonlyMap<string, string>,
  ): SettingSchemaEntry[];
  parsePublicEnvEntriesFromDocs(
    pages: ReadonlyMap<string, string>,
  ): SettingSchemaEntry[];
  parseSettingsReferenceMd(markdown: string): SettingSchemaEntry[];
};

export type SyncDocsDependencies = {
  source: OfficialDocsSource;
  store: DocsSearchStore;
  contentParser: SettingSchemaContentParser;
};

export type SyncDocsInput = {
  now: Date;
};

export type SyncDocsResult = {
  documentCount: number;
  successfulCount: number;
  failedCount: number;
  changedCount: number;
  skippedCount: number;
  deletedCount: number;
  skippedBySafetyGuard: boolean;
  schemaUpdated: boolean;
};

const PAGE_BATCH_SIZE = 5;
const PAGE_BATCH_DELAY_MS = 500;

/** 公式ドキュメントと設定スキーマを docs-search store へ同期する。 */
export async function syncDocs(
  dependencies: SyncDocsDependencies,
  input: SyncDocsInput,
): Promise<SyncDocsResult> {
  const documents = await dependencies.source.fetchDocumentList();
  if (documents.length === 0) {
    return {
      documentCount: 0,
      successfulCount: 0,
      failedCount: 0,
      changedCount: 0,
      skippedCount: 0,
      deletedCount: 0,
      skippedBySafetyGuard: false,
      schemaUpdated: false,
    };
  }

  const existingPages = await dependencies.store.loadExistingPages();
  const outcomes = await fetchPages(dependencies.source, documents);
  const failedPages = outcomes.filter(
    (outcome): outcome is { document: DocumentInfo; error: Error } =>
      'error' in outcome,
  );
  if (failedPages.length > 0) {
    logger.warn('ドキュメントページの取得に失敗しました', {
      'resource.count': failedPages.length,
      'resource.paths': failedPages.map(({ document }) => document.path),
      'exception.messages': failedPages.map(({ error }) => error.message),
    });
  }
  const existingHashes = new Map(
    existingPages.map((page) => [page.path, page.contentHash]),
  );
  const changedPages: StoredPage[] = [];
  let skippedCount = 0;
  let failedCount = 0;
  const pageContents = new Map<string, string>();

  for (const outcome of outcomes) {
    if ('error' in outcome) {
      failedCount += 1;
      continue;
    }

    pageContents.set(outcome.page.path, outcome.page.content);

    if (existingHashes.get(outcome.page.path) === outcome.page.contentHash) {
      skippedCount += 1;
      continue;
    }

    changedPages.push(outcome.page);
  }

  if (changedPages.length > 0) {
    await dependencies.store.writeChangedPages(changedPages, input.now);
  }

  const expectedPaths = new Set(documents.map((document) => document.path));
  const stalePaths = existingPages
    .map((page) => page.path)
    .filter((path) => !expectedPaths.has(path));
  let deletedCount = 0;
  let skippedBySafetyGuard = false;

  if (stalePaths.length > 0) {
    if (
      !isSafeToDeleteStaleDocuments(existingPages.length, expectedPaths.size)
    ) {
      skippedBySafetyGuard = true;
    } else {
      await dependencies.store.deletePages(stalePaths);
      deletedCount = stalePaths.length;
    }
  }

  const schema = await dependencies.source.fetchSettingSchema();
  const previousSchemaHash = await dependencies.store.loadSettingSchemaHash();
  const schemaUpdated = previousSchemaHash !== schema.contentHash;
  const envVarsPage = [...pageContents.entries()].find(
    ([path]) => path.split('/').at(-1) === 'env-vars.md',
  )?.[1];
  const markdownEntries =
    envVarsPage === undefined
      ? []
      : dependencies.contentParser.parseEnvVarsMd(envVarsPage, pageContents);
  const docsEntries =
    dependencies.contentParser.parsePublicEnvEntriesFromDocs(pageContents);
  const settingsReferencePage = [...pageContents.entries()].find(
    ([path]) => path.split('/').at(-1) === 'settings-reference.md',
  )?.[1];
  const referenceEntries =
    settingsReferencePage === undefined
      ? []
      : dependencies.contentParser.parseSettingsReferenceMd(
          settingsReferencePage,
        );
  const mergedEntries = mergeSettingSchemaEntries({
    schemaEntries: schema.entries,
    markdownEntries,
    docsEntries,
    referenceEntries,
  });
  if (failedCount === 0 && (schemaUpdated || changedPages.length > 0)) {
    await dependencies.store.replaceSettingSchema(
      { ...schema, entries: mergedEntries },
      input.now,
    );
  }

  return {
    documentCount: documents.length,
    successfulCount: outcomes.length - failedCount,
    failedCount,
    changedCount: changedPages.length,
    skippedCount,
    deletedCount,
    skippedBySafetyGuard,
    schemaUpdated,
  };
}

type PageFetchOutcome =
  | { page: StoredPage }
  | { document: DocumentInfo; error: Error };

async function fetchPages(
  source: OfficialDocsSource,
  documents: DocumentInfo[],
): Promise<PageFetchOutcome[]> {
  const outcomes: PageFetchOutcome[] = [];

  for (let index = 0; index < documents.length; index += PAGE_BATCH_SIZE) {
    const batch = documents.slice(index, index + PAGE_BATCH_SIZE);
    outcomes.push(
      ...(await Promise.all(
        batch.map(async (document): Promise<PageFetchOutcome> => {
          try {
            return { page: await source.fetchPage(document) };
          } catch (error) {
            return { document, error: toError(error) };
          }
        }),
      )),
    );

    if (index + PAGE_BATCH_SIZE < documents.length) {
      await new Promise((resolve) => setTimeout(resolve, PAGE_BATCH_DELAY_MS));
    }
  }

  return outcomes;
}
