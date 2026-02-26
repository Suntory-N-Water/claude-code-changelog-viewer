# 実装ログ: Discord Webhook 通知登録機能

**実装日**: 2026-02-25
**ブランチ**: `feature/notify`
**ステータス**: 実装完了、デプロイ前

---

## 概要

changelog 更新時の Discord 通知を「ユーザーが自分の Webhook URL を登録して受け取れる」仕組みに拡張した。既存の単一 Webhook 直接送信から、Cloudflare Queue 経由の非同期配信システムに移行。

## アーキテクチャ

```
【変更前】
GitHub Actions → pnpm run notify:changelog-send
               → changelog-fetcher がローカルファイルを読み、1つの Webhook に送信

【変更後】
GitHub Actions → curl POST notification-worker/api/dispatch(Bearer 認証)
               → Cloudflare Queue にバージョン情報を投入
               → Queue Consumer が inferred JSON を GitHub Raw URL から取得
               → D1 から登録者一覧を取得
               → 各登録者の Webhook URL に通知メッセージを送信
```

## 技術選定の理由

| 選定 | 理由 |
|------|------|
| notification-worker を別 Worker として構築 | www は静的サイトのまま維持。Queue consumer の export は Worker 単位 |
| Cloudflare Queues | 配信を非同期化し GitHub Actions の実行時間に影響しない。無料枠で十分 |
| GitHub Raw URL から fetch | Worker はリポジトリのファイルシステムにアクセスできない。dispatch は push 後に呼ばれるため Raw URL に最新データがある |
| D1 生 SQL | テーブル 1 つ・クエリ 5 種程度なので ORM 不要 |
| Cloudflare Turnstile | 無料 CAPTCHA で Bot 登録を防止 |

## 変更ファイル一覧

### 新規作成

| ファイル | 内容 |
|---------|------|
| `apps/notification-worker/migrations/0001_create_webhooks.sql` | D1 マイグレーション |
| `apps/notification-worker/src/types.ts` | Env, WebhookRow 等の型定義 |
| `apps/notification-worker/src/lib/validation.ts` | Discord Webhook URL 正規表現検証 |
| `apps/notification-worker/src/lib/turnstile.ts` | Turnstile トークン検証 |
| `apps/notification-worker/src/lib/discord.ts` | メッセージ生成 + Discord 送信 |
| `apps/notification-worker/src/routes/webhooks.ts` | POST /api/webhooks(登録 API) |
| `apps/notification-worker/src/routes/dispatch.ts` | POST /api/dispatch(配信トリガー) |
| `apps/notification-worker/src/routes/unsubscribe.ts` | GET /api/unsubscribe(配信停止) |
| `apps/notification-worker/src/queue/consumer.ts` | Queue Consumer(非同期配信処理) |
| `apps/www/src/pages/notify.astro` | 通知登録ページ |

### 変更

| ファイル | 内容 |
|---------|------|
| `apps/notification-worker/wrangler.jsonc` | D1, Queue, vars 設定追加 |
| `apps/notification-worker/package.json` | zod, types パッケージ追加 |
| `apps/notification-worker/tsconfig.json` | include 設定追加 |
| `apps/notification-worker/src/index.ts` | Hono ルーティング + Queue consumer export に全面書き換え |
| `apps/www/src/pages/index.astro` | ヘッダーに通知登録への控えめなリンク追加 |
| `apps/www/src/components/Footer.astro` | プロジェクトセクションに Discord 通知リンク追加 |
| `apps/www/src/pages/privacy.astro` | 「個人情報の収集について」→「Discord 通知について」に書き換え |
| `apps/changelog-fetcher/package.json` | `notify:changelog-send` スクリプト削除 |
| `package.json`(ルート)| `notify:changelog-send` スクリプト削除 |
| `.github/workflows/changelog-auto-inference.yml` | Discord 通知ステップを curl dispatch に置換 |
| `tsconfig.json`(ルート)| references に notification-worker 追加 |
| `knip.json` | notification-worker ワークスペース設定追加 |

### 削除

| ファイル | 理由 |
|---------|------|
| `apps/changelog-fetcher/src/discord/create-changelog-message.ts` | notification-worker/src/lib/discord.ts に移植済み |

## API 仕様

### POST /api/webhooks(登録)

```
Request:  { webhook_url: string, turnstile_token: string }
Response: { success: true } | { error: string }
Status:   200, 400, 403, 409
```

処理: Turnstile 検証 → URL 検証 → 重複チェック → テスト通知送信 → D1 INSERT

### POST /api/dispatch(配信トリガー)

```
Header:   Authorization: Bearer <DISPATCH_SECRET>
Request:  { versions: ["v2.1.56"] }
Response: { success: true, queued: ["v2.1.56"] }
Status:   200, 400, 401
```

処理: Bearer 認証 → バージョンバリデーション → Queue 投入

### GET /api/unsubscribe(配信停止)

```
Query:    ?token=xxx
Response: HTML ページ
Status:   200, 400, 404
```

処理: トークン検索 → active=0 に更新 → 結果 HTML 表示

## Queue Consumer の配信ロジック

1. Queue メッセージから `version` を取得
2. `https://raw.githubusercontent.com/.../inferred_{version}.json` を fetch
3. `AnalysisSchema` でパース
4. D1 から `active=1` の Webhook 一覧取得
5. 各登録者に送信:
   - 成功 → `fail_count=0` にリセット
   - 失敗(401/403/404)→ `fail_count++`、3 回以上で `active=0`
   - 失敗(429)→ ログ出力(Queue のリトライに委ねる)
   - 各送信間に 1 秒間隔(Discord API レートリミット対策)

## デプロイ前に必要な手動作業

```bash
# 1. D1 データベース作成
cd apps/notification-worker
pnpm exec wrangler d1 create notification-db
# → 出力された database_id を wrangler.jsonc に設定

# 2. Queue 作成
pnpm exec wrangler queues create changelog-notification

# 3. マイグレーション適用
pnpm exec wrangler d1 migrations apply notification-db --remote

# 4. Secrets 設定
pnpm exec wrangler secret put DISPATCH_SECRET
pnpm exec wrangler secret put TURNSTILE_SECRET_KEY

# 5. デプロイ
pnpm exec wrangler deploy --minify

# 6. GitHub Secrets 追加(GitHub UI)
#    - NOTIFICATION_WORKER_URL: デプロイ後の Worker URL
#    - DISPATCH_SECRET: 上記と同じ値

# 7. 既存内部 Webhook の D1 登録
pnpm exec wrangler d1 execute notification-db --remote \
  --command="INSERT INTO webhooks (id, webhook_url, token) VALUES ('$(uuidgen)', '<DISCORD_WEBHOOK_URL>', '$(uuidgen)');"
```

## 検証手順

1. D1 テーブル確認: `wrangler d1 execute notification-db --remote --command="SELECT name FROM sqlite_master WHERE type='table';"` → webhooks が存在
2. 登録 API: テスト用 Webhook URL で POST /api/webhooks → Discord にテスト通知が届く
3. 配信トリガー: POST /api/dispatch に認証付きで既存バージョンを送信 → 登録済み Webhook に通知が届く
4. 配信停止: 通知メッセージ内の停止リンクをクリック → `active=0` になり以降の通知が届かない
5. www 確認: `/notify` ページ表示、フォーム送信、トップページ・フッターの導線

## 残した技術的負債

- `worker-configuration.d.ts`(wrangler 自動生成)に lint 警告あり。Biome の設定で除外するか、`.biome.json` に ignore を追加する検討が必要
- Turnstile の site key はハードコード。環境ごとの切り替えが必要になった場合は vars 化を検討
