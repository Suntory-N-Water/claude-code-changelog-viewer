import {
  mergeChangelogInference,
  type ChangelogAiResult,
  type ChangelogInference,
  type ChangelogInferenceInput,
  type ChangelogRelease,
  type RelatedDocument,
} from '../domain/changelog-inference/changelog-inference';

export type ChangelogDocumentSearchPort = {
  searchChangelogEntry(entry: string): Promise<readonly RelatedDocument[]>;
};

export type ChangelogInferencePort = {
  infer(input: ChangelogInferenceInput): Promise<ChangelogAiResult>;
};

export async function buildChangelogInferenceInput(
  documentSearch: ChangelogDocumentSearchPort,
  release: ChangelogRelease,
): Promise<ChangelogInferenceInput> {
  return {
    version: release.version,
    items: await Promise.all(
      release.items.map(async (item) => ({
        ...item,
        relatedDocs: await documentSearch.searchChangelogEntry(item.content),
      })),
    ),
  };
}

export async function inferChangelogRelease(
  inference: ChangelogInferencePort,
  input: ChangelogInferenceInput,
): Promise<ChangelogInference> {
  return mergeChangelogInference(input, await inference.infer(input));
}
