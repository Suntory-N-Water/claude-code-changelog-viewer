import { z } from 'zod';

// Pipeline
export const PipelineSchema = z.enum(['developer', 'extension', 'general']);
export type Pipeline = z.infer<typeof PipelineSchema>;

// SearchStrategy
export const SearchStrategySchema = z.enum([
  'exact',
  'normalized',
  'multi',
  'skip',
]);
export type SearchStrategy = z.infer<typeof SearchStrategySchema>;

// AnalysisStatus
export const AnalysisStatusSchema = z.enum([
  'ready_for_inference',
  'docs_pending',
  'sdk_only',
  'no_docs_found',
  'completed',
  'inference_failed',
]);
export type AnalysisStatus = z.infer<typeof AnalysisStatusSchema>;

// Keywords
export const KeywordsSchema = z.object({
  original: z.array(z.string()),
  normalized: z.array(z.string()),
});
export type Keywords = z.infer<typeof KeywordsSchema>;

// RelatedDoc
export const RelatedDocSchema = z.object({
  file: z.string(),
  hit_count: z.number(),
  context_score: z.number(),
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

// ChangelogItem
export const ChangelogItemSchema = z.object({
  content: z.string(),
  prefix: z.string(),
  importance_score: z.number(),
  tags: z.array(z.string()),
  pipeline: PipelineSchema,
  keywords: KeywordsSchema,
  search_strategy: SearchStrategySchema,
  related_docs: z.array(RelatedDocSchema),
  analysis_status: AnalysisStatusSchema,
  inference: InferenceResultSchema.optional(),
});
export type ChangelogItem = z.infer<typeof ChangelogItemSchema>;

// Analysis (最終出力)
export const AnalysisSchema = z.object({
  version: z.string(),
  analyzed_at: z.string(), // ISO 8601 (UI非表示、デバッグ用)
  items: z.array(ChangelogItemSchema),
});
export type Analysis = z.infer<typeof AnalysisSchema>;

// ========== ヘルパー定義 ==========

export const ANALYSIS_STATUS_LABELS: Record<AnalysisStatus, string> = {
  ready_for_inference: '推論準備中',
  docs_pending: 'ドキュメント未整備',
  sdk_only: 'SDK専用',
  no_docs_found: 'ドキュメントなし',
  completed: '分析済み',
  inference_failed: '推論失敗',
};

export type ImportanceLevel = 'high' | 'medium' | 'low';

export function getImportanceLevel(score: number): ImportanceLevel {
  if (score >= 8) return 'high';
  if (score >= 5) return 'medium';
  return 'low';
}

export function getOfficialDocUrl(filePath: string): string {
  const match = filePath.match(/docs\/(en|ja)\/(.+)$/);
  if (!match) return '';
  const [, lang, path] = match;
  // .md拡張子を削除
  const pathWithoutExt = path.replace(/\.md$/, '');
  return `https://code.claude.com/docs/${lang}/${pathWithoutExt}`;
}
