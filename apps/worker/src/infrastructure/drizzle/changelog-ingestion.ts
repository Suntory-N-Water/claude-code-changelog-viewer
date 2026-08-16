import type {
  IngestChangelogDiffEvent,
  IngestChangelogVersion,
} from '@claude-code-changelog-viewer/types';
import type { BatchItem } from 'drizzle-orm/batch';
import { eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import {
  changelogDiffEventItems,
  changelogDiffEvents,
  changelogItemFeatureAreas,
  changelogItemRelatedDocs,
  changelogItems,
  changelogVersions,
} from '../../db/schema';

// D1 の bound parameters 上限 100/query から逆算した 1 INSERT あたりの行数
const ITEMS_PER_INSERT = 11; // 9 カラム
const FEATURE_AREAS_PER_INSERT = 33; // 3 カラム
const RELATED_DOCS_PER_INSERT = 33; // 3 カラム
const DIFF_EVENTS_PER_INSERT = 33; // 3 カラム
const DIFF_EVENT_ITEMS_PER_INSERT = 20; // 5 カラム
const MAX_BATCH_STATEMENTS = 100;

function chunk<T>(rows: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    result.push(rows.slice(i, i + size));
  }
  return result;
}

async function runBatchedStatements(
  db: DrizzleD1Database,
  statements: BatchItem<'sqlite'>[],
): Promise<void> {
  for (const batchStatements of chunk(statements, MAX_BATCH_STATEMENTS)) {
    const [first, ...rest] = batchStatements;
    if (first !== undefined) {
      await db.batch([first, ...rest]);
    }
  }
}

function toDocPath(value: string): string {
  // docs 検索用 D1 の pages 主キーに合わせて docs/en/ 以下の .md パスに揃える
  const normalized = value.replaceAll('\\', '/').split(/[?#]/)[0] ?? value;
  const marker = 'docs/en/';
  const markerIndex = normalized.indexOf(marker);
  const path =
    markerIndex === -1
      ? normalized
      : normalized.slice(markerIndex + marker.length);
  const withoutTrailingSlash = path.replace(/\/+$/, '');
  return withoutTrailingSlash.endsWith('.md')
    ? withoutTrailingSlash
    : `${withoutTrailingSlash}.md`;
}

// version 単位の delete → insert を同じ batch で実行し、冪等性と原子性を保つ。
export async function ingestChangelogVersion(
  db: DrizzleD1Database,
  entry: IngestChangelogVersion,
): Promise<void> {
  const itemRows = entry.items.map((item) => ({
    version: entry.version,
    itemId: item.id,
    content: item.content,
    contentJa: item.content_ja ?? null,
    prefix: item.prefix,
    inferenceBefore: item.inference?.before ?? null,
    inferenceAfter: item.inference?.after ?? null,
    inferenceBenefit: item.inference?.benefit ?? null,
    searchText: [item.content, item.content_ja, entry.summary]
      .filter((text) => text != null)
      .join('\n')
      .normalize('NFKC')
      .toLowerCase(),
  }));
  // 実データには同一 item 内で feature_area が重複する例があり
  // (v2.1.110 の 44f5d2690b62)、複合 PK に違反するため除去する
  const featureAreaRows = entry.items.flatMap((item) =>
    [...new Set(item.feature_areas ?? [])].map((featureArea) => ({
      version: entry.version,
      itemId: item.id,
      featureArea,
    })),
  );
  const relatedDocRows = entry.items.flatMap((item) =>
    [
      ...new Set(
        (item.related_docs ?? []).map((relatedDoc) =>
          toDocPath(relatedDoc.file),
        ),
      ),
    ].map((docPath) => ({
      version: entry.version,
      itemId: item.id,
      docPath,
    })),
  );

  const statements = [
    db
      .delete(changelogItemRelatedDocs)
      .where(eq(changelogItemRelatedDocs.version, entry.version)),
    db
      .delete(changelogItemFeatureAreas)
      .where(eq(changelogItemFeatureAreas.version, entry.version)),
    db.delete(changelogItems).where(eq(changelogItems.version, entry.version)),
    db
      .delete(changelogVersions)
      .where(eq(changelogVersions.version, entry.version)),
    db
      .insert(changelogVersions)
      .values({ version: entry.version, summary: entry.summary ?? null }),
    ...chunk(itemRows, ITEMS_PER_INSERT).map((rows) =>
      db.insert(changelogItems).values(rows),
    ),
    ...chunk(featureAreaRows, FEATURE_AREAS_PER_INSERT).map((rows) =>
      db.insert(changelogItemFeatureAreas).values(rows),
    ),
    ...chunk(relatedDocRows, RELATED_DOCS_PER_INSERT).map((rows) =>
      db.insert(changelogItemRelatedDocs).values(rows),
    ),
  ] as const;
  if (statements.length > MAX_BATCH_STATEMENTS) {
    throw new Error(
      `version ${entry.version} の D1 batch が上限を超えています: ${statements.length}`,
    );
  }
  const [first, ...rest] = statements;
  if (first !== undefined) {
    await db.batch([first, ...rest]);
  }
}

export async function ingestChangelogDiffEvents(
  db: DrizzleD1Database,
  events: IngestChangelogDiffEvent[],
): Promise<void> {
  if (events.length === 0) {
    return;
  }

  const eventRows = events.map((event) => ({
    version: event.version,
    detectedAt: event.detected_at,
    type: event.type,
  }));
  const itemRows = events.flatMap((event) => [
    ...event.items_added.map((content, seq) => ({
      version: event.version,
      detectedAt: event.detected_at,
      direction: 'added' as const,
      seq,
      content,
    })),
    ...event.items_removed.map((content, seq) => ({
      version: event.version,
      detectedAt: event.detected_at,
      direction: 'removed' as const,
      seq,
      content,
    })),
  ]);

  const statements = [
    ...chunk(eventRows, DIFF_EVENTS_PER_INSERT).map((rows) =>
      db.insert(changelogDiffEvents).values(rows).onConflictDoNothing(),
    ),
    ...chunk(itemRows, DIFF_EVENT_ITEMS_PER_INSERT).map((rows) =>
      db.insert(changelogDiffEventItems).values(rows).onConflictDoNothing(),
    ),
  ];
  await runBatchedStatements(db, statements);
}
