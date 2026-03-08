import { Database, type SQLQueryBindings } from 'bun:sqlite';

type SqliteRow = Record<string, unknown>;

class FakeD1PreparedStatement {
  constructor(
    private readonly db: Database,
    private readonly query: string,
    private readonly values: SQLQueryBindings[] = [],
  ) {}

  bind(...values: SQLQueryBindings[]) {
    return new FakeD1PreparedStatement(this.db, this.query, values);
  }

  async first<T = SqliteRow>(): Promise<T | null> {
    const row = this.db.query(this.query).get(...this.values) as T | null;
    return row ?? null;
  }

  async run<T = SqliteRow>() {
    this.db.query(this.query).run(...this.values);
    return {
      success: true,
      meta: {} as D1Meta & Record<string, unknown>,
      results: [] as T[],
    } satisfies D1Result<T>;
  }

  async all<T = SqliteRow>() {
    const results = this.db.query(this.query).all(...this.values) as T[];
    return {
      success: true,
      meta: {} as D1Meta & Record<string, unknown>,
      results,
    } satisfies D1Result<T>;
  }
}

export class FakeD1Database {
  private readonly db = new Database(':memory:');

  constructor() {
    this.db.exec(`
      CREATE TABLE webhooks (
        id TEXT PRIMARY KEY,
        webhook_url TEXT NOT NULL UNIQUE,
        token TEXT NOT NULL UNIQUE,
        active INTEGER NOT NULL DEFAULT 1,
        fail_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_webhooks_active ON webhooks(active);
      CREATE INDEX idx_webhooks_token ON webhooks(token);
    `);
  }

  prepare(query: string) {
    return new FakeD1PreparedStatement(this.db, query);
  }

  close() {
    this.db.close();
  }
}
