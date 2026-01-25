# Claude Code Changelog Viewer

Claude Code の更新履歴を分かりやすく表示する Web アプリケーション。pnpm workspace モノレポ構成。

## プロジェクト構造

- `apps/www` - Astro フロントエンド
- `apps/docs-tracker` - Claude Code のドキュメント取得、GitHub Actions で定期実行
- `apps/changelog-fetcher` - CHANGELOG パーサー、GitHub Actions で定期実行

## 技術スタック

- TypeScript ~5.9.3 (strict mode), Astro ^5.16.15, Tailwind CSS
- Biome 2.3.8 (linter/formatter) - **Prettier や ESLint は使用しない**
- Node.js ≥22.0.0, pnpm ≥10.0.0 **必須**（npm/yarn 不可）
- Cloudflare Workers (デプロイ先)

## 主要コマンド(全体)

コード修正後は以下の手順で静的解析を行い、エラーがなくなるまで実施。

- pnpm run format → フォーマッター
- pnpm run lint:ai → AI ベースのリント
- pnpm run type-check:ai → AI ベースの型チェック

## 自動化ワークフロー

**IMPORTANT**: 以下のファイルは GitHub Actions で自動生成されるため手動編集しないこと

- `apps/docs-tracker/metadata/last_update.json` - ドキュメント取得状況（JST 3:00, 9:00, 15:00, 21:00）
- `apps/changelog-fetcher/metadata/last_fetch.json` - CHANGELOG 取得状況（毎時）

## その他

- github の情報は `gh` コマンドを使用して取得する