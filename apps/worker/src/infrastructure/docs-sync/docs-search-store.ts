import type { DocsSearchStore, ExistingPage } from '../../usecases/sync-docs';
import { chunkMarkdown, type PageChunk } from './content';

const CHUNKS_PER_INSERT = 25;
const SETTINGS_PER_INSERT = 14;
const MAX_BATCH_STATEMENTS = 100;

type PageChunkRow = PageChunk & {
  chunkIndex: number;
};

type SettingSchemaMetaRow = {
  content_hash: string;
};

/** D1 の docs-search schema を DocsSearchStore port として実装する。 */
export function createDocsSearchStore(db: D1Database): DocsSearchStore {
  return {
    async loadExistingPages(): Promise<ExistingPage[]> {
      const result = await db
        .prepare('SELECT path, content_hash FROM pages')
        .all<{ path: string; content_hash: string }>();
      return result.results.map((page) => ({
        path: page.path,
        contentHash: page.content_hash,
      }));
    },

    async writeChangedPages(pages, now): Promise<void> {
      const updatedAt = now.toISOString();
      const statementGroups = pages.map((page) => {
        const chunks = chunkMarkdown(page.content).map(
          (chunk, chunkIndex): PageChunkRow => ({ ...chunk, chunkIndex }),
        );
        const statements: D1PreparedStatement[] = [
          db
            .prepare(
              `INSERT INTO pages
                 (path, title, source_url, content, content_hash, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)
               ON CONFLICT(path) DO UPDATE SET
                 title = excluded.title,
                 source_url = excluded.source_url,
                 content = excluded.content,
                 content_hash = excluded.content_hash,
                 updated_at = excluded.updated_at`,
            )
            .bind(
              page.path,
              page.title,
              page.url,
              page.content,
              page.contentHash,
              updatedAt,
            ),
          db
            .prepare('DELETE FROM page_chunks_fts WHERE path = ?')
            .bind(page.path),
        ];

        for (const chunkRows of splitIntoChunks(chunks, CHUNKS_PER_INSERT)) {
          const placeholders = chunkRows.map(() => '(?, ?, ?, ?)').join(', ');
          const values = chunkRows.flatMap((chunk) => [
            chunk.text,
            page.path,
            chunk.heading,
            chunk.chunkIndex,
          ]);
          statements.push(
            db
              .prepare(
                `INSERT INTO page_chunks_fts
                   (content, path, heading, chunk_index)
                 VALUES ${placeholders}`,
              )
              .bind(...values),
          );
        }

        return statements;
      });

      await runBatchedStatements(db, statementGroups);
    },

    async deletePages(paths): Promise<void> {
      await runBatchedStatements(
        db,
        paths.map((path) => [
          db.prepare('DELETE FROM page_chunks_fts WHERE path = ?').bind(path),
          db.prepare('DELETE FROM pages WHERE path = ?').bind(path),
        ]),
      );
    },

    async loadSettingSchemaHash(): Promise<string | null> {
      const previous = await db
        .prepare('SELECT content_hash FROM setting_schema_meta WHERE id = 1')
        .first<SettingSchemaMetaRow>();
      return previous?.content_hash ?? null;
    },

    async replaceSettingSchema(schema, now): Promise<void> {
      const statements: D1PreparedStatement[] = [
        db.prepare('DELETE FROM setting_schema_entries'),
      ];
      for (const rows of splitIntoChunks(schema.entries, SETTINGS_PER_INSERT)) {
        const placeholders = rows.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
        const values = rows.flatMap((entry) => [
          entry.key,
          entry.source,
          entry.description,
          entry.parentDescriptions,
          entry.valueType,
          entry.defaultValue,
          entry.enumValues,
        ]);
        statements.push(
          db
            .prepare(
              `INSERT INTO setting_schema_entries
                 (key, source, description, parent_descriptions, value_type, default_value, enum_values)
               VALUES ${placeholders}`,
            )
            .bind(...values),
        );
      }
      statements.push(
        db
          .prepare(
            `INSERT INTO setting_schema_meta (id, content_hash, updated_at)
             VALUES (1, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               content_hash = excluded.content_hash,
               updated_at = excluded.updated_at`,
          )
          .bind(schema.contentHash, now.toISOString()),
      );

      await db.batch(statements);
    },
  };
}

async function runBatchedStatements(
  db: D1Database,
  statementGroups: D1PreparedStatement[][],
): Promise<void> {
  let currentBatch: D1PreparedStatement[] = [];

  for (const group of statementGroups) {
    if (
      currentBatch.length > 0 &&
      currentBatch.length + group.length > MAX_BATCH_STATEMENTS
    ) {
      await db.batch(currentBatch);
      currentBatch = [];
    }
    currentBatch.push(...group);
  }

  if (currentBatch.length > 0) {
    await db.batch(currentBatch);
  }
}

function splitIntoChunks<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
