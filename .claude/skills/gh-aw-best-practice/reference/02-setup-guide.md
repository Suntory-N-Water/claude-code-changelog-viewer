# GH-AW セットアップ・運用ガイド

> Source: https://github.github.com/gh-aw/setup/quick-start/index
> Source: https://github.github.com/gh-aw/setup/cli/index

## 前提条件

- GitHub CLI (`gh`) v2.0.0 以上
- GitHub Actions が有効なリポジトリ
- AI エンジン: Copilot / Claude / Codex のいずれか

---

## Step 1 - CLIインストール

```bash
gh extension install github/gh-aw
gh aw version
```

## Step 2 - リポジトリ初期化

```bash
gh aw init              # 対話型 (エンジン選択・シークレット設定)
gh aw init --no-mcp     # MCP統合をスキップ
gh aw init --push       # 初期化後に自動コミット・プッシュ
```

## Step 3 - ワークフロー作成

### 方法A: ウィザード (最も簡単)

```bash
gh aw add-wizard githubnext/agentics/daily-repo-status
```

### 方法B: 既存ワークフローを追加

```bash
gh aw add githubnext/agentics/ci-doctor
gh aw add "githubnext/agentics/ci-*"               # ワイルドカード
gh aw add ci-doctor --create-pull-request           # PR経由で追加
```

### 方法C: 新規テンプレート

```bash
gh aw new my-workflow
```

### 方法D: 手動作成

`.github/workflows/<name>.md` を直接作成する。

### 方法E: コーディングエージェント経由

```
Create a workflow for GitHub Agentic Workflows using
https://raw.githubusercontent.com/github/gh-aw/main/create.md

The purpose of the workflow is ...
```

## Step 4 - シークレット設定

| エンジン | シークレット名                            |
| -------- | ----------------------------------------- |
| Copilot  | `COPILOT_GITHUB_TOKEN` (fine-grained PAT) |
| Claude   | `ANTHROPIC_API_KEY`                       |
| Codex    | `OPENAI_API_KEY`                          |

```bash
gh aw secrets set ANTHROPIC_API_KEY --value "YOUR_KEY"
gh aw secrets bootstrap           # 不足シークレットを一括確認・設定
```

追加トークン:
- `GH_AW_GITHUB_TOKEN` - クロスリポジトリ・ロックダウンモード
- `GH_AW_PROJECT_GITHUB_TOKEN` - GitHub Projects V2操作

## Step 5 - コンパイル (ロックファイル生成)

```bash
gh aw compile                          # 全ワークフロー
gh aw compile my-workflow              # 特定ワークフロー
gh aw compile --watch                  # ファイル変更時に自動再コンパイル
gh aw compile --validate --strict      # 検証 + ストリクトモード
gh aw compile --fix                    # 非推奨フィールドを自動修正
gh aw compile --zizmor                 # セキュリティスキャン
```

重要: **Markdown本文の変更はコンパイル不要**。フロントマター変更時のみ再コンパイルが必要。

```bash
git add .github/workflows/my-workflow.md .github/workflows/my-workflow.lock.yml
git commit -m "Add my-workflow"
git push
```

## Step 6 - 実行

```bash
gh aw run my-workflow                  # 実行
gh aw run my-workflow --push           # プッシュ後に実行
gh aw run workflow1 workflow2          # 複数同時実行
```

GitHub Actions UIからも手動実行可能 (Actions > ワークフロー選択 > Run workflow)。

## Step 7 - 検証・監視

```bash
gh aw list                  # ワークフロー一覧
gh aw status                # 状態確認
gh aw health                # 過去7日間のヘルスメトリクス
gh aw logs                  # ログ確認
gh aw audit <run-id>        # トークン使用量・コスト確認
gh aw fix                   # 非推奨フィールドの確認
gh aw fix --write           # 非推奨フィールドの自動修正
```

---

## 推奨フロー (まとめ)

```bash
gh extension install github/gh-aw
gh aw init
gh aw add-wizard githubnext/agentics/daily-repo-status
# または: gh aw new my-workflow → 編集 → gh aw compile
gh aw secrets bootstrap
gh aw run my-workflow
gh aw status
```
