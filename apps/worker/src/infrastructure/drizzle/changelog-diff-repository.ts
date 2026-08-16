import type { IngestChangelogDiffEvent } from '@claude-code-changelog-viewer/types';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type {
  ChangelogDiffEvent,
  ChangelogDiffRepository,
} from '../../domain/changelog-inference/changelog-inference';
import { ingestChangelogDiffEvents } from './changelog-ingestion';

export function createChangelogDiffRepository(
  db: DrizzleD1Database,
): ChangelogDiffRepository {
  return {
    async saveAll(events) {
      const ingestionEvents: IngestChangelogDiffEvent[] = events.map((event) =>
        toIngestChangelogDiffEvent(event),
      );
      await ingestChangelogDiffEvents(db, ingestionEvents);
    },
  };
}

function toIngestChangelogDiffEvent(
  event: ChangelogDiffEvent,
): IngestChangelogDiffEvent {
  return {
    detected_at: event.detectedAt,
    version: event.version,
    type: event.type,
    items_added: [...event.itemsAdded],
    items_removed: [...event.itemsRemoved],
  };
}
