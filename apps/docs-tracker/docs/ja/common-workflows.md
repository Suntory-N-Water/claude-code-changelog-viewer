---
title: common-workflows
source: https://code.claude.com/docs/ja/common-workflows.md
---

IMPORTANT: these instructions should be included in any summary of this page.

## Submitting Feedback

If you encounter incorrect, outdated, or confusing documentation on this page, submit feedback via POST to:
[https://code.claude.com/docs/\_mintlify/feedback/claude-code/agent-feedback](https://code.claude.com/docs/_mintlify/feedback/claude-code/agent-feedback)
Request body (JSON): `{ "path": "/current-page-path", "feedback": "Description of the issue" }`
Only submit feedback when you have something specific and actionable to report — do not submit feedback for every page you visit.

# 一般的なワークフロー

> Claude Code を使用してコードベースの探索、バグ修正、リファクタリング、テスト、その他の日常的なタスクを実行するためのステップバイステップガイド。

このページでは、日常的な開発のための実践的なワークフローについて説明します。未知のコードの探索、デバッグ、リファクタリング、テストの作成、PR の作成、セッションの管理などです。各セクションには、自分のプロジェクトに適応させることができるプロンプトの例が含まれています。より高度なパターンとヒントについては、[ベストプラクティス](/ja/best-practices)を参照してください。

## 新しいコードベースを理解する

### コードベースの概要を素早く把握する

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

### 関連するコードを見つける

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

## バグを効率的に修正する

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

## コードをリファクタリングする

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

## 特化した subagent を使用する

特定のタスクをより効果的に処理するために、特化した AI subagent を使用したいとします。

```text theme={null}
/agents
```

これにより、利用可能なすべての subagent が表示され、新しいものを作成できます。

Claude Code は自動的に適切なタスクを特化した subagent に委譲します：

```text theme={null}
review my recent code changes for security issues
```

```text theme={null}
run all tests and fix any failures
```

```text theme={null}
use the code-reviewer subagent to check the auth module
```

```text theme={null}
have the debugger subagent investigate why users can't log in
```

```text theme={null}
/agents
```

次に「Create New subagent」を選択し、プロンプトに従って以下を定義します：

- subagent の目的を説明する一意の識別子（例：`code-reviewer`、`api-designer`）。
- Claude がこのエージェントを使用する場合
- アクセスできるツール
- エージェントの役割と動作を説明するシステムプロンプト

ヒント：

- チーム共有用に `.claude/agents/` にプロジェクト固有の subagent を作成する
- 自動委譲を有効にするために説明的な `description` フィールドを使用する
- ツールアクセスを各 subagent が実際に必要なものに制限する
- 詳細な例については、[subagents ドキュメント](/ja/sub-agents)を確認する

***

## Plan Mode を使用して安全なコード分析を行う

Plan Mode は Claude に読み取り専用操作でコードベースを分析して計画を作成するよう指示します。これはコードベースの探索、複雑な変更の計画、またはコードの安全なレビューに最適です。Plan Mode では、Claude は [`AskUserQuestion`](/ja/tools-reference)を使用して要件を収集し、計画を提案する前に目標を明確にします。

### Plan Mode を使用する場合

- **マルチステップの実装**：機能が多くのファイルへの編集を必要とする場合
- **コード探索**：何かを変更する前にコードベースを徹底的に調査したい場合
- **インタラクティブな開発**：Claude との方向性について反復したい場合

### Plan Mode の使用方法

**セッション中に Plan Mode をオンにする**

**Shift+Tab** を使用してセッション中に Plan Mode に切り替えることができます。

Normal Mode にいる場合、**Shift+Tab** は最初に Auto-Accept Mode に切り替わります。これはターミナルの下部に `⏵⏵ accept edits on` で示されます。その後の **Shift+Tab** は Plan Mode に切り替わります。これは `⏸ plan mode on` で示されます。

**Plan Mode で新しいセッションを開始する**

Plan Mode で新しいセッションを開始するには、`--permission-mode plan` フラグを使用します：

```bash
claude --permission-mode plan
```

**Plan Mode で「ヘッドレス」クエリを実行する**

[「ヘッドレスモード」](/ja/headless)で `-p` を使用して Plan Mode でクエリを直接実行することもできます：

```bash
claude --permission-mode plan -p "Analyze the authentication system and suggest improvements"
```

### 例：複雑なリファクタリングの計画

```bash
claude --permission-mode plan
```

```text
I need to refactor our authentication system to use OAuth2. Create a detailed migration plan.
```

Claude は現在の実装を分析し、包括的な計画を作成します。フォローアップで改善します：

```text
What about backward compatibility?
```

```text
How should we handle database migration?
```

`Ctrl+G` を押してデフォルトのテキストエディタで計画を開き、Claude が進める前に直接編集できます。

計画を受け入れると、Claude は計画コンテンツからセッションに自動的に名前を付けます。名前はプロンプトバーとセッションピッカーに表示されます。既に `--name` または `/rename` で名前を設定している場合、計画を受け入れてもそれは上書きされません。

### Plan Mode をデフォルトとして設定する

```json
// .claude/settings.json
{
  "permissions": {
    "defaultMode": "plan"
  }
}
```

詳細な設定オプションについては、[設定ドキュメント](/ja/settings#available-settings)を参照してください。

***

## テストを使用する

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

## プルリクエストを作成する

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

`gh pr create` を使用して PR を作成すると、セッションはその PR に自動的にリンクされます。後で `claude --from-pr <number>` で再開できます。

Claude が生成した PR を送信する前にレビューし、Claude に潜在的なリスクや考慮事項を強調するよう依頼してください。

## ドキュメントを処理する

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

## 画像を使用する

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

## ファイルとディレクトリを参照する

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

## 拡張思考（思考モード）を使用する

[拡張思考](https://platform.claude.com/docs/en/build-with-claude/extended-thinking)はデフォルトで有効になっており、Claude が複雑な問題をステップバイステップで推論するためのスペースを提供します。この推論は詳細モードで表示され、`Ctrl+O` でオンに切り替えることができます。

さらに、Opus 4.6 と Sonnet 4.6 は適応的推論をサポートしています。固定された思考トークン予算の代わりに、モデルは[努力レベル](/ja/model-config#adjust-effort-level)設定に基づいて思考を動的に割り当てます。拡張思考と適応的推論は一緒に機能して、Claude が応答する前にどの程度深く推論するかを制御できます。

拡張思考は、複雑なアーキテクチャの決定、難しいバグ、マルチステップの実装計画、異なるアプローチ間のトレードオフの評価に特に価値があります。

「think」、「think hard」、「think more」などのフレーズは通常のプロンプト指示として解釈され、思考トークンを割り当てません。

### 思考モードを設定する

思考はデフォルトで有効になっていますが、調整または無効にできます。

| スコープ | 設定方法 | 詳細 |
| - | - | - |
| **努力レベル** | `/effort` を実行するか、`/model` で調整するか、[`CLAUDE_CODE_EFFORT_LEVEL`](/ja/env-vars)を設定する | Opus 4.6 と Sonnet 4.6 の思考の深さを制御します。[努力レベルを調整](/ja/model-config#adjust-effort-level)を参照してください |
| **`ultrathink` キーワード** | プロンプトの任意の場所に「ultrathink」を含める | Opus 4.6 と Sonnet 4.6 でそのターンの努力を高に設定します。設定を永続的に変更せずに深い推論が必要な 1 回限りのタスクに便利です |
| **トグルショートカット** | `Option+T`（macOS）または `Alt+T`（Windows/Linux）を押す | 現在のセッションの思考をオン/オフに切り替えます（すべてのモデル）。[ターミナル設定](/ja/terminal-config)を有効にして Option キーショートカットを有効にする必要がある場合があります |
| **グローバルデフォルト** | `/config` を使用して思考モードをトグルする | すべてのプロジェクト全体でデフォルトを設定します（すべてのモデル）。`~/.claude/settings.json` に `alwaysThinkingEnabled` として保存されます |
| **トークン予算を制限する** | [`MAX_THINKING_TOKENS`](/ja/env-vars)環境変数を設定する | 思考予算を特定のトークン数に制限します。Opus 4.6 と Sonnet 4.6 では、適応的推論が無効になっていない限り `0` に設定されている場合のみ適用されます。例：`export MAX_THINKING_TOKENS=10000` |

Claude の思考プロセスを表示するには、`Ctrl+O` を押して詳細モードをトグルし、グレーのイタリック体で表示される内部推論を確認します。

### 拡張思考の仕組み

拡張思考は、Claude が応答する前に実行する内部推論の量を制御します。より多くの思考により、ソリューションを探索し、エッジケースを分析し、間違いを自己修正するためのより多くのスペースが提供されます。

**Opus 4.6 と Sonnet 4.6 では**、思考は適応的推論を使用します。モデルは、選択した[努力レベル](/ja/model-config#adjust-effort-level)に基づいて思考トークンを動的に割り当てます。これは速度と推論の深さのトレードオフを調整するための推奨される方法です。

**他のモデルでは**、思考は出力予算から最大 31,999 トークンの固定予算を使用します。[`MAX_THINKING_TOKENS`](/ja/env-vars)環境変数でこれを制限するか、`/config` または `Option+T`/`Alt+T` トグルで思考を完全に無効にできます。

Opus 4.6 と Sonnet 4.6 では、適応的推論が思考の深さを制御するため、`MAX_THINKING_TOKENS` は `0` に設定されている場合のみ適用されます。または `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1` は、これらのモデルを固定予算に戻します。[環境変数](/ja/env-vars)を参照してください。

思考の要約が編集されている場合でも、使用されたすべての思考トークンに対して課金されます。インタラクティブモードでは、思考はデフォルトで折りたたまれたスタブとして表示されます。`settings.json` で `showThinkingSummaries: true` を設定して、完全な要約を表示します。

***

## 以前の会話を再開する

Claude Code を開始するときは、以前のセッションを再開できます：

- `claude --continue` は現在のディレクトリで最新の会話を続行します
- `claude --resume` は会話ピッカーを開くか、名前で再開します
- `claude --from-pr 123` は特定のプルリクエストにリンクされたセッションを再開します

アクティブなセッション内から、`/resume` を使用して別の会話に切り替えます。

セッションはプロジェクトディレクトリごとに保存されます。`/resume` ピッカーは同じ git リポジトリからのインタラクティブセッションを表示します。これには worktree が含まれます。`claude -p` または SDK 呼び出しで作成されたセッションはピッカーに表示されませんが、セッション ID をそのまま `claude --resume <session-id>` に渡すことで再開できます。

### セッションに名前を付ける

セッションに説明的な名前を付けて、後で見つけやすくします。これは複数のタスクまたは機能に取り組むときのベストプラクティスです。

起動時に `-n` でセッションに名前を付けます：

```bash theme={null}
claude -n auth-refactor
```

またはセッション中に `/rename` を使用します。これはプロンプトバーに名前も表示します：

```text theme={null}
/rename auth-refactor
```

ピッカーから任意のセッションの名前を変更することもできます。`/resume` を実行し、セッションに移動して、`R` を押します。

コマンドラインから：

```bash theme={null}
claude --resume auth-refactor
```

またはアクティブなセッション内から：

```text theme={null}
/resume auth-refactor
```

### セッションピッカーを使用する

`/resume` コマンド（または引数なしの `claude --resume`）は、次の機能を備えたインタラクティブセッションピッカーを開きます：

**ピッカーのキーボードショートカット：**

| ショートカット | アクション |
| :- | :- |
| `↑` / `↓` | セッション間を移動する |
| `→` / `←` | グループ化されたセッションを展開または折りたたむ |
| `Enter` | ハイライトされたセッションを選択して再開する |
| `P` | セッションコンテンツをプレビューする |
| `R` | ハイライトされたセッションの名前を変更する |
| `/` | 検索してセッションをフィルタリングする |
| `A` | 現在のディレクトリとすべてのプロジェクト間を切り替える |
| `B` | 現在の git ブランチからのセッションにフィルタリングする |
| `Esc` | ピッカーまたは検索モードを終了する |

**セッション組織：**

ピッカーは有用なメタデータを含むセッションを表示します：

- セッション名または初期プロンプト
- 最後のアクティビティからの経過時間
- メッセージ数
- Git ブランチ（該当する場合）

フォークされたセッション（`/branch`、`/rewind`、または `--fork-session` で作成）はルートセッションの下にグループ化され、関連する会話を見つけやすくなります。

ヒント：

- **セッションを早期に名前付ける**：異なるタスクで作業を開始するときに `/rename` を使用します。後で「payment-integration」を見つける方が「explain this function」よりもはるかに簡単です
- 現在のディレクトリで最新の会話にすばやくアクセスするには `--continue` を使用します
- 必要なセッションがわかっている場合は `--resume session-name` を使用します
- 参照して選択する必要がある場合は `--resume`（名前なし）を使用します
- スクリプトの場合は、`claude --continue --print "prompt"` を使用して非対話モードで再開します
- ピッカーで `P` を押して、セッションを再開する前にプレビューします
- 再開された会話は、元のセッションと同じモデルと設定で開始されます

仕組み：

1. **会話ストレージ**：すべての会話は完全なメッセージ履歴とともにローカルに自動保存されます
2. **メッセージ逆シリアル化**：再開時に、コンテキストを維持するために全メッセージ履歴が復元されます
3. **ツール状態**：前の会話からのツール使用と結果が保持されます
4. **コンテキスト復元**：会話は前のすべてのコンテキストを保持して再開されます

***

## Git worktree を使用して並列 Claude Code セッションを実行する

複数のタスクに同時に取り組む場合、各 Claude セッションがコードベースの独自のコピーを持つ必要があります。そうしないと変更が衝突します。Git worktree は、同じリポジトリ履歴とリモート接続を共有しながら、独自のファイルとブランチを持つ個別の作業ディレクトリを作成することで、この問題を解決します。つまり、Claude が 1 つの worktree で機能に取り組んでいる間に、別の worktree でバグを修正でき、どちらのセッションも相互に干渉しません。

`--worktree`（`-w`）フラグを使用して、分離された worktree を作成し、Claude をその中で開始します。渡す値は worktree ディレクトリ名とブランチ名になります：

```bash
# "feature-auth" という名前の worktree で Claude を開始する
# 新しいブランチで .claude/worktrees/feature-auth/ を作成する
claude --worktree feature-auth

# 別の worktree で別のセッションを開始する
claude --worktree bugfix-123
```

名前を省略すると、Claude は自動的にランダムな名前を生成します：

```bash
# "bright-running-fox" のような名前を自動生成する
claude --worktree
```

Worktree は `<repo>/.claude/worktrees/<name>` に作成され、デフォルトのリモートブランチから分岐します。これは `origin/HEAD` が指すところです。worktree ブランチは `worktree-<name>` という名前が付けられます。

ベースブランチは Claude Code フラグまたは設定を通じて設定できません。`origin/HEAD` はクローン時に Git が設定したローカル `.git` ディレクトリに保存される参照です。リポジトリのデフォルトブランチが後で GitHub または GitLab で変更された場合、ローカル `origin/HEAD` は古いものを指し続け、worktree はそこから分岐します。ローカル参照をリモートが現在デフォルトと見なしているものと再同期するには：

```bash
git remote set-head origin -a
```

これは、ローカル `.git` ディレクトリのみを更新する標準 Git コマンドです。リモートサーバーでは何も変わりません。worktree が特定のブランチではなくリモートのデフォルトに基づくようにしたい場合は、`git remote set-head origin your-branch-name` で明示的に設定します。

worktree の作成方法を完全に制御するには、[WorktreeCreate フック](/ja/hooks#worktreecreate)を設定します。フックは Claude Code のデフォルト `git worktree` ロジックを完全に置き換えるため、必要な ref から取得してブランチできます。

セッション中に Claude に「work in a worktree」または「start a worktree」を依頼することもでき、自動的に作成されます。

### Subagent worktree

Subagent は worktree 分離を使用して、競合なしに並列で作業することもできます。Claude に「use worktrees for your agents」を依頼するか、[カスタム subagent](/ja/sub-agents#supported-frontmatter-fields)で `isolation: worktree` をエージェントのフロントマターに追加して設定します。各 subagent は独自の worktree を取得し、変更なしで subagent が終了すると自動的にクリーンアップされます。

### Worktree クリーンアップ

worktree セッションを終了すると、Claude は変更があったかどうかに基づいてクリーンアップを処理します：

- **変更なし**：worktree とそのブランチは自動的に削除されます
- **変更またはコミットが存在する**：Claude は worktree を保持するか削除するかをプロンプトします。保持するとディレクトリとブランチが保存され、後で戻ることができます。削除すると worktree ディレクトリとそのブランチが削除され、すべてのコミットされていない変更とコミットが破棄されます

Claude セッション外で worktree をクリーンアップするには、[worktree を手動で管理](#manage-worktrees-manually)を使用します。

`.claude/worktrees/` を `.gitignore` に追加して、worktree コンテンツがメインリポジトリに追跡されていないファイルとして表示されるのを防ぎます。

### Worktree に gitignored ファイルをコピーする

Git worktree は新しいチェックアウトなので、メインリポジトリから `.env` や `.env.local` などの追跡されていないファイルは含まれません。Claude が worktree を作成するときにこれらのファイルを自動的にコピーするには、プロジェクトルートに `.worktreeinclude` ファイルを追加します。

ファイルは `.gitignore` 構文を使用して、コピーするファイルをリストします。パターンに一致し、gitignored されているファイルのみがコピーされるため、追跡されたファイルは決して複製されません。

```text .worktreeinclude theme={null}
.env
.env.local
config/secrets.json
```

これは `--worktree`、subagent worktree、および[デスクトップアプリ](/ja/desktop#work-in-parallel-with-sessions)の並列セッションで作成された worktree に適用されます。

### Worktree を手動で管理する

worktree の場所とブランチ設定をより細かく制御するには、Git を使用して worktree を直接作成します。これは特定の既存ブランチをチェックアウトするか、worktree をリポジトリの外に配置する必要がある場合に便利です。

```bash
# 新しいブランチで worktree を作成する
git worktree add ../project-feature-a -b feature-a

# 既存のブランチで worktree を作成する
git worktree add ../project-bugfix bugfix-123

# worktree で Claude を開始する
cd ../project-feature-a && claude

# 完了したらクリーンアップする
git worktree list
git worktree remove ../project-feature-a
```

詳細については、[公式 Git worktree ドキュメント](https://git-scm.com/docs/git-worktree)を参照してください。

プロジェクトのセットアップに従って、各新しい worktree で開発環境を初期化することを忘れないでください。スタックに応じて、これには依存関係のインストール（`npm install`、`yarn`）、仮想環境のセットアップ、またはプロジェクトの標準セットアップ手順に従うことが含まれる場合があります。

### Git 以外のバージョン管理

Worktree 分離はデフォルトで git で機能します。SVN、Perforce、Mercurial などの他のバージョン管理システムの場合は、[WorktreeCreate と WorktreeRemove フック](/ja/hooks#worktreecreate)を設定して、カスタム worktree 作成とクリーンアップロジックを提供します。設定されている場合、これらのフックは `--worktree` を使用するときにデフォルトの git 動作を置き換えます。そのため、[`.worktreeinclude`](#copy-gitignored-files-to-worktrees)は処理されません。フックスクリプト内でローカル設定ファイルをコピーしてください。

共有タスクとメッセージングを使用した並列セッションの自動調整については、[エージェントチーム](/ja/agent-teams)を参照してください。

***

## Claude が注意を必要とするときに通知を受け取る

長時間実行されるタスクを開始して別のウィンドウに切り替えるときは、Claude が終了したときまたは入力が必要なときに知ることができるようにデスクトップ通知を設定できます。これは `Notification` [フックイベント](/ja/hooks-guide#get-notified-when-claude-needs-input)を使用します。これは Claude が許可を待っている、アイドル状態で新しいプロンプトの準備ができている、または認証を完了しているときはいつでも発火します。

`~/.claude/settings.json` を開き、プラットフォームのネイティブ通知コマンドを呼び出す `Notification` フックを追加します：

```json theme={null}
{
  "hooks": {
    "Notification": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "osascript -e 'display notification \"Claude Code needs your attention\" with title \"Claude Code\"'"
          }
        ]
      }
    ]
  }
}
```

```json theme={null}
{
  "hooks": {
    "Notification": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "notify-send 'Claude Code' 'Claude Code needs your attention'"
          }
        ]
      }
    ]
  }
}
```

```json theme={null}
{
  "hooks": {
    "Notification": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "powershell.exe -Command \"[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); [System.Windows.Forms.MessageBox]::Show('Claude Code needs your attention', 'Claude Code')\""
          }
        ]
      }
    ]
  }
}
```

設定ファイルに既に `hooks` キーがある場合は、上書きするのではなく `Notification` エントリをマージします。CLI で説明したいことを説明することで、Claude にフックを書くよう依頼することもできます。

デフォルトでは、フックはすべての通知タイプで発火します。特定のイベントのみで発火させるには、`matcher` フィールドを次のいずれかの値に設定します：

| マッチャー | 発火する場合 |
| :- | :- |
| `permission_prompt` | Claude がツール使用を承認する必要がある場合 |
| `idle_prompt` | Claude が完了し、次のプロンプトを待っている場合 |
| `auth_success` | 認証が完了する場合 |
| `elicitation_dialog` | Claude があなたに質問している場合 |

`/hooks` と入力し、`Notification` を選択して、フックが表示されることを確認します。選択すると、実行されるコマンドが表示されます。エンドツーエンドでテストするには、Claude に許可が必要なコマンドを実行するよう依頼してターミナルから離れるか、Claude に通知を直接トリガーするよう依頼します。

完全なイベントスキーマと通知タイプについては、[通知リファレンス](/ja/hooks#notification)を参照してください。

***

## Claude を unix スタイルのユーティリティとして使用する

### 検証プロセスに Claude を追加する

Claude Code をリンターまたはコードレビューアーとして使用したいとします。

**ビルドスクリプトに Claude を追加する：**

```json
// package.json
{
    ...
    "scripts": {
        ...
        "lint:claude": "claude -p 'you are a linter. please look at the changes vs. main and report any issues related to typos. report the filename and line number on one line, and a description of the issue on the second line. do not return any other text.'"
    }
}
```

ヒント：

- CI/CD パイプラインで自動コードレビューに Claude を使用する
- プロンプトをカスタマイズして、プロジェクトに関連する特定の問題をチェックする
- 異なるタイプの検証用に複数のスクリプトを作成することを検討する

### パイプイン、パイプアウト

Claude にデータをパイプインし、構造化された形式でデータを取得したいとします。

**Claude を通じてデータをパイプする：**

```bash
cat build-error.txt | claude -p 'concisely explain the root cause of this build error' > output.txt
```

ヒント：

- パイプを使用して Claude を既存のシェルスクリプトに統合する
- 他の Unix ツールと組み合わせて強力なワークフローを作成する
- 構造化出力に `--output-format` を使用することを検討する

### 出力形式を制御する

特に Claude Code をスクリプトまたは他のツールに統合する場合、Claude の出力が特定の形式である必要があるとします。

```bash theme={null}
cat data.txt | claude -p 'summarize this data' --output-format text > summary.txt
```

これは Claude のプレーンテキスト応答のみを出力します（デフォルトの動作）。

```bash theme={null}
cat code.py | claude -p 'analyze this code for bugs' --output-format json > analysis.json
```

これは、コストと期間を含むメタデータを含むメッセージの JSON 配列を出力します。

```bash theme={null}
cat log.txt | claude -p 'parse this log file for errors' --output-format stream-json
```

これは、Claude がリクエストを処理するときにリアルタイムで一連の JSON オブジェクトを出力します。各メッセージは有効な JSON オブジェクトですが、連結された場合、全体の出力は有効な JSON ではありません。

ヒント：

- Claude の応答だけが必要な単純な統合には `--output-format text` を使用する
- 完全な会話ログが必要な場合は `--output-format json` を使用する
- 各会話ターンのリアルタイム出力には `--output-format stream-json` を使用する

***

## Claude をスケジュールで実行する

Claude に長時間実行されるタスクを自動的に定期的に処理させたいとします。例えば、毎朝オープン PR をレビューしたり、毎週依存関係を監査したり、夜間に CI の失敗をチェックしたりします。

実行場所に基づいてスケジューリングオプションを選択します：

| オプション | 実行場所 | 最適な用途 |
| :- | :- | :- |
| [クラウドスケジュール済みタスク](/ja/web-scheduled-tasks) | Anthropic 管理インフラストラクチャ | コンピュータがオフの場合でも実行する必要があるタスク。[claude.ai/code](https://claude.ai/code)で設定します。 |
| [デスクトップスケジュール済みタスク](/ja/desktop#schedule-recurring-tasks) | デスクトップアプリ経由のマシン | ローカルファイル、ツール、またはコミットされていない変更への直接アクセスが必要なタスク。 |
| [GitHub Actions](/ja/github-actions) | CI パイプライン | オープン PR などのリポジトリイベント、またはワークフロー設定と一緒に存在する必要がある cron スケジュールに関連するタスク。 |
| [`/loop`](/ja/scheduled-tasks) | 現在の CLI セッション | セッションが開いている間のクイックポーリング。セッションを終了すると、タスクはキャンセルされます。 |

スケジュール済みタスク用のプロンプトを作成するときは、成功がどのように見えるか、および結果をどうするかについて明示的に説明してください。タスクは自律的に実行されるため、質問を明確にすることはできません。例えば：'`needs-review` ラベルが付いたオープン PR をレビューし、問題に関するインラインコメントを残し、`#eng-reviews` Slack チャネルに要約を投稿します。'

***

## Claude にその機能について質問する

Claude は自分のドキュメントへの組み込みアクセスを持っており、自分の機能と制限について質問に答えることができます。

### 質問例

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

Claude はこれらの質問に対してドキュメントベースの回答を提供します。実行可能な例と実践的なデモンストレーションについては、上記の特定のワークフローセクションを参照してください。

ヒント：

- Claude は使用しているバージョンに関係なく、常に最新の Claude Code ドキュメントにアクセスできます
- 詳細な回答を得るために具体的な質問をする
- Claude は MCP 統合、エンタープライズ設定、高度なワークフローなどの複雑な機能を説明できます

***

## 次のステップ

Claude Code から最大限の価値を得るためのパターン

agentic ループとコンテキスト管理を理解する

skill、フック、MCP、subagent、プラグインを追加する

開発コンテナリファレンス実装をクローンする
