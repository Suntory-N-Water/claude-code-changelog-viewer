# GH-AW フロントマター完全仕様

> Source: https://github.github.com/gh-aw/reference/frontmatter/index
> Source: https://github.github.com/gh-aw/reference/frontmatter-full/index

## 構造

ワークフローは `.github/workflows/<name>.md` に配置する。フロントマター(YAML) + Markdown本文の2部構成。

```markdown
---
# YAML フロントマター (設定)
---

# Markdown 本文 (AIへの指示)
```

---

## on: (トリガー)

### イベント一覧

| イベント                      | 説明                              |
| ----------------------------- | --------------------------------- |
| `issues`                      | Issue の作成・更新時              |
| `issue_comment`               | Issue コメント作成時              |
| `pull_request`                | PR の作成・更新・クローズ時       |
| `pull_request_review`         | PR レビュー投稿時                 |
| `pull_request_review_comment` | PR レビューコメント時             |
| `discussion`                  | Discussion 作成・更新時           |
| `discussion_comment`          | Discussion コメント時             |
| `push`                        | コードプッシュ時                  |
| `schedule`                    | スケジュール実行                  |
| `workflow_dispatch`           | 手動実行                          |
| `workflow_call`               | 他ワークフローからの呼び出し      |
| `workflow_run`                | ワークフロー実行後                |
| `release`                     | リリースイベント時                |
| `slash_command`               | `/コマンド` でのトリガー (AW固有) |

### schedule ショートハンド

```yaml
schedule: "daily"
schedule: "daily around 14:00"
schedule: "daily between 9:00 and 17:00"
schedule: "weekly on monday"
schedule: "hourly"
schedule: "every 2h"
schedule: "every 10 minutes"
schedule: "0 9 * * 1"  # 標準cron形式
```

### slash_command (AW固有)

```yaml
on:
  slash_command:
    name: "analyze"
    events: [issues, pull_request]
```

### アクセス制御オプション (AW固有)

```yaml
on:
  issues:
    types: [opened]
  roles: [admin, maintainer, write]     # トリガー可能なロール
  bots: ["dependabot[bot]"]             # 許可するボット
  skip-bots: [github-actions, copilot]  # スキップするボット
  stop-after: "2026-06-01"              # 自動停止日時
  reaction: "eyes"                      # 起動時リアクション
  status-comment: true                  # 開始/完了コメント
```

### workflow_dispatch (手動実行)

```yaml
on:
  workflow_dispatch:
    inputs:
      topic:
        description: 'Research topic'
        required: true
        type: string
      depth:
        type: choice
        options: [brief, detailed]
        default: brief
```

本文で `${{ github.event.inputs.topic }}` として参照可能。

---

## permissions:

デフォルトは読み取り専用。書き込みは `safe-outputs` 経由が推奨。

| スコープ          | 説明                   |
| ----------------- | ---------------------- |
| `actions`         | GitHub Actions         |
| `contents`        | リポジトリコンテンツ   |
| `discussions`     | ディスカッション       |
| `issues`          | Issue                  |
| `pull-requests`   | PR                     |
| `checks`          | チェックラン           |
| `packages`        | GitHub Packages        |
| `security-events` | コードスキャンアラート |

値: `read`, `write`, `none`

```yaml
permissions:
  contents: read
  issues: read
  pull-requests: read
```

---

## safe-outputs:

エージェントが書き込み権限なしでGitHub操作を宣言する仕組み。別ジョブが実際の書き込みを行う。

### Issues & Discussions

| タイプ              | 説明           | デフォルトmax |
| ------------------- | -------------- | ------------- |
| `create-issue`      | Issue作成      | 1             |
| `update-issue`      | Issue更新      | 1             |
| `close-issue`       | Issueクローズ  | 1             |
| `create-discussion` | Discussion作成 | 1             |

### Pull Requests

