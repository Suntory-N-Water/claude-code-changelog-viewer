import { createSettingSlugFromKey } from '../domain/settings-reference/setting-slug';

export type SettingsReferenceWorkflowParams = {
  readonly targetKeys?: readonly string[] | undefined;
};

export type SettingsReferenceFailureReporterPort = {
  report(input: {
    readonly params: SettingsReferenceWorkflowParams;
    readonly instanceId: string;
    readonly error: unknown;
  }): Promise<void>;
};

export type SettingsReferenceEntry = {
  readonly key: string;
  readonly source: 'settings' | 'env';
  readonly descriptionEn: string;
  readonly parentDescriptions: readonly string[];
  readonly schemaDefault?: string;
  readonly schemaEnum?: readonly string[];
};

export type RelatedSettingDocument = {
  readonly file: string;
  readonly snippets: readonly string[];
};

export type RelatedSettingChangelog = {
  readonly version: string;
  readonly contentJa?: string;
  readonly inference?: {
    readonly before: string;
    readonly after: string;
    readonly benefit: string;
  };
};

export type SettingsReferenceEntrySourcePort = {
  loadEntries(): Promise<readonly SettingsReferenceEntry[]>;
  loadExistingKeys(): Promise<ReadonlySet<string>>;
  findRelatedChangelogs(
    key: string,
  ): Promise<readonly RelatedSettingChangelog[]>;
};

export type SettingsReferenceDocumentSearchPort = {
  searchSettingKey(
    leafName: string,
  ): Promise<readonly RelatedSettingDocument[]>;
};

export type SettingsReferenceInputEntry = {
  readonly id: number;
  readonly key: string;
  readonly source: 'settings' | 'env';
  readonly descriptionEn: string;
  readonly parentDescriptions: readonly string[];
  readonly docSnippets: readonly string[];
  readonly officialDocs: readonly string[];
  readonly relatedChangelog: readonly RelatedSettingChangelog[];
  readonly schemaDefault?: string;
  readonly schemaEnum?: readonly string[];
};

export type SettingsReferenceInput = {
  readonly entries: readonly SettingsReferenceInputEntry[];
};

export type SettingsReferenceTranslation = {
  readonly id: number;
  readonly descriptionJa: string;
  readonly useCaseJa: string;
};

export type SettingsReferenceAiPort = {
  infer(
    input: SettingsReferenceInput,
  ): Promise<readonly SettingsReferenceTranslation[]>;
};

export type SettingsReferenceRecord = {
  readonly key: string;
  readonly leafName: string;
  readonly slug: string;
  readonly source: 'settings' | 'env';
  readonly descriptionEn: string;
  readonly descriptionJa: string;
  readonly useCaseJa: string | null;
  readonly fetchedAt: string;
  readonly officialDocs: readonly string[];
};

export type SettingsReferenceRepositoryPort = {
  save(input: {
    readonly records: readonly SettingsReferenceRecord[];
  }): Promise<void>;
};

type SettingsReferenceSaveInput = {
  readonly input: SettingsReferenceInput;
  readonly translations: readonly SettingsReferenceTranslation[];
  readonly fetchedAt: string;
};

const MAX_DOC_SNIPPET_CHARS = 8000;
const MAX_RELATED_CHANGELOGS = 5;
const EXCLUDED_DOC_FILES = new Set(['env-vars.md']);

export async function loadSettingsReferenceEntries(
  source: SettingsReferenceEntrySourcePort,
  params: SettingsReferenceWorkflowParams,
): Promise<readonly SettingsReferenceEntry[]> {
  const [entries, existingKeys] = await Promise.all([
    source.loadEntries(),
    source.loadExistingKeys(),
  ]);
  const targetKeys =
    params.targetKeys === undefined ? undefined : new Set(params.targetKeys);

  return entries.filter(
    (entry) => targetKeys?.has(entry.key) ?? !existingKeys.has(entry.key),
  );
}

export async function buildSettingsReferenceInput(
  documentSearch: SettingsReferenceDocumentSearchPort,
  entrySource: SettingsReferenceEntrySourcePort,
  entries: readonly SettingsReferenceEntry[],
): Promise<SettingsReferenceInput> {
  return {
    entries: await Promise.all(
      entries.map(async (entry, id) => {
        const leafName = entry.key.split('.').at(-1) ?? entry.key;
        const [documents, relatedChangelog] = await Promise.all([
          documentSearch.searchSettingKey(leafName),
          entrySource.findRelatedChangelogs(entry.key),
        ]);
        const filteredDocuments = documents.filter(
          (document) =>
            !EXCLUDED_DOC_FILES.has(document.file.split('/').at(-1) ?? ''),
        );
        const officialDocs = [
          ...new Set(filteredDocuments.map((document) => document.file)),
        ];
        const docSnippets: string[] = [];
        let snippetLength = 0;
        for (const document of filteredDocuments) {
          for (const snippet of document.snippets) {
            if (snippetLength >= MAX_DOC_SNIPPET_CHARS) {
              break;
            }
            const remaining = MAX_DOC_SNIPPET_CHARS - snippetLength;
            const truncated = snippet.slice(0, remaining);
            if (truncated.length > 0) {
              docSnippets.push(truncated);
              snippetLength += truncated.length;
            }
          }
          if (snippetLength >= MAX_DOC_SNIPPET_CHARS) {
            break;
          }
        }

        return {
          id,
          key: entry.key,
          source: entry.source,
          descriptionEn: entry.descriptionEn,
          parentDescriptions: [...entry.parentDescriptions],
          docSnippets,
          officialDocs,
          relatedChangelog: relatedChangelog.slice(0, MAX_RELATED_CHANGELOGS),
          ...(entry.schemaDefault === undefined
            ? {}
            : { schemaDefault: entry.schemaDefault }),
          ...(entry.schemaEnum === undefined
            ? {}
            : { schemaEnum: [...entry.schemaEnum] }),
        };
      }),
    ),
  };
}

export async function saveSettingsReferences(
  repository: SettingsReferenceRepositoryPort,
  saveInput: SettingsReferenceSaveInput,
): Promise<{ count: number }> {
  const { input, translations, fetchedAt } = saveInput;
  const translationsById = new Map(
    translations.map((translation) => [translation.id, translation]),
  );
  const records = input.entries.flatMap((entry) => {
    const translation = translationsById.get(entry.id);
    if (translation === undefined) {
      return [];
    }

    const leafName = entry.key.split('.').at(-1) ?? entry.key;
    return [
      {
        key: entry.key,
        leafName,
        slug: createSettingSlugFromKey(entry.key, entry.source),
        source: entry.source,
        descriptionEn: entry.descriptionEn,
        descriptionJa: translation.descriptionJa,
        useCaseJa: translation.useCaseJa === '' ? null : translation.useCaseJa,
        fetchedAt,
        officialDocs: [...entry.officialDocs],
      },
    ];
  });

  await repository.save({ records });
  return { count: records.length };
}
