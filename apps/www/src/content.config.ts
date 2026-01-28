import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const changelogCollection = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/changelog' }),
  schema: z.object({
    version: z.string(),
    analyzed_at: z.string(),
    items: z.array(
      z.object({
        content: z.string(),
        prefix: z.string(),
        importance_score: z.number(),
        tags: z.array(z.string()),
        pipeline: z.enum(['developer', 'extension', 'general']),
        keywords: z.object({
          original: z.array(z.string()),
          normalized: z.array(z.string()),
        }),
        search_strategy: z.enum(['exact', 'normalized', 'multi', 'skip']),
        related_docs: z.array(
          z.object({
            file: z.string(),
            hit_count: z.number(),
            context_score: z.number(),
            total_score: z.number(),
            snippets: z.array(z.string()),
          }),
        ),
        analysis_status: z.enum([
          'ready_for_inference',
          'docs_pending',
          'sdk_only',
          'no_docs_found',
          'completed',
          'inference_failed',
        ]),
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
