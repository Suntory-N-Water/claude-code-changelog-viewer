import { toError } from '@claude-code-changelog-viewer/common';
import { IngestChangelogPayloadSchema } from '@claude-code-changelog-viewer/types';
import { sValidator } from '@hono/standard-validator';
import { drizzle } from 'drizzle-orm/d1';
import { Hono } from 'hono';
import { bearerAuth } from 'hono/bearer-auth';
import { workerLogger } from '../logger';
import {
  ingestChangelogDiffEvents,
  ingestChangelogVersion,
} from '../infrastructure/drizzle/changelog-ingestion';
import { createSettingsReferenceRepository } from '../infrastructure/drizzle/settings-reference-repository';

const logger = workerLogger('routes.ingest-changelog');

export const ingestChangelogRoute = new Hono<{
  Bindings: CloudflareBindings;
}>().post(
  '/',
  // token 指定の bearerAuth は内部で定数時間比較を行う。env は起動時に決まらないため毎回組み立てる
  (c, next) =>
    bearerAuth<{ Bindings: CloudflareBindings }>({
      token: c.env.DISPATCH_SECRET,
    })(c, next),
  sValidator('json', IngestChangelogPayloadSchema, (result, c) => {
    if (!result.success) {
      logger.warn('リクエストの検証に失敗しました', {
        route: 'ingest-changelog',
        error: result.error,
      });
      return c.json({ error: 'リクエストが不正です' }, 400);
    }
    return;
  }),
  async (c) => {
    const { versions, settings, diff_events: diffEvents } = c.req.valid('json');

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
          enumDescriptionsJa: setting.enum_descriptions_ja ?? null,
          defaultNoteJa: setting.default_note_ja ?? null,
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
  },
);
