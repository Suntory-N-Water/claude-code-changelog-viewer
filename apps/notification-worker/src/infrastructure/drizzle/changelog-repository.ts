import { and, eq, sql, type SQL } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import {
  changelogItemFeatureAreas,
  changelogItems,
  changelogVersions,
  settingsReference,
} from '../../db/schema';

// feature area は正規化テーブルに分かれているため、item と同時に group_concat で引く
const featureAreasColumn = sql<string | null>`(
  select group_concat(${changelogItemFeatureAreas.featureArea})
  from ${changelogItemFeatureAreas}
  where ${changelogItemFeatureAreas.version} = ${changelogItems.version}
    and ${changelogItemFeatureAreas.itemId} = ${changelogItems.itemId}
)`;

export type ChangelogSearchParams = {
  query: string;
  featureArea?: string | undefined;
  prefix?: string | undefined;
  limit: number;
};

export async function searchChangelogItems(
  db: DrizzleD1Database,
  params: ChangelogSearchParams,
) {
  // search_text は取り込み時に NFKC 正規化 + 小文字化済みのため、クエリ側も揃える。
  // D1 は LIKE パターン長が 50 バイトのため instr() で検索する
  const normalizedQuery = params.query.normalize('NFKC').toLowerCase();
  const conditions: SQL[] = [
    sql`instr(${changelogItems.searchText}, ${normalizedQuery}) > 0`,
  ];
  if (params.prefix !== undefined) {
    conditions.push(
      sql`lower(${changelogItems.prefix}) = ${params.prefix.toLowerCase()}`,
    );
  }
  if (params.featureArea !== undefined) {
    conditions.push(
      sql`exists (
        select 1 from ${changelogItemFeatureAreas}
        where ${changelogItemFeatureAreas.version} = ${changelogItems.version}
          and ${changelogItemFeatureAreas.itemId} = ${changelogItems.itemId}
          and lower(${changelogItemFeatureAreas.featureArea}) = ${params.featureArea.toLowerCase()}
      )`,
    );
  }

  // バージョン降順は SQL で表現できない(semver のテキスト比較が壊れる)ため、
  // 全該当行を取得して JS 側でソートする。items は 4386 行で全件でも性能内
  const rows = await db
    .select({
      version: changelogItems.version,
      prefix: changelogItems.prefix,
      content: changelogItems.content,
      contentJa: changelogItems.contentJa,
      benefit: changelogItems.inferenceBenefit,
      featureAreas: featureAreasColumn,
    })
    .from(changelogItems)
    .where(and(...conditions));

  // バージョン降順。semver をテキスト比較すると 2.1.9 > 2.1.10 になるため数値部ごとに比較する
  rows.sort((a, b) => {
    const partsA = a.version.split('.').map(Number);
    const partsB = b.version.split('.').map(Number);
    for (let i = 0; i < Math.max(partsA.length, partsB.length); i += 1) {
      const diff = (partsB[i] ?? 0) - (partsA[i] ?? 0);
      if (diff !== 0) {
        return diff;
      }
    }
    return 0;
  });
  return rows.slice(0, params.limit).map((row) => ({
    ...row,
    featureAreas: row.featureAreas === null ? [] : row.featureAreas.split(','),
  }));
}

export async function findChangelogVersion(
  db: DrizzleD1Database,
  version: string,
) {
  const versionRow = await db
    .select()
    .from(changelogVersions)
    .where(eq(changelogVersions.version, version))
    .get();
  if (versionRow === undefined) {
    return null;
  }
  const items = await db
    .select({
      prefix: changelogItems.prefix,
      content: changelogItems.content,
      contentJa: changelogItems.contentJa,
      benefit: changelogItems.inferenceBenefit,
      featureAreas: featureAreasColumn,
    })
    .from(changelogItems)
    .where(eq(changelogItems.version, version))
    .orderBy(sql`rowid`);
  return {
    version: versionRow.version,
    summary: versionRow.summary,
    items: items.map((row) => ({
      ...row,
      featureAreas:
        row.featureAreas === null ? [] : row.featureAreas.split(','),
    })),
  };
}

export async function findSettingByKey(db: DrizzleD1Database, key: string) {
  const row = await db
    .select()
    .from(settingsReference)
    .where(eq(settingsReference.key, key))
    .get();
  return row ?? null;
}

export async function searchSettings(
  db: DrizzleD1Database,
  query: string,
  limit: number,
) {
  // settings_reference には search_text がないため、対象カラムを連結して instr で引く。
  // SQLite の lower() は ASCII のみ対象だが、日本語は大文字小文字の揺れがないため足りる
  const normalizedQuery = query.normalize('NFKC').toLowerCase();
  return db
    .select()
    .from(settingsReference)
    .where(
      sql`instr(
        lower(${settingsReference.key} || ' ' || ${settingsReference.descriptionEn} || ' ' || ${settingsReference.descriptionJa} || ' ' || coalesce(${settingsReference.useCaseJa}, '')),
        ${normalizedQuery}
      ) > 0`,
    )
    .orderBy(settingsReference.key)
    .limit(limit);
}

export async function listSettingKeys(db: DrizzleD1Database) {
  return db
    .select({ key: settingsReference.key, source: settingsReference.source })
    .from(settingsReference)
    .orderBy(settingsReference.source, settingsReference.key);
}
