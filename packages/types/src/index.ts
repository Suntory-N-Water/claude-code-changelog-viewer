import { z } from 'zod';

// RelatedDoc
export const RelatedDocSchema = z.object({
  file: z.string(),
  hit_count: z.number(),
  // schema 互換のため残す固定値。現在は意味のある評価値として使わない。
  context_score: z.number(),
  // schema 互換のため残す固定値。現在は意味のある評価値として使わない。
  total_score: z.number(),
  snippets: z.array(z.string()),
});
export type RelatedDoc = z.infer<typeof RelatedDocSchema>;

// InferenceResult
export const InferenceResultSchema = z.object({
  before: z.string().min(10).max(500),
  after: z.string().min(10).max(500),
  benefit: z.string().min(10).max(500),
});
export type InferenceResult = z.infer<typeof InferenceResultSchema>;

// InferenceWithTranslation (翻訳含む推論結果)
export const InferenceWithTranslationSchema = z.object({
  content_ja: z.string().min(10).max(500),
  before: z.string().min(10).max(500),
  after: z.string().min(10).max(500),
  benefit: z.string().min(10).max(500),
});
export type InferenceWithTranslation = z.infer<
  typeof InferenceWithTranslationSchema
>;

// InferenceBatchResult (一括推論の Gemini API レスポンス)
export const InferenceBatchResultSchema = z.object({
  inferred_items: z.array(
    z.object({
      id: z.number(),
      content_ja: z.string(),
      before: z.string(),
      after: z.string(),
      benefit: z.string(),
    }),
  ),
  translated_items: z.array(
    z.object({
      id: z.number(),
      content_ja: z.string(),
    }),
  ),
  feature_area_corrections: z
    .array(
      z.object({
        id: z.number(),
        feature_areas: z.array(z.string()),
      }),
    )
    .optional(),
  summary: z.string(),
});
export type InferenceBatchResult = z.infer<typeof InferenceBatchResultSchema>;

// ChangelogItem
export const ChangelogItemSchema = z.object({
  content: z.string(), // 英語原文
  content_ja: z.string().optional(), // 日本語翻訳
  prefix: z.string(),
  // schema 互換のため残す固定値。現在は意味のある評価値として使わない。
  importance_score: z.number(),
  feature_areas: z.array(z.string()).optional(), // 機能領域タグ
  related_docs: z.array(RelatedDocSchema),
  inference: InferenceResultSchema.optional(),
});
export type ChangelogItem = z.infer<typeof ChangelogItemSchema>;

// Analysis (最終出力)
export const AnalysisSchema = z.object({
  version: z.string(),
  summary: z.string().optional(), // バージョン全体のサマリー(日本語)
  items: z.array(ChangelogItemSchema),
});
export type Analysis = z.infer<typeof AnalysisSchema>;
