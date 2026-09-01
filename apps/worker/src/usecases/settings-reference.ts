import { buildEnumDescriptionsJa } from '../domain/settings-reference/enum-descriptions';
import { createSettingSlugFromKey } from '../domain/settings-reference/setting-slug';

export type SettingsReferenceWorkflowParams = {
  targetKeys?: string[] | undefined;
};

export type SettingsReferenceFailureReporterPort = {
  report(input: {
    params: SettingsReferenceWorkflowParams;
    instanceId: string;
    error: unknown;
  }): Promise<void>;
};

export type SettingsReferenceEntry = {
  key: string;
  source: 'settings' | 'env';
  descriptionEn: string;
  parentDescriptions: string[];
  schemaDefault?: string;
  schemaEnum?: string[];
  enumDescriptions?: Record<string, string>;
  defaultNote?: string;
};

export type RelatedSettingDocument = {
  file: string;
  snippets: string[];
};

export type RelatedSettingChangelog = {
  version: string;
  contentJa?: string;
  inference?: {
    before: string;
    after: string;
    benefit: string;
  };
};

export type SettingsReferenceEntrySourcePort = {
  loadEntries(): Promise<SettingsReferenceEntry[]>;
  loadExistingKeys(): Promise<ReadonlySet<string>>;
  findRelatedChangelogs(key: string): Promise<RelatedSettingChangelog[]>;
};

export type SettingsReferenceDocumentSearchPort = {
  searchSettingKey(leafName: string): Promise<RelatedSettingDocument[]>;
};

export type SettingsReferenceInputEntry = {
  id: number;
  key: string;
  source: 'settings' | 'env';
  descriptionEn: string;
  parentDescriptions: string[];
  docSnippets: string[];
  officialDocs: string[];
  relatedChangelog: RelatedSettingChangelog[];
  schemaDefault?: string;
  schemaEnum?: string[];
  enumDescriptions?: Record<string, string>;
  defaultNote?: string;
};

export type SettingsReferenceInput = {
  entries: SettingsReferenceInputEntry[];
};

export type SettingsReferenceTranslation = {
  id: number;
  descriptionJa: string;
  useCaseJa: string;
  enumDescriptionsJa: { value: string; descriptionJa: string }[];
  defaultNoteJa: string;
};

export type SettingsReferenceAiPort = {
  infer(input: SettingsReferenceInput): Promise<SettingsReferenceTranslation[]>;
};

export type SettingsReferenceRecord = {
  key: string;
  leafName: string | null;
  slug: string;
  source: 'settings' | 'env';
  descriptionEn: string;
  descriptionJa: string;
  useCaseJa: string | null;
  enumDescriptionsJa: string | null;
  defaultNoteJa: string | null;
  fetchedAt: string;
  officialDocs: string[];
};

export type SettingsReferenceRepositoryPort = {
  save(input: { records: SettingsReferenceRecord[] }): Promise<void>;
};

type SettingsReferenceSaveInput = {
  input: SettingsReferenceInput;
  translations: SettingsReferenceTranslation[];
  fetchedAt: string;
};

const MAX_DOC_SNIPPET_CHARS = 8000;
const MAX_RELATED_CHANGELOGS = 5;
const EXCLUDED_DOC_FILES = new Set(['env-vars.md']);

export async function loadSettingsReferenceEntries(
  source: SettingsReferenceEntrySourcePort,
  params: SettingsReferenceWorkflowParams,
): Promise<SettingsReferenceEntry[]> {
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
  entries: SettingsReferenceEntry[],
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
          ...(entry.enumDescriptions === undefined
            ? {}
            : { enumDescriptions: { ...entry.enumDescriptions } }),
          ...(entry.defaultNote === undefined
            ? {}
            : { defaultNote: entry.defaultNote }),
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
        enumDescriptionsJa: buildEnumDescriptionsJa(
          entry.enumDescriptions,
          translation.enumDescriptionsJa,
        ),
        defaultNoteJa:
          entry.defaultNote === undefined || translation.defaultNoteJa === ''
            ? null
            : translation.defaultNoteJa,
        fetchedAt,
        officialDocs: [...entry.officialDocs],
      },
    ];
  });

  await repository.save({ records });
  return { count: records.length };
}
