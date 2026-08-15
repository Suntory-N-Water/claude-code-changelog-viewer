CREATE TABLE pages (
  path         TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  source_url   TEXT NOT NULL,
  content      TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE VIRTUAL TABLE page_chunks_fts USING fts5(
  content,
  path UNINDEXED,
  heading UNINDEXED,
  chunk_index UNINDEXED,
  tokenize = 'porter unicode61'
);

CREATE TABLE setting_schema_entries (
  key                 TEXT PRIMARY KEY,
  source              TEXT NOT NULL,
  description         TEXT NOT NULL,
  parent_descriptions TEXT NOT NULL,
  value_type          TEXT NOT NULL,
  default_value       TEXT,
  enum_values         TEXT
);

CREATE TABLE setting_schema_meta (
  id           INTEGER PRIMARY KEY CHECK (id = 1),
  content_hash TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
