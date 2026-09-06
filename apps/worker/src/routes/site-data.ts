import { workerLogger } from '../logger';
import { toError } from '@claude-code-changelog-viewer/common';
import { drizzle } from 'drizzle-orm/d1';
import { Hono } from 'hono';
import {
  listAllOfficialDocs,
  listChangelogItems,
  listChangelogVersions,
  listDiffEventItems,
  listDiffEvents,
  listFeatureAreas,
  listRelatedDocs,
  listSettingsReference,
} from '../infrastructure/drizzle/changelog-repository';
import { resolveSettingSlugs } from '../domain/settings-reference/setting-slug';
import { parseEnumDescriptions } from '../domain/settings-reference/enum-descriptions';
import { loadSettingSchemaDisplays } from '../infrastructure/docs-sync/setting-schema-reader';
import { rateLimit } from './rate-limit';

const logger = workerLogger('routes.site-data');

export const siteDataRoute = new Hono<{
  Bindings: CloudflareBindings;
}>();

siteDataRoute.use(
  '*',
  rateLimit(
    (env) => env.SITE_DATA_RATE_LIMITER,
    'site-data',
    'リクエストが多すぎます',
  ),
);

siteDataRoute.get('/changelog', async (c) => {
  const db = drizzle(c.env.DB);
  let versionRows: Awaited<ReturnType<typeof listChangelogVersions>>;
  let itemRows: Awaited<ReturnType<typeof listChangelogItems>>;
  let featureAreaRows: Awaited<ReturnType<typeof listFeatureAreas>>;
  let relatedDocRows: Awaited<ReturnType<typeof listRelatedDocs>>;
  try {
    [versionRows, itemRows, featureAreaRows, relatedDocRows] =
      await Promise.all([
        listChangelogVersions(db),
        listChangelogItems(db),
        listFeatureAreas(db),
        listRelatedDocs(db),
      ]);
  } catch (error) {
    logger.error('CHANGELOG データの取得に失敗しました', {
      route: 'site-data/changelog',
      error: toError(error),
    });
    throw error;
  }

  const featureAreasByVersion = new Map<string, Map<string, string[]>>();
  for (const row of featureAreaRows) {
    const areasByItem =
      featureAreasByVersion.get(row.version) ?? new Map<string, string[]>();
    const areas = areasByItem.get(row.itemId) ?? [];
    areas.push(row.featureArea);
    areasByItem.set(row.itemId, areas);
    featureAreasByVersion.set(row.version, areasByItem);
  }

  const relatedDocsByVersion = new Map<
    string,
    Map<string, { doc_path: string }[]>
  >();
  for (const row of relatedDocRows) {
    const docsByItem =
      relatedDocsByVersion.get(row.version) ??
      new Map<string, { doc_path: string }[]>();
    const docs = docsByItem.get(row.itemId) ?? [];
    docs.push({ doc_path: row.docPath });
    docsByItem.set(row.itemId, docs);
    relatedDocsByVersion.set(row.version, docsByItem);
  }

  const itemsByVersion = new Map<string, Record<string, unknown>[]>();
  for (const row of itemRows) {
    const item: Record<string, unknown> = {
      id: row.itemId,
      content: row.content,
      prefix: row.prefix,
      feature_areas:
        featureAreasByVersion.get(row.version)?.get(row.itemId) ?? [],
      related_docs:
        relatedDocsByVersion.get(row.version)?.get(row.itemId) ?? [],
    };
    if (row.contentJa !== null) {
      item['content_ja'] = row.contentJa;
    }
    if (
      row.inferenceBefore !== null &&
      row.inferenceAfter !== null &&
      row.inferenceBenefit !== null
    ) {
      item['inference'] = {
        before: row.inferenceBefore,
        after: row.inferenceAfter,
        benefit: row.inferenceBenefit,
      };
    }
    const items = itemsByVersion.get(row.version) ?? [];
    items.push(item);
    itemsByVersion.set(row.version, items);
  }

  const response = {
    versions: versionRows.map((row) => ({
      version: row.version,
      ...(row.summary === null ? {} : { summary: row.summary }),
      items: itemsByVersion.get(row.version) ?? [],
    })),
  };
  logger.info('CHANGELOG データを返しました', {
    route: 'site-data/changelog',
    versions: response.versions.length,
  });
  return c.json(response);
});

