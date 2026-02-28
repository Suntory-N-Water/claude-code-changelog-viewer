# エージェント・ガイドライン

<!-- セクションの構造変更・削除禁止。変更時は個別の値を直接更新すること。 -->

## 基本原則

- ログ・コメント・コミットメッセージは日本語で記載する
- 明示的に求められない限り、**後方互換性を維持しない**

## プロジェクト概要

Bun workspace モノレポ / TypeScript / Astro + Cloudflare Workers

## コマンド

- 静的解析: `bun run ai-check`(Stop hook で自動実行)
- テスト: `bun run --filter <app> test`

## コード規約

- GitHub の情報取得には `gh` コマンドを使用する
- ライブラリの仕様は Context7 MCP サーバー を使用する
- GitHub Actions ワークフロー更新時は `/dev:actions-check` で静的解析を実施する
- interface ではなく type を使う
- テスト作成時は t-wada 氏のテスト設計思想に従う

## 制約

以下は GitHub Actions で自動生成されるため手動編集禁止:
- `apps/docs-tracker/metadata/last_update.json`
- `apps/changelog-fetcher/metadata/last_fetch.json`
- `apps/changelog-fetcher/changelogs/v*.md`
- `apps/changelog-fetcher/analysis/analysis_v*.json`
- `apps/changelog-fetcher/inferred/inferred_v*.json`

---

## メンテナンスノート

<!-- このセクションは永続。削除禁止。 -->

1. **定期的に見直す** - 古い指示はエージェントのコンテキストを汚染する
2. **重要: 指示行は最小限に** - 詳細は別ファイルに移して参照する
3. **ワークフロー変更時はコマンドを即座に更新する**
4. **コードから推測できる情報は書かない**
