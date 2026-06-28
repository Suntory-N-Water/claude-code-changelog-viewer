# claude-code-changelog-viewer モノレポ現状把握

## 概要

GitHub Release を毎時取得・AI分析 → 並行してドキュメント差分追跡 → 通知配信 → Astro で統合表示。すべての変更は自動PR化・マージで CI/CD 一体。

### 1. **apps/changelog-fetcher** - 変更履歴自動解析

- **役割**: GitHub Releases の CHANGELOG を取得・解析・AI推論
- **処理フロー**: `parse-changelog.ts` → キーワード抽出 → `analyze-changelog.ts` (ドキュメント grep) → `infer-benefits.ts` (Gemini API で翻訳+Before/After/Benefit推論)
- **保存先**: `/changelogs/`(取得), `/analysis/`(解析結果), `/inferred/`(推論結果), `/metadata/last_fetch.json`(ステータス)
- **Workflow**: `changelog-auto-inference.yml` (毎時実行, UTC基準)
- **主要ファイル**: `/apps/changelog-fetcher/src/{analyze-changelog,infer-benefits,parse-changelog}.ts`

### 2. **apps/docs-tracker** - ドキュメント差分追跡

- **役割**: Claude Code 公式ドキュメントを定期取得・差分検知
- **取得方式**: Markdown 直接取得(llms.txt + docs_map.md から URL一覧マージ)
- **スキーマ取得**: settings JSON 取得も併行実行
- **保存先**: `/docs/en/`(Markdown), `/diffs/`(差分JSON), `/schema/`(設定スキーマ)
- **Workflow**: `fetch-docs.yml` (3時間ごと)、変更時のみ自動PR作成・マージ
- **主要ファイル**: `/apps/docs-tracker/src/{fetch-docs,generate-docs-diff,fetch-schema}.ts`

### 3. **apps/notification-worker** - 通知配信 API

- **機能**: Discord/Slack/Email 通知登録・配信(Cloudflare Workers + Hono)
- **駆動方式**: イベント駆動(dispatch API呼出時) + cron (UTC 15:00 = JST 00:00 で休眠チャンネル削除)
- **DB**: Cloudflare D1 (drizzle ORM) → `channels` テーブル、Discord/Slack/Email別スキーマ
- **キューイング**: Cloudflare Queues (`changelog-notification`, バッチサイズ1, 最大リトライ3回)
- **主要ファイル**: `/apps/notification-worker/src/{index.ts,queue/consumer.ts,db/schema.ts,routes/{dispatch,webhooks}.ts}`, `wrangler.jsonc` (cron設定)

### 4. **apps/www** (Astro) - フロントエンド

- **フレームワーク**: Astro (静的生成) + Tailwind CSS、Cloudflare Workers へデプロイ
- **データソース**: Content Collections (glob loader)
  - `/src/content/changelog/inferred_*.json` (推論結果)
  - `/src/content/diff/**/*.json` (差分履歴)
  - `/src/content/docs-diff/**/*.json` (ドキュメント差分)
  - `/src/content/settings/**/*.json` (設定スキーマ)
- **GitHub Release 統合**: astro.config.mjs で ビルド時に API fetch、公開日時をサイトマップに反映
- **主要ファイル**: `/apps/www/src/content.config.ts`, `astro.config.mjs`

### 5. **.github/workflows/** - 自動化パイプライン

| Workflow                          | トリガー         | 役割                                      |
| --------------------------------- | ---------------- | ----------------------------------------- |
| `changelog-auto-inference.yml`    | 毎時             | CHANGELOG 取得→解析→推論、PR 作成         |
| `fetch-docs.yml`                  | 3時間ごと        | ドキュメント取得、差分検知、PR 自動マージ |
| `fetch-builtin-data.yml`          | 日1回(JST 06:00) | Claude Code ビルトイン機能データ取得      |
| `generate-settings-reference.yml` | 日1回            | 設定スキーマドキュメント生成              |
| `ci.yml`                          | PR/push          | テスト・linting・型チェック               |

### 6. **plugins/ & .claude/skills/**

- **Grit プラグイン** (5個): `enforce-date-fns`, `no-debug-statements`, `no-deep-relative-import`, `no-import-equals`, `no-template-literal-import`
- **Claude Skills** (2個): `adr-creator`, `ddd-layering` (独自アーキテクチャ支援ツール)
