# Claude Code Changelog Viewer

Claude Code の更新履歴を分かりやすく表示する Web アプリケーション。pnpm workspace モノレポ構成。

プロジェクトのログ・コメント・GitHubのコミットメッセージ等は日本語で記載する。

## プロジェクト構造

- `apps/www` - Astro フロントエンド
- `apps/docs-tracker` - Claude Code のドキュメント取得、GitHub Actions で定期実行
- `apps/changelog-fetcher` - CHANGELOG パーサー、GitHub Actions で定期実行

## 技術スタック

- TypeScript ~5.9.3
- Astro ^5.16.15
- Tailwind CSS v4
- Cloudflare Workers (デプロイ先)

## 主要コマンド

コード修正後はプロジェクトのルートで以下の手順で静的解析を行い、エラーがなくなるまで実施する。
ユーザーへの許可は不要です。

- pnpm run format → フォーマッター
- pnpm run lint:ai → AI ベースのリント
- pnpm run type-check:ai → AI ベースの型チェック

## 自動化ワークフロー

**IMPORTANT**: 以下のファイルは GitHub Actions で自動生成されるため手動編集しないこと

- `apps/docs-tracker/metadata/last_update.json` - ドキュメント取得状況(JST 3:00, 9:00, 15:00, 21:00)
- `apps/changelog-fetcher/metadata/last_fetch.json` - CHANGELOG 取得状況(毎時)

## その他

- github の情報は `gh` コマンドを使用して取得する