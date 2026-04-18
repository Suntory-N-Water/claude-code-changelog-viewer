# ADR 0005: Drizzle ORM の導入とスーパータイプ/サブタイプ DB スキーマへの移行

## Status

Proposed

## Context

notification-worker は Cloudflare Workers 上で動作する通知配信サービスである。現在、D1 データベースへのアクセスには Cloudflare D1 の生 API（`env.DB.prepare(...).bind(...).first()` 等）を使用しており、テーブルは Discord Webhook 専用の `webhooks` テーブル1つで構成されている。

この構成には以下の課題がある。

### 解決したい課題

- 生 SQL 文字列がアプリケーションコード全体に散在しており、カラム名の typo やスキーマ変更時の追従漏れがレビューで検出しにくい
- テーブル定義が `.sql` マイグレーションファイルにしか存在せず、TypeScript の型情報と乖離しやすい（手動で `WebhookRow` 型を定義・保守していた）
- `webhooks` テーブルは Discord 固有の `webhook_url` カラムを持っており、将来 Slack やメールなど別チャンネルを追加する際にテーブル設計の大幅な変更が必要になる
- 通知頻度（即時・週次など）の設定を保持する場所がない

### 検討した選択肢

#### ORM / クエリビルダーの選択

| 観点 | 生 D1 API（現状維持） | Drizzle ORM | Kysley |
|------|----------------------|-------------|--------|
| 型安全性 | なし（手動型定義） | スキーマから自動推論 | スキーマから自動推論 |
| D1 対応 | ネイティブ | 公式サポート（`drizzle-orm/d1`） | コミュニティドライバ |
| バンドルサイズ | 0 | 軽量（SQL ビルダー中心） | やや大きい |
| マイグレーション | wrangler d1 migrations（手書き SQL） | drizzle-kit generate（スキーマ差分自動生成） | 別途ツールが必要 |
| 学習コスト | 低（SQL そのまま） | 中（API は SQL に近い） | 中 |
| エコシステム成熟度 | — | 活発（Cloudflare 公式ドキュメントでも推奨） | 安定 |

#### テーブル設計の選択

| 観点 | 単一テーブル（現状維持） | STI（Single Table Inheritance） | スーパータイプ/サブタイプ（Class Table Inheritance） |
|------|------------------------|-------------------------------|-----------------------------------------------|
| 拡張性 | 低（チャンネル追加ごとに nullable カラム増加） | 中（nullable カラムが増える） | 高（サブタイプテーブルを追加するだけ） |
| データ整合性 | — | nullable カラムの組み合わせ制約が複雑 | FK + NOT NULL で強制可能 |
| クエリの複雑さ | シンプル | シンプル | JOIN が必要 |
| D1 との相性 | — | — | Drizzle の JOIN API で記述量は許容範囲 |

### 各選択肢の評価

ORM の選択では、D1 の公式サポートがあり、バンドルサイズが小さく、スキーマ定義から型推論できる Drizzle ORM が最も適している。テーブル設計では、将来の通知チャンネル拡張を見据え、nullable カラム汚染を避けられるスーパータイプ/サブタイプ分割が適切と判断した。

## Decision

notification-worker の DB アクセス層を Drizzle ORM に移行し、テーブル設計をスーパータイプ/サブタイプ構造に再設計する。

### 1. Drizzle ORM の導入

依存パッケージとして `drizzle-orm` と `drizzle-kit`（dev）を追加し、D1 ドライバ（`drizzle-orm/d1`）経由でデータベースにアクセスする。

```typescript
// Good: Drizzle ORM による型安全なクエリ
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { channels, discordChannels } from '../db/schema';

const db = drizzle(env.DB);
const rows = await db
  .select({ channelId: channels.id, token: channels.token })
  .from(discordChannels)
  .innerJoin(channels, eq(discordChannels.channelId, channels.id))
  .where(eq(discordChannels.webhookUrl, webhookUrl));
```

```typescript
// Bad: 生 SQL の散在（型安全性なし）
const row = await env.DB.prepare(
  'SELECT id, token FROM webhooks WHERE webhook_url = ?'
).bind(webhookUrl).first<{ id: string; token: string }>();
```

### 2. スキーマ定義の一元化