| タイプ                        | 説明                   | デフォルトmax |
| ----------------------------- | ---------------------- | ------------- |
| `create-pull-request`         | PR作成(コード変更含む) | 1             |
| `update-pull-request`         | PRタイトル・本文更新   | 1             |
| `close-pull-request`          | PRクローズ             | 10            |
| `push-to-pull-request-branch` | PRブランチへプッシュ   | 1             |

### Labels, Comments & Assignments

| タイプ           | 説明             | デフォルトmax |
| ---------------- | ---------------- | ------------- |
| `add-comment`    | コメント投稿     | 1             |
| `add-labels`     | ラベル付与       | 3             |
| `remove-labels`  | ラベル削除       | 3             |
| `add-reviewer`   | レビュアー追加   | 3             |
| `assign-to-user` | ユーザー割り当て | 1             |

### Projects & Releases

| タイプ           | 説明                   | デフォルトmax |
| ---------------- | ---------------------- | ------------- |
| `create-project` | Projects V2ボード作成  | 1             |
| `update-project` | Projectsフィールド更新 | 10            |
| `update-release` | リリース説明更新       | 1             |
| `upload-asset`   | ファイルアップロード   | 10            |

### Orchestration

| タイプ                 | 説明                     | デフォルトmax |
| ---------------------- | ------------------------ | ------------- |
| `dispatch-workflow`    | 他ワークフローのトリガー | 3             |
| `create-agent-session` | Copilotセッション作成    | 1             |

### オプション

```yaml
safe-outputs:
  footer: false                   # フッター非表示
  create-issue:
    title-prefix: "[ai] "
    labels: [automation]
    assignees: [user1]
    max: 5
    expires: 7                    # 7日後自動クローズ
    close-older-issues: true
    target-repo: "owner/repo"     # クロスリポジトリ
    github-token: ${{ secrets.CUSTOM_TOKEN }}
  add-labels:
    allowed: [bug, feature, docs] # 許可ラベルを制限
```

---

## tools:

```yaml
tools:
  github:                              # GitHub MCP (デフォルト)
    toolsets: [issues, pull_requests, projects]
    read-only: true
    lockdown: true
  bash: ["gh issue list", "gh pr view"]  # 許可コマンドを制限
  bash: null                             # 全コマンド許可
  edit: null                             # ファイル編集
  web-fetch: null                        # Webフェッチ
  web-search: null                       # Web検索
  playwright: null                       # ブラウザ自動化
  cache-memory: true                     # ラン間のキャッシュ
  serena: null                           # コードインテリジェンス
  agentic-workflows: true                # AW分析ツール
```

---

## engine:

```yaml
engine: copilot           # GitHub Copilot CLI (デフォルト)
engine: claude             # Claude Code
engine: codex              # OpenAI Codex CLI

# 詳細形式
engine:
  id: claude
  model: "claude-opus-4-6"
  max-turns: 30
```

---

## network:

```yaml
network:
  allowed:
    - defaults        # 基本インフラ
    - python           # pip/PyPI
    - node             # npm/yarn
    - go               # Go modules
    - github           # GitHubドメイン
    - "api.example.com"  # 特定ドメイン
  blocked:
    - "tracker.example.com"
```

---

## strict:

デフォルト `true`。write権限禁止、network明示必須、SHAピン留め強制。

```yaml
strict: true   # 有効 (デフォルト)
strict: false  # 開発・テスト用
```

---

## その他のキー

```yaml
name: "My Workflow"
description: "ワークフローの説明"
runs-on: ubuntu-latest
timeout-minutes: 20

# エージェント実行前のカスタムステップ
steps:
  - name: Install deps
    run: npm ci

# エージェント実行後のカスタムステップ
post-steps:
  - name: Upload
    uses: actions/upload-artifact@v4

# シークレット
secrets:
  API_TOKEN: ${{ secrets.API_TOKEN }}

# 共有ワークフローのインポート
imports:
  - "githubnext/agentics/workflows/shared/common.md@v1.0.0"

# サンドボックス
sandbox: "awf"  # Agent Workflow Firewall (デフォルト)

# 脅威検出
threat-detection:
  enabled: true
```
