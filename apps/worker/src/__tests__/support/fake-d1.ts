import { DatabaseSync } from 'node:sqlite';
import type { SQLInputValue } from 'node:sqlite';

type SQLQueryBindings = SQLInputValue;
type SqliteRow = Record<string, unknown>;

class FakeD1PreparedStatement {
  constructor(
    private readonly db: DatabaseSync,
    private readonly query: string,
    private readonly values: SQLQueryBindings[] = [],
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

  async first<T = SqliteRow>(): Promise<T | null> {
    const row = this.db.prepare(this.query).get(...this.values) as T | null;
    return row ?? null;
  }

  async run<T = SqliteRow>() {
    this.db.prepare(this.query).run(...this.values);
    return {
      success: true,
      meta: {} as D1Meta & Record<string, unknown>,
      results: [] as T[],
    } satisfies D1Result<T>;
  }

  async all<T = SqliteRow>() {
    const results = this.db.prepare(this.query).all(...this.values) as T[];
    return {
      success: true,
      meta: {} as D1Meta & Record<string, unknown>,
      results,
    } satisfies D1Result<T>;
  }

  async raw<T = unknown[]>(): Promise<T[]> {
    const resultInfo = this.db.prepare(this.query).all(...this.values);
    const rows = resultInfo.map((row) => Object.values(row));
    return rows as T[];
  }
}

export class FakeD1Database {
  private readonly db = new DatabaseSync(':memory:');

  constructor() {
    this.db.exec(`
      CREATE TABLE channels (
        id TEXT PRIMARY KEY,
        channel_type TEXT(3) NOT NULL,
        token TEXT NOT NULL UNIQUE,
        deactivated_at TEXT NOT NULL DEFAULT '9999-12-31',
        deactivated_reason TEXT NOT NULL DEFAULT 'none',
        fail_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_channels_deactivated_at ON channels(deactivated_at);

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

      CREATE TABLE notification_deliveries (
        version TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        delivered_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (version, channel_id),
        FOREIGN KEY (channel_id) REFERENCES channels(id)
      );

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

      CREATE TABLE changelog_versions (
        version TEXT PRIMARY KEY NOT NULL,
        summary TEXT
      );

      CREATE TABLE changelog_items (
        version TEXT NOT NULL,
        item_id TEXT NOT NULL,
        content TEXT NOT NULL,
        content_ja TEXT,
        prefix TEXT NOT NULL,
        inference_before TEXT,
        inference_after TEXT,
        inference_benefit TEXT,
        search_text TEXT NOT NULL,
        PRIMARY KEY (version, item_id)
      );

      CREATE TABLE changelog_item_feature_areas (
        version TEXT NOT NULL,
        item_id TEXT NOT NULL,
        feature_area TEXT NOT NULL,
        PRIMARY KEY (version, item_id, feature_area)
      );

      CREATE TABLE settings_reference (
        key TEXT PRIMARY KEY NOT NULL,
        slug TEXT NOT NULL,
        source TEXT NOT NULL,
        description_en TEXT NOT NULL,
        description_ja TEXT NOT NULL,
        use_case_ja TEXT,
        official_doc_urls TEXT
      );
    `);
  }

  prepare(query: string) {
    return new FakeD1PreparedStatement(this.db, query);
  }

  async batch(statements: FakeD1PreparedStatement[]) {
    return Promise.all(statements.map((statement) => statement.run()));
  }

  close() {
    this.db.close();
  }
}
