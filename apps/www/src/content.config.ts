import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const changelogCollection = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/changelog' }),
  schema: z.object({
    version: z.string(),
    summary: z.string().optional(), // バージョン全体のサマリー（日本語）
    items: z.array(
      z.object({
        content: z.string(), // 英語原文
        content_ja: z.string().optional(), // 日本語翻訳
        prefix: z.string(),
        importance_score: z.number(),
        related_docs: z.array(
          z.object({
            file: z.string(),
            hit_count: z.number(),
            context_score: z.number(),
            total_score: z.number(),
            snippets: z.array(z.string()),
          }),
        ),
        inference: z
          .object({
            before: z.string().min(10).max(500),
            after: z.string().min(10).max(500),
            benefit: z.string().min(10).max(500),
          })
          .optional(),
      }),
    ),
  }),
});

export const collections = {
  changelog: changelogCollection,
};
