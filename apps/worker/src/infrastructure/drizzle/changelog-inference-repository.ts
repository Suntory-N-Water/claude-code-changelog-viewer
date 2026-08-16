import type { IngestChangelogVersion } from '@claude-code-changelog-viewer/types';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type {
  ChangelogInference,
  ChangelogInferenceRepository,
} from '../../domain/changelog-inference/changelog-inference';
import { ingestChangelogVersion } from './changelog-ingestion';

export function createChangelogInferenceRepository(
  db: DrizzleD1Database,
): ChangelogInferenceRepository {
  return {
    async save(inference) {
      await ingestChangelogVersion(db, toIngestChangelogVersion(inference));
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
