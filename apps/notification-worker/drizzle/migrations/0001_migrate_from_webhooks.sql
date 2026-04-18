-- webhooks テーブルから新スキーマへデータ移行
-- 本マイグレーションは旧 webhooks テーブルが存在する環境（本番）でのみ適用する

INSERT INTO channels (id, channel_type, token, is_active, fail_count, created_at, updated_at)
SELECT id, 'DSC', token, active, fail_count, created_at, updated_at
FROM webhooks;
--> statement-breakpoint

INSERT INTO discord_channels (channel_id, webhook_url)
SELECT id, webhook_url
FROM webhooks;
--> statement-breakpoint

-- 既存登録はすべて即時通知（IMM）としてデフォルト移行
INSERT INTO notification_settings (id, channel_id, frequency, created_at)
SELECT 'ns_' || id, id, 'IMM', created_at
FROM webhooks;
--> statement-breakpoint

DROP TABLE webhooks;
