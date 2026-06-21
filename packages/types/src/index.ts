import { z } from 'zod';

// RelatedDoc
export const RelatedDocSchema = z.object({
  file: z.string(),
  hit_count: z.number(),
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

// ChangelogItem
export const ChangelogItemSchema = z.object({
  content: z.string(), // 英語原文
  content_ja: z.string().optional(), // 日本語翻訳
  prefix: z.string(),
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

export const InferredRelatedDocSchema = z.object({
  file: z.string(),
});
export type InferredRelatedDoc = z.infer<typeof InferredRelatedDocSchema>;

export const InferredChangelogItemSchema = ChangelogItemSchema.omit({
  related_docs: true,
}).extend({
  related_docs: z.array(InferredRelatedDocSchema),
});
export type InferredChangelogItem = z.infer<typeof InferredChangelogItemSchema>;

export const InferredAnalysisSchema = AnalysisSchema.omit({
  items: true,
}).extend({
  items: z.array(InferredChangelogItemSchema),
});
export type InferredAnalysis = z.infer<typeof InferredAnalysisSchema>;

// NotificationAnalysis (通知配信用サブセット)
// 通知 payload を Cloudflare Queues の 128KB 上限内に収めるため
// notifier 実装が参照するフィールドのみを抽出した型。
// jq スリム化時に summary / content_ja は欠落キーまたは null になり得る。
export const NotificationChangelogItemSchema = z.object({
  content: z.string(),
  content_ja: z.string().nullable().optional(),
  prefix: z.string(),
});
export type NotificationChangelogItem = z.infer<
  typeof NotificationChangelogItemSchema
>;

export const NotificationAnalysisSchema = z.object({
  version: z.string(),
  summary: z.string().nullable().optional(),
  items: z.array(NotificationChangelogItemSchema),
});
export type NotificationAnalysis = z.infer<typeof NotificationAnalysisSchema>;
