import { getLogger, toError } from '@claude-code-changelog-viewer/common';
import {
  IngestChangelogPayloadSchema,
  type IngestSetting,
} from '@claude-code-changelog-viewer/types';
import { eq, sql } from 'drizzle-orm';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import { Hono } from 'hono';
import { settingsReference, settingsOfficialDocs } from '../db/schema';
import {
  ingestChangelogDiffEvents,
  ingestChangelogVersion,
} from '../infrastructure/drizzle/changelog-ingestion';
import {
  chunk,
  runBatchedStatements,
  toDocPath,
} from '../infrastructure/drizzle/d1-ingestion-utils';
import { timingSafeEqual } from './dispatch';

const SETTINGS_PER_INSERT = 12; // 8 カラム
const OFFICIAL_DOCS_PER_INSERT = 50; // 2 カラム

const logger = getLogger({
  name: 'routes.ingest-changelog',
  serviceName: 'changelog-viewer-worker',
  level: 'INFO',
  format: 'json',
});

function sqlExcluded(column: string) {
  return sql.raw(`excluded.${column}`);
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
    logger.warn('認証に失敗しました', { route: 'ingest-changelog' });
    return c.json({ error: '認証に失敗しました' }, 401);
  }

  const parseResult = IngestChangelogPayloadSchema.safeParse(
    await c.req.json(),
  );
  if (!parseResult.success) {
    logger.warn('リクエストの検証に失敗しました', {
      route: 'ingest-changelog',
      error: parseResult.error,
    });
    return c.json({ error: 'リクエストが不正です' }, 400);
  }
  const { versions, settings, diff_events: diffEvents } = parseResult.data;

  try {
    const db = drizzle(c.env.DB);
    for (const entry of versions) {
      await ingestChangelogVersion(db, entry);
    }
    await ingestChangelogDiffEvents(db, diffEvents);
    await ingestSettings(db, settings);
  } catch (error) {
    logger.error('CHANGELOG の保存に失敗しました', {
      route: 'ingest-changelog',
      error: toError(error),
    });
    throw error;
  }

  logger.info('CHANGELOG を保存しました', {
    route: 'ingest-changelog',
    versions: versions.length,
    settings: settings.length,
    diff_events: diffEvents.length,
  });

  return c.json({
    success: true,
    versions: versions.length,
    settings: settings.length,
    diffEvents: diffEvents.length,
  });
});
