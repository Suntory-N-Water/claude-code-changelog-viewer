import {
  mergeChangelogItemInferences,
  type ChangelogInferenceInput,
  type ChangelogItemInference,
  type ChangelogItemsAiResult,
  type ChangelogRelease,
  type RelatedDocument,
} from '../domain/changelog-inference/changelog-inference';

// step の戻り値は 1MiB までのため、大型リリースでも収まるよう項目単位で snippets の総量を抑える。
// 設定リファレンス生成の MAX_DOC_SNIPPET_CHARS と同じ値
const MAX_SNIPPET_CHARS_PER_ITEM = 8000;

export type ChangelogDocumentSearchPort = (
  entry: string,
) => Promise<RelatedDocument[]>;

export type ChangelogItemInferencePort = {
  inferItems(input: ChangelogInferenceInput): Promise<ChangelogItemsAiResult>;
};

export type ChangelogSummaryPort = {
  summarize(release: ChangelogRelease): Promise<string>;
};

export async function buildChangelogInferenceInput(
  documentSearch: ChangelogDocumentSearchPort,
  release: ChangelogRelease,
): Promise<ChangelogInferenceInput> {
  return {
    version: release.version,
    items: await Promise.all(
      release.items.map(async (item) => {
        const documents = await documentSearch(item.content);
        let remaining = MAX_SNIPPET_CHARS_PER_ITEM;
        // 予算を使い切ったファイルも file 名は保存対象なので、snippets を空にして残す
        const relatedDocs = documents.map((document) => {
          const snippets: string[] = [];
          for (const snippet of document.snippets) {
            const truncated = snippet.slice(0, remaining);
            if (truncated === '') {
              break;
            }
            snippets.push(truncated);
            remaining -= truncated.length;
          }
          return { file: document.file, snippets };
        });

        return { ...item, relatedDocs };
      }),
    ),
  };
}

export async function inferChangelogItemBatch(
  inference: ChangelogItemInferencePort,
  batch: ChangelogInferenceInput,
): Promise<ChangelogItemInference[]> {
  return mergeChangelogItemInferences(
    batch.items,
    await inference.inferItems(batch),
  );
}
