# Claude Code Changelog Viewer

Claude Code の更新履歴を分かりやすく表示する Web サイト。

GitHub Actions により自動的に最新の CHANGELOG と公式ドキュメントを取得し、Cloudflare Workers 上でホスティングされた静的サイトで提供します。

## 特徴

- GitHub Actions で CHANGELOG とドキュメントを定期取得
- AI による CHANGELOG の自動翻訳・推論(Gemini API 使用)
- pnpm workspace によるモノレポ構成
- Astro + Cloudflare Workers による高速な静的サイト
- TypeScript strict mode による型安全な実装

## プロジェクト構造

```
.
├── apps/
│   ├── www/                    # Astro フロントエンド (Cloudflare Workers)
│   ├── docs-tracker/          # Claude Code ドキュメント取得スクリプト
│   └── changelog-fetcher/     # CHANGELOG パーサー
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

## 技術スタック

- Astro ^5.16.15
- TypeScript ~5.9.3
- Tailwind CSS
- Biome 2.3.8
- pnpm ≥10.0.0
- Cloudflare Workers

## ライセンス

MIT