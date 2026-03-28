import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { defineCollection } from 'astro:content';

const changelogCollection = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/changelog' }),
  schema: z.object({
    version: z.string(),
    summary: z.string().optional(), // バージョン全体のサマリー(日本語)
    items: z.array(
      z.object({
        content: z.string(), // 英語原文
        content_ja: z.string().optional(), // 日本語翻訳
        prefix: z.string(),
        importance_score: z.number(),
        feature_areas: z.array(z.string()).optional(),
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

const diffCollection = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/diff' }),
  schema: z.object({
    events: z.array(
      z.object({
        detected_at: z.iso.datetime(),
        version: z.string(),
        type: z.enum(['items_changed', 'version_removed']),
        items_added: z.array(z.string()),
        items_removed: z.array(z.string()),
      }),
    ),
  }),
});

const docsDiffCollection = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/docs-diff' }),
  schema: z.object({
    entries: z.array(
      z.object({
        id: z.string(),
        timestamp: z.iso.datetime(),
        aiSummary: z.string(),
        files: z.array(
          z.object({
            filename: z.string(),
            additions: z.number(),
            deletions: z.number(),
            hunks: z.array(
              z.object({
                header: z.string(),
                lines: z.array(
                  z.object({
                    type: z.enum(['added', 'removed', 'context']),
                    content: z.string(),
                  }),
                ),
              }),
            ),
          }),
        ),
      }),
    ),
  }),
});

export const collections = {
  changelog: changelogCollection,
  diff: diffCollection,
  docsDiff: docsDiffCollection,
};
