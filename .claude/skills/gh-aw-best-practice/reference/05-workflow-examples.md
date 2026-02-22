# GH-AW ワークフロー実践例

> Source: https://github.github.com/gh-aw/blog/
> Source: https://github.github.com/gh-aw/examples/

## 1. Issue自動トリアージ (IssueOps)

```markdown
---
timeout-minutes: 5

on:
  issues:
    types: [opened, reopened]

permissions:
  issues: read

tools:
  github:
    toolsets: [issues, labels]

safe-outputs:
  add-labels:
    allowed: [bug, feature, enhancement, documentation, question, help-wanted, good-first-issue]
  add-comment: {}
---

# Issue Triage Agent

List open issues in ${{ github.repository }} that have no labels. For each
unlabeled issue, analyze the title and body, then add one of the allowed
labels: `bug`, `feature`, `enhancement`, `documentation`, `question`,
`help-wanted`, or `good-first-issue`.

Skip issues that:
- Already have any of these labels
- Have been assigned to any user (especially non-bot users)

Do research on the issue in the context of the codebase and, after
adding the label to an issue, mention the issue author in a comment, explain
why the label was added and give a brief summary of how the issue may be
addressed.
```

---

## 2. ラベル駆動リアクション (LabelOps)

```markdown
---
on:
  issues:
    types: [labeled]
    names: [bug, critical, security]

permissions:
  contents: read
  actions: read

safe-outputs:
  add-comment:
    max: 1
---

# Critical Issue Handler

When a critical label is added to an issue, analyze the severity and provide
immediate triage guidance.

Check the issue for:
- Impact scope and affected users
- Reproduction steps
- Related dependencies or systems
- Recommended priority level

Respond with a comment outlining next steps and recommended actions.
```

---

## 3. 日次レポート (DailyOps)

```markdown
---
on:
  schedule: daily

permissions:
  contents: read
  issues: read
  pull-requests: read

safe-outputs:
  create-issue:
    title-prefix: "[repo status] "
    labels: [report]

tools:
  github:
---

# Daily Repo Status Report

Create a daily status report for maintainers.

Include:
- Recent repository activity (issues, PRs, discussions, releases, code changes)
- Progress tracking, goal reminders and highlights
- Project status and recommendations
- Actionable next steps for maintainers

Keep it concise and link to the relevant issues/PRs.
```

---

## 4. 週次クロスリポジトリレポート (MultiRepoOps + DataOps)

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
Summarize issues from all component repositories including open counts by
priority, issues opened/closed this week, stale issues (>30 days), and
blockers. Create discussion with executive summary, per-repo breakdown,
trending analysis, and action items formatted as markdown table.
```

---

## 5. PRコードレビュー (ChatOps)

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
analysis of the changes.

Examine the diff for potential bugs, security vulnerabilities, performance
implications, code style issues, and missing tests or documentation.

Create specific review comments on relevant lines of code and add a summary
comment with overall observations and recommendations.
```

---

## 6. データ駆動レポート (DataOps)

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
      gh pr list \
        --repo "${{ github.repository }}" \
        --state all --limit 100 \
        --json number,title,state,author,createdAt,mergedAt,additions,deletions \
        > /tmp/gh-aw/pr-data/recent-prs.json

  - name: Compute summary statistics
    run: |
      cd /tmp/gh-aw/pr-data
      jq '{
        total: length,
        merged: [.[] | select(.state == "MERGED")] | length,
        open: [.[] | select(.state == "OPEN")] | length,
        authors: [.[].author.login] | unique | length
      }' recent-prs.json > stats.json

timeout-minutes: 10
---

# Weekly Pull Request Summary

Analyze the data at `/tmp/gh-aw/pr-data/recent-prs.json` and generate
a summary discussion.
```

---

## 7. プロジェクト連携トリアージ (ProjectOps)

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

When a new issue is created, analyze it and add to the appropriate project
board.

Examine the issue title and description to determine its type:
- Bug reports -> Add to "Bug Triage" project, status: "Needs Triage"
- Feature requests -> Add to "Feature Roadmap" project, status: "Proposed"
- Documentation issues -> Add to "Docs Improvements" project, status: "Todo"
- Performance issues -> Add to "Performance Optimization" project

After adding to project board, comment on the issue confirming where it was
added.
```

---

## 公式ワークフローの取得方法

公式ドキュメントで完全例が掲載されていないワークフローは `gh aw add-wizard` で取得可能:

```bash
# ドキュメント自動更新
gh aw add-wizard githubnext/agentics/daily-doc-updater

# CI失敗分析・修正
gh aw add-wizard githubnext/agentics/ci-doctor

# コード簡素化
gh aw add-wizard githubnext/agentics/code-simplifier

# テスト改善
gh aw add-wizard githubnext/agentics/daily-test-improver

# 重複コード検出
gh aw add-wizard githubnext/agentics/duplicate-code-detector
```
