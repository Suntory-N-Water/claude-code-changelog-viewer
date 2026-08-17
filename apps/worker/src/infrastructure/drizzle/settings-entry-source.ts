import { buildChangelogSearchTerms } from '@claude-code-changelog-viewer/common';
import { or, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { changelogItems, settingsReference } from '../../db/schema';
import type {
  RelatedSettingChangelog,
  SettingsReferenceEntry,
  SettingsReferenceEntrySourcePort,
} from '../../usecases/settings-reference';

type SettingSchemaRow = {
  key: string;
  source: string;
  description: string;
  parent_descriptions: string;
  default_value: string | null;
  enum_values: string | null;
};

/** docs-search 用 D1 と正データ用 D1 の読み取りを設定リファレンス用 port に接続する。 */
export function createSettingsEntrySource(
  db: DrizzleD1Database,
  docsDb: D1Database,
): SettingsReferenceEntrySourcePort {
  return {
    async loadEntries(): Promise<readonly SettingsReferenceEntry[]> {
      const result = await docsDb
        .prepare(
          `SELECT key, source, description, parent_descriptions, default_value, enum_values
           FROM setting_schema_entries
           ORDER BY key`,
        )
        .all<SettingSchemaRow>();

      return result.results.map((row) => ({
        key: row.key,
        source: row.source === 'env' ? 'env' : 'settings',
        descriptionEn: row.description,
        parentDescriptions: parseStringArray(row.parent_descriptions),
        ...(row.default_value === null
          ? {}
          : { schemaDefault: row.default_value }),
        ...(row.enum_values === null
          ? {}
          : { schemaEnum: parseStringArray(row.enum_values) }),
      }));
    },

    async loadExistingKeys(): Promise<ReadonlySet<string>> {
      const rows = await db
        .select({ key: settingsReference.key })
        .from(settingsReference);
      return new Set(rows.map((row) => row.key));
    },

    async findRelatedChangelogs(
      key: string,
    ): Promise<readonly RelatedSettingChangelog[]> {
      const conditions = buildChangelogSearchTerms(key).flatMap((term) => [
        sql`instr(${changelogItems.content}, ${term}) > 0`,
        sql`instr(coalesce(${changelogItems.contentJa}, ''), ${term}) > 0`,
      ]);
      const rows = await db
        .select({
          version: changelogItems.version,
          contentJa: changelogItems.contentJa,
          inferenceBefore: changelogItems.inferenceBefore,
          inferenceAfter: changelogItems.inferenceAfter,
          inferenceBenefit: changelogItems.inferenceBenefit,
        })
        .from(changelogItems)
        .where(or(...conditions));

      rows.sort((a, b) => {
        const partsA = a.version.split('.').map(Number);
        const partsB = b.version.split('.').map(Number);
        for (
          let index = 0;
          index < Math.max(partsA.length, partsB.length);
          index += 1
        ) {
          const difference = (partsB[index] ?? 0) - (partsA[index] ?? 0);
          if (difference !== 0) {
            return difference;
          }
        }
        return 0;
      });

      return rows.map((row) => ({
        version: row.version,
        ...(row.contentJa === null ? {} : { contentJa: row.contentJa }),
        ...(row.inferenceBefore === null ||
        row.inferenceAfter === null ||
        row.inferenceBenefit === null
          ? {}
          : {
              inference: {
                before: row.inferenceBefore,
                after: row.inferenceAfter,
                benefit: row.inferenceBenefit,
              },
            }),
      }));
    },
  };
}

function parseStringArray(value: string): string[] {
  const parsed: unknown = JSON.parse(value);
  return Array.isArray(parsed) ? parsed.map(String) : [];
}
