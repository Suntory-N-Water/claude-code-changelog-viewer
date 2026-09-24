import {
  mergeChangelogItemInferences,
  type ChangelogInferenceInput,
  type ChangelogItemInference,
  type ChangelogItemsAiResult,
  type ChangelogRelease,
  type RelatedDocument,
} from '../domain/changelog-inference/changelog-inference';

// step の戻り値は 1MiB までのため、項目単位で snippets の総量を抑える。
// 項目数が多いリリースはこれだけでは収まらないので、Workflow 側でも step を分けている。
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
  // 1 件の検索は本番で約 200ms・約 5 万行を読む。v2.1.280 の約 180 件を同時に送信すると
  // D1 が捌き切れず毎回失敗したため、1 件ずつ順に実行する
  const items: ChangelogInferenceInput['items'] = [];
  for (const item of release.items) {
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
    items.push({ ...item, relatedDocs });
  }

  return { version: release.version, items };
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
