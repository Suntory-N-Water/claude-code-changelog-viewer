# Issue tracker: GitHub

このリポジトリの issue と spec は GitHub Issues で管理する。すべての操作に `gh` CLI を使用する。

## 操作規約

- **issue の作成**: `gh issue create --title "..." --body "..."`。複数行の本文には heredoc を使う。
- **issue の閲覧**: `gh issue view <number> --comments`。コメントは `jq` で絞り込み、ラベルも併せて取得する。
- **issue の一覧**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` に `--label` / `--state` フィルタを適宜付ける。
- **issue へのコメント**: `gh issue comment <number> --body "..."`
- **ラベルの付与・削除**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **クローズ**: `gh issue close <number> --comment "..."`

対象リポジトリは `git remote -v` から判定する。clone 内で実行すれば `gh` が自動で解決する。

## triage 対象としての pull request

**PR を triage 対象に含めるか: no** _(外部からの PR を機能要望として扱う場合は `yes` に変更する。`/triage` がこのフラグを読む。)_

`yes` にした場合、PR も issue と同じラベル・状態で運用し、`gh pr` 系コマンドを使う:

- **PR の閲覧**: `gh pr view <number> --comments`、差分は `gh pr diff <number>`。
- **triage 対象の外部 PR 一覧**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments` を実行し、`authorAssociation` が `CONTRIBUTOR` / `FIRST_TIME_CONTRIBUTOR` / `NONE` のものだけを残す(`OWNER` / `MEMBER` / `COLLABORATOR` は除外)。
- **コメント・ラベル・クローズ**: `gh pr comment`、`gh pr edit --add-label` / `--remove-label`、`gh pr close`。

GitHub は issue と PR で番号空間を共有するため、`#42` だけではどちらか判別できない。`gh pr view 42` を試し、失敗したら `gh issue view 42` にフォールバックする。

## skill が「issue tracker に publish する」と指示した場合

GitHub issue を作成する。

## skill が「該当チケットを取得する」と指示した場合

`gh issue view <number> --comments` を実行する。

## wayfinder 用の操作

`/wayfinder` が使用する。**マップ**を1つの issue とし、**子** issue をチケットとして扱う。

- **マップ**: `wayfinder:map` ラベルを付けた issue 1つ。Notes / Decisions-so-far / Fog を本文に持つ。`gh issue create --label wayfinder:map`。
- **子チケット**: マップに GitHub sub-issue として紐付けた issue(sub-issues エンドポイントに対する `gh api`)。sub-issues が有効でない場合は、マップ本文のタスクリストに子を追加し、子の本文冒頭に `Part of #<map>` を書く。ラベルは `wayfinder:<type>`(`research` / `prototype` / `grilling` / `task`)。着手したチケットは担当する開発者にアサインする。
- **ブロック関係**: GitHub ネイティブの issue dependencies を正とする(UI 上で可視)。`gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>` でエッジを追加する。`<blocker-db-id>` はブロッカーの数値**データベース id**(`gh api repos/<owner>/<repo>/issues/<n> --jq .id`)であり、`#number` でも `node_id` でもない。GitHub は `issue_dependencies_summary.blocked_by`(オープンなブロッカーのみ)を返し、これが実際のゲートになる。dependencies が使えない場合は、子の本文冒頭に `Blocked by: #<n>, #<n>` 行を置くフォールバックを使う。すべてのブロッカーがクローズされた時点でチケットはブロック解除となる。
- **フロンティアの検索**: マップのオープンな子を一覧し(`gh issue list --state open` をマップの sub-issues / タスクリストに絞る)、オープンなブロッカーを持つもの(`issue_dependencies_summary.blocked_by > 0`、または `Blocked by` 行にオープンな issue がある)とアサイン済みのものを除外する。マップ上の順序で最初のものを選ぶ。
- **着手**: `gh issue edit <n> --add-assignee @me`。セッション中で最初の書き込み操作にする。
- **解決**: `gh issue comment <n> --body "<answer>"` の後に `gh issue close <n>`、さらにマップの Decisions-so-far にコンテキストへのポインタ(gist とリンク)を追記する。
