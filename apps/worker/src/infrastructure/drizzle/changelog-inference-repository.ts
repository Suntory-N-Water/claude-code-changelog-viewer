import type { IngestChangelogVersion } from '@claude-code-changelog-viewer/types';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type {
  ChangelogInference,
  ChangelogInferenceRepository,
} from '../../domain/changelog-inference/changelog-inference';
import { normalizeChangelogVersion } from '../../domain/changelog-inference/changelog-version';
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
    version: normalizeChangelogVersion(inference.version),
    summary: inference.summary,
    items: inference.items.map((item) => ({
      id: item.id,
      content: item.content,
      // 推論を諦めた項目は日本語を持たない。空文字のまま保存すると
      // 「翻訳済みだが本文が空」と区別できなくなるため NULL で保存する
      content_ja: item.contentJa === '' ? undefined : item.contentJa,
      prefix: item.prefix,
      feature_areas: [...item.featureAreas],
      related_docs: item.relatedDocs.map((doc) => ({ file: doc.file })),
      ...(item.inference === undefined ? {} : { inference: item.inference }),
    })),
  };
}
