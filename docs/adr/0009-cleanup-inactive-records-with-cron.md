# ADR 0009: Cloudflare Workers Cron を用いた非アクティブレコードの定期削除

## Status

Proposed

## Context

notification-worker において、ユーザーが通知チャンネル（Discord, Slack, Emailなど）を登録した際、一時的に非アクティブ（未確認）状態でレコードが作成されます。
この状態のままユーザーが確認プロセスを完了せず放置した場合、データベース（D1）に不要なレコードが蓄積され続ける問題がありました。

### 解決したい課題

- 確認プロセスが完了していない（isActive === 0）孤立したレコードがD1に無駄に蓄積されるのを防ぎたい
- データベースの容量削減とパフォーマンス維持のため、一定期間経過したレコードを自動で削除したい

### 検討した選択肢

- A: Cloudflare Workers の Cron トリガーを使用して定期的に削除バッチを実行する
- B: アプリケーションへのリクエスト発生時（Webhooks受信時など）についでに古いレコードを削除する
- C: データベース（SQLite/D1）のスキーマ変更で onDelete: 'cascade' を設定し、親テーブルのみを削除する

### 各選択肢の評価

| 観点 | 選択肢A (Cronトリガー) | 選択肢B (リクエスト時ついで) | 選択肢C (スキーマでカスケード) |
|------|---------|---------|---------|
| 確実性 | 高い（定時で確実に実行） | 低い（アクセスがないと実行されない） | 高い（DB層で処理） |
| パフォーマンスへの影響 | なし（別実行のため） | あり（ユーザーへのレスポンスが遅延） | なし |
| 実装の手間 | 中（バッチ処理の追加） | 小 | 大（マイグレーションが必要） |

## Decision

Cloudflare Workers の Cron トリガーを採用し、Drizzle ORM の db.batch を用いて関連テーブルをプログラム側で一括削除する手法を採用します。

### 1. Cron トリガーによるスケジュール実行

Cloudflare Workers の triggers 設定を用いて、毎日定時（UTC 15時、JST 0時）に scheduled ハンドラを発火させます。将来的な拡張性を考慮し、event.cron の文字列を switch 文で判定する設計としました。

### 2. D1 における db.batch() の活用

SQLite の PRAGMA foreign_keys を有効化するマイグレーションの手間を省くため、プログラム側で子テーブルから順番に削除するアプローチを採用しました。
その際、途中でエラーが起きた場合に孤立レコードが発生しないよう、Drizzle ORM が提供する D1 向けの db.batch() を使用し、配列内のクエリをひとつのトランザクションとして実行します。

```typescript
// Good: トランザクション（batch）を使用して関連レコードを安全に一括削除
await db.batch([
  db.delete(discordChannels).where(inArray(discordChannels.channelId, channelIds)),
  db.delete(slackChannels).where(inArray(slackChannels.channelId, channelIds)),
  db.delete(emailChannels).where(inArray(emailChannels.channelId, channelIds)),
  db.delete(notificationSettings).where(inArray(notificationSettings.channelId, channelIds)),
  db.delete(channels).where(inArray(channels.id, channelIds)),
]);
```

## Consequences

### Positive

- 未確認状態の古いレコードが自動的にクリーンアップされ、データベースの肥大化を防ぐことができる
- Cron トリガーを使用することで、ユーザーの操作やレスポンスに影響を与えることなくバックグラウンドで処理が完結する
- db.batch() によりトランザクションが保証されるため、データの整合性が保たれる

### Negative

- アプリケーション側にテーブルの削除順序を管理する責任が生じる
  - → テーブル構成が変更される際は、このクリーンアップロジックも忘れずに更新するよう運用でカバーする

### Risks

- 将来的にサブテーブルが増えた際、クリーンアップロジックへの追加を忘れると、親テーブルのみ削除され子テーブルに孤立レコードが残るリスクがある
  - → スキーマ定義を変更する際は、関連する操作ロジック（src/cron/cleanup.ts など）の全体検索を併せて行うことを開発フローの慣習とする

## Notes

### 参考資料

- Cloudflare Workers Cron Triggers ドキュメント
- Drizzle ORM D1 Batch API ドキュメント
