import { z } from 'zod';

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
  summary: z.string(),
});
export type InferenceBatchResult = z.infer<typeof InferenceBatchResultSchema>;

// ChangelogItem
export const ChangelogItemSchema = z.object({
  content: z.string(), // 英語原文
  content_ja: z.string().optional(), // 日本語翻訳
  prefix: z.string(),
  importance_score: z.number(),
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

export function getOfficialDocUrl(filePath: string): string {
  const match = filePath.match(/docs\/(en|ja)\/(.+)$/);
  if (!match) {
    return '';
  }
  const [, lang, path] = match;
  // .md拡張子を削除
  const pathWithoutExt = path.replace(/\.md$/, '');
  return `https://code.claude.com/docs/${lang}/${pathWithoutExt}`;
}
