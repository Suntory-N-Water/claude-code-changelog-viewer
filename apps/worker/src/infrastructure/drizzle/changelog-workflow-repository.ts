import type { IngestChangelogVersion } from '@claude-code-changelog-viewer/types';
import { eq, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { changelogItems, changelogVersions } from '../../db/schema';
import type { ChangelogInference } from '../../domain/changelog-inference/changelog-inference';
import type { ChangelogWorkflowRepository } from '../../usecases/changelog-inference-workflow';
import {
  ingestChangelogDiffEvents,
  ingestChangelogVersion,
} from './changelog-ingestion';

export function createChangelogWorkflowRepository(
  db: DrizzleD1Database,
): ChangelogWorkflowRepository {
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

    async saveDiffEvents(events) {
      await ingestChangelogDiffEvents(db, [...events]);
    },

    async saveVersion(inference) {
      await ingestChangelogVersion(db, toIngestChangelogVersion(inference));
    },

    async findNotificationRows(version) {
      return db
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
    },
  };
}

function toIngestChangelogVersion(
  inference: ChangelogInference,
): IngestChangelogVersion {
  return {
    version: inference.version.replace(/^v/, ''),
    summary: inference.summary,
    items: inference.items.map((item) => ({
      id: item.id,
      content: item.content,
      content_ja: item.contentJa,
      prefix: item.prefix,
      feature_areas: [...item.featureAreas],
      related_docs: item.relatedDocs.map((doc) => ({ file: doc.file })),
      ...(item.inference === undefined ? {} : { inference: item.inference }),
    })),
  };
}
