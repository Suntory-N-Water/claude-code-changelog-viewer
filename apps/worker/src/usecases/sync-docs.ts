import { toError } from '@claude-code-changelog-viewer/common';
import { isSafeToDeleteStaleDocuments } from '../domain/docs-sync/document-sync';

export type DocumentInfo = {
  readonly title: string;
  readonly url: string;
  readonly path: string;
};

export type StoredPage = DocumentInfo & {
  readonly content: string;
  readonly contentHash: string;
};

export type SettingSchemaEntry = {
  readonly key: string;
  readonly source: 'settings' | 'env';
  readonly description: string;
  readonly parentDescriptions: string;
  readonly valueType: string;
  readonly defaultValue: string | null;
  readonly enumValues: string | null;
};

export type SettingSchemaSnapshot = {
  readonly contentHash: string;
  readonly entries: readonly SettingSchemaEntry[];
};

/** 公式ドキュメントと設定スキーマの取得を抽象化する port。 */
export type OfficialDocsSource = {
  fetchDocumentList(): Promise<readonly DocumentInfo[]>;
  fetchPage(document: DocumentInfo): Promise<StoredPage>;
  fetchSettingSchema(): Promise<SettingSchemaSnapshot>;
};

export type ExistingPage = {
  readonly path: string;
  readonly contentHash: string;
};

/** docs-search 用 D1 への読み書きを抽象化する port。 */
export type DocsSearchStore = {
  loadExistingPages(): Promise<readonly ExistingPage[]>;
  writeChangedPages(pages: readonly StoredPage[], now: Date): Promise<void>;
  deletePages(paths: readonly string[]): Promise<void>;
  loadSettingSchemaHash(): Promise<string | null>;
  replaceSettingSchema(schema: SettingSchemaSnapshot, now: Date): Promise<void>;
};

export type SyncDocsDependencies = {
  readonly source: OfficialDocsSource;
  readonly store: DocsSearchStore;
};

export type SyncDocsInput = {
  readonly now: Date;
};

export type SyncDocsResult = {
  readonly documentCount: number;
  readonly successfulCount: number;
  readonly failedCount: number;
  readonly changedCount: number;
  readonly skippedCount: number;
  readonly deletedCount: number;
  readonly skippedBySafetyGuard: boolean;
  readonly schemaUpdated: boolean;
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
  const existingHashes = new Map(
    existingPages.map((page) => [page.path, page.contentHash]),
  );
  const changedPages: StoredPage[] = [];
  let skippedCount = 0;
  let failedCount = 0;

  for (const outcome of outcomes) {
    if ('error' in outcome) {
      failedCount += 1;
      continue;
    }

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
  if (schemaUpdated) {
    await dependencies.store.replaceSettingSchema(schema, input.now);
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
  | { readonly page: StoredPage }
  | { readonly document: DocumentInfo; readonly error: Error };

async function fetchPages(
  source: OfficialDocsSource,
  documents: readonly DocumentInfo[],
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
