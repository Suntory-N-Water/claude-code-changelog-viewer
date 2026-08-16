export type ChangelogItem = {
  readonly id: string;
  readonly content: string;
  readonly prefix: string;
};

export type ChangelogRelease = {
  readonly version: string;
  readonly items: readonly ChangelogItem[];
};

export type ChangelogDiffEvent = {
  readonly detectedAt: string;
  readonly version: string;
  readonly type: 'items_changed' | 'version_removed';
  readonly itemsAdded: readonly string[];
  readonly itemsRemoved: readonly string[];
};

export type RelatedDocument = {
  readonly file: string;
  readonly snippets: readonly string[];
};

export type ChangelogInferenceInputItem = ChangelogItem & {
  readonly relatedDocs: readonly RelatedDocument[];
};

export type ChangelogInferenceInput = {
  readonly version: string;
  readonly items: readonly ChangelogInferenceInputItem[];
};

export type InferenceExplanation = {
  readonly before: string;
  readonly after: string;
  readonly benefit: string;
};

export type ChangelogAiInferenceItem = {
  readonly id: string;
  readonly contentJa: string;
  readonly inference: InferenceExplanation;
};

export type ChangelogAiTranslationItem = {
  readonly id: string;
  readonly contentJa: string;
};

export type ChangelogAiFeatureAreaCorrection = {
  readonly id: string;
  readonly featureAreas: readonly string[];
};

export type ChangelogAiResult = {
  readonly inferredItems: readonly ChangelogAiInferenceItem[];
  readonly translatedItems: readonly ChangelogAiTranslationItem[];
  readonly featureAreaCorrections: readonly ChangelogAiFeatureAreaCorrection[];
  readonly summary: string;
};

export type ChangelogInferenceItem = ChangelogItem & {
  readonly contentJa: string;
  readonly featureAreas: readonly string[];
  readonly relatedDocs: readonly RelatedDocument[];
  readonly inference?: InferenceExplanation;
};

export type ChangelogInference = {
  readonly version: string;
  readonly summary: string;
  readonly items: readonly ChangelogInferenceItem[];
};

export type ChangelogDiffRepository = {
  saveAll(events: readonly ChangelogDiffEvent[]): Promise<void>;
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
  expectedIds: readonly string[],
  actualIds: readonly string[],
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