siteDataRoute.get('/settings', async (c) => {
  const db = drizzle(c.env.DB);
  let settingRows: Awaited<ReturnType<typeof listSettingsReference>>;
  let officialDocRows: Awaited<ReturnType<typeof listAllOfficialDocs>>;
  let schemaDisplays: Awaited<ReturnType<typeof loadSettingSchemaDisplays>>;
  try {
    [settingRows, officialDocRows, schemaDisplays] = await Promise.all([
      listSettingsReference(db),
      listAllOfficialDocs(db),
      loadSettingSchemaDisplays(c.env.DOCS_DB),
    ]);
  } catch (error) {
    logger.error('設定リファレンスの取得に失敗しました', {
      route: 'site-data/settings',
      error: toError(error),
    });
    throw error;
  }

  const officialDocsBySetting = new Map<string, { doc_path: string }[]>();
  for (const row of officialDocRows) {
    const docs = officialDocsBySetting.get(row.settingKey) ?? [];
    docs.push({ doc_path: row.docPath });
    officialDocsBySetting.set(row.settingKey, docs);
  }

  const slugs = resolveSettingSlugs(settingRows);

  const response = {
    settings: settingRows.map((row) => {
      const schema = schemaDisplays.get(row.key);
      const enumDescriptionsJa = parseEnumDescriptions(row.enumDescriptionsJa);
      return {
        key: row.key,
        ...(row.leafName === null ? {} : { leaf_name: row.leafName }),
        slug: slugs.get(row.key) ?? row.slug,
        source: row.source,
        description_en: row.descriptionEn,
        description_ja: row.descriptionJa,
        ...(row.useCaseJa === null ? {} : { use_case_ja: row.useCaseJa }),
        ...(schema?.valueType === undefined
          ? {}
          : { value_type: schema.valueType }),
        ...(schema?.defaultValue === undefined
          ? {}
          : { default_value: schema.defaultValue }),
        ...(schema?.enumValues === undefined
          ? {}
          : { enum_values: schema.enumValues }),
        ...(enumDescriptionsJa === undefined
          ? {}
          : { enum_descriptions_ja: enumDescriptionsJa }),
        ...(row.defaultNoteJa === null
          ? {}
          : { default_note_ja: row.defaultNoteJa }),
        ...(schema?.scope === undefined ? {} : { scope: schema.scope }),
        ...(schema?.example === undefined ? {} : { example: schema.example }),
        fetched_at: row.fetchedAt,
        official_docs: officialDocsBySetting.get(row.key) ?? [],
      };
    }),
  };
  logger.info('設定リファレンスを返しました', {
    route: 'site-data/settings',
    settings: response.settings.length,
  });
  return c.json(response);
});

siteDataRoute.get('/diff', async (c) => {
  const db = drizzle(c.env.DB);
  let eventRows: Awaited<ReturnType<typeof listDiffEvents>>;
  let itemRows: Awaited<ReturnType<typeof listDiffEventItems>>;
  try {
    [eventRows, itemRows] = await Promise.all([
      listDiffEvents(db),
      listDiffEventItems(db),
    ]);
  } catch (error) {
    logger.error('CHANGELOG 差分の取得に失敗しました', {
      route: 'site-data/diff',
      error: toError(error),
    });
    throw error;
  }

  const itemsByEvent = new Map<
    string,
    { added: string[]; removed: string[] }
  >();
  for (const row of itemRows) {
    const eventKey = `${row.version}\u0000${row.detectedAt}`;
    const items = itemsByEvent.get(eventKey) ?? { added: [], removed: [] };
    items[row.direction].push(row.content);
    itemsByEvent.set(eventKey, items);
  }

  const response = {
    events: eventRows.map((row) => {
      const items = itemsByEvent.get(
        `${row.version}\u0000${row.detectedAt}`,
      ) ?? {
        added: [],
        removed: [],
      };
      return {
        detected_at: row.detectedAt,
        version: row.version,
        type: row.type,
        items_added: items.added,
        items_removed: items.removed,
      };
    }),
  };
  logger.info('CHANGELOG 差分を返しました', {
    route: 'site-data/diff',
    events: response.events.length,
  });
  return c.json(response);
});
