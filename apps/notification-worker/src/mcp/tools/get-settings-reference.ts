import type { McpServer } from '@modelcontextprotocol/server';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { z } from 'zod';
import {
  findSettingByKey,
  listSettingKeys,
  searchSettings,
} from '../../infrastructure/drizzle/changelog-repository';
import type { settingsReference } from '../../db/schema';

function toSettingPayload(row: typeof settingsReference.$inferSelect) {
  return {
    key: row.key,
    source: row.source,
    description: row.descriptionJa,
    useCase: row.useCaseJa ?? undefined,
    officialDocUrls:
      row.officialDocUrls === null
        ? undefined
        : (JSON.parse(row.officialDocUrls) as string[]),
  };
}

export function registerGetSettingsReferenceTool(
  server: McpServer,
  db: DrizzleD1Database,
): void {
  server.registerTool(
    'get_settings_reference',
    {
      description:
        'Claude Code の設定リファレンス(settings.json のキーと環境変数)を調べる。' +
        'key を指定すると完全一致で 1 件、query を指定するとキーワード検索、' +
        'どちらも指定しない場合はキー名の一覧だけを返す。key と query の両方を指定した場合は key を優先する。',
      inputSchema: z.object({
        key: z
          .string()
          .optional()
          .describe('設定キー名の完全一致(例: model, ANTHROPIC_MODEL)'),
        query: z
          .string()
          .min(1)
          .max(50)
          .optional()
          .describe('キー名と説明文を対象にしたキーワード検索'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(30)
          .default(10)
          .describe('query 検索時の最大件数'),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ key, query, limit }) => {
      if (key !== undefined) {
        const setting = await findSettingByKey(db, key);
        if (setting === null) {
          return {
            content: [
              {
                type: 'text',
                text: `設定キー ${key} は見つかりません。query でキーワード検索を試してください。`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            { type: 'text', text: JSON.stringify(toSettingPayload(setting)) },
          ],
        };
      }
      if (query !== undefined) {
        const settings = await searchSettings(db, query, limit);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(settings.map(toSettingPayload)),
            },
          ],
        };
      }
      const keys = await listSettingKeys(db);
      const payload = {
        settings: keys
          .filter((row) => row.source === 'settings')
          .map((row) => row.key),
        env: keys.filter((row) => row.source === 'env').map((row) => row.key),
      };
      return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
    },
  );
}
