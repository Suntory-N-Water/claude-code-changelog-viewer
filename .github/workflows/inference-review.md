---
description: |
  CHANGELOG 推論結果の品質をチェックし、
  原文との矛盾や的外れな benefit を検出して Issue で報告する。

on:
  push:
    branches: [main]
    paths:
      - 'apps/changelog-fetcher/inferred/inferred_v*.json'
  bots: ["github-actions[bot]"]
  skip-if-match: 'is:issue is:open label:inference-review'

permissions:
  contents: read
  issues: read

network:
  allowed:
    - defaults
    - node
    - github

safe-outputs:
  create-issue:
    title-prefix: "[推論レビュー] "
    labels: [inference-review, automation]
    max: 1

tools:
  github:
    toolsets: [issues]
  cache-memory: true

engine: copilot

timeout-minutes: 15

steps:
  - name: 推論結果の収集
    env:
      HEAD_SHA: ${{ github.event.after }}
      BEFORE_SHA: ${{ github.event.before }}
      GH_TOKEN: ${{ github.token }}
    run: |
      mkdir -p /tmp/gh-aw/review-data

      # GitHub API で push コミットの変更ファイルを取得(shallow clone でも動作する)
      CHANGED_FILES=$(gh api "repos/${{ github.repository }}/compare/${BEFORE_SHA}...${HEAD_SHA}" \
        --jq '.files[] | select(.filename | test("^apps/changelog-fetcher/inferred/inferred_v.*\\.json$")) | .filename' 2>/dev/null || true)

      if [ -z "$CHANGED_FILES" ]; then
        echo "⚠️ 推論結果の変更なし。スキップします。"
        echo '{"versions": "", "skip": true}' > /tmp/gh-aw/review-data/manifest.json
        exit 0
      fi

      VERSIONS=""
      for file in $CHANGED_FILES; do
        version=$(basename "$file" | sed 's/^inferred_//' | sed 's/\.json$//')
        if [ -f "$file" ]; then
          cp "$file" /tmp/gh-aw/review-data/
          echo "✓ ${version} の推論結果を収集"
          VERSIONS="${VERSIONS} ${version}"
        fi
      done
      VERSIONS=$(echo "$VERSIONS" | xargs)

      echo "{\"versions\": \"$VERSIONS\"}" > /tmp/gh-aw/review-data/manifest.json
      echo "対象バージョン: $VERSIONS"
---

# 推論品質チェックエージェント

あなたは CHANGELOG 推論結果の品質を評価するレビュアーです。
Gemini API が生成した `before/after/benefit` が原文と矛盾していないか、的外れでないかをチェックします。

## コンテキスト

- **リポジトリ**: ${{ github.repository }}
- **コミットSHA**: ${{ github.event.after }}

## データの場所

`/tmp/gh-aw/review-data/` に以下が配置されている:
- `manifest.json` - 対象バージョン情報。`skip: true` の場合は推論結果の変更がないため何もせず終了する
- `inferred_v*.json` - 推論結果(各アイテムに `content` として原文を含む)

## チェック手順

### ステップ 1: 各バージョンの推論結果を評価

`inferred_v*.json` の各アイテムについて、`inference` フィールドが存在するもののみを対象に以下を評価する:

**チェック観点:**

1. **before/after の原文整合性**: `content`(英語原文)が述べている変更内容と、`before`/`after` の記述が矛盾していないか
   - 例: 原文が "Fixed crash when..." なのに before が新機能追加について述べている → 矛盾
   - 例: 原文が "Added X" なのに after が "X を削除" と述べている → 矛盾

2. **benefit の妥当性**: `benefit` が変更内容から論理的に導かれるものか、飛躍や的外れがないか
   - 例: 軽微なバグ修正に対して「開発体験が革命的に向上」→ 過大評価
   - 例: 原文の変更と無関係な benefit → 的外れ

**チェック対象外:**
- `inference` フィールドが存在しないアイテム(`related_docs < 2` の場合は意図的に推論を省略している)
- `content_ja`(翻訳品質)はチェック対象外

### ステップ 2: 重複チェック

1. `/tmp/gh-aw/cache-memory/last-review.json` を確認し、同一バージョンのレビュー済み記録があればスキップする
2. ラベル `inference-review` のオープンIssueを検索し、同一バージョンが既に報告済みならスキップする

### ステップ 3: 結果判定

- 問題のあるアイテムが **1 件もなければ Issue を作成しない**。何もせず終了する
- 問題のあるアイテムがあれば Issue を作成する
- レビュー結果を `/tmp/gh-aw/cache-memory/last-review.json` に保存する(対象バージョン、チェック日時、結果)

### ステップ 4: Issue 作成(問題がある場合のみ)

以下のフォーマットで Issue を作成する:

```
## 推論品質レビュー結果

**対象バージョン**: [バージョン一覧]
**チェック日時**: [タイムスタンプ]

## 要確認アイテム

### [バージョン] - アイテム N

**原文**: [content の内容]
**before**: [before の内容]
**after**: [after の内容]
**benefit**: [benefit の内容]

**指摘**: [具体的に何が怪しいか]

---

(繰り返し)

## 推奨アクション

プロンプト調整後、以下で再推論を実行してください:
`bun run infer <version>`
```

## 重要な制約

- Issue 本文は **日本語** で記載する
- **問題がない場合は Issue を作成しない**(正常時は何もしない)
- 自動修正は行わない。報告のみ
- セキュリティに関わる情報はIssueに含めない
