# ADR 0006: Slack 通知チャンネルの追加

## Status

Accepted

## Context

本プロジェクトの通知機能は、これまで Discord Webhook のみを対象としていた。ADR 0005 でスーパータイプ/サブタイプ DB 設計に移行し、`slack_channels` テーブルを定義済みだが、アプリケーションコード側は Discord にしか対応していなかった。

Slack は日本のソフトウェア開発チームで広く利用されており、Discord を使っていないユーザーからの通知チャンネル追加の要望に応えるため、Slack Incoming Webhook による通知配信を実装する必要がある。

### 解決したい課題

- Discord を使わないユーザーが更新通知を受け取る手段がない
- 通知設定ページの UI が Discord 専用のハードコードになっており、複数チャンネル種別を扱えない
- `notify.astro` のインラインスクリプトが肥大化しており、チャンネル追加時にさらに複雑化する

### 検討した選択肢

#### Slack 連携方式の選択

| 観点 | Incoming Webhook(App Manifest 配布) | Slack Bot OAuth 認証 | Slack App Directory 公開 |
|------|--------------------------------------|---------------------|------------------------|
| ユーザー側のセットアップ | App 作成 + Webhook URL 取得 | OAuth ボタンを押すだけ | アプリ追加ボタンを押すだけ |
| サーバー側の実装 | Webhook URL に POST するだけ | OAuth フロー + トークン管理 | 審査対応 + OAuth フロー |
| 認証情報の管理 | Webhook URL のみ(既存設計に適合) | アクセストークンの暗号化保存が必要 | 同上 |
| 必要な Slack スコープ | `incoming-webhook` のみ | `chat:write` + チャンネル選択 | 審査基準に応じて |
| DB スキーマへの影響 | `slack_channels.webhook_url` に格納(Discord と同構造) | トークン用カラム追加が必要 | 同上 |
| 運用コスト | 低い(サーバーレスのまま) | トークンリフレッシュ等の追加実装 | 審査・保守の継続的コスト |

### 各選択肢の評価

現在の DB 設計(ADR 0005)で `slack_channels` テーブルに `webhook_url` カラムが既に存在し、Discord Webhook と同じ「URL に POST する」モデルで統一できる Incoming Webhook 方式が最も自然に統合できる。App Manifest を提供することで、ユーザーのセットアップ手順を最小限に抑える。

## Decision

Slack Incoming Webhook 方式で Slack 通知チャンネルを追加し、フロントエンドの通知設定ページを Discord / Slack のタブ切り替え UI にリファクタリングする。

### 1. Slack 通知送信モジュール

`apps/notification-worker/src/lib/slack.ts` を新規作成し、Block Kit 形式のメッセージ構築と送信を実装する。Discord 用モジュール(`discord.ts`)と同じインターフェース(`{ ok: boolean; status: number }`)を返すことで、consumer 側のエラーハンドリングを共通化する。

```
── src/lib/
   ├── discord.ts   // 既存: Discord Webhook 送信
   └── slack.ts     // 新規: Slack Incoming Webhook 送信
```

Slack のメッセージは Block Kit(`header`, `section`, `divider`)を使用し、変更ログのグループ化・emoji ラベル付けは Discord 版と同じロジックを Slack API のフォーマットに変換する。

### 2. consumer の分岐ロジック

`queue/consumer.ts` で Discord と Slack のチャンネルを別々のクエリで取得し、`channelType` フィールドで送信先を分岐する。

```typescript
const result =
  webhook.channelType === 'SLK'
    ? await sendToSlack(webhook.webhookUrl, createSlackChangelogMessage(...))
    : await sendToDiscord(webhook.webhookUrl, createChangelogMessage(...));
```

失敗時のリトライ・fail_count 加算・チャンネル無効化のロジックは Discord / Slack で共通のまま維持する。

### 3. Webhook 登録 API の拡張

`routes/webhooks.ts` のリクエストスキーマに `channel_type` フィールド(`DSC` | `SLK`)を追加する。`channel_type` に応じて、URL バリデーション・サブタイプテーブルへの INSERT・テスト通知送信を分岐する。

### 4. Slack Webhook URL バリデーション

`src/lib/validation.ts` に `isValidSlackWebhookUrl` を追加する。

```
^https://hooks\.slack\.com/services/[A-Z0-9]+/[A-Z0-9]+/[A-Za-z0-9]+$
```

