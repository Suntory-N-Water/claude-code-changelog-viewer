import { z } from 'zod';

export const ClaudeCodeVersionSchema = z.string().regex(/^v\d+\.\d+\.\d+$/);

export const RelatedDocSchema = z.object({
  file: z.string(),
  hit_count: z.number(),
  snippets: z.array(z.string()),
  snippet_scores: z.array(z.number()).optional(),
});

export const InferenceResultSchema = z.object({
  before: z.string().min(10).max(500),
  after: z.string().min(10).max(500),
  benefit: z.string().min(10).max(500),
});
export type InferenceResult = z.infer<typeof InferenceResultSchema>;

export const InferenceWithTranslationSchema = z.object({
  content_ja: z.string().min(10).max(500),
  before: z.string().min(10).max(500),
  after: z.string().min(10).max(500),
  benefit: z.string().min(10).max(500),
});

export const ImpactAssessmentSchema = z.object({
  level: z.enum(['high', 'medium', 'low']),
  default_behavior_change: z.boolean(),
  breaking: z.boolean(),
  reason: z.string(),
});

export const ChangelogItemSchema = z.object({
  id: z.string().length(12), // sha256(content)[0:12]
  content: z.string(), // 英語原文
  content_ja: z.string().optional(), // 日本語翻訳
  prefix: z.string(),
  feature_areas: z.array(z.string()).optional(), // 機能領域タグ
  related_docs: z.array(RelatedDocSchema),
  inference: InferenceResultSchema.optional(),
  impact: ImpactAssessmentSchema.optional(),
});

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

// D1 取り込み用ペイロード。inferred ファイルの version は 'v' プレフィックスなし。
// 旧バージョンのファイルには summary / content_ja / feature_areas / inference がなく、
// jq の射影では欠落キーが null になるため nullable + optional にする。
export const IngestChangelogItemSchema = z.object({
  id: z.string().length(12),
  content: z.string(),
  content_ja: z.string().nullable().optional(),
  prefix: z.string(),
  feature_areas: z.array(z.string()).nullable().optional(),
  related_docs: z.array(InferredRelatedDocSchema).nullable().optional(),
  inference: z
    .object({
      before: z.string(),
      after: z.string(),
      benefit: z.string(),
    })
    .nullable()
    .optional(),
});

export const IngestChangelogVersionSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  summary: z.string().nullable().optional(),
  items: z.array(IngestChangelogItemSchema),
});
export type IngestChangelogVersion = z.infer<
  typeof IngestChangelogVersionSchema
>;

export const IngestChangelogDiffEventSchema = z.object({
  detected_at: z.string(),
  version: z.string().regex(/^v?\d+\.\d+\.\d+$/),
  type: z.enum(['items_changed', 'version_removed']),
  items_added: z.array(z.string()),
  items_removed: z.array(z.string()),
});
export type IngestChangelogDiffEvent = z.infer<
  typeof IngestChangelogDiffEventSchema
>;

// doc_snippets は意図的に受け取らない(D1 の SQL 文長上限と LLM 向けノイズ対策)
export const IngestSettingSchema = z.object({
  key: z.string().min(1),
  leaf_name: z.string().nullable().optional(),
  slug: z.string(),
  source: z.enum(['settings', 'env']),
  description_en: z.string(),
  description_ja: z.string(),
  use_case_ja: z.string().nullable().optional(),
  enum_descriptions_ja: z.string().nullable().optional(),
  default_note_ja: z.string().nullable().optional(),
  fetched_at: z.string(),
  official_doc_urls: z.array(z.string()).nullable().optional(),
});
export type IngestSetting = z.infer<typeof IngestSettingSchema>;

// D1 の queries 上限 (1000/invocation) から 1 リクエスト 50 バージョンに制限する
export const IngestChangelogPayloadSchema = z.object({
  versions: z.array(IngestChangelogVersionSchema).max(50).default([]),
  settings: z.array(IngestSettingSchema).default([]),
  diff_events: z.array(IngestChangelogDiffEventSchema).default([]),
});

// 通知 payload を Cloudflare Queues の 128KB 上限内に収めるため
// notifier 実装が参照するフィールドのみを抽出した型。
// jq スリム化時に summary / content_ja は欠落キーまたは null になり得る。
export const NotificationChangelogItemSchema = z.object({
  content: z.string(),
  content_ja: z.string().nullable().optional(),
  prefix: z.string(),
});

export const NotificationAnalysisSchema = z.object({
  version: z.string(),
  summary: z.string().nullable().optional(),
  items: z.array(NotificationChangelogItemSchema),
});
export type NotificationAnalysis = z.infer<typeof NotificationAnalysisSchema>;
