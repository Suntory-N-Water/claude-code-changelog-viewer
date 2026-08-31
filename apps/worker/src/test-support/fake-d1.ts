import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
// biome-ignore lint/correctness/noUnresolvedImports: Node.js 24 の組み込みモジュール
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

type SQLQueryBindings = SQLInputValue;
type SqliteRow = Record<string, unknown>;

const NOTIFICATION_MIGRATIONS_DIRECTORY = fileURLToPath(
  new URL('../../drizzle/migrations', import.meta.url),
);
const DOCS_SEARCH_MIGRATIONS_DIRECTORY = fileURLToPath(
  new URL('../../docs-search/migrations', import.meta.url),
);

// スキーマを手書きすると本番との差分に気付けないため、本番と同じマイグレーションを流す
function applyMigrations(db: DatabaseSync, directory: string) {
  const files = readdirSync(directory)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    db.exec(readFileSync(join(directory, file), 'utf8'));
  }
}

class FakeD1PreparedStatement implements D1PreparedStatement {
  constructor(
    private db: DatabaseSync,
    private query: string,
    private values: SQLQueryBindings[] = [],
  ) {}

  bind(...values: SQLQueryBindings[]) {
    // 実 D1 の制約 (bound parameters 100/query) を再現し、分割漏れを検出する
    if (values.length > 100) {
      throw new Error(
        `D1 の bound parameters 上限 100 を超過: ${values.length}`,
      );
    }
    return new FakeD1PreparedStatement(this.db, this.query, values);
  }

  first<T = unknown>(columnName: string): Promise<T | null>;
  first<T = SqliteRow>(): Promise<T | null>;
  async first<T = SqliteRow>(_columnName?: string): Promise<T | null> {
    const row = this.db.prepare(this.query).get(...this.values) as T | null;
    return row ?? null;
  }

  async run<T = SqliteRow>(): Promise<D1Result<T>> {
    this.db.prepare(this.query).run(...this.values);
    return {
      success: true,
      meta: {} as D1Meta & Record<string, unknown>,
      results: [] as T[],
    } satisfies D1Result<T>;
  }

  async all<T = SqliteRow>(): Promise<D1Result<T>> {
    const results = this.db.prepare(this.query).all(...this.values) as T[];
    return {
      success: true,
      meta: {} as D1Meta & Record<string, unknown>,
      results,
    } satisfies D1Result<T>;
  }

  raw<T = unknown[]>(options: {
    columnNames: true;
  }): Promise<[string[], ...T[]]>;
  raw<T = unknown[]>(options?: { columnNames?: false }): Promise<T[]>;
  async raw<T = unknown[]>(options?: {
    columnNames?: boolean;
  }): Promise<T[] | [string[], ...T[]]> {
    const resultInfo = this.db.prepare(this.query).all(...this.values);
    const rows = resultInfo.map((row) => Object.values(row)) as T[];
    return options?.columnNames === true
      ? [Object.keys(resultInfo[0] ?? {}), ...rows]
      : rows;
  }
}

export class FakeD1Database {
  private db = new DatabaseSync(':memory:');

  constructor() {
    applyMigrations(this.db, NOTIFICATION_MIGRATIONS_DIRECTORY);
  }

  prepare(query: string) {
    return new FakeD1PreparedStatement(this.db, query);
  }

  async batch(statements: FakeD1PreparedStatement[]) {
    if (statements.length > 100) {
      throw new Error(`D1 の batch 上限 100 を超過: ${statements.length}`);
    }
    this.db.exec('BEGIN');
    try {
      const results: D1Result[] = [];
      for (const statement of statements) {
        results.push(await statement.run());
      }
      this.db.exec('COMMIT');
      return results;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  close() {
    this.db.close();
  }
}

export class FakeDocsD1Database implements D1Database {
  private db = new DatabaseSync(':memory:');

  constructor() {
    applyMigrations(this.db, DOCS_SEARCH_MIGRATIONS_DIRECTORY);
  }

  prepare(query: string) {
    return new FakeD1PreparedStatement(this.db, query);
  }

  async batch<T = unknown>(
    statements: D1PreparedStatement[],
  ): Promise<D1Result<T>[]> {
    return Promise.all(statements.map((statement) => statement.run<T>()));
  }

  // D1Database を要求する関数にそのまま渡せるようにするための穴埋め。
  // 呼ばれた時点でテスト側の想定違いなので落とす
  async exec(_query: string): Promise<D1ExecResult> {
    throw new Error('FakeDocsD1Database.exec は未実装');
  }

  withSession(): D1DatabaseSession {
    throw new Error('FakeDocsD1Database.withSession は未実装');
  }

  async dump(): Promise<ArrayBuffer> {
    throw new Error('FakeDocsD1Database.dump は未実装');
  }

  close() {
    this.db.close();
  }
}
