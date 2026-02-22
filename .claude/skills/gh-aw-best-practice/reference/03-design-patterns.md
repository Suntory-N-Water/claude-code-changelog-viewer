# GH-AW デザインパターン

> Source: https://github.github.com/gh-aw/patterns/

## パターン一覧

| パターン      | トリガー                 | 主なsafe-outputs                           | 用途                           |
| ------------- | ------------------------ | ------------------------------------------ | ------------------------------ |
| ChatOps       | `slash_command`          | `add-comment`                              | コメントからのオンデマンド操作 |
| DailyOps      | `schedule`               | `create-discussion`, `create-pull-request` | 毎日の漸進的改善               |
| DataOps       | `schedule`               | `create-discussion`                        | データ収集・分析・レポート     |
| IssueOps      | `issues: [opened]`       | `add-comment`, `add-labels`                | Issue駆動の自動トリアージ      |
| ProjectOps    | `issues: [opened]`       | `update-project`                           | GitHub Projects自動管理        |
| MultiRepoOps  | イベント + `target-repo` | `create-issue` (target-repo)               | 複数リポジトリ横断             |
| Orchestration | 任意                     | `dispatch-workflow`                        | 複数ワーカーへのファンアウト   |
| LabelOps      | `issues: [labeled]`      | `add-comment`                              | ラベル付与時のリアクション     |
| DispatchOps   | `workflow_dispatch`      | 任意                                       | 手動トリガー                   |
| TrialOps      | -                        | -                                          | 隔離リポジトリでテスト         |

---

## ChatOps

Issueコメントで `/command` を入力してワークフローをトリガー。

```markdown
---
on:
  slash_command:
    name: review
    events: [pull_request_comment]

permissions:
  contents: read
  pull-requests: read

safe-outputs:
  create-pull-request-review-comment:
    max: 5
  add-comment:
---

# Code Review Assistant

When someone types /review in a pull request comment, perform a thorough
analysis of the changes. Examine the diff for potential bugs, security
vulnerabilities, performance implications, and missing tests.
```

---

## DailyOps

毎日スケジュール実行で漸進的な改善を行う。Research → Configuration → Execution の3フェーズ。

```markdown
---
on:
  schedule:
    - cron: "0 2 * * 1-5"
  workflow_dispatch:

safe-outputs:
  create-discussion:
    title-prefix: "${{ github.workflow }}"
    category: "ideas"

tools:
  cache-memory: true
---

# Daily Code Improvement

Analyze the codebase and identify one small improvement.
Use cache-memory to track what has already been addressed.
```

`cache-memory: true` でラン間の状態を `/tmp/gh-aw/cache-memory/` に保持可能。

---

## DataOps

関心の分離が核心。`steps:` で決定論的なデータ抽出、Markdown本文でAIによる分析。

```markdown
---
name: Weekly PR Summary
on:
  schedule: weekly
  workflow_dispatch:

permissions:
  contents: read
  pull-requests: read

engine: copilot
strict: true

network:
  allowed:
    - defaults
    - github

safe-outputs:
  create-discussion:
    title-prefix: "[weekly-summary] "
    category: "announcements"
    max: 1
    close-older-discussions: true

tools:
  bash: ["*"]

steps:
  - name: Fetch recent pull requests
    env:
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    run: |
      mkdir -p /tmp/gh-aw/pr-data
      gh pr list --repo "${{ github.repository }}" --state all --limit 100 \
        --json number,title,state,author,createdAt,mergedAt,additions,deletions \
        > /tmp/gh-aw/pr-data/recent-prs.json
---

# Weekly Pull Request Summary

Analyze the data at `/tmp/gh-aw/pr-data/recent-prs.json` and generate
a summary discussion.
```

---

## IssueOps

新規Issueをトリガーに自動トリアージ。

```markdown
---
on:
  issues:
    types: [opened]

permissions:
  contents: read
  actions: read

safe-outputs:
  add-labels:
    allowed: [bug, needs-info, enhancement, question, documentation]
    max: 2
  add-comment:
    max: 1
---

# Bug Report Triage

Analyze new issues and add appropriate labels.
Maximum 2 labels from the allowed list.
```

---

## ProjectOps

GitHub Projects V2との連携。専用PATが必要。

```markdown
---
on:
  issues:
    types: [opened]

permissions:
  contents: read
  actions: read

tools:
  github:
    toolsets: [default, projects]
    github-token: ${{ secrets.GH_AW_PROJECT_GITHUB_TOKEN }}

safe-outputs:
  update-project:
    max: 1
    github-token: ${{ secrets.GH_AW_PROJECT_GITHUB_TOKEN }}
  add-comment:
    max: 1
---

# Smart Issue Triage with Project Tracking

When a new issue is created, analyze it and add to the appropriate
project board based on type (bug/feature/docs/performance).
```

注意: `GH_AW_PROJECT_GITHUB_TOKEN` に Projects権限付きPATが必要。

---

## MultiRepoOps

`target-repo` でクロスリポジトリ操作。専用PATが必要。

```markdown
---
on:
  issues:
    types: [opened, labeled]

permissions:
  contents: read
  actions: read

safe-outputs:
  github-token: ${{ secrets.CROSS_REPO_PAT }}
  create-issue:
    target-repo: "org/tracking-repo"
    title-prefix: "[component-a] "
    labels: [tracking, multi-repo]
---

# Cross-Repo Issue Tracker

When issues are created in component repositories, automatically create
tracking issues in the central coordination repo.
```

クロスリポジトリ対応の safe-outputs: `create-issue`, `add-comment`, `update-issue`, `add-labels`, `create-pull-request`, `create-discussion`

---

## Orchestration

1つのオーケストレーターが複数ワーカーにファンアウト。

```markdown
---
safe-outputs:
  dispatch-workflow:
    workflows: [repo-triage-worker, dependency-audit-worker]
    max: 10
---

# Multi-Agent Orchestrator

Analyze the repository and identify work items.
For each item, dispatch the appropriate worker workflow.
```

`gh aw compile` がターゲットワークフローの存在と `workflow_dispatch` 対応を検証する。

---

## Weekly Cross-Repo Report (完全例)

```markdown
---
on: weekly on monday

permissions:
  contents: read

tools:
  github:
    toolsets: [issues]

safe-outputs:
  github-token: ${{ secrets.CROSS_REPO_PAT }}
  create-discussion:
    target-repo: "myorg/central-tracker"
    category: "Status Reports"
    title-prefix: "[weekly] "
---

# Weekly Cross-Repo Issue Summary

Generate weekly summary of tracked issues across all component repositories.
Summarize open counts by priority, issues opened/closed this week,
stale issues (>30 days), and blockers.
```
