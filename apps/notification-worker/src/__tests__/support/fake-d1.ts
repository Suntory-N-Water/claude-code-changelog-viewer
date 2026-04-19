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

  // D1 の .raw() に相当: カラム名なしの配列形式で返す(Drizzle ORM が内部で使用)
  async raw<T = unknown[]>(): Promise<T[]> {
    const rows = this.db.query(this.query).values(...this.values);
    return rows as T[];
  }
}

export class FakeD1Database {
  private readonly db = new Database(':memory:');

  constructor() {
    this.db.exec(`
      CREATE TABLE channels (
        id TEXT PRIMARY KEY,
        channel_type TEXT(3) NOT NULL,
        token TEXT NOT NULL UNIQUE,
        is_active INTEGER NOT NULL DEFAULT 1,
        fail_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_channels_is_active ON channels(is_active);

      CREATE TABLE discord_channels (
        channel_id TEXT PRIMARY KEY,
        webhook_url TEXT NOT NULL UNIQUE,
        FOREIGN KEY (channel_id) REFERENCES channels(id)
      );

      CREATE TABLE notification_settings (
        id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        frequency TEXT(3) NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (channel_id) REFERENCES channels(id)
      );
      CREATE INDEX idx_notification_settings_channel_id ON notification_settings(channel_id);

      CREATE TABLE slack_channels (
        channel_id TEXT PRIMARY KEY,
        webhook_url TEXT NOT NULL UNIQUE,
        FOREIGN KEY (channel_id) REFERENCES channels(id)
      );

      CREATE TABLE email_channels (
        channel_id TEXT PRIMARY KEY,
        email_hash TEXT NOT NULL UNIQUE,
        email_encrypted TEXT NOT NULL,
        FOREIGN KEY (channel_id) REFERENCES channels(id)
      );
    `);
  }

  prepare(query: string) {
    return new FakeD1PreparedStatement(this.db, query);
  }

  close() {
    this.db.close();
  }
}
