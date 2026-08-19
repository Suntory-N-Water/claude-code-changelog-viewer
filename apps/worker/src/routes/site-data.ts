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

export const siteDataRoute = new Hono<{
  Bindings: CloudflareBindings;
}>();

siteDataRoute.use('*', async (c, next) => {
  const clientKey = c.req.header('CF-Connecting-IP') ?? 'unknown-client';
  const rateLimit = await c.env.SITE_DATA_RATE_LIMITER.limit({
    key: `site-data:${clientKey}`,
  });
  if (!rateLimit.success) {
    c.header('Retry-After', '60');
    return c.json({ error: 'リクエストが多すぎます' }, 429);
  }
  return next();
});

siteDataRoute.get('/changelog', async (c) => {
  const db = drizzle(c.env.DB);
  const [versionRows, itemRows, featureAreaRows, relatedDocRows] =
    await Promise.all([
      listChangelogVersions(db),
      listChangelogItems(db),
      listFeatureAreas(db),
      listRelatedDocs(db),
    ]);

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

  return c.json({
    versions: versionRows.map((row) => ({
      version: row.version,
      ...(row.summary === null ? {} : { summary: row.summary }),
      items: itemsByVersion.get(row.version) ?? [],
    })),
  });
});

siteDataRoute.get('/settings', async (c) => {
  const db = drizzle(c.env.DB);
  const [settingRows, officialDocRows] = await Promise.all([
    listSettingsReference(db),
    listAllOfficialDocs(db),
  ]);

  const officialDocsBySetting = new Map<string, { doc_path: string }[]>();
  for (const row of officialDocRows) {
    const docs = officialDocsBySetting.get(row.settingKey) ?? [];
    docs.push({ doc_path: row.docPath });
    officialDocsBySetting.set(row.settingKey, docs);
  }

  return c.json({
    settings: settingRows.map((row) => ({
      key: row.key,
      ...(row.leafName === null ? {} : { leaf_name: row.leafName }),
      slug: row.slug,
      source: row.source,
      description_en: row.descriptionEn,
      description_ja: row.descriptionJa,
      ...(row.useCaseJa === null ? {} : { use_case_ja: row.useCaseJa }),
      fetched_at: row.fetchedAt,
      official_docs: officialDocsBySetting.get(row.key) ?? [],
    })),
  });
});

siteDataRoute.get('/diff', async (c) => {
  const db = drizzle(c.env.DB);
  const [eventRows, itemRows] = await Promise.all([
    listDiffEvents(db),
    listDiffEventItems(db),
  ]);

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

  return c.json({
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
  });
});