`src/db/schema.ts` にテーブル定義を集約し、手動の行型定義（旧 `src/types.ts` の `WebhookRow`）を廃止する。Drizzle のスキーマ定義から型が自動推論されるため、スキーマ変更時の型の不整合が構造的に発生しない。

### 3. スーパータイプ/サブタイプ テーブル設計

```
channels (スーパータイプ)
├── discord_channels (サブタイプ: webhook_url)
├── slack_channels   (サブタイプ: webhook_url) ※将来用
└── email_channels   (サブタイプ: email_address) ※将来用

notification_settings (チャンネルごとの通知設定)
```

- `channels`: 全チャンネル共通のフィールド（id, channel_type, token, is_active, fail_count, created_at, updated_at）
- `discord_channels`: Discord 固有の `webhook_url` を保持。`channel_id` で `channels` を FK 参照
- `notification_settings`: 通知頻度（`IMM`=即時, `WEK`=週次）を行持ちテーブルで管理
- `channel_type` は3文字コード（`DSC`, `SLK`, `EML`）で識別

### 4. マイグレーション戦略

- Drizzle Kit による自動生成マイグレーション（`0000_dizzy_crystal.sql`）で新テーブルを作成
- 手書きマイグレーション（`0001_migrate_from_webhooks.sql`）で旧 `webhooks` テーブルからデータを移行し、旧テーブルを DROP
- 初期セットアップ環境（旧テーブルが存在しない場合）でも動作するよう `CREATE TABLE IF NOT EXISTS webhooks` で空テーブルを作成してから移行する
- マイグレーションディレクトリを `migrations/` から `drizzle/migrations/` に変更し、`wrangler.jsonc` の `migrations_dir` を更新

### 5. テスト構造の整理

- Drizzle ORM の D1 ドライバが内部で使用するメソッド（`.raw()`, `.all()` with RETURNING 等）に合わせてモックを修正
- 手動モックによるユニットテスト（`webhooks.test.ts`, `unsubscribe.test.ts`）を削除し、統合テスト（`*.integration.test.ts`）に集約
- テストヘルパー（`fake-d1.ts`, `notification-test-support.ts`）を新スキーマに対応

## Consequences

### Positive

- TypeScript の型安全性がスキーマ定義から自動的に保証され、カラム名の typo や型の不整合がコンパイル時に検出される
- テーブル定義が `src/db/schema.ts` に一元化され、スキーマの全体像が把握しやすくなる
- 新しい通知チャンネル（Slack, メール等）の追加がサブタイプテーブルの追加で完結し、既存コードへの影響が最小化される
- 通知頻度の設定が DB に永続化され、週次ダイジェスト等の機能追加の基盤ができる
- Drizzle Kit のマイグレーション自動生成により、スキーマ変更時の手書き SQL のミスが減る

### Negative

- Drizzle ORM への依存が増える（ランタイム依存 +1）
  - → バンドルサイズへの影響は軽微（Drizzle は SQL ビルダー中心で軽量）。D1 公式サポートがあり、メンテナンスリスクは低い
- JOIN を伴うクエリが増え、単一テーブル時代より SQL が複雑になる
  - → Drizzle の API で記述するため、生 SQL ほどの複雑さにはならない。現時点のクエリパターンは限定的
- 既存の手動モックベースのユニットテストを書き直す必要がある
  - → Drizzle ORM の D1 ドライバの内部仕様に依存するモックは脆いため、統合テストへの集約が望ましい方向

### Risks

- Drizzle ORM の D1 ドライバに breaking change が入った場合、テスト・アプリコードの修正が必要
  - → `drizzle-orm` のバージョンを lockfile で固定し、アップグレードは意図的に行う
- `slack_channels`, `email_channels` は現時点では未使用のテーブルだが、マイグレーションで作成される
  - → スキーマ定義としての「意図の表明」であり、不要になれば DROP するだけ。データが入らないため実害はない

## Notes

### 参考資料

- [Drizzle ORM - D1 ドキュメント](https://orm.drizzle.team/docs/get-started/d1-new)
- [Cloudflare D1 + Drizzle](https://developers.cloudflare.com/d1/tutorials/d1-and-drizzle/)
- 旧スキーマ: `migrations/0001_create_webhooks.sql`（本ブランチで削除）
