---
paths:
  - "apps/notification-worker/**"
---

# apps/notification-worker - Discord 通知配信

Cloudflare Workers + Hono ベースの通知配信 API。

- Cloudflare D1 で Webhook URL を管理
- Cloudflare Queues による非同期バッチ配信
- Cloudflare Turnstile による Bot 対策
- 連続送信失敗 3 回で自動停止

## API エンドポイント

- `POST /api/webhooks` - 通知登録（Turnstile 認証 + テスト通知送信）
- `POST /api/dispatch` - 配信トリガー（Bearer トークン認証、GitHub Actions から呼び出し）
- `POST /api/unsubscribe` - 配信停止
