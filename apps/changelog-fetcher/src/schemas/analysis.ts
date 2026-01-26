import * as v from 'valibot';

// キーワード
export const KeywordsSchema = v.object({
  original: v.array(v.string()), // [`CLAUDE_CODE_ENABLE_TASKS`, `false`]
  normalized: v.array(v.string()), // [CLAUDE_CODE_ENABLE_TASKS, false]
});

// 関連ドキュメント
export const RelatedDocSchema = v.object({
  file: v.string(), // apps/docs-tracker/docs/en/skills.md
  hit_count: v.number(), // 9
  context_score: v.number(), // 15
  total_score: v.number(), // 135
  snippets: v.array(v.string()), // ["| `$ARGUMENTS` | All arguments...", ...]
});

// AI推論結果
export const InferenceResultSchema = v.object({
  before: v.pipe(v.string(), v.minLength(10), v.maxLength(500)),
  after: v.pipe(v.string(), v.minLength(10), v.maxLength(500)),
  benefit: v.pipe(v.string(), v.minLength(10), v.maxLength(500)),
});

// CHANGELOG項目
export const ChangelogItemSchema = v.object({
  content: v.string(),
  prefix: v.string(), // Added/Fixed/Changed
  importance_score: v.number(), // 4-10
  tags: v.array(v.string()), // ["SDK"], ["VSCode"], []
  pipeline: v.picklist(['developer', 'extension', 'general']),
  keywords: KeywordsSchema,
  search_strategy: v.picklist(['exact', 'normalized', 'multi', 'skip']),
  related_docs: v.array(RelatedDocSchema),
  analysis_status: v.picklist([
    'ready_for_inference',
    'docs_pending',
    'sdk_only',
    'no_docs_found',
    'completed',
    'inference_failed',
  ]),
  inference: v.optional(InferenceResultSchema),
});

// 最終出力
export const AnalysisSchema = v.object({
  version: v.string(),
  analyzed_at: v.string(), // ISO 8601
  items: v.array(ChangelogItemSchema),
});

export type Analysis = v.InferOutput<typeof AnalysisSchema>;
export type ChangelogItem = v.InferOutput<typeof ChangelogItemSchema>;
export type RelatedDoc = v.InferOutput<typeof RelatedDocSchema>;
export type Keywords = v.InferOutput<typeof KeywordsSchema>;
export type InferenceResult = v.InferOutput<typeof InferenceResultSchema>;
