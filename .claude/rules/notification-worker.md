---
paths:
  - "apps/notification-worker/**"
---

# apps/notification-worker - Discord 通知配信 / CHANGELOG 変化検知

Cloudflare Workers + Hono ベースの通知配信 API。加えて 5 分 cron で CHANGELOG.md の変化を検知する。

- Cloudflare D1 で Webhook URL を管理
- Cloudflare Queues による非同期バッチ配信
- Cloudflare Turnstile による Bot 対策
- 連続送信失敗 3 回で自動停止
- Cloudflare KV (`CHANGELOG_DETECTION_KV`) に CHANGELOG.md 全体の SHA256 を保持し、変化時に GitHub `workflow_dispatch` を起動

## API エンドポイント

- `POST /api/webhooks` - 通知登録(Turnstile 認証 + テスト通知送信)
- `POST /api/dispatch` - 配信トリガー(Bearer トークン認証、GitHub Actions から呼び出し)
- `POST /api/unsubscribe` - 配信停止

## cron トリガー

- `0 15 * * *` (毎日 JST 0 時) - 30 日以上停止状態のチャンネルを削除
- `*/5 * * * *` (5 分間隔) - CHANGELOG.md を fetch して KV 保存ハッシュと比較、差分があれば `changelog-auto-inference.yml` を `workflow_dispatch` で起動
