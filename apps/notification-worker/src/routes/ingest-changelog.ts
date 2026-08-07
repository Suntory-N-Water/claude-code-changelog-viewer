import {
  type IngestChangelogVersion,
  IngestChangelogPayloadSchema,
  type IngestSetting,
} from '@claude-code-changelog-viewer/types';
import { eq, sql } from 'drizzle-orm';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import { Hono } from 'hono';
import {
  changelogItemFeatureAreas,
  changelogItems,
  changelogVersions,
  settingsReference,
} from '../db/schema';
import { timingSafeEqual } from './dispatch';

// D1 の bound parameters 上限 100/query から逆算した 1 INSERT あたりの行数
const ITEMS_PER_INSERT = 11; // 9 カラム
const FEATURE_AREAS_PER_INSERT = 33; // 3 カラム
const SETTINGS_PER_INSERT = 14; // 7 カラム

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

// 全角半角・大文字小文字の揺れを吸収するため NFKC 正規化 + 小文字化する
function buildSearchText(texts: (string | null | undefined)[]): string {
  return texts
    .filter((text) => text != null)
    .join('\n')
    .normalize('NFKC')
    .toLowerCase();
}

// version 単位の delete → insert を 1 トランザクションで実行し冪等にする。
// 包まないと delete 成功・insert 失敗の間に items が空になる。
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
  const featureAreaRows = entry.items.flatMap((item) =>
    (item.feature_areas ?? []).map((featureArea) => ({
      version: entry.version,
      itemId: item.id,
      featureArea,
    })),
  );

  const statements = [
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
  ] as const;
  await db.batch([statements[0], ...statements.slice(1)]);
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
    officialDocUrls: setting.official_doc_urls
      ? JSON.stringify(setting.official_doc_urls)
      : null,
  }));

  const [first, ...rest] = chunk(rows, SETTINGS_PER_INSERT).map((chunkRows) =>
    db
      .insert(settingsReference)
      .values(chunkRows)
      .onConflictDoUpdate({
        target: settingsReference.key,
        set: {
          slug: sqlExcluded('slug'),
          source: sqlExcluded('source'),
          descriptionEn: sqlExcluded('description_en'),
          descriptionJa: sqlExcluded('description_ja'),
          useCaseJa: sqlExcluded('use_case_ja'),
          officialDocUrls: sqlExcluded('official_doc_urls'),
        },
      }),
  );
  if (first === undefined) {
    return;
  }
  await db.batch([first, ...rest]);
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
  const { versions, settings } = parseResult.data;

  const db = drizzle(c.env.DB);
  for (const entry of versions) {
    await ingestVersion(db, entry);
  }
  await ingestSettings(db, settings);

  return c.json({
    success: true,
    versions: versions.length,
    settings: settings.length,
  });
});
