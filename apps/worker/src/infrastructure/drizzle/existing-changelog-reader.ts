import { eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { changelogItems, changelogVersions } from '../../db/schema';
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
  };
}
