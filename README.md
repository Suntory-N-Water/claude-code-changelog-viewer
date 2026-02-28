# Claude Code Changelog Viewer

Claude Code の更新履歴を分かりやすく表示する Web サイト。

GitHub Actions により自動的に最新の CHANGELOG と公式ドキュメントを取得し、Cloudflare Workers 上でホスティングされた静的サイトで提供します。

## 特徴

- GitHub Actions で CHANGELOG とドキュメントを定期取得
- AI による CHANGELOG の自動翻訳・推論(Gemini API 使用)
- Discord Webhook による新バージョンの自動通知
- pnpm workspace によるモノレポ構成
- Astro + Cloudflare Workers による高速な静的サイト
- TypeScript strict mode による型安全な実装

## プロジェクト構造

```
.
├── apps/
│   ├── www/                    # Astro フロントエンド (Cloudflare Workers)
│   ├── docs-tracker/          # Claude Code ドキュメント取得スクリプト
│   ├── changelog-fetcher/     # CHANGELOG パーサー
│   └── notification-worker/   # Discord 通知配信 (Cloudflare Workers)
└── .github/workflows/         # GitHub Actions ワークフロー
```

### アプリケーション詳細

#### `apps/www`
- Astro ベースのフロントエンド
- Tailwind CSS によるスタイリング
- Cloudflare Workers へデプロイ

#### `apps/docs-tracker`
- Claude Code の公式ドキュメントを取得
- 3時間おきに定期実行
- 取得状況: `apps/docs-tracker/metadata/last_update.json`

#### `apps/changelog-fetcher`
- CHANGELOG.md をパースして JSON 化
- Gemini API による自動翻訳・推論
- 毎時実行
- 取得状況: `apps/changelog-fetcher/metadata/last_fetch.json`
- 解析結果: `apps/changelog-fetcher/analysis/analysis_v*.json`
- 推論結果: `apps/changelog-fetcher/inferred/inferred_v*.json`

#### `apps/notification-worker`
- Cloudflare Workers + Hono ベースの通知配信 API
- Discord Webhook を通じた新バージョンの自動通知
- Cloudflare D1 で登録者の Webhook URL を管理
- Cloudflare Queues による非同期バッチ配信
- Cloudflare Turnstile による Bot 対策
- API エンドポイント:
  - `POST /api/webhooks` - 通知登録(Turnstile 認証 + テスト通知送信)
  - `POST /api/dispatch` - 配信トリガー(Bearer トークン認証、GitHub Actions から呼び出し)
  - `POST /api/unsubscribe` - 配信停止
- 連続送信失敗 3 回で自動停止するエラーハンドリング

## 技術スタック

- Astro
- Hono
- TypeScript ~5.9.3
- Tailwind CSS
- Biome
- Zod
- pnpm
- Cloudflare Workers / D1 / Queues

## ライセンス

MIT
