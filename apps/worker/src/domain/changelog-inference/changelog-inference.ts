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

export type InferenceExplanation = {
  before: string;
  after: string;
  benefit: string;
};

export type ChangelogAiInferenceItem = {
  id: string;
  contentJa: string;
  inference: InferenceExplanation;
};

export type ChangelogAiTranslationItem = {
  id: string;
  contentJa: string;
};

export type ChangelogAiFeatureAreaCorrection = {
  id: string;
  featureAreas: string[];
};

export type ChangelogAiResult = {
  inferredItems: ChangelogAiInferenceItem[];
  translatedItems: ChangelogAiTranslationItem[];
  featureAreaCorrections: ChangelogAiFeatureAreaCorrection[];
  summary: string;
};

export type ChangelogInferenceItem = ChangelogItem & {
  contentJa: string;
  featureAreas: string[];
  relatedDocs: RelatedDocument[];
  inference?: InferenceExplanation;
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

export function mergeChangelogInference(
  input: ChangelogInferenceInput,
  aiResult: ChangelogAiResult,
): ChangelogInference {
  const inferenceItems = input.items.filter(
    (item) => item.relatedDocs.length > 0,
  );
  const translationItems = input.items.filter(
    (item) => item.relatedDocs.length === 0,
  );

  assertItemIds(
    inferenceItems.map((item) => item.id),
    aiResult.inferredItems.map((item) => item.id),
    '推論',
  );
  assertItemIds(
    translationItems.map((item) => item.id),
    aiResult.translatedItems.map((item) => item.id),
    '翻訳',
  );

  const inferredById = new Map(
    aiResult.inferredItems.map((item) => [item.id, item]),
  );
  const translatedById = new Map(
    aiResult.translatedItems.map((item) => [item.id, item]),
  );
  const featureAreasById = new Map(
    aiResult.featureAreaCorrections.map((item) => [
      item.id,
      [...new Set(item.featureAreas)],
    ]),
  );

  for (const id of featureAreasById.keys()) {
    if (!input.items.some((item) => item.id === id)) {
      throw new Error(`AI 推論結果に未知の item id があります: ${id}`);
    }
  }

  return {
    version: input.version,
    summary: aiResult.summary,
    items: input.items.map((item) => {
      const inferred = inferredById.get(item.id);
      const translated = translatedById.get(item.id);
      return {
        ...item,
        contentJa: inferred?.contentJa ?? translated?.contentJa ?? '',
        featureAreas: featureAreasById.get(item.id) ?? [],
        ...(inferred === undefined ? {} : { inference: inferred.inference }),
      };
    }),
  };
}

function assertItemIds(
  expectedIds: string[],
  actualIds: string[],
  resultName: string,
): void {
  const expected = new Set(expectedIds);
  const actual = new Set(actualIds);
  if (
    expected.size !== expectedIds.length ||
    actual.size !== actualIds.length ||
    expected.size !== actual.size ||
    [...expected].some((id) => !actual.has(id))
  ) {
    throw new Error(`AI 推論結果の${resultName}項目数が一致しません`);
  }
}
