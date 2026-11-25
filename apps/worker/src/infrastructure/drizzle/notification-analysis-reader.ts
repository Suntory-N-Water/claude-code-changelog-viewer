import {
  ClaudeCodeVersionSchema,
  NotificationAnalysisSchema,
  type NotificationAnalysis,
} from '@claude-code-changelog-viewer/types';
import { eq, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import {
  formatChangelogVersion,
  normalizeChangelogVersion,
} from '../../domain/changelog-inference/changelog-version';
import { changelogItems, changelogVersions } from '../../db/schema';

type NotificationRow = {
  version: string;
  summary: string | null;
  itemId: string | null;
  content: string | null;
  contentJa: string | null;
  prefix: string | null;
};

export async function findNotificationAnalysis(
  db: DrizzleD1Database,
  version: string,
): Promise<NotificationAnalysis | null> {
  const rows: NotificationRow[] = await db
    .select({
      version: changelogVersions.version,
      summary: changelogVersions.summary,
      itemId: changelogItems.itemId,
      content: changelogItems.content,
      contentJa: changelogItems.contentJa,
      prefix: changelogItems.prefix,
    })
    .from(changelogVersions)
    .leftJoin(changelogItems, eq(changelogItems.version, changelogVersions.version))
    .where(eq(changelogVersions.version, normalizeChangelogVersion(version)))
    .orderBy(sql.raw('changelog_items.rowid'));
  const first = rows[0];
  if (first === undefined) {
    return null;
  }

  return NotificationAnalysisSchema.parse({
    version: ClaudeCodeVersionSchema.parse(formatChangelogVersion(first.version)),
    summary: first.summary,
    items: rows
      .filter(
        (
          row,
        ): row is NotificationRow & {
          itemId: string;
          content: string;
          prefix: string;
        } => row.itemId !== null && row.content !== null && row.prefix !== null,
      )
      .map((row) => ({
        content: row.content,
        content_ja: row.contentJa,
        prefix: row.prefix,
      })),
  });
}
