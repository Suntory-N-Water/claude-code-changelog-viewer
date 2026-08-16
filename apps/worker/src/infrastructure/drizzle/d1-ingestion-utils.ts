import type { BatchItem } from 'drizzle-orm/batch';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

export const MAX_BATCH_STATEMENTS = 100;

export function chunk<T>(rows: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    result.push(rows.slice(i, i + size));
  }
  return result;
}

export async function runBatchedStatements(
  db: DrizzleD1Database,
  statements: BatchItem<'sqlite'>[],
): Promise<void> {
  for (const batchStatements of chunk(statements, MAX_BATCH_STATEMENTS)) {
    const [first, ...rest] = batchStatements;
    if (first !== undefined) {
      await db.batch([first, ...rest]);
    }
  }
}

export function toDocPath(value: string): string {
  // docs 検索用 D1 の pages 主キーに合わせて docs/en/ 以下の .md パスに揃える
  const normalized = value.replaceAll('\\', '/').split(/[?#]/)[0] ?? value;
  const marker = 'docs/en/';
  const markerIndex = normalized.indexOf(marker);
  const path =
    markerIndex === -1
      ? normalized
      : normalized.slice(markerIndex + marker.length);
  const withoutTrailingSlash = path.replace(/\/+$/, '');
  return withoutTrailingSlash.endsWith('.md')
    ? withoutTrailingSlash
    : `${withoutTrailingSlash}.md`;
}
