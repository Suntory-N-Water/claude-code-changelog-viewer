import {
  type IngestChangelogDiffEvent,
  type IngestChangelogVersion,
  IngestChangelogPayloadSchema,
  type IngestSetting,
} from '@claude-code-changelog-viewer/types';
import type { BatchItem } from 'drizzle-orm/batch';
import { eq, sql } from 'drizzle-orm';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import { Hono } from 'hono';
import {
  changelogDiffEventItems,
  changelogDiffEvents,
  changelogItemFeatureAreas,
  changelogItemRelatedDocs,
  changelogItems,
  changelogVersions,
  settingsReference,
  settingsOfficialDocs,
} from '../db/schema';
import { timingSafeEqual } from './dispatch';

// D1 の bound parameters 上限 100/query から逆算した 1 INSERT あたりの行数
const ITEMS_PER_INSERT = 11; // 9 カラム
const FEATURE_AREAS_PER_INSERT = 33; // 3 カラム
const RELATED_DOCS_PER_INSERT = 33; // 3 カラム
const DIFF_EVENTS_PER_INSERT = 33; // 3 カラム
const DIFF_EVENT_ITEMS_PER_INSERT = 20; // 5 カラム
const SETTINGS_PER_INSERT = 12; // 8 カラム
const OFFICIAL_DOCS_PER_INSERT = 50; // 2 カラム
const MAX_BATCH_STATEMENTS = 100;

function sqlExcluded(column: string) {
  return sql.raw(`excluded.${column}`);
}

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

// 全角半角・大文字小文字の揺れを吸収するため NFKC 正規化 + 小文字化する
function buildSearchText(texts: (string | null | undefined)[]): string {
  return texts
    .filter((text) => text != null)
    .join('\n')
    .normalize('NFKC')
    .toLowerCase();
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
async function ingestVersion(
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
    searchText: buildSearchText([item.content, item.content_ja, entry.summary]),
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

async function ingestDiffEvents(
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

async function ingestSettings(
  db: DrizzleD1Database,
  settings: IngestSetting[],
): Promise<void> {
  const rows = settings.map((setting) => ({
    key: setting.key,
    slug: setting.slug,
    source: setting.source,
    descriptionEn: setting.description_en,
    descriptionJa: setting.description_ja,
    useCaseJa: setting.use_case_ja ?? null,
    leafName: setting.leaf_name ?? null,
    fetchedAt: setting.fetched_at,
  }));
  const officialDocRows = settings.flatMap((setting) =>
    [
      ...new Set(
        (setting.official_doc_urls ?? []).map((url) => toDocPath(url)),
      ),
    ].map((docPath) => ({
      settingKey: setting.key,
      docPath,
    })),
  );

  if (rows.length === 0) {
    return;
  }

  const deleteOfficialDocStatements = settings.map((setting) =>
    db
      .delete(settingsOfficialDocs)
      .where(eq(settingsOfficialDocs.settingKey, setting.key)),
  );
  const settingStatements = chunk(rows, SETTINGS_PER_INSERT).map((chunkRows) =>
    db
      .insert(settingsReference)
      .values(chunkRows)
      .onConflictDoUpdate({
        target: settingsReference.key,
        set: {
          leafName: sqlExcluded('leaf_name'),
          slug: sqlExcluded('slug'),
          source: sqlExcluded('source'),
          descriptionEn: sqlExcluded('description_en'),
          descriptionJa: sqlExcluded('description_ja'),
          useCaseJa: sqlExcluded('use_case_ja'),
          fetchedAt: sqlExcluded('fetched_at'),
        },
      }),
  );
  const officialDocStatements = chunk(
    officialDocRows,
    OFFICIAL_DOCS_PER_INSERT,
  ).map((chunkRows) =>
    db.insert(settingsOfficialDocs).values(chunkRows).onConflictDoNothing(),
  );
  const statements = [
    ...deleteOfficialDocStatements,
    ...settingStatements,
    ...officialDocStatements,
  ];
  await runBatchedStatements(db, statements);
}

export const ingestChangelogRoute = new Hono<{
  Bindings: CloudflareBindings;
}>().post('/', async (c) => {
  const authHeader = c.req.header('Authorization');
  const isValid = await timingSafeEqual(
    authHeader ?? '',
    `Bearer ${c.env.DISPATCH_SECRET}`,
  );
  if (!isValid) {
    return c.json({ error: '認証に失敗しました' }, 401);
  }

  const parseResult = IngestChangelogPayloadSchema.safeParse(
    await c.req.json(),
  );
  if (!parseResult.success) {
    return c.json({ error: 'リクエストが不正です' }, 400);
  }
  const { versions, settings, diff_events: diffEvents } = parseResult.data;

  const db = drizzle(c.env.DB);
  for (const entry of versions) {
    await ingestVersion(db, entry);
  }
  await ingestDiffEvents(db, diffEvents);
  await ingestSettings(db, settings);

  return c.json({
    success: true,
    versions: versions.length,
    settings: settings.length,
    diffEvents: diffEvents.length,
  });
});
