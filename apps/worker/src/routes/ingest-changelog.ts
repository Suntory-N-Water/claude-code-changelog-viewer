import { getLogger, toError } from '@claude-code-changelog-viewer/common';
import { IngestChangelogPayloadSchema } from '@claude-code-changelog-viewer/types';
import { drizzle } from 'drizzle-orm/d1';
import { Hono } from 'hono';
import {
  ingestChangelogDiffEvents,
  ingestChangelogVersion,
} from '../infrastructure/drizzle/changelog-ingestion';
import { timingSafeEqual } from '../infrastructure/crypto/timing-safe-equal';
import { createSettingsReferenceRepository } from '../infrastructure/drizzle/settings-reference-repository';

const logger = getLogger({
  name: 'routes.ingest-changelog',
  serviceName: 'changelog-viewer-worker',
  level: 'INFO',
  format: 'json',
});

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
    await createSettingsReferenceRepository(db).save({
      records: settings.map((setting) => ({
        key: setting.key,
        leafName: setting.leaf_name ?? null,
        slug: setting.slug,
        source: setting.source,
        descriptionEn: setting.description_en,
        descriptionJa: setting.description_ja,
        useCaseJa: setting.use_case_ja ?? null,
        fetchedAt: setting.fetched_at,
        officialDocs: setting.official_doc_urls ?? [],
      })),
    });
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