### 5. Slack App Manifest の配布

`config/slack-app-manifest.yaml` にマニフェストファイルを追加し、ユーザーが「Create app from manifest」でアプリを作成できるようにする。必要なスコープは `incoming-webhook` のみ。

### 6. フロントエンド UI のリファクタリング

通知設定ページ(`notify.astro`)を以下の構成に変更する。

- Discord / Slack のタブ切り替え UI(`role="tablist"` + `role="tabpanel"`)
- 各タブに個別のセットアップガイド・登録フォーム・Turnstile ウィジェット
- Slack タブにはマニフェスト YAML のコピーボタン付きコードブロックを表示

インラインスクリプトの肥大化を解消するため、以下のモジュールに分割する。

```
── src/lib/notify/
   ├── form.ts        // 登録フォームの入力検証・送信処理
   ├── tabs.ts        // Discord / Slack タブ切り替え
   ├── turnstile.ts   // Turnstile ウィジェットの遅延レンダリング
   └── copy-button.ts // マニフェスト YAML のコピーボタン
```

### 7. サイト全体の表記変更

「Discord通知」「Discord通知設定」等の表記を「通知設定」「更新通知を受け取る」に統一し、Discord 固定の印象を払拭する。対象: Footer, index, about, changelog/[version], privacy ページ。

## Consequences

### Positive

- Slack ユーザーが更新通知を受け取れるようになり、リーチが拡大する
- ADR 0005 で用意したスーパータイプ/サブタイプ設計が想定どおり機能し、DB スキーマの変更なしでチャンネル追加が完了した
- `notify.astro` のインラインスクリプトがモジュール分割されたことで、メール通知チャンネルも同じパターンで追加できた
- メール通知チャンネル(`EML`)を同一ブランチで追加実装した。Cloudflare Email Routing(`send_email` binding)と `mimetext` による multipart/alternative メールを採用。メールパネルはプレビュー版として公開しており、サービス停止の可能性をユーザーに明示している
- Incoming Webhook 方式により、サーバー側の実装が Discord と同じ「URL に POST」モデルで統一され、共通のエラーハンドリングが使える
- App Manifest 配布により、ユーザーのセットアップ手順を段階的に案内できる

### Negative

- Incoming Webhook 方式はユーザー側で Slack App を作成する必要があり、OAuth 認証方式と比べてセットアップの手間が大きい
  - → App Manifest を提供し、「Create app from manifest」で App 作成を簡略化。セットアップガイドで手順を詳細に案内する
- consumer のチャンネル取得が Discord と Slack で2回のクエリに分かれており、チャンネル種別が増えるとクエリ数が増加する
  - → 現時点では2種類のみで十分。将来的にチャンネル数が増えた場合は UNION や汎用クエリへのリファクタリングを検討する

### Risks

- Slack Incoming Webhook の仕様変更(URL パターン、レート制限、Block Kit フォーマット等)への追従が必要
  - → Slack API の変更頻度は低く、Incoming Webhook は安定した API。バリデーション正規表現は設定として分離済み
- Turnstile ウィジェットの複数インスタンス管理(Discord 用 / Slack 用)でレンダリングの競合が起きる可能性
  - → タブ切り替え時の遅延レンダリングと widget ID による管理で対処済み

## 決めていないこと

| 項目 | 決めない理由 | いつ決めるか |
|------|------------|------------|
| ~~メール通知チャンネルの追加~~ | ~~現時点では需要が不明~~ | **決定済み** — 同ブランチでプレビュー版として実装完了 |
| 週次ダイジェスト通知の実装 | `notification_settings.frequency` に `WEK` を定義済みだが、配信ロジックは未実装 | 即時通知の運用が安定してから |
| Slack Bot OAuth 認証への移行 | Incoming Webhook で十分機能しており、移行の緊急性がない | ユーザーからセットアップの煩雑さに関するフィードバックがあった場合 |

## Notes

### 参考資料

- [ADR 0005: Drizzle ORM の導入とスーパータイプ/サブタイプ DB スキーマへの移行](./0005-adopt-drizzle-orm-and-supertype-subtype-schema.md)
- [Slack Incoming Webhooks](https://api.slack.com/messaging/webhooks)
- [Slack Block Kit Builder](https://app.slack.com/block-kit-builder)
- [Slack App Manifest](https://api.slack.com/reference/manifests)
