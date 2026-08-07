import type { McpServer } from '@modelcontextprotocol/server';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { z } from 'zod';
import { searchChangelogItems } from '../../infrastructure/drizzle/changelog-repository';

export function registerSearchChangelogTool(
  server: McpServer,
  db: DrizzleD1Database,
): void {
  server.registerTool(
    'search_changelog',
    {
      description:
        'Claude Code の CHANGELOG をキーワードで検索する。' +
        '「どのバージョンでこの機能が入ったか」「この機能領域で何が変わったか」を調べるときに使う。' +
        'バージョン番号がわかっている場合は get_changelog を使う。',
      inputSchema: z.object({
        query: z
          .string()
          .min(1)
          .max(50)
          .describe('検索キーワード。日本語・英語のどちらでもよい'),
        featureArea: z
          .string()
          .optional()
          .describe('Settings, Permissions, Hooks などの機能領域で絞る'),
        prefix: z
          .string()
          .optional()
          .describe('Added, Fixed, Changed, Improved などの変更種別で絞る'),
        limit: z.number().int().min(1).max(30).default(10),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ query, featureArea, prefix, limit }) => {
      const hits = await searchChangelogItems(db, {
        query,
        featureArea,
        prefix,
        limit,
      });
      const items = hits.map((hit) => ({
        version: hit.version,
        prefix: hit.prefix,
        featureAreas: hit.featureAreas,
        content: hit.contentJa ?? hit.content,
        // undefined にすると JSON.stringify がキーごと落とし、null のトークンを消せる
        benefit: hit.benefit ?? undefined,
      }));
      return { content: [{ type: 'text', text: JSON.stringify(items) }] };
    },
  );
}
