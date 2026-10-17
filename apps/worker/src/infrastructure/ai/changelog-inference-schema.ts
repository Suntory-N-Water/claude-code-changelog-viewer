import { z } from 'zod';

// 短い原文からは短い文しか生まれない。1 項目が下限を割るだけでバッチ全体が失敗するため、
// 下限は空文字を弾くだけにする
const InferredItemSchema = z.object({
  id: z.string().min(1),
  benefit: z.string().min(1).max(500),
});

const TranslatedItemSchema = z.object({
  id: z.string().min(1),
  content_ja: z.string().min(1).max(500),
});

const FeatureAreaCorrectionSchema = z.object({
  id: z.string().min(1),
  feature_areas: z.array(z.string().min(1)),
});

export const ChangelogTranslationResponseSchema = z.object({
  translated_items: z.array(TranslatedItemSchema).describe('各項目の日本語訳'),
});

export const ChangelogTranslationResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'changelog_translation',
    schema: z.toJSONSchema(ChangelogTranslationResponseSchema, {
      target: 'draft-07',
    }),
  },
} as const;

export const ChangelogItemsResponseSchema = z.object({
  inferred_items: z.array(InferredItemSchema).describe('変更後を書く対象の項目の推論結果'),
  feature_area_corrections: z
    .array(FeatureAreaCorrectionSchema)
    .default([])
    .describe('機能領域タグの付与結果。該当項目だけを返す'),
});

export const ChangelogItemsResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'changelog_items',
    schema: z.toJSONSchema(ChangelogItemsResponseSchema, {
      target: 'draft-07',
    }),
  },
} as const;

export const ChangelogSummaryResponseSchema = z.object({
  summary: z.string().min(1).describe('バージョン全体の日本語サマリー'),
});

export const ChangelogSummaryResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'changelog_summary',
    schema: z.toJSONSchema(ChangelogSummaryResponseSchema, {
      target: 'draft-07',
    }),
  },
} as const;
