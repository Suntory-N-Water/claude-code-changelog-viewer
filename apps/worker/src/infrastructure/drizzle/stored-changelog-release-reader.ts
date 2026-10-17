import { eq, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { changelogItems, changelogVersions } from '../../db/schema';
import {
  formatChangelogVersion,
  normalizeChangelogVersion,
} from '../../domain/changelog-inference/changelog-version';
import type { StoredChangelogReleaseReader } from '../../usecases/changelog-inference-workflow';

export function createStoredChangelogReleaseReader(
  db: DrizzleD1Database,
): StoredChangelogReleaseReader {
  return {
    async listVersions() {
      const rows = await db.select({ version: changelogVersions.version }).from(changelogVersions);
      return rows.map((row) => row.version);
    },

    async findRelease(version) {
      const normalizedVersion = normalizeChangelogVersion(version);
      const versionRow = await db
        .select({ version: changelogVersions.version })
        .from(changelogVersions)
        .where(eq(changelogVersions.version, normalizedVersion))
        .get();
      if (versionRow === undefined) {
        return null;
      }
      // 保存は入力の並び順で INSERT しているため、rowid 順が CHANGELOG 上の並び順になる
      const items = await db
        .select({
          id: changelogItems.itemId,
          content: changelogItems.content,
          prefix: changelogItems.prefix,
          contentJa: changelogItems.contentJa,
        })
        .from(changelogItems)
        .where(eq(changelogItems.version, normalizedVersion))
        .orderBy(sql`rowid`);
      return {
        release: {
          version: formatChangelogVersion(versionRow.version),
          items: items.map(({ id, content, prefix }) => ({ id, content, prefix })),
        },
        translations: items.flatMap(({ id, contentJa }) =>
          contentJa === null ? [] : [{ id, contentJa }],
        ),
      };
    },
  };
}
