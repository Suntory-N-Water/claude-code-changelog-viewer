import {
  IngestChangelogPayloadSchema,
  type IngestSetting,
} from '@claude-code-changelog-viewer/types';
import type { BatchItem } from 'drizzle-orm/batch';
import { eq, sql } from 'drizzle-orm';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import { Hono } from 'hono';
import { settingsReference, settingsOfficialDocs } from '../db/schema';
import {
  ingestChangelogDiffEvents,
  ingestChangelogVersion,
} from '../infrastructure/drizzle/changelog-ingestion';
import { timingSafeEqual } from './dispatch';

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
    await ingestChangelogVersion(db, entry);
  }
  await ingestChangelogDiffEvents(db, diffEvents);
  await ingestSettings(db, settings);

  return c.json({
    success: true,
    versions: versions.length,
    settings: settings.length,
    diffEvents: diffEvents.length,
  });
});
