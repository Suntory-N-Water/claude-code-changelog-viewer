import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const changelogCollection = defineCollection({
  loader: glob({
    pattern: 'inferred_v*.json',
    base: './src/content/changelog',
  }),
  schema: z.object({
    version: z.string(),
    summary: z.string().optional(), // バージョン全体のサマリー(日本語)
    items: z.array(
      z.object({
        id: z.string().length(12), // sha256(content)[0:12]
        content: z.string(), // 英語原文
        content_ja: z.string().optional(), // 日本語翻訳
        prefix: z.string(),
        feature_areas: z.array(z.string()).optional(),
        related_docs: z.array(
          z.object({
            file: z.string(),
          }),
        ),
        inference: z
          .object({
            before: z.string().min(10).max(500),
            after: z.string().min(10).max(500),
            benefit: z.string().min(10).max(500),
          })
          .optional(),
        impact: z
          .object({
            level: z.enum(['high', 'medium', 'low']),
            default_behavior_change: z.boolean(),
            breaking: z.boolean(),
            reason: z.string(),
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
    id: z.string(),
    timestamp: z.iso.datetime(),
    aiSummary: z.string(),
    files: z.array(
      z.object({
        filename: z.string(),
        additions: z.number(),
        deletions: z.number(),
        explanation: z.string().optional(),
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
});

const blogCollection = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    source: z.enum(['claude-blog', 'anthropic-news', 'anthropic-engineering']),
    url: z.string().url(),
    title: z.string(),
    published_at: z.iso.datetime(),
    content_hash: z.string(),
    lang: z.literal('en'),
  }),
});

const postsCollection = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    versions: z.array(z.string()),
  }),
});

const youtubeCollection = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/youtube' }),
  schema: z.object({
    source: z.literal('youtube'),
    url: z.string().url(),
    title: z.string(),
    published_at: z.iso.datetime(),
    content_hash: z.string(),
    lang: z.literal('en'),
    video_id: z.string(),
    channel_id: z.string(),
    duration_sec: z.number(),
    has_transcript: z.boolean(),
  }),
});

const settingsReferenceCollection = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/settings' }),
  schema: z.object({
    key: z.string(),
    leaf_name: z.string().optional(),
    slug: z.string(),
    source: z.enum(['settings', 'env']),
    description_en: z.string(),
    description_ja: z.string(),
    use_case_ja: z.string().optional(),
    parent_descriptions: z.array(z.string()),
    doc_snippets: z.array(z.string()),
    official_doc_urls: z.array(z.string().url()).optional(),
    fetched_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    related_changelog: z.array(z.unknown()),
  }),
});

export const collections = {
  blog: blogCollection,
  changelog: changelogCollection,
  diff: diffCollection,
  docsDiff: docsDiffCollection,
  posts: postsCollection,
  settingsReference: settingsReferenceCollection,
  youtube: youtubeCollection,
};
