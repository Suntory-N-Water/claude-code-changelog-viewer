export type ChangelogItem = {
  id: string;
  content: string;
  prefix: string;
};

export type ChangelogRelease = {
  version: string;
  items: ChangelogItem[];
};

export type ChangelogDiffEvent = {
  detectedAt: string;
  version: string;
  type: 'items_changed' | 'version_removed';
  itemsAdded: string[];
  itemsRemoved: string[];
};

export type RelatedDocument = {
  file: string;
  snippets: string[];
};

export type ChangelogInferenceInputItem = ChangelogItem & {
  relatedDocs: RelatedDocument[];
};

export type ChangelogInferenceInput = {
  version: string;
  items: ChangelogInferenceInputItem[];
};

export type ChangelogAiInferenceItem = {
  id: string;
  benefit: string;
};

// バグ修正は読み手が流し読みするため、翻訳だけで足りる。関連ドキュメントがない項目は、
// 原文だけでは翻訳の言い換えしか書けない
export function needsBenefit(item: ChangelogInferenceInputItem): boolean {
  return item.prefix !== 'Fixed' && item.relatedDocs.length > 0;
}

export type ChangelogAiTranslationItem = {
  id: string;
  contentJa: string;
};

export type ChangelogAiFeatureAreaCorrection = {
  id: string;
  featureAreas: string[];
};

export const FEATURE_AREAS = [
  'IDE',
  'Hooks',
  'MCP',
  'Skills',
  'Agent Teams',
  'Sub-agents',
  'Plan',
  'Plugins',
  'Settings',
  'Memory',
  'Permissions',
] as const;

// サイトはタグを小文字化した URL でページを作り、大文字小文字違いの重複があるとビルドを失敗させる。
// AI は候補を示しても "Ide" や候補外のタグを返すため、保存前に候補の表記へ揃え、候補外は捨てる
const FEATURE_AREA_BY_LOWERCASE = new Map<string, string>(
  FEATURE_AREAS.map((area) => [area.toLowerCase(), area]),
);

function normalizeFeatureAreas(areas: string[]): string[] {
  return [
    ...new Set(
      areas.flatMap((area) => {
        const canonical = FEATURE_AREA_BY_LOWERCASE.get(area.trim().toLowerCase());
        return canonical === undefined ? [] : [canonical];
      }),
    ),
  ];
}

export type ChangelogItemsAiResult = {
  inferredItems: ChangelogAiInferenceItem[];
  featureAreaCorrections: ChangelogAiFeatureAreaCorrection[];
};

export type ChangelogItemInference = {
  id: string;
  featureAreas: string[];
  benefit?: string;
};

export type ChangelogInferenceItem = ChangelogItem & {
  contentJa: string;
  featureAreas: string[];
  relatedDocs: RelatedDocument[];
  benefit?: string;
};

export type ChangelogInference = {
  version: string;
  summary: string;
  items: ChangelogInferenceItem[];
};

export type ChangelogDiffRepository = {
  saveAll(events: ChangelogDiffEvent[]): Promise<void>;
};

export type ChangelogInferenceRepository = {
  save(inference: ChangelogInference): Promise<void>;
};

// AI 呼び出しはバッチに分かれるため、突き合わせもバッチに含まれる項目だけを対象にする
export function mergeChangelogItemInferences(
  items: ChangelogInferenceInputItem[],
  aiResult: ChangelogItemsAiResult,
): ChangelogItemInference[] {
  // モデルは対象外と指示した項目にも変更後を書くことがある。使える機能領域タグまで
  // 捨てないよう、対象外の項目の変更後だけを除いてから id の一致を確かめる
  const skippedIds = new Set(items.filter((item) => !needsBenefit(item)).map((item) => item.id));
  const inferredItems = aiResult.inferredItems.filter((item) => !skippedIds.has(item.id));
  assertItemIds(
    items.filter(needsBenefit).map((item) => item.id),
    inferredItems.map((item) => item.id),
    '推論',
  );

  const inferredById = new Map(inferredItems.map((item) => [item.id, item]));
  const featureAreasById = new Map(
    aiResult.featureAreaCorrections.map((item) => [
      item.id,
      normalizeFeatureAreas(item.featureAreas),
    ]),
  );

  for (const id of featureAreasById.keys()) {
    if (!items.some((item) => item.id === id)) {
      throw new Error(`AI 推論結果に未知の item id があります: ${id}`);
    }
  }

  return items.map((item) => {
    const inferred = inferredById.get(item.id);
    return {
      id: item.id,
      featureAreas: featureAreasById.get(item.id) ?? [],
      ...(inferred === undefined ? {} : { benefit: inferred.benefit }),
    };
  });
}

export function verifyChangelogTranslations(
  items: ChangelogItem[],
  translations: ChangelogAiTranslationItem[],
): ChangelogAiTranslationItem[] {
  assertItemIds(
    items.map((item) => item.id),
    translations.map((item) => item.id),
    '翻訳',
  );
  return translations;
}

// 項目を取りこぼした応答は同じ入力で再試行しても直らないことがあるため、呼び出し側が
// その項目を諦める判断に使えるよう、メッセージの先頭を固定する
export const ITEM_IDS_MISMATCH_MESSAGE = 'AI 結果の項目 id が入力と一致しません';

function assertItemIds(expectedIds: string[], actualIds: string[], resultName: string): void {
  const expected = new Set(expectedIds);
  const actual = new Set(actualIds);
  if (
    expected.size !== expectedIds.length ||
    actual.size !== actualIds.length ||
    expected.size !== actual.size ||
    [...expected].some((id) => !actual.has(id))
  ) {
    throw new Error(`${ITEM_IDS_MISMATCH_MESSAGE} (${resultName})`);
  }
}
