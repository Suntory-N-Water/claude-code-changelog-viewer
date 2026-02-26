-- ユーザーが登録したDiscord Webhook URLを管理するテーブル
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
