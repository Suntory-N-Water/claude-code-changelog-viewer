import {
  ClaudeCodeVersionSchema,
  NotificationAnalysisSchema,
  type NotificationAnalysis,
} from '@claude-code-changelog-viewer/types';
import { eq, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { ChangelogNotificationPort } from '../../usecases/changelog-inference-workflow';
import { changelogItems, changelogVersions } from '../../db/schema';

type NotificationQueueMessage = {
  readonly version: string;
  readonly analysis: NotificationAnalysis;
};

type NotificationRow = {
  readonly version: string;
  readonly summary: string | null;
  readonly itemId: string | null;
  readonly content: string | null;
  readonly contentJa: string | null;
  readonly prefix: string | null;
};

export function createChangelogWorkflowNotifier(
  db: DrizzleD1Database,
  queue: Queue<NotificationQueueMessage>,
): ChangelogNotificationPort {
  return {
    async send(version) {
      // 保存済みの D1 行を再取得し、AI のメモリ上の結果ではなく永続化済みデータを Queue に渡す。
      const rows = await db
        .select({
          version: changelogVersions.version,
          summary: changelogVersions.summary,
          itemId: changelogItems.itemId,
          content: changelogItems.content,
          contentJa: changelogItems.contentJa,
          prefix: changelogItems.prefix,
        })
        .from(changelogVersions)
        .leftJoin(
          changelogItems,
          eq(changelogItems.version, changelogVersions.version),
        )
        .where(eq(changelogVersions.version, version.replace(/^v/, '')))
        .orderBy(sql.raw('changelog_items.rowid'));
      const first = rows[0];
      if (first === undefined) {
        throw new Error(`通知対象のバージョンが D1 にありません: ${version}`);
      }

      const notificationVersion = ClaudeCodeVersionSchema.parse(
        `v${first.version.replace(/^v/, '')}`,
      );
      const analysis = NotificationAnalysisSchema.parse({
        version: notificationVersion,
        summary: first.summary,
        items: rows
          .filter(
            (
              row,
            ): row is NotificationRow & {
              readonly itemId: string;
              readonly content: string;
              readonly prefix: string;
            } =>
              row.itemId !== null &&
              row.content !== null &&
              row.prefix !== null,
          )
          .map((row) => ({
            content: row.content,
            content_ja: row.contentJa,
            prefix: row.prefix,
          })),
      });
      await queue.send({ version: notificationVersion, analysis });
    },
  };
}
