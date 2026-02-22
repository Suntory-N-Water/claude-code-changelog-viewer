---
name: gh-aw-best-practice
description: GitHub Agentic Workflows (GH-AW) のワークフロー作成・運用ベストプラクティス
metadata:
  target_agent: claude
---

# GitHub Agentic Workflows スキル

GitHub Agentic Workflows (.github/workflows/*.md) を正確かつ安全に作成・運用するためのスキル。

## このスキルの使い方

ユーザーが GH-AW ワークフローの作成・修正・トラブルシューティングを求めたとき、以下の判断フローに従う。

### 判断フロー

1. **ワークフロー新規作成** → `reference/01-frontmatter-spec.md` でフロントマター構文を確認 + `reference/05-workflow-examples.md` で類似例を参照
2. **セットアップ・CLI操作** → `reference/02-setup-guide.md` を参照
3. **パターン選択に迷う** → `reference/03-design-patterns.md` でパターン一覧を確認
4. **セキュリティ・権限の設計** → `reference/04-security-best-practices.md` を参照
5. **エラー・トラブル** → `reference/04-security-best-practices.md` のトラブルシューティングセクション

---

## ワークフロー作成の必須チェックリスト

ワークフロー (.md) を作成する際、以下を必ず確認すること:

1. **フロントマター**: `on:`, `permissions:`, `safe-outputs:` は必須
2. **権限は最小限**: デフォルト read-only。書き込みは `safe-outputs` 経由のみ
3. **PRは自動マージされない**: 人間レビューが常に必要
4. **ロックファイル**: フロントマター変更時は `gh aw compile` で再生成が必要。Markdown本文の変更は不要
5. **strict: true** (デフォルト): write権限禁止、network明示必須

## ファイル配置

```
.github/workflows/
  my-workflow.md           # ワークフロー定義
  my-workflow.lock.yml     # コンパイル済みロックファイル (自動生成)
```

## referenceファイル一覧

| ファイル | 内容 |
|---|---|
| `reference/01-frontmatter-spec.md` | フロントマターの全キー・構文仕様 |
| `reference/02-setup-guide.md` | CLIインストール・セットアップ手順 |
| `reference/03-design-patterns.md` | デザインパターン (ChatOps, DailyOps 等) + 完全例 |
| `reference/04-security-best-practices.md` | セキュリティ・ガードレール・トラブルシューティング |
| `reference/05-workflow-examples.md` | 7つの実践的ワークフロー完全例 |

## 公式ドキュメント

- ドキュメント: https://github.github.io/gh-aw/
- クイックスタート: https://github.github.io/gh-aw/setup/quick-start/
- ワークフローギャラリー: https://github.github.io/gh-aw/blog/2026-01-12-welcome-to-pelis-agent-factory/
