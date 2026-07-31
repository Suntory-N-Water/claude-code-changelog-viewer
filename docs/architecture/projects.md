# claude-code-changelog-viewer モノレポ構成

## 概要

pnpm workspace 上の TypeScript モノレポ。Claude Code の CHANGELOG、公式 Docs、設定スキーマ、ブログ、YouTube 情報を収集し、Astro の静的サイトで公開する。CHANGELOG の変化検知と通知 API は Cloudflare Workers、購読情報と配信済み記録は D1、通知処理は Cloudflare Queues を使う。

内部の Claude Code version は `v2.1.220` のような `v` 付き表記に統一する。ファイル名、metadata / diff、workflow と通知の version、公開 URL は `v` 付きとする。一方、analysis / inferred / tied JSON の本文、CHANGELOG Markdown の見出し、週次記事 frontmatter は既存の外部保存形式として `v` なしを維持し、読み込み時にドメイン表現へ正規化する。

## Workspace

### `apps/changelog-fetcher`

- GitHub の公式 CHANGELOG を取得し、変更検知、Docs 検索、Issue 紐付け、Gemini による翻訳・推論を行う。
- 主な出力は `changelogs/`、`analysis/`、`tied/`、`inferred/`、`diff/`、`settings/`、`metadata/`。
- `infer:no-ai` は `infer-benefits.ts --no-ai` を実行し、既存の推論結果を再利用する。破損した inferred JSON は警告して未取得として扱う。
- Docs 検索エンジンの子プロセスにはタイムアウトを設け、完了・失敗・タイムアウトの各経路でタイマーとプロセスを終了処理する。
- 週次記事は `posts/weekly/` に生成する。

### `apps/docs-tracker`

- Claude Code 公式 Docs、settings schema、Anthropic Blog、YouTube メタデータと transcript を取得する。
- Docs は `docs/en/`、差分は `diffs/`、settings schema は `schema/`、取得状態は `metadata/` に保存する。
- 既存 JSON が存在しない場合と、JSON が破損・schema 不一致の場合を区別する。後者はファイルパスとエラーを警告する。
- Docs、schema、metadata、docs diff、YouTube 関連の主要な JSON・Markdown 出力は、一時ファイルを同一ディレクトリへ書いて rename するアトミック書き込みを使う。

### `apps/notification-worker`

- Hono + Cloudflare Workers で Discord、Slack、Email の通知登録・配信 API を提供する。
- D1 の `channels` と通知先別テーブル、通知設定に加え、`notification_deliveries` に version と channel の配信済み組を記録する。Queue の再試行時は配信済みチャンネルをスキップし、重複配信を防ぐ。
- 一時障害と例外はチャンネルの失敗履歴へ記録し、Queue message を再試行する。恒久障害は失敗履歴へ記録するが同じ message は再試行しない。
- webhook 登録は Turnstile 検証に加え、`CF-Connecting-IP` 単位で 1 分あたり 5 回に制限する。
- Queue は batch size 1、最大 3 回再試行、60 秒遅延、dead-letter queue 付き。
- cron は 5 分ごとの CHANGELOG 変化検知と、毎日 JST 00:00 の休眠チャンネル削除を実行する。

### `apps/www`

- Astro + Tailwind CSS の静的サイトを生成し、Cloudflare Workers Static Assets で配信する。
- Content Collections は次の symlink を通じて他 app の生成物を参照する。
  - `src/content/changelog` → `apps/changelog-fetcher/inferred`
  - `src/content/diff` → `apps/changelog-fetcher/diff`
  - `src/content/docs-diff` → `apps/docs-tracker/diffs`
  - `src/content/settings` → `apps/changelog-fetcher/settings`
- CHANGELOG 一覧・トップは共通の version card データ生成を使い、Docs 差分は共通ソートとページサイズ定数を使う。
- prefix の表示名・スタイル・アイコンは `src/lib/prefix.ts` に集約する。
- 週次選定画面は Astro component を表示責務に絞り、型、初期化、画像 upload、リンク行操作を `src/lib/weekly-selection/` に分離する。
- `src/content/posts/weekly` は changelog-fetcher の週次記事を参照し、`src/content/posts/column` はコラムを保持する。

### `packages/common` / `packages/types`

- `common`: ロガー、エラー変換、Markdown 処理など、複数 app で使う実装。
- `types`: changelog analysis と通知用 subset の Zod schema。workflow・通知境界で使う `v` 付き version schema もここで共有する。

## 自動化

| Workflow | トリガー | 役割 |
| --- | --- | --- |
| `changelog-auto-inference.yml` | notification-worker からの手動 dispatch | CHANGELOG 取得、解析、Issue 紐付け、推論、通知、PR 作成 |
| `fetch-docs.yml` | 3 時間ごと / 手動 | Docs と settings schema の取得、差分生成、PR 作成・マージ |
| `fetch-blog.yml` | 1 時間ごと / 手動 | Anthropic Blog の取得 |
| `fetch-youtube.yml` | 毎日 / 手動 | YouTube 情報の取得 |
| `fetch-builtin-data.yml` | 毎日 JST 06:00 / 手動 | Claude Code ビルトイン情報の取得 |
| `generate-settings-reference.yml` | 毎日 JST 06:00 / 手動 | 設定リファレンスの生成 |
| `ci.yml` | push / 手動 | TypeScript workspace の検査 |
| `python-ci.yml` | Python 関連変更の push / 手動 | Docs 検索エンジンなど Python 部分の検査 |
| `github-actions-lint.yml` | workflow 関連変更 | GitHub Actions の静的解析 |
| `weekly-report.yml` | Issue 操作 | 週次記事用 Issue の処理 |

共通の Node/pnpm セットアップは `.github/actions/setup`、Python/uv セットアップは `.github/actions/setup-uv` に置く。

## インフラと開発支援

- `terraform/zone/`: Cloudflare zone の DNS、Access、R2、メール、bot 対策などを管理する。
- `.agents/skills/`: `column-image-upload`、`find-skills`、`perf-astro`、`skill-creator`、`weekly-post` のプロジェクト向け skill を置く。
- `plugins/`: date-fns 利用、debug 文、深い相対 import、TypeScript import equals、template literal import を検査する Grit rule を置く。

## 検証コマンド

- 全体の format・lint・型検査: `pnpm run ai-check`
- app 単位のテスト: `pnpm run --filter <app> test`
- www の build: `pnpm run --filter www build`
