import { InferenceWithTranslationSchema } from '@claude-code-changelog-viewer/types';
import { z } from 'zod';

const InferredItemSchema = InferenceWithTranslationSchema.extend({
  id: z.string().min(1),
});

const TranslatedItemSchema = z.object({
  id: z.string().min(1),
  content_ja: z.string().min(10).max(500),
});

const FeatureAreaCorrectionSchema = z.object({
  id: z.string().min(1),
  feature_areas: z.array(z.string().min(1)),
});

export const ChangelogInferenceResponseSchema = z.object({
  inferred_items: z
    .array(InferredItemSchema)
    .describe('関連ドキュメントがある項目の推論と翻訳結果'),
  translated_items: z
    .array(TranslatedItemSchema)
    .describe('関連ドキュメントがない項目の翻訳結果'),
  feature_area_corrections: z
    .array(FeatureAreaCorrectionSchema)
    .default([])
    .describe('機能領域タグの付与結果。該当項目だけを返す'),
  summary: z.string().min(1).describe('バージョン全体の日本語サマリー'),
});

export type ChangelogInferenceResponse = z.infer<
  typeof ChangelogInferenceResponseSchema
>;

export const ChangelogInferenceResponseFormat = {
  type: 'json_schema',
  json_schema: z.toJSONSchema(ChangelogInferenceResponseSchema, {
    target: 'draft-07',
  }),
} as const;
