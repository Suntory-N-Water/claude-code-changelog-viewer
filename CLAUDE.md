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

### CHANGELOG自動推論パイプライン

毎時実行されるワークフロー(`.github/workflows/changelog-auto-inference.yml`)により、CHANGELOG の取得から AI 推論まで自動化

1. **fetch-and-parse**: CHANGELOG を取得し、更新を検知
2. **analyze-changelogs**: 各バージョンの解析ファイル(`analysis_*.json`)を生成
3. **infer-benefits**: Gemini API で翻訳・推論を実行し、推論ファイル(`inferred_*.json`)を生成
4. **commit-and-push**: 生成されたファイルを自動コミット&プッシュ

エラー時は自動的に Issue を作成(重複チェック付き)。

### 自動生成されるファイル

**IMPORTANT**: 以下のファイルは GitHub Actions で自動生成されるため手動編集しないこと

- `apps/docs-tracker/metadata/last_update.json` - ドキュメント取得状況(JST 3:00, 9:00, 15:00, 21:00)
- `apps/changelog-fetcher/metadata/last_fetch.json` - CHANGELOG 取得状況(毎時)
- `apps/changelog-fetcher/changelogs/v*.md` - 各バージョンの CHANGELOG
- `apps/changelog-fetcher/analysis/analysis_v*.json` - 各バージョンの解析結果
- `apps/changelog-fetcher/inferred/inferred_v*.json` - 各バージョンの AI 推論結果

## GitHub Actions スクリプト

再利用可能な JavaScript スクリプトは `.github/scripts/` に配置

- `create-changelog-processing-issue.cjs` - CHANGELOG 処理エラー時の Issue 作成

型定義は `.github/types/actions.ts` で管理。

## その他

- github の情報は `gh` コマンドを使用して取得する