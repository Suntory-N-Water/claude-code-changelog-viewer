# エージェント・ガイドライン

<!-- セクションの構造変更・削除禁止。変更時は個別の値を直接更新すること。 -->

## 基本原則

- ログ・コメント・コミットメッセージは日本語で記載する
- 明示的に求められない限り、**後方互換性を維持しない**
- **このファイルは指示行 20-30 行以内に収める**

---

## プロジェクト概要

**種別:** Web アプリケーション(pnpm workspace モノレポ)
**主要言語:** TypeScript
**主要依存:** Astro, Tailwind CSS v4, Cloudflare Workers(デプロイ先)

---

## コマンド

```bash
# 静的解析(コード修正後に必ず実行、ユーザー許可不要)
pnpm run ai-check
```

---

## コード規約

- GitHub の情報取得には `gh` コマンドを使用する
- GitHub Actions ワークフロー更新時は `/dev:actions-check` で静的解析を実施する

---

## アーキテクチャ

```
apps/
  www/                - Astro フロントエンド(Cloudflare Workers にデプロイ)
  docs-tracker/       - ドキュメント取得(GitHub Actions 定期実行)
  changelog-fetcher/  - CHANGELOG パーサー(GitHub Actions 定期実行)
```

IMPORTANT: 以下は GitHub Actions で自動生成されるため手動編集禁止:
- `apps/docs-tracker/metadata/last_update.json`
- `apps/changelog-fetcher/metadata/last_fetch.json`
- `apps/changelog-fetcher/changelogs/v*.md`
- `apps/changelog-fetcher/analysis/analysis_v*.json`
- `apps/changelog-fetcher/inferred/inferred_v*.json`

---

## メンテナンスノート

<!-- このセクションは永続。削除禁止。 -->

1. **定期的に見直す** - 古い指示はエージェントのコンテキストを汚染する
2. **重要: 指示行は合計 20-30 行以内** - 詳細は別ファイルに移して参照する
3. **ワークフロー変更時はコマンドを即座に更新する**
4. **大きなアーキテクチャ変更時はアーキテクチャセクションを書き直す**
5. **コードから推測できる情報は書かない**
