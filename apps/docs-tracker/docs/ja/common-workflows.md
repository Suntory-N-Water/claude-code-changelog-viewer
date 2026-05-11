---
title: common-workflows
source: https://code.claude.com/docs/ja/common-workflows.md
---

# 一般的なワークフロー

> Claude Code を使用してコードベースの探索、バグ修正、リファクタリング、テスト、その他の日常的なタスクを実行するためのステップバイステップガイド。

このページでは、日常的な開発のための短いレシピを集めています。プロンプティングとコンテキスト管理に関する高度なガイダンスについては、[ベストプラクティス](/ja/best-practices)を参照してください。

このページでは以下をカバーしています：

- [プロンプトレシピ](#prompt-recipes)：コード探索、バグ修正、リファクタリング、テスト、PR、ドキュメント用
- [以前の会話を再開する](#resume-previous-conversations)：タスクを複数回に分けて実行できるようにする
- [worktree を使用して並列セッションを実行する](#run-parallel-sessions-with-worktrees)：同時編集が衝突しないようにする
- [編集前に計画する](#plan-before-editing)：ディスクに変更を加える前に確認する
- [研究を subagent に委譲する](#delegate-research-to-subagents)：メインコンテキストをクリーンに保つ
- [Claude をスクリプトにパイプする](#pipe-claude-into-scripts)：CI とバッチ処理用

## プロンプトレシピ

これらは、未知のコード探索、デバッグ、リファクタリング、テスト作成、PR 作成などの日常的なタスク用のプロンプトパターンです。各パターンは任意の Claude Code サーフェスで機能します。プロジェクトに合わせて表現を調整してください。

### 新しいコードベースを理解する

#### コードベースの概要を素早く把握する

新しいプロジェクトに参加したばかりで、その構造を素早く理解する必要があるとします。

```bash theme={null}
cd /path/to/project 
```

```bash theme={null}
claude 
```

```text theme={null}
give me an overview of this codebase
```

```text theme={null}
explain the main architecture patterns used here
```

```text theme={null}
what are the key data models?
```

```text theme={null}
how is authentication handled?
```

ヒント：

- 広い質問から始めて、特定の領域に絞り込んでいく
- プロジェクトで使用されているコーディング規約とパターンについて質問する
- プロジェクト固有の用語の用語集をリクエストする

#### 関連するコードを見つける

特定の機能または機能に関連するコードを見つける必要があるとします。

```text theme={null}
find the files that handle user authentication
```

```text theme={null}
how do these authentication files work together?
```

```text theme={null}
trace the login process from front-end to database
```

ヒント：

- 探しているものについて具体的に説明する
- プロジェクトのドメイン言語を使用する
- 言語の[コード インテリジェンス プラグイン](/ja/discover-plugins#code-intelligence)をインストールして、Claude に正確な'定義に移動'と'参照を検索'のナビゲーションを提供する

***

### バグを効率的に修正する

エラーメッセージが表示され、そのソースを見つけて修正する必要があるとします。

```text theme={null}
I'm seeing an error when I run npm test
```

```text theme={null}
suggest a few ways to fix the @ts-ignore in user.ts
```

```text theme={null}
update user.ts to add the null check you suggested
```

ヒント：

- Claude に問題を再現するコマンドとスタックトレースを伝える
- エラーを再現するための手順を記載する
- エラーが断続的か一貫しているかを Claude に知らせる

***

### コードをリファクタリングする

古いコードを最新のパターンとプラクティスを使用するように更新する必要があるとします。

```text theme={null}
find deprecated API usage in our codebase
```

```text theme={null}
suggest how to refactor utils.js to use modern JavaScript features
```

```text theme={null}
refactor utils.js to use ES2024 features while maintaining the same behavior
```

```text theme={null}
run tests for the refactored code
```

ヒント：

- Claude に最新のアプローチの利点を説明するよう依頼する
- 必要に応じて変更が後方互換性を維持することをリクエストする
- リファクタリングを小さくテスト可能な増分で実行する

***

### テストを使用する

カバーされていないコードのテストを追加する必要があるとします。

```text theme={null}
find functions in NotificationsService.swift that are not covered by tests
```

```text theme={null}
add tests for the notification service
```

```text theme={null}
add test cases for edge conditions in the notification service
```

```text theme={null}
run the new tests and fix any failures
```

Claude は、プロジェクトの既存のパターンと規約に従うテストを生成できます。テストをリクエストするときは、検証したい動作について具体的に説明してください。Claude は既存のテストファイルを調べて、既に使用されているスタイル、フレームワーク、アサーションパターンに一致させます。

包括的なカバレッジのために、Claude に見落とした可能性のあるエッジケースを特定するよう依頼してください。Claude はコードパスを分析し、エラー条件、境界値、見落としやすい予期しない入力のテストを提案できます。

***

### プルリクエストを作成する

Claude に直接プルリクエストを作成するよう依頼するか（「create a pr for my changes」）、ステップバイステップで Claude をガイドできます：

```text theme={null}
summarize the changes I've made to the authentication module
```

```text theme={null}
create a pr
```

```text theme={null}
enhance the PR description with more context about the security improvements
```

`gh pr create` を使用して PR を作成すると、セッションはその PR に自動的にリンクされます。後で `claude --from-pr <number>` で再開するか、[`/resume` ピッカー](/ja/sessions#use-the-session-picker)の検索に PR URL を貼り付けることで再開できます。

Claude が生成した PR を送信する前にレビューし、Claude に潜在的なリスクや考慮事項を強調するよう依頼してください。

### ドキュメントを処理する

コードのドキュメントを追加または更新する必要があるとします。

```text theme={null}
find functions without proper JSDoc comments in the auth module
```

```text theme={null}
add JSDoc comments to the undocumented functions in auth.js
```

```text theme={null}
improve the generated documentation with more context and examples
```

```text theme={null}
check if the documentation follows our project standards
```

ヒント：

- 必要なドキュメントスタイル（JSDoc、docstring など）を指定する
- ドキュメント内の例をリクエストする
- パブリック API、インターフェース、複雑なロジックのドキュメントをリクエストする

***

### ノートと非コードフォルダで作業する

Claude Code はどのディレクトリでも機能します。ノートボルト、ドキュメントフォルダ、またはマークダウンファイルの任意のコレクション内で実行して、コードと同じ方法でコンテンツを検索、編集、再編成します。

`.claude/` ディレクトリと `CLAUDE.md` は他のツールの設定ディレクトリと並んで競合なく存在します。Claude は各ツール呼び出しで新しくファイルを読み込むため、別のアプリケーションで行った編集は次回そのファイルを読み込むときに表示されます。

***

### 画像を使用する

コードベース内の画像を使用する必要があり、Claude の画像コンテンツ分析を支援したいとします。

次のいずれかの方法を使用できます：

1. Claude Code ウィンドウに画像をドラッグアンドドロップする
2. 画像をコピーして、CLI に ctrl+v で貼り付ける（cmd+v は使用しないでください）
3. Claude に画像パスを提供する。例：「Analyze this image: /path/to/your/image.png」

```text theme={null}
What does this image show?
```

```text theme={null}
Describe the UI elements in this screenshot
```

```text theme={null}
Are there any problematic elements in this diagram?
```

```text theme={null}
Here's a screenshot of the error. What's causing it?
```

```text theme={null}
This is our current database schema. How should we modify it for the new feature?
```

```text theme={null}
Generate CSS to match this design mockup
```

```text theme={null}
What HTML structure would recreate this component?
```

ヒント：

- テキスト説明が不明確または面倒な場合は画像を使用する
- より良いコンテキストのために、エラー、UI デザイン、図のスクリーンショットを含める
- 会話で複数の画像を使用できます
- 画像分析は図、スクリーンショット、モックアップなどで機能します
- Claude が画像を参照する場合（例：`[Image #1]`）、`Cmd+Click`（Mac）または `Ctrl+Click`（Windows/Linux）リンクをクリックして、デフォルトビューアで画像を開きます

***

### ファイルとディレクトリを参照する

@ を使用して、Claude に読み込まれるのを待たずにファイルまたはディレクトリをすばやく含めます。

```text theme={null}
Explain the logic in @src/utils/auth.js
```

これにより、ファイルの完全な内容が会話に含まれます。

```text theme={null}
What's the structure of @src/components?
```

これにより、ファイル情報を含むディレクトリリストが提供されます。

```text theme={null}
Show me the data from @github:repos/owner/repo/issues
```

これにより、@server:resource 形式を使用して接続された MCP サーバーからデータを取得します。詳細については、[MCP リソース](/ja/mcp#use-mcp-resources)を参照してください。

ヒント：

- ファイルパスは相対パスまたは絶対パスにできます
- @ ファイル参照は、ファイルのディレクトリと親ディレクトリに `CLAUDE.md` を追加してコンテキストに含めます
- ディレクトリ参照はコンテンツではなくファイルリストを表示します
- 単一のメッセージで複数のファイルを参照できます（例：「@file1.js and @file2.js」）

***

### スケジュールで Claude を実行する

Claude に長時間実行されるタスクを自動的に定期的に処理させたいとします。例えば、毎朝オープン PR をレビューしたり、毎週依存関係を監査したり、夜間に CI の失敗をチェックしたりします。

実行場所に基づいてスケジューリングオプションを選択します：

| オプション | 実行場所 | 最適な用途 |
| :- | :- | :- |
| [ルーチン](/ja/routines) | Anthropic 管理インフラストラクチャ | コンピュータがオフの場合でも実行する必要があるタスク。[claude.ai/code/routines](https://claude.ai/code/routines)で設定します。API 呼び出しまたは GitHub イベントに加えてスケジュールでトリガーすることもできます。 |
| [デスクトップスケジュール済みタスク](/ja/desktop-scheduled-tasks) | デスクトップアプリ経由のマシン | ローカルファイル、ツール、またはコミットされていない変更への直接アクセスが必要なタスク。 |
| [GitHub Actions](/ja/github-actions) | CI パイプライン | オープン PR などのリポジトリイベント、またはワークフロー設定と一緒に存在する必要がある cron スケジュールに関連するタスク。 |
| [`/loop`](/ja/scheduled-tasks) | 現在の CLI セッション | セッションが開いている間のクイックポーリング。タスクは新しい会話を開始すると停止します。`--resume` と `--continue` は期限切れでないものを復元します。 |

スケジュール済みタスク用のプロンプトを作成するときは、成功がどのように見えるか、および結果をどうするかについて明示的に説明してください。タスクは自律的に実行されるため、質問を明確にすることはできません。例えば：「`needs-review` ラベルが付いたオープン PR をレビューし、問題に関するインラインコメントを残し、`#eng-reviews` Slack チャネルに要約を投稿します。」

***

### Claude にその機能について質問する

Claude は自分のドキュメントへの組み込みアクセスを持っており、自分の機能と制限について質問に答えることができます。

#### 質問例

```text
can Claude Code create pull requests?
```

```text
how does Claude Code handle permissions?
```

```text
what skills are available?
```

```text
how do I use MCP with Claude Code?
```

```text
how do I configure Claude Code for Amazon Bedrock?
```

```text
what are the limitations of Claude Code?
```

Claude はこれらの質問に対してドキュメントベースの回答を提供します。実行可能な例と実践的なデモンストレーションについては、`/powerup` を実行してアニメーション化されたデモを含むインタラクティブレッスンを受けるか、上記の特定のワークフローセクションを参照してください。

ヒント：

- Claude は使用しているバージョンに関係なく、常に最新の Claude Code ドキュメントにアクセスできます
- 詳細な回答を得るために具体的な質問をする
- Claude は MCP 統合、エンタープライズ設定、高度なワークフローなどの複雑な機能を説明できます

***

## 以前の会話を再開する

タスクが複数回に分けて実行される場合は、コンテキストを再度説明するのではなく、中断したところから再開してください。Claude Code はすべての会話をローカルに保存します。

```bash
claude --continue
```

これにより、現在のディレクトリで最新のセッションが再開されます。まだセッションがない場合は、`No conversation found to continue` と出力して終了します。`claude --resume` を使用してリストから選択するか、実行中のセッション内から `/resume` を使用してください。[セッションを管理する](/ja/sessions)を参照して、名前付け、ブランチ、および完全なピッカーリファレンスを確認してください。

## worktree を使用して並列セッションを実行する

1 つのターミナルで機能に取り組みながら、別のターミナルで Claude がバグを修正するようにします。編集が衝突しないようにしてください。各 worktree は独自のブランチ上の個別のチェックアウトです。

```bash
claude --worktree feature-auth
```

別の名前で 2 番目のターミナルで同じコマンドを実行して、分離された並列セッションを開始します。[Worktrees](/ja/worktrees)を参照して、クリーンアップ、`.worktreeinclude`、および非 git VCS サポートを確認してください。1 つの画面から並列セッションを監視するには、[バックグラウンドエージェント](/ja/agent-view)を参照してください。

## 編集前に計画する

ディスクに変更を加える前に確認したい変更については、計画モードに切り替えてください。Claude はファイルを読み込んで計画を提案しますが、承認されるまで編集は行いません。

```bash
claude --permission-mode plan
```

セッション中に `Shift+Tab` を押して計画モードに切り替えることもできます。[計画モード](/ja/permission-modes#analyze-before-you-edit-with-plan-mode)を参照して、承認フローとテキストエディタで計画を編集することを確認してください。

## 研究を subagent に委譲する

大規模なコードベースの探索はコンテキストをファイル読み込みで満たします。探索を委譲して、結果のみが戻るようにしてください。

```text
use a subagent to investigate how our auth system handles token refresh
```

subagent は独自のコンテキストウィンドウでファイルを読み込み、要約を報告します。[Subagents](/ja/sub-agents)を参照して、独自のツールとプロンプトを持つカスタムエージェントを定義することを確認してください。

## Claude をスクリプトにパイプする

CI、プリコミットフック、またはバッチ処理用に Claude を非対話的に実行します。stdin と stdout は任意の Unix ツールのように機能します。

```bash
git log --oneline -20 | claude -p "summarize these recent commits"
```

[非対話モード](/ja/headless)を参照して、出力形式、許可フラグ、およびファンアウトパターンを確認してください。

## 次のステップ

Claude Code から最大限の価値を得るためのパターン

会話を再開、名前付け、ブランチする

分離された並列セッションを実行する

skill、フック、MCP、subagent、プラグインを追加する
