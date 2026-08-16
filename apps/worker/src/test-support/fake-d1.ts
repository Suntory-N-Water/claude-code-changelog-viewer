// biome-ignore lint/correctness/noUnresolvedImports: Node.js 24 の組み込みモジュール
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

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

      CREATE TABLE changelog_item_related_docs (
        version TEXT NOT NULL,
        item_id TEXT NOT NULL,
        doc_path TEXT NOT NULL,
        PRIMARY KEY (version, item_id, doc_path)
      );

      CREATE TABLE changelog_diff_events (
        version TEXT NOT NULL,
        detected_at TEXT NOT NULL,
        type TEXT NOT NULL,
        PRIMARY KEY (version, detected_at)
      );

      CREATE TABLE changelog_diff_event_items (
        version TEXT NOT NULL,
        detected_at TEXT NOT NULL,
        direction TEXT NOT NULL,
        seq INTEGER NOT NULL,
        content TEXT NOT NULL,
        PRIMARY KEY (version, detected_at, direction, seq)
      );

      CREATE TABLE settings_reference (
        key TEXT PRIMARY KEY NOT NULL,
        leaf_name TEXT,
        slug TEXT NOT NULL,
        source TEXT NOT NULL,
        description_en TEXT NOT NULL,
        description_ja TEXT NOT NULL,
        use_case_ja TEXT,
        fetched_at TEXT NOT NULL
      );

      CREATE TABLE settings_official_docs (
        setting_key TEXT NOT NULL,
        doc_path TEXT NOT NULL,
        PRIMARY KEY (setting_key, doc_path)
      );
    `);
  }

  prepare(query: string) {
    return new FakeD1PreparedStatement(this.db, query);
  }

  async batch(statements: FakeD1PreparedStatement[]) {
    if (statements.length > 100) {
      throw new Error(`D1 の batch 上限 100 を超過: ${statements.length}`);
    }
    return Promise.all(statements.map((statement) => statement.run()));
  }

  close() {
    this.db.close();
  }
}

export class FakeDocsD1Database {
  private readonly db = new DatabaseSync(':memory:');

  constructor() {
    this.db.exec(`
      CREATE TABLE pages (
        path TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        source_url TEXT NOT NULL,
        content TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE VIRTUAL TABLE page_chunks_fts USING fts5(
        content,
        path UNINDEXED,
        heading UNINDEXED,
        chunk_index UNINDEXED,
        tokenize = 'porter unicode61'
      );

      CREATE TABLE setting_schema_entries (
        key TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        description TEXT NOT NULL,
        parent_descriptions TEXT NOT NULL,
        value_type TEXT NOT NULL,
        default_value TEXT,
        enum_values TEXT
      );

      CREATE TABLE setting_schema_meta (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        content_hash TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  prepare(query: string) {
    return new FakeD1PreparedStatement(this.db, query);
  }

  async batch<T = SqliteRow>(
    statements: FakeD1PreparedStatement[],
  ): Promise<D1Result<T>[]> {
    return Promise.all(statements.map((statement) => statement.run<T>()));
  }

  // D1Database を要求する関数にそのまま渡せるようにするための穴埋め。
  // 呼ばれた時点でテスト側の想定違いなので落とす
  async exec(): Promise<D1ExecResult> {
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
