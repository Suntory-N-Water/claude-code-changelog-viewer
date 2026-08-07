import type { McpServer } from '@modelcontextprotocol/server';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { z } from 'zod';
import { findChangelogVersion } from '../../infrastructure/drizzle/changelog-repository';

export function registerGetChangelogTool(
  server: McpServer,
  db: DrizzleD1Database,
): void {
  server.registerTool(
    'get_changelog',
    {
      description:
        'Claude Code の指定バージョンの CHANGELOG(要約と全変更項目)を取得する。' +
        'バージョン番号がわからない場合は search_changelog でキーワード検索する。',
      inputSchema: z.object({
        version: z.string().min(1).describe('バージョン番号(例: 2.1.98)'),
        lang: z
          .enum(['ja', 'en'])
          .default('ja')
          .describe('変更項目の言語。ja は日本語訳、en は原文'),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ version, lang }) => {
      const found = await findChangelogVersion(db, version);
      if (found === null) {
        return {
          content: [
            {
              type: 'text',
              text: `バージョン ${version} は見つかりません。search_changelog でキーワード検索を試してください。`,
            },
          ],
          isError: true,
        };
      }
      const payload = {
        version: found.version,
        summary: found.summary ?? undefined,
        items: found.items.map((item) => ({
          prefix: item.prefix,
          featureAreas: item.featureAreas,
          content:
            lang === 'ja' ? (item.contentJa ?? item.content) : item.content,
          // benefit は日本語でしか存在しないため en では返さない
          benefit: lang === 'ja' ? (item.benefit ?? undefined) : undefined,
        })),
      };
      return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
    },
  );
}
