import { eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { changelogItems, changelogVersions } from '../../db/schema';
import type { ChangelogWorkflowDataPort } from '../../usecases/changelog-inference-workflow';

export function createChangelogWorkflowDataPort(
  db: DrizzleD1Database,
): ChangelogWorkflowDataPort {
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
