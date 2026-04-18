-- webhooks テーブルから新スキーマへデータ移行
-- 旧テーブルが存在しない初期セットアップ環境では空テーブルを作成して 0 件移行する
CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT NOT NULL PRIMARY KEY,
  token TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  fail_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  webhook_url TEXT NOT NULL
);
--> statement-breakpoint

INSERT INTO channels (id, channel_type, token, is_active, fail_count, created_at, updated_at)
SELECT id, 'DSC', token, active, fail_count, created_at, updated_at
FROM webhooks;
--> statement-breakpoint

INSERT INTO discord_channels (channel_id, webhook_url)
SELECT id, webhook_url
FROM webhooks;
--> statement-breakpoint

-- 既存登録はすべて即時通知(IMM)としてデフォルト移行
INSERT INTO notification_settings (id, channel_id, frequency, created_at)
SELECT 'ns_' || id, id, 'IMM', created_at
FROM webhooks;
--> statement-breakpoint

DROP TABLE webhooks;
