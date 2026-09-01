import { eq, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { settingsOfficialDocs, settingsReference } from '../../db/schema';
import type {
  SettingsReferenceRecord,
  SettingsReferenceRepositoryPort,
} from '../../usecases/settings-reference';
import { chunk, runBatchedStatements, toDocPath } from './d1-ingestion-utils';

// D1 の bound parameters 上限 100 を、1 行 10 列で割った件数
const SETTINGS_PER_INSERT = 10;
const OFFICIAL_DOCS_PER_INSERT = 50;

function sqlExcluded(column: string) {
  return sql.raw(`excluded.${column}`);
}

/** settings_reference と settings_official_docs への保存を D1 に接続する。 */
export function createSettingsReferenceRepository(
  db: DrizzleD1Database,
): SettingsReferenceRepositoryPort {
  return {
    async save({ records }: { records: SettingsReferenceRecord[] }) {
      if (records.length === 0) {
        return;
      }

      const officialDocRows = records.flatMap((record) =>
        [...new Set(record.officialDocs.map(toDocPath))].map((docPath) => ({
          settingKey: record.key,
          docPath,
        })),
      );
      const statements = [
        ...records.map((record) =>
          db
            .delete(settingsOfficialDocs)
            .where(eq(settingsOfficialDocs.settingKey, record.key)),
        ),
        ...chunk([...records], SETTINGS_PER_INSERT).map((rows) =>
          db
            .insert(settingsReference)
            .values(
              rows.map((record) => ({
                key: record.key,
                leafName: record.leafName,
                slug: record.slug,
                source: record.source,
                descriptionEn: record.descriptionEn,
                descriptionJa: record.descriptionJa,
                useCaseJa: record.useCaseJa,
                enumDescriptionsJa: record.enumDescriptionsJa,
                defaultNoteJa: record.defaultNoteJa,
                fetchedAt: record.fetchedAt,
              })),
            )
            .onConflictDoUpdate({
              target: settingsReference.key,
              set: {
                leafName: sqlExcluded('leaf_name'),
                slug: sqlExcluded('slug'),
                source: sqlExcluded('source'),
                descriptionEn: sqlExcluded('description_en'),
                descriptionJa: sqlExcluded('description_ja'),
                useCaseJa: sqlExcluded('use_case_ja'),
                enumDescriptionsJa: sqlExcluded('enum_descriptions_ja'),
                defaultNoteJa: sqlExcluded('default_note_ja'),
                fetchedAt: sqlExcluded('fetched_at'),
              },
            }),
        ),
        ...chunk(officialDocRows, OFFICIAL_DOCS_PER_INSERT).map((rows) =>
          db.insert(settingsOfficialDocs).values(rows).onConflictDoNothing(),
        ),
      ];

      await runBatchedStatements(db, statements);
    },
  };
}
