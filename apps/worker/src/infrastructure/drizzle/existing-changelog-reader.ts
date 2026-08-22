import { eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import {
  changelogDiffEvents,
  changelogItems,
  changelogVersions,
} from '../../db/schema';
import type { ExistingChangelogReader } from '../../usecases/changelog-inference-workflow';

export function createExistingChangelogReader(
  db: DrizzleD1Database,
): ExistingChangelogReader {
  return {
    async findExistingItems() {
      return db
        .select({
          version: changelogVersions.version,
          itemId: changelogItems.itemId,
          content: changelogItems.content,
        })
        .from(changelogVersions)
        .leftJoin(
          changelogItems,
          eq(changelogItems.version, changelogVersions.version),
        );
    },

    async findRecordedRemovedVersions() {
      const rows = await db
        .selectDistinct({ version: changelogDiffEvents.version })
        .from(changelogDiffEvents)
        .where(eq(changelogDiffEvents.type, 'version_removed'));
      return rows.map((row) => row.version);
    },
  };
}
