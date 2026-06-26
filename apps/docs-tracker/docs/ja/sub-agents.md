---
title: sub-agents
source: https://code.claude.com/docs/ja/sub-agents.md
---

# カスタムサブエージェントの作成

> Claude Code でタスク固有のワークフローと改善されたコンテキスト管理のための特化した AI サブエージェントを作成して使用します。

サブエージェントは、特定の種類のタスクを処理する特化した AI アシスタントです。サイドタスクがメイン会話に検索結果、ログ、または再度参照しないファイルコンテンツで溢れかえる場合に使用します。サブエージェントはそのタスクを独自のコンテキストで実行し、概要のみを返します。同じ種類のワーカーを同じ指示で繰り返し生成する場合は、カスタムサブエージェントを定義します。

各サブエージェントは、カスタムシステムプロンプト、特定のツールアクセス、および独立した権限を備えた独自のコンテキストウィンドウで実行されます。Claude がサブエージェントの説明に一致するタスクに遭遇すると、そのサブエージェントに委譲し、サブエージェントは独立して動作して結果を返します。実際にコンテキスト節約を確認するには、[コンテキストウィンドウの可視化](/ja/context-window)で、サブエージェントが独自の別のウィンドウで研究を処理するセッションを説明しています。

サブエージェントは単一のセッション内で動作します。多くの独立したセッションを並行して実行し、1 つの場所から監視するには、[バックグラウンドエージェント](/ja/agent-view)を参照してください。互いに通信するセッションについては、[エージェントチーム](/ja/agent-teams)を参照してください。

サブエージェントは以下に役立ちます：

- **コンテキストを保持する** ことで、探索と実装をメインの会話から分離します
- **制約を強制する** ことで、サブエージェントが使用できるツールを制限します
- **設定を再利用する** ことで、ユーザーレベルのサブエージェントをプロジェクト全体で再利用します
- **動作を特化させる** ことで、特定のドメイン向けの焦点を絞ったシステムプロンプトを使用します
- **コストを制御する** ことで、Haiku のような高速で安価なモデルにタスクをルーティングします

Claude は各サブエージェントの説明を使用して、タスクを委譲するかどうかを決定します。サブエージェントを作成するときは、Claude がいつそれを使用するかを知るように、明確な説明を書いてください。

Claude Code には、**Explore**、**Plan**、**general-purpose** などのいくつかの組み込みサブエージェントが含まれています。特定のタスクを処理するカスタムサブエージェントを作成することもできます。

組み込みサブエージェント

Claude Code には、Claude が適切なときに自動的に使用する組み込みサブエージェントが含まれています。各サブエージェントは、親の会話の権限を継承し、追加のツール制限があります。

Explore と Plan は CLAUDE.md ファイルと親セッションの git ステータスをスキップして、研究を高速かつ低コストに保ちます。その他すべての組み込みおよび[カスタムサブエージェント](#configure-subagents)は両方をロードします。サブエージェントに到達するものの完全な内訳については、[スタートアップ時にロードされるもの](#what-loads-at-startup)を参照してください。

コードベースの検索と分析に最適化された高速な読み取り専用エージェント。

- **モデル**：Haiku（高速、低レイテンシ）
- **ツール**：読み取り専用ツール（Write および Edit ツールへのアクセスは拒否）
- **目的**：ファイル検出、コード検索、コードベース探索

Claude は、変更を加えずにコードベースを検索または理解する必要があるときに Explore に委譲します。これにより、探索結果がメインの会話コンテキストから除外されます。

Explore を呼び出すときに、Claude は徹底度レベルを指定します：ターゲット検索の場合は **quick**、バランスの取れた探索の場合は **medium**、包括的な分析の場合は **very thorough**。

[プランモード](/ja/permission-modes#analyze-before-you-edit-with-plan-mode)中にプランを提示する前にコンテキストを収集するために使用される研究エージェント。

- **モデル**：メイン会話から継承
- **ツール**：読み取り専用ツール（Write および Edit ツールへのアクセスは拒否）
- **目的**：計画のためのコードベース研究

プランモード中に Claude がコードベースを理解する必要がある場合、研究を Plan サブエージェントに委譲して、探索出力がメイン会話が読み取り専用のままである間に別のコンテキストウィンドウに留まるようにします。

探索と実行の両方を必要とする複雑なマルチステップタスク向けの有能なエージェント。

- **モデル**：メイン会話から継承
- **ツール**：すべてのツール
- **目的**：複雑な研究、マルチステップ操作、コード変更

Claude は、タスクが探索と変更の両方を必要とする場合、結果を解釈するための複雑な推論が必要な場合、または複数の依存ステップがある場合に general-purpose に委譲します。

Claude Code には、特定のタスク向けの追加のヘルパーエージェントが含まれています。これらは通常自動的に呼び出されるため、直接使用する必要はありません。

| エージェント | モデル | Claude が使用する場合 |
| :- | :- | :- |
| statusline-setup | Sonnet | `/statusline` を実行してステータスラインを設定する場合 |
| claude-code-guide | Haiku | Claude Code 機能について質問する場合 |

組み込みサブエージェントは常にインタラクティブセッションに登録されます。特定の組み込みタイプをブロックするには、[特定のサブエージェントを無効にする](#disable-specific-subagents)に示されているように `permissions.deny` に追加します。Claude がサブエージェントに委譲することを防ぐには、[`permissions.deny`](/ja/permissions#tool-specific-permission-rules)で `Agent` ツール自体を拒否します。[非インタラクティブモード](/ja/headless)および [Agent SDK](/ja/agent-sdk/overview)では、[`CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS=1`](/ja/env-vars)を設定して、すべての組み込みタイプを削除し、独自のものだけを提供します。

これらの組み込みサブエージェント以外に、カスタムプロンプト、ツール制限、権限モード、hooks、および skills を使用して独自のサブエージェントを作成できます。以下のセクションでは、開始方法とサブエージェントのカスタマイズ方法を示します。

クイックスタート：最初のサブエージェントを作成する

サブエージェントは YAML フロントマターを含む Markdown ファイルで定義されます。[手動で作成](#write-subagent-files)することも、`/agents` コマンドを使用することもできます。

このチュートリアルでは、`/agents` コマンドを使用してユーザーレベルのサブエージェントを作成する手順を説明します。サブエージェントはコードをレビューし、コードベースの改善を提案します。

Claude Code で、以下を実行します：

```text theme={null}
/agents
```

**Library** タブに切り替え、**Create new agent** を選択し、**Personal** を選択します。これにより、サブエージェントが `~/.claude/agents/` に保存され、すべてのプロジェクトで利用可能になります。

**Generate with Claude** を選択します。プロンプトが表示されたら、サブエージェントを説明します：

```text theme={null}
A code improvement agent that scans files and suggests improvements
for readability, performance, and best practices. It should explain
each issue, show the current code, and provide an improved version.
```

Claude は識別子、説明、およびシステムプロンプトを生成します。

読み取り専用レビュアーの場合は、**Read-only tools** 以外のすべてを選択解除します。すべてのツールを選択したままにすると、サブエージェントはメイン会話で利用可能なすべてのツールを継承します。

サブエージェントが使用するモデルを選択します。このサンプルエージェントの場合は、**Sonnet** を選択します。これはコードパターンの分析のための機能と速度のバランスを取ります。

サブエージェントの背景色を選択します。これにより、UI でどのサブエージェントが実行されているかを識別するのに役立ちます。

**User scope** を選択して、サブエージェントに `~/.claude/agent-memory/` の[永続メモリディレクトリ](#enable-persistent-memory)を提供します。サブエージェントはこれを使用して、コードベースパターンや繰り返される問題など、会話全体で洞察を蓄積します。サブエージェントが学習を永続化しないようにする場合は、**None** を選択します。

設定概要を確認します。`s` または `Enter` を押して保存するか、`e` を押してエディターで保存して編集します。サブエージェントはすぐに利用可能になります。試してみます：

```text theme={null}
Use the code-improver agent to suggest improvements in this project
```

Claude は新しいサブエージェントに委譲し、コードベースをスキャンして改善提案を返します。

これで、マシン上のプロジェクトでコードベースを分析し、改善を提案するために使用できるサブエージェントができました。

Markdown ファイルとして手動でサブエージェントを作成したり、CLI フラグを使用して定義したり、プラグインを通じて配布したりすることもできます。以下のセクションでは、すべての設定オプションについて説明します。

サブエージェントを設定する

/agents コマンドを使用する

`/agents` コマンドは、サブエージェントを管理するためのタブ付きインターフェースを開きます。**Running** タブはライブおよび最近終了したサブエージェントをリストし、それらを開くまたは停止できます。**Library** タブでは以下を実行できます：

- すべての利用可能なサブエージェント（組み込み、ユーザー、プロジェクト、プラグイン）を表示する
- ガイド付きセットアップまたは Claude 生成を使用して新しいサブエージェントを作成する
- 既存のサブエージェント設定とツールアクセスを編集する
- カスタムサブエージェントを削除する
- 重複が存在する場合、どのサブエージェントがアクティブであるかを確認する

これはサブエージェントを作成および管理するための推奨される方法です。手動作成または自動化の場合は、サブエージェントファイルを直接追加することもできます。

サブエージェントのスコープを選択する

サブエージェントは YAML フロントマターを含む Markdown ファイルです。スコープに応じて異なる場所に保存します。複数のサブエージェントが同じ名前を共有する場合、より高い優先度の場所が優先されます。

| 場所 | スコープ | 優先度 | 作成方法 |
| :- | :- | :- | :- |
| 管理設定 | 組織全体 | 1（最高） | [管理設定](/ja/settings)を通じてデプロイ |
| `--agents` CLI フラグ | 現在のセッション | 2 | Claude Code を起動するときに JSON を渡す |
| `.claude/agents/` | 現在のプロジェクト | 3 | インタラクティブまたは手動 |
| `~/.claude/agents/` | すべてのプロジェクト | 4 | インタラクティブまたは手動 |
| プラグインの `agents/` ディレクトリ | プラグインが有効な場所 | 5（最低） | [プラグイン](/ja/plugins)でインストール |

**プロジェクトサブエージェント** (`.claude/agents/`)は、コードベース固有のサブエージェントに最適です。バージョン管理にチェックインして、チームが協力して使用および改善できるようにします。

プロジェクトサブエージェントは、現在の作業ディレクトリから上へ向かって検出されます。そのため、そこからリポジトリルートまでのすべての `.claude/agents/` がスキャンされます。v2.1.178 以降、これらのネストされたディレクトリの複数が同じ `name` を定義する場合、Claude Code は作業ディレクトリに最も近い定義を使用します。

`--add-dir` で追加されたディレクトリもスキャンされます：追加されたディレクトリ内の `.claude/agents/` フォルダはプロジェクトサブエージェントと一緒に読み込まれます。[追加ディレクトリ](/ja/permissions#additional-directories-grant-file-access-not-configuration)を参照して、`--add-dir` から読み込まれる他の設定タイプを確認してください。`--add-dir` なしでプロジェクト全体でサブエージェントを共有するには、`~/.claude/agents/` または[プラグイン](/ja/plugins)を使用します。

**ユーザーサブエージェント** (`~/.claude/agents/`)は、すべてのプロジェクトで利用可能な個人用サブエージェントです。

Claude Code は `.claude/agents/` と `~/.claude/agents/` を再帰的にスキャンするため、`agents/review/` や `agents/research/` などのサブフォルダに定義を整理できます。サブディレクトリパスはサブエージェントの識別方法や呼び出し方法に影響しません。これは `name` フロントマターフィールドからのみ識別されるためです。`name` 値をツリー全体で一意に保ちます：1 つのスコープ内の 2 つのファイルが同じ名前を宣言する場合、Claude Code は 1 つを保持し、警告なしに他を破棄します。

プラグイン `agents/` ディレクトリも再帰的にスキャンされます。プロジェクトおよびユーザースコープとは異なり、プラグインの `agents/` ディレクトリ内のサブフォルダは[スコープ付き識別子](#invoke-subagents-explicitly)の一部になります：プラグイン `my-plugin` の `agents/review/security.md` にあるファイルは `my-plugin:review:security` として登録されます。

**CLI で定義されたサブエージェント** は、Claude Code を起動するときに JSON として渡されます。これらはそのセッションのみに存在し、ディスクに保存されないため、クイックテストまたは自動化スクリプトに役立ちます。単一の `--agents` 呼び出しで複数のサブエージェントを定義できます：

```bash theme={null}
claude --agents '{
  "code-reviewer": {
    "description": "Expert code reviewer. Use proactively after code changes.",
    "prompt": "You are a senior code reviewer. Focus on code quality, security, and best practices.",
    "tools": ["Read", "Grep", "Glob", "Bash"],
    "model": "sonnet"
  },
  "debugger": {
    "description": "Debugging specialist for errors and test failures.",
    "prompt": "You are an expert debugger. Analyze errors, identify root causes, and provide fixes."
  }
}'
```

```powershell theme={null}
claude --agents @'
{
  "code-reviewer": {
    "description": "Expert code reviewer. Use proactively after code changes.",
    "prompt": "You are a senior code reviewer. Focus on code quality, security, and best practices.",
    "tools": ["Read", "Grep", "Glob", "Bash"],
    "model": "sonnet"
  },
  "debugger": {
    "description": "Debugging specialist for errors and test failures.",
    "prompt": "You are an expert debugger. Analyze errors, identify root causes, and provide fixes."
  }
}
'@
```

`--agents` フラグは、ファイルベースのサブエージェントと同じ[フロントマター](#supported-frontmatter-fields)フィールドを持つ JSON を受け入れます：`description`、`prompt`、`tools`、`disallowedTools`、`model`、`permissionMode`、`mcpServers`、`hooks`、`maxTurns`、`skills`、`initialPrompt`、`memory`、`effort`、`background`、`isolation`、および `color`。システムプロンプトには `prompt` を使用します。これはファイルベースのサブエージェントの markdown 本体と同等です。

**管理サブエージェント** は、組織管理者によってデプロイされます。[管理設定ディレクトリ](/ja/settings#settings-files)内の `.claude/agents/` に markdown ファイルを配置し、プロジェクトおよびユーザーサブエージェントと同じフロントマター形式を使用します。管理定義は、同じ名前のプロジェクトおよびユーザーサブエージェントより優先されます。

**プラグインサブエージェント** は、インストールした[プラグイン](/ja/plugins)から提供されます。これらは、カスタムサブエージェントと一緒に `/agents` に表示されます。プラグインサブエージェントの作成の詳細については、[プラグインコンポーネントリファレンス](/ja/plugins-reference#agents)を参照してください。

セキュリティ上の理由から、プラグインサブエージェントは `hooks`、`mcpServers`、または `permissionMode` フロントマターフィールドをサポートしていません。これらのフィールドはプラグインからエージェントを読み込むときに無視されます。これらが必要な場合は、エージェントファイルを `.claude/agents/` または `~/.claude/agents/` にコピーしてください。また、`settings.json` または `settings.local.json` の [`permissions.allow`](/ja/settings#permission-settings)にルールを追加することもできますが、これらのルールはプラグインサブエージェントだけでなく、セッション全体に適用されます。

これらのスコープのいずれかからのサブエージェント定義は、[エージェントチーム](/ja/agent-teams#use-subagent-definitions-for-teammates)でも利用可能です：チームメイトを生成するときに、サブエージェント型を参照でき、チームメイトはその `tools` と `model` を使用し、定義の本体がチームメイトのシステムプロンプトに追加指示として追加されます。[エージェントチーム](/ja/agent-teams#use-subagent-definitions-for-teammates)を参照して、どのフロントマターフィールドがこのパスに適用されるかを確認してください。

サブエージェントファイルを書く

サブエージェントファイルは、YAML フロントマターを使用して設定を行い、その後に Markdown でシステムプロンプトを続けます：

サブエージェントはセッション開始時に読み込まれます。ディスク上でサブエージェントファイルを直接追加または編集する場合は、セッションを再起動してそれを読み込みます。`/agents` インターフェースを通じて作成されたサブエージェントは、再起動なしで即座に有効になります。

```markdown
---
name: code-reviewer
description: Reviews code for quality and best practices
tools: Read, Glob, Grep
model: sonnet
---

You are a code reviewer. When invoked, analyze the code and provide
specific, actionable feedback on quality, security, and best practices.
```

フロントマターはサブエージェントのメタデータと設定を定義します。本体はサブエージェントの動作をガイドするシステムプロンプトになります。サブエージェントは、このシステムプロンプト（作業ディレクトリなどの基本的な環境詳細を含む）のみを受け取り、完全な Claude Code システムプロンプトは受け取りません。

サブエージェントはメイン会話の現在の作業ディレクトリで開始します。サブエージェント内では、`cd` コマンドは Bash または PowerShell ツール呼び出し間で永続化されず、メイン会話の作業ディレクトリに影響しません。代わりにサブエージェントにリポジトリの分離されたコピーを提供するには、[`isolation: worktree`](#supported-frontmatter-fields)を設定します。

サポートされているフロントマターフィールド

以下のフィールドは YAML フロントマターで使用できます。`name` と `description` のみが必須です。

| フィールド | 必須 | 説明 |
| :- | :- | :- |
| `name` | はい | 小文字とハイフンを使用した一意の識別子。[Hooks](/ja/hooks#subagentstart)はこの値を `agent_type` として受け取ります。ファイル名は一致する必要はありません |
| `description` | はい | Claude がこのサブエージェントに委譲する場合 |
| `tools` | いいえ | サブエージェントが使用できる[ツール](#available-tools)。省略した場合はすべてのツールを継承します。スキルをコンテキストにプリロードするには、`tools` にリストするのではなく `skills` フィールドを使用します |
| `disallowedTools` | いいえ | 拒否するツール。継承または指定されたリストから削除 |
| `model` | いいえ | 使用する[モデル](#choose-a-model)：`sonnet`、`opus`、`haiku`、`fable`、完全なモデル ID（例：`claude-opus-4-8`）、または `inherit`。デフォルトは `inherit` |
| `permissionMode` | いいえ | [権限モード](#permission-modes)：`default`、`acceptEdits`、`auto`、`dontAsk`、`bypassPermissions`、または `plan`。[プラグインサブエージェント](#choose-the-subagent-scope)では無視されます |
| `maxTurns` | いいえ | サブエージェントが停止する前の最大 agentic ターン数 |
| `skills` | いいえ | スタートアップ時にサブエージェントのコンテキストに[プリロード](/ja/skills)する[スキル](/ja/skills)。完全なスキルコンテンツが注入されます。説明だけでなく、スキル全体が注入されます。サブエージェントは、Skill ツールを通じて、リストされていないプロジェクト、ユーザー、およびプラグインスキルを引き続き呼び出すことができます |
| `mcpServers` | いいえ | このサブエージェントで利用可能な[MCP サーバー](/ja/mcp)。各エントリは、既に設定されたサーバーを参照するサーバー名（例：`"slack"`）または、サーバー名をキーとし、完全な[MCP サーバー設定](/ja/mcp#installing-mcp-servers)を値とするインライン定義のいずれかです。[プラグインサブエージェント](#choose-the-subagent-scope)では無視されます |
| `hooks` | いいえ | このサブエージェントにスコープされた[ライフサイクルフック](#define-hooks-for-subagents)。[プラグインサブエージェント](#choose-the-subagent-scope)では無視されます |
| `memory` | いいえ | [永続メモリスコープ](#enable-persistent-memory)：`user`、`project`、または `local`。クロスセッション学習を有効にします |
| `background` | いいえ | `true` に設定して、このサブエージェントを常に[バックグラウンドタスク](#run-subagents-in-foreground-or-background)として実行します。デフォルト：`false` |
| `effort` | いいえ | このサブエージェントがアクティブな場合の努力レベル。セッション努力レベルをオーバーライドします。デフォルト：セッションから継承。オプション：`low`、`medium`、`high`、`xhigh`、`max`。利用可能なレベルはモデルに依存します |
| `isolation` | いいえ | `worktree` に設定して、サブエージェントを一時的な[git worktree](/ja/worktrees)で実行し、リポジトリの分離されたコピーを提供します。デフォルトでは[デフォルトブランチ](/ja/worktrees#choose-the-base-branch)から分岐し、親セッションの `HEAD` ではなく、サブエージェントが変更を加えない場合、worktree は自動的にクリーンアップされます |
| `color` | いいえ | タスクリストとトランスクリプトでサブエージェントの表示色。`red`、`blue`、`green`、`yellow`、`purple`、`orange`、`pink`、または `cyan` を受け入れます |
| `initialPrompt` | いいえ | このエージェントがメインセッションエージェント（`--agent` または `agent` 設定を通じて）として実行される場合、最初のユーザーターンとして自動送信されます。[コマンド](/ja/commands)および[スキル](/ja/skills)が処理されます。ユーザーが提供するプロンプトの前に付加されます |

モデルを選択する

`model` フィールドは、サブエージェントが使用する[AI モデル](/ja/model-config)を制御します：

- **モデルエイリアス**：利用可能なエイリアスの 1 つを使用します：`sonnet`、`opus`、`haiku`、または `fable`
- **完全なモデル ID**：`claude-opus-4-8` または `claude-sonnet-4-6` などの完全なモデル ID を使用します。`--model` フラグと同じ値を受け入れます
- **inherit**：メイン会話と同じモデルを使用します
- **省略**：指定されていない場合、デフォルトは `inherit`（メイン会話と同じモデルを使用）です

Claude がサブエージェントを呼び出すときに、その特定の呼び出しに対して `model` パラメーターを渡すこともできます。Claude Code はサブエージェントのモデルを次の順序で解決します：

1. [`CLAUDE_CODE_SUBAGENT_MODEL`](/ja/model-config#environment-variables)環境変数（設定されている場合）
2. 呼び出しごとの `model` パラメーター
3. サブエージェント定義の `model` フロントマター
4. メイン会話のモデル

環境変数、呼び出しごとのパラメーター、およびフロントマター値は、組織の [`availableModels`](/ja/model-config#restrict-model-selection)許可リストに対してチェックされます。除外されたモデルに解決される値は使用されず、サブエージェントは継承されたモデルで実行されます。

サブエージェント機能を制御する

ツールアクセス、権限モード、および条件付きルールを通じて、サブエージェントが実行できることを制御できます。

利用可能なツール

サブエージェントは、デフォルトでメイン会話で利用可能な[内部ツール](/ja/tools-reference)と MCP ツールを継承します。以下のツールはメイン会話の UI またはセッション状態に依存し、`tools` フィールドにリストされている場合でも、サブエージェントでは利用できません：

- `AskUserQuestion`
- `EnterPlanMode`
- `ExitPlanMode`（サブエージェントの [`permissionMode`](#permission-modes)が `plan` の場合を除く）
- `ScheduleWakeup`
- `WaitForMcpServers`

ツールを制限するには、`tools` フィールド（許可リスト）または `disallowedTools` フィールド（拒否リスト）を使用します。この例は `tools` を使用して、Read、Grep、Glob、および Bash のみを排他的に許可します。サブエージェントはファイルを編集したり、ファイルを書き込んだり、MCP ツールを使用したりできません：

```yaml
---
name: safe-researcher
description: Research agent with restricted capabilities
tools: Read, Grep, Glob, Bash
---
```

この例は `disallowedTools` を使用して、Write および Edit を除く、メイン会話からすべてのツールを継承します。サブエージェントは Bash、MCP ツール、およびその他すべてを保持します：

```yaml
---
name: no-writes
description: Inherits every tool except file writes
disallowedTools: Write, Edit
---
```

両方が設定されている場合、`disallowedTools` が最初に適用され、その後 `tools` が残りのプールに対して解決されます。両方にリストされているツールは削除されます。

両方のフィールドは、正確なツール名に加えて MCP サーバーレベルのパターンを受け入れます：`mcp__<server>` または `mcp__<server>__*` は、指定されたサーバーからすべてのツールを付与または削除します。`disallowedTools` では、`mcp__*` はすべてのサーバーからすべての MCP ツールも削除します。この例は、`github` MCP サーバーからすべてのツールを削除しながら、他のサーバーのツールと組み込みツールをすべて保持します：

```yaml
---
name: local-only
description: Inherits every tool except those from the github MCP server
disallowedTools: mcp__github
---
```

生成できるサブエージェントを制限する

エージェントが `claude --agent` でメインスレッドとして実行される場合、Agent ツールを使用してサブエージェントを生成できます。生成できるサブエージェントの種類を制限するには、`tools` フィールドで `Agent(agent_type)` 構文を使用します。

バージョン 2.1.63 では、Task ツールが Agent に名前変更されました。設定とエージェント定義の既存の `Task(...)` 参照は引き続きエイリアスとして機能します。

```yaml
---
name: coordinator
description: Coordinates work across specialized agents
tools: Agent(worker, researcher), Read, Bash
---
```

これは許可リストです：`worker` と `researcher` サブエージェントのみを生成できます。エージェントが他の種類を生成しようとすると、リクエストは失敗し、エージェントはプロンプトで許可されたタイプのみを表示します。特定のエージェントをブロックしながら他のすべてを許可するには、代わりに[`permissions.deny`](#disable-specific-subagents)を使用します。

制限なしでサブエージェントを生成できるようにするには、括弧なしで `Agent` を使用します：

```yaml
tools: Agent, Read, Bash
```

`Agent` が `tools` リストから完全に省略されている場合、エージェントはサブエージェントを生成できません。

`Agent(agent_type)` 許可リスト構文は、`claude --agent` でメインスレッドとして実行されるエージェントにのみ適用されます。サブエージェント定義では、`tools` に `Agent` をリストするとそのサブエージェントは[ネストされたサブエージェントを生成](#spawn-nested-subagents)できますが、括弧内のタイプリストは無視されます。

MCP サーバーをサブエージェントにスコープする

`mcpServers` フィールドを使用して、メイン会話で利用可能でない[MCP](/ja/mcp) サーバーへのアクセスをサブエージェントに付与します。ここで定義されたインラインサーバーは、サブエージェントの開始時に接続され、終了時に切断されます。文字列参照は親セッションの接続を共有します。

`mcpServers` フィールドは、エージェントファイルが実行できる両方のコンテキストに適用されます：

- Agent ツールまたは @-mention を通じて生成されるサブエージェント
- [`--agent`](#invoke-subagents-explicitly)または `agent` 設定で起動されるメインセッション

エージェントがメインセッションの場合、インラインサーバー定義は、[`.mcp.json`](/ja/mcp)および設定ファイルのサーバーと一緒にスタートアップ時に接続されます。

リスト内の各エントリは、インラインサーバー定義またはセッションで既に設定されている MCP サーバーを参照する文字列のいずれかです：

```yaml
---
name: browser-tester
description: Tests features in a real browser using Playwright
mcpServers:
  # Inline definition: scoped to this subagent only
  - playwright:
      type: stdio
      command: npx
      args: ["-y", "@playwright/mcp@latest"]
  # Reference by name: reuses an already-configured server
  - github
---

Use the Playwright tools to navigate, screenshot, and interact with pages.
```

インライン定義は、`.mcp.json` サーバーエントリ（`stdio`、`http`、`sse`、`ws`）と同じスキーマを使用し、サーバー名でキー付けされます。

MCP サーバーをメイン会話から完全に除外し、そのツール説明がコンテキストを消費するのを避けるには、`.mcp.json` ではなくここでインラインで定義します。サブエージェントはツールを取得します。親の会話は取得しません。

v2.1.153 以降、メインセッションに適用される MCP 制限は、サブエージェントフロントマターで宣言されたサーバーもカバーします：

- [`--strict-mcp-config`](/ja/cli-reference)および [`--bare`](/ja/cli-reference)
- [Enterprise 管理 MCP 設定](/ja/managed-mcp)
- [`allowedMcpServers` および `deniedMcpServers` ポリシー](/ja/managed-mcp#policy-based-control-with-allowlists-and-denylists)

これらのいずれかがサーバーをブロックする場合、Claude Code はそれをスキップし、ブロックされたサーバーの名前を示す警告を表示します。

管理設定の制限は、定義方法に関係なく、すべてのサブエージェントに適用されます。`--strict-mcp-config` は、`--agents` または SDK `agents` オプションを通じてインラインで渡すサーバーをフィルタリングしません。これらは明示的な呼び出し元入力であるためです。

権限モード

`permissionMode` フィールドは、サブエージェントが権限プロンプトをどのように処理するかを制御します。サブエージェントはメイン会話から権限コンテキストを継承しますが、モードをオーバーライドできます。ただし、以下で説明するように、親モードが優先される場合があります。

| モード | 動作 |
| :- | :- |
| `default` | プロンプト付きの標準権限チェック |
| `acceptEdits` | ファイル編集と作業ディレクトリまたは `additionalDirectories` 内のパスの一般的なファイルシステムコマンドを自動受け入れ |
| `auto` | [自動モード](/ja/permission-modes#eliminate-prompts-with-auto-mode)：バックグラウンド分類器がコマンドと保護されたディレクトリ書き込みを確認 |
| `dontAsk` | 権限プロンプトを自動拒否（明示的に許可されたツールは引き続き機能） |
| `bypassPermissions` | すべての権限チェックをスキップ |
| `plan` | プランモード（読み取り専用探索） |

`bypassPermissions` は注意して使用してください。権限プロンプトをスキップし、サブエージェントが承認なしで操作を実行できるようにします。`.git`、`.config/git`、`.claude`、`.vscode`、`.idea`、`.husky`、`.cargo`、`.devcontainer`、`.yarn`、および `.mvn` ディレクトリへの書き込みを含みます。明示的な [`ask` ルール](/ja/permissions#manage-permissions)およびルートおよびホームディレクトリの削除（`rm -rf /` など）は引き続きプロンプトが表示されます。詳細については、[権限モード](/ja/permission-modes#skip-all-checks-with-bypasspermissions-mode)を参照してください。

親が `bypassPermissions` または `acceptEdits` を使用する場合、これが優先され、オーバーライドできません。親が[自動モード](/ja/permission-modes#eliminate-prompts-with-auto-mode)を使用する場合、サブエージェントは自動モードを継承し、フロントマター内の `permissionMode` は無視されます：分類器は、親セッションと同じブロックおよび許可ルールを使用してサブエージェントのツール呼び出しを評価します。

スキルをサブエージェントにプリロードする

`skills` フィールドを使用して、スキルコンテンツをスタートアップ時にサブエージェントのコンテキストに注入します。これにより、実行中にスキルを検出して読み込む必要なく、サブエージェントにドメイン知識を提供します。

```yaml
---
name: api-developer
description: Implement API endpoints following team conventions
skills:
  - api-conventions
  - error-handling-patterns
---

Implement API endpoints. Follow the conventions and patterns from the preloaded skills.
```

各スキルの完全なコンテンツがサブエージェントのコンテキストに注入されます。説明だけでなく、スキル全体が注入されます。このフィールドは、どのスキルがプリロードされるかを制御します。スキルの発見と読み込みはスキルの実行中に必要ありません。プリロードなしでも、サブエージェントは Skill ツールを通じてプロジェクト、ユーザー、およびプラグインスキルを検出して呼び出すことができます。スキルをプリロードするのを防ぐには、[`tools`](#available-tools)リストから `Skill` を省略するか、`disallowedTools` に追加します。

[`disable-model-invocation: true`](/ja/skills#control-who-invokes-a-skill)を設定するスキルをプリロードすることはできません。プリロードは Claude が呼び出すことができるスキルの同じセットから引き出されるためです。リストされたスキルが見つからないか無効な場合、Claude Code はそれをスキップし、デバッグログに警告をログします。

これは[サブエージェントでスキルを実行する](/ja/skills#run-skills-in-a-subagent)の逆です。サブエージェントの `skills` を使用すると、サブエージェントはシステムプロンプトを制御し、スキルコンテンツを読み込みます。スキルの `context: fork` を使用すると、スキルコンテンツが指定したエージェントに注入されます。どちらも同じ基盤システムを使用します。

永続メモリを有効にする

`memory` フィールドは、会話全体で存続する永続ディレクトリをサブエージェントに提供します。サブエージェントはこのディレクトリを使用して、コードベースパターン、デバッグの洞察、アーキテクチャの決定など、時間をかけて知識を構築します。

```yaml
---
name: code-reviewer
description: Reviews code for quality and best practices
memory: user
---

You are a code reviewer. As you review code, update your agent memory with
patterns, conventions, and recurring issues you discover.
```

メモリがどの程度広く適用されるべきかに基づいて、スコープを選択します：

| スコープ | 場所 | 使用する場合 |
| :- | :- | :- |
| `user` | `~/.claude/agent-memory/<name-of-agent>/` | サブエージェントがすべてのプロジェクト全体で学習を記憶する必要がある場合 |
| `project` | `.claude/agent-memory/<name-of-agent>/` | サブエージェントの知識がプロジェクト固有で、バージョン管理を通じて共有可能な場合 |
| `local` | `.claude/agent-memory-local/<name-of-agent>/` | サブエージェントの知識がプロジェクト固有だが、バージョン管理にチェックインすべきでない場合 |

メモリが有効な場合：

- サブエージェントのシステムプロンプトには、メモリディレクトリの読み取りと書き込みの指示が含まれます。
- サブエージェントのシステムプロンプトには、メモリディレクトリの `MEMORY.md` の最初の 200 行または 25KB（どちらか小さい方）も含まれ、`MEMORY.md` がその制限を超える場合はキュレーションの指示が含まれます。
- Read、Write、および Edit ツールが自動的に有効になり、サブエージェントがメモリファイルを管理できるようになります。

永続メモリのヒント

- `project` は推奨されるデフォルトスコープです。バージョン管理を通じてサブエージェント知識を共有可能にします。サブエージェントの知識がプロジェクト全体で広く適用可能な場合は `user` を使用するか、知識がバージョン管理にチェックインされるべきでない場合は `local` を使用します。
- サブエージェントに作業を開始する前にメモリを確認するよう依頼します：「このプルリクエストをレビューし、以前に見たパターンについてメモリを確認してください。」
- タスク完了後、サブエージェントにメモリを更新するよう依頼します：「完了したので、学習したことをメモリに保存してください。」時間をかけて、これはサブエージェントをより効果的にする知識ベースを構築します。
- メモリ指示をサブエージェントの markdown ファイルに直接含めて、独自の知識ベースを積極的に維持するようにします：

  ```markdown theme={null}
  Update your agent memory as you discover codepaths, patterns, library
  locations, and key architectural decisions. This builds up institutional
  knowledge across conversations. Write concise notes about what you found
  and where.
  ```

hooks を使用した条件付きルール

ツール使用をより動的に制御するには、`PreToolUse` hooks を使用して、操作が実行される前に検証します。これは、ツールの一部の操作を許可しながら他の操作をブロックする必要がある場合に役立ちます。

この例は、読み取り専用データベースクエリのみを許可するサブエージェントを作成します。`PreToolUse` hook は、各 Bash コマンドが実行される前に `command` で指定されたスクリプトを実行します：

```yaml
---
name: db-reader
description: Execute read-only database queries
tools: Bash
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate-readonly-query.sh"
---
```

Claude Code は[hook 入力を JSON として](/ja/hooks#pretooluse-input)stdin を通じて hook コマンドに渡します。検証スクリプトはこの JSON を読み取り、Bash コマンドを抽出し、[終了コード 2](/ja/hooks#exit-code-2-behavior-per-event)で書き込み操作をブロックします：

```bash
#!/bin/bash
# ./scripts/validate-readonly-query.sh

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Block SQL write operations (case-insensitive)
if echo "$COMMAND" | grep -iE '\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE)\b' > /dev/null; then
  echo "Blocked: Only SELECT queries are allowed" >&2
  exit 2
fi

exit 0
```

完全な入力スキーマについては[Hook 入力](/ja/hooks#pretooluse-input)を参照し、終了コードが動作に与える影響については[終了コード](/ja/hooks#exit-code-output)を参照してください。Windows では、PowerShell で hook スクリプトを記述し、[PowerShell で hooks を実行する](/ja/hooks#windows-powershell-tool)に示されているように hook エントリに `shell: powershell` を追加します。

特定のサブエージェントを無効にする

[設定](/ja/settings#permission-settings)の `deny` 配列にサブエージェントを追加することで、Claude が特定のサブエージェントを使用するのを防ぐことができます。`Agent(subagent-name)` 形式を使用します。ここで `subagent-name` はサブエージェントの name フィールドと一致します。

```json
{
  "permissions": {
    "deny": ["Agent(Explore)", "Agent(my-custom-agent)"]
  }
}
```

これは組み込みとカスタムの両方のサブエージェントで機能します。`--disallowedTools` CLI フラグを使用することもできます：

```bash
claude --disallowedTools "Agent(Explore)"
```

権限ルールの詳細については、[権限ドキュメント](/ja/permissions#tool-specific-permission-rules)を参照してください。

サブエージェント用の hooks を定義する

サブエージェントは、サブエージェントのライフサイクル中に実行される[hooks](/ja/hooks)を定義できます。hooks を設定する方法は 2 つあります：

1. **サブエージェントのフロントマター内**：そのサブエージェントがアクティブな間のみ実行される hooks を定義します
2. **`settings.json` 内**：サブエージェントが開始または停止するときにメインセッションで実行される hooks を定義します

サブエージェントフロントマター内の hooks

サブエージェントの markdown ファイルで直接 hooks を定義します。これらの hooks は、その特定のサブエージェントがアクティブな間のみ実行され、終了時にクリーンアップされます。

フロントマター hooks は、Agent ツールまたは @-mention を通じてサブエージェントとして生成されるときに発火します。また、[`--agent`](#invoke-subagents-explicitly)または `agent` 設定でメインセッションとして実行される場合にも発火します。メインセッションの場合、[`settings.json`](/ja/hooks)で定義されている hooks と一緒に実行されます。

すべての[hook イベント](/ja/hooks#hook-events)がサポートされています。サブエージェントの最も一般的なイベントは：

| イベント | マッチャー入力 | 発火する場合 |
| :- | :- | :- |
| `PreToolUse` | ツール名 | サブエージェントがツールを使用する前 |
| `PostToolUse` | ツール名 | サブエージェントがツールを使用した後 |
| `Stop` | （なし） | サブエージェントが終了する場合（実行時に `SubagentStop` に変換） |

この例は、`PreToolUse` hook で Bash コマンドを検証し、`PostToolUse` でファイル編集後にリンターを実行します：

```yaml
---
name: code-reviewer
description: Review code changes with automatic linting
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate-command.sh $TOOL_INPUT"
  PostToolUse:
    - matcher: "Edit|Write"
      hooks:
        - type: command
          command: "./scripts/run-linter.sh"
---
```

フロントマター内の `Stop` hooks は自動的に `SubagentStop` イベントに変換されます。

サブエージェントイベント用のプロジェクトレベル hooks

メインセッションでサブエージェントのライフサイクルイベントに応答する hooks を `settings.json` で設定します。

| イベント | マッチャー入力 | 発火する場合 |
| :- | :- | :- |
| `SubagentStart` | エージェント型名 | サブエージェントが実行を開始する場合 |
| `SubagentStop` | エージェント型名 | サブエージェントが完了する場合 |

両方のイベントは、名前でエージェント型をターゲットにするマッチャーをサポートします。この例は、`db-agent` サブエージェントが開始するときのみセットアップスクリプトを実行し、サブエージェントが停止するときにクリーンアップスクリプトを実行します：

```json
{
  "hooks": {
    "SubagentStart": [
      {
        "matcher": "db-agent",
        "hooks": [
          { "type": "command", "command": "./scripts/setup-db-connection.sh" }
        ]
      }
    ],
    "SubagentStop": [
      {
        "hooks": [
          { "type": "command", "command": "./scripts/cleanup-db-connection.sh" }
        ]
      }
    ]
  }
}
```

完全な hook 設定形式については、[Hooks](/ja/hooks)を参照してください。

サブエージェントを使用する

自動委譲を理解する

Claude は、リクエスト内のタスク説明、サブエージェント設定の `description` フィールド、および現在のコンテキストに基づいて、タスクを自動的に委譲します。積極的な委譲を促進するには、サブエージェントの description フィールドに「use proactively」などのフレーズを含めます。

サブエージェントを明示的に呼び出す

自動委譲では不十分な場合、サブエージェント自体をリクエストできます。3 つのパターンは、1 回限りの提案からセッション全体のデフォルトまでエスカレートします：

- **自然言語**：プロンプトでサブエージェントに名前を付けます。Claude は委譲するかどうかを決定します
- **@-mention**：サブエージェントが 1 つのタスクで実行されることを保証します
- **セッション全体**：セッション全体が `--agent` フラグまたは `agent` 設定を通じてそのサブエージェントのシステムプロンプト、ツール制限、およびモデルを使用します

自然言語の場合、特別な構文はありません。サブエージェントに名前を付けると、Claude は通常委譲します：

```text
Use the test-runner subagent to fix failing tests
Have the code-reviewer subagent look at my recent changes
```

**サブエージェントを @-mention します。** `@` を入力し、タイプアヘッドからサブエージェントを選択します。ファイルを @-mention する方法と同じです。これにより、Claude の選択ではなく、特定のサブエージェントが実行されることが保証されます：

```text
@"code-reviewer (agent)" look at the auth changes
```

完全なメッセージは引き続き Claude に送信され、Claude はあなたが何を尋ねたかに基づいてサブエージェントのタスクプロンプトを作成します。@-mention は Claude が呼び出すサブエージェントを制御し、受け取るプロンプトではありません。

有効な[プラグイン](/ja/plugins)から提供されるサブエージェントは、タイプアヘッドに `my-plugin:code-reviewer` または `my-plugin:review:security` などのスコープ付き名で表示されます。プラグインが[サブエージェントをサブフォルダに整理](#choose-the-subagent-scope)する場合です。セッションで現在実行されている名前付きバックグラウンドサブエージェントもタイプアヘッドに表示され、名前の横にステータスが表示されます。ピッカーを使用せずに手動で mention を入力することもできます：ローカルサブエージェントの場合は `@agent-<name>`、プラグインサブエージェントの場合はスコープ付き名の後に `@agent-` を続けます。例えば `@agent-my-plugin:code-reviewer`。

**セッション全体をサブエージェントとして実行します。** [`--agent <name>`](/ja/cli-reference)を渡して、メインスレッド自体がそのサブエージェントのシステムプロンプト、ツール制限、およびモデルを採用するセッションを開始します：

```bash
claude --agent code-reviewer
```

サブエージェントのシステムプロンプトは、[`--system-prompt`](/ja/cli-reference)と同じように、デフォルト Claude Code システムプロンプトを完全に置き換えます。`CLAUDE.md` ファイルとプロジェクトメモリは引き続き通常のメッセージフローを通じて読み込まれます。エージェント名は起動ヘッダーに `@<name>` として表示されるため、アクティブであることを確認できます。

これは組み込みとカスタムの両方のサブエージェントで機能し、セッションを再開するときに選択が保持されます。

プラグイン提供のサブエージェントの場合、エージェント名を渡すだけで、Claude Code がそれを見つけます：

```bash
claude --agent security-reviewer
```

複数のプラグインが同じ名前のエージェントを提供する場合、スコープ付き名を渡して曖昧性を解消します：

```bash
claude --agent my-plugin:security-reviewer
```

プラグインがエージェントを `agents/` ディレクトリのサブフォルダに配置する場合、スコープ付き名にサブフォルダを含めます。例えば `claude --agent my-plugin:review:security`。

プロジェクト内のすべてのセッションのデフォルトにするには、`.claude/settings.json` で `agent` を設定します：

```json
{
  "agent": "code-reviewer"
}
```

両方が存在する場合、CLI フラグが設定をオーバーライドします。

サブエージェントをフォアグラウンドまたはバックグラウンドで実行する

サブエージェントは、フォアグラウンド（ブロッキング）またはバックグラウンド（並行）で実行できます：

- **フォアグラウンドサブエージェント** は、完了するまでメイン会話をブロックします。権限プロンプトは発生時にあなたに渡されます。
- **バックグラウンドサブエージェント** は、作業を続ける間に並行して実行されます。v2.1.186 以降、バックグラウンドサブエージェントが権限が必要なツール呼び出しに到達すると、プロンプトがメインセッションに表示され、要求しているサブエージェントの名前が付けられます。承認してサブエージェントを続行させるか、Esc を押してそのツール呼び出しのみを拒否し、サブエージェントを停止しないようにします。v2.1.186 より前は、バックグラウンドサブエージェントはプロンプトが表示されるツール呼び出しを自動拒否していました。

Claude は、タスクに基づいてサブエージェントをフォアグラウンドまたはバックグラウンドで実行するかどうかを決定します。また、以下を実行できます：

- Claude に「run this in the background」と依頼する
- **Ctrl+B** を押して実行中のタスクをバックグラウンドにする

すべてのバックグラウンドタスク機能を無効にするには、`CLAUDE_CODE_DISABLE_BACKGROUND_TASKS` 環境変数を `1` に設定します。[環境変数](/ja/env-vars)を参照してください。

[`CLAUDE_CODE_FORK_SUBAGENT`](#fork-the-current-conversation)が `1` に設定されている場合、すべてのサブエージェント生成は `background` フィールドに関係なくバックグラウンドで実行されます。これらのバックグラウンドサブエージェントからの権限プロンプトは、上記で説明したようにメインセッションに表示されます。

一般的なパターン

大量操作を分離する

サブエージェントの最も効果的な用途の 1 つは、大量の出力を生成する操作を分離することです。テストの実行、ドキュメントの取得、またはログファイルの処理は、かなりのコンテキストを消費できます。これらをサブエージェントに委譲することで、詳細な出力はサブエージェントのコンテキストに留まり、関連する概要のみがメイン会話に返されます。

```text
Use a subagent to run the test suite and report only the failing tests with their error messages
```

並行研究を実行する

独立した調査の場合、複数のサブエージェントを生成して同時に動作させます：

```text
Research the authentication, database, and API modules in parallel using separate subagents
```

各サブエージェントは独立して領域を探索し、Claude は結果を統合します。これは、研究パスが互いに依存しない場合に最適に機能します。

サブエージェントが完了すると、その結果がメイン会話に返されます。詳細な結果を返す多くのサブエージェントを実行すると、かなりのコンテキストを消費できます。

持続的な並列性が必要なタスクまたはコンテキストウィンドウを超えるタスクの場合、[エージェントチーム](/ja/agent-teams)は各ワーカーに独立したコンテキストを提供します。

サブエージェントをチェーンする

マルチステップワークフローの場合、Claude にサブエージェントを順序立てて使用するよう依頼します。各サブエージェントはタスクを完了して結果を Claude に返し、Claude は関連するコンテキストを次のサブエージェントに渡します。

```text
Use the code-reviewer subagent to find performance issues, then use the optimizer subagent to fix them
```

サブエージェントとメイン会話の選択

**メイン会話** を使用する場合：

- タスクが頻繁なやり取りまたは反復的な改善が必要な場合
- 複数のフェーズが重要なコンテキストを共有する場合（計画 → 実装 → テスト）
- 迅速でターゲット化された変更を行う場合
- レイテンシが重要な場合。サブエージェントは新規に開始し、コンテキストを収集するのに時間がかかる場合があります

**サブエージェント** を使用する場合：

- タスクがメインコンテキストで不要な詳細な出力を生成する場合
- 特定のツール制限または権限を強制したい場合
- 作業が自己完結型で、概要を返すことができる場合

代わりに[スキル](/ja/skills)を検討してください。メイン会話コンテキストで実行される再利用可能なプロンプトまたはワークフローが必要な場合、分離されたサブエージェントコンテキストではなく。

会話に既にあるものについての簡単な質問の場合は、サブエージェントの代わりに[`/btw`](/ja/interactive-mode#side-questions-with-%2Fbtw)を使用します。完全なコンテキストを表示しますが、ツールアクセスはなく、答えは履歴に追加されるのではなく破棄されます。

ネストされたサブエージェントを生成する

Claude Code v2.1.172 以降、サブエージェントは独自のサブエージェントを生成できます。委譲されたタスク自体が並行サブタスクに分割される場合、これを使用します。例えば、レビュアーサブエージェントが検出結果ごとに検証者をディスパッチする場合、中間出力がメイン会話に到達することはありません。トップレベルのサブエージェントの概要のみがあなたに返されます。

ネストされたサブエージェントは、トップレベルのものと同じ方法で設定され、同じ[スコープ](#choose-the-subagent-scope)から解決されます。プロンプト入力の下のサブエージェントパネルは、完全なツリーを表示します：各行は子孫の `(+N)` カウントを表示し、行を開くとそのサブエージェントの直接の子が `main` へのパスとともに表示されます。[`/agents`](#use-the-%2Fagents-command)の Running タブは、実行中のサブエージェントをフラットリストとして表示します。

深さは、各レベルが[フォアグラウンドまたはバックグラウンド](#run-subagents-in-foreground-or-background)で実行されるかどうかに関係なく、メイン会話の下のサブエージェントレベルの数として数えられます。深さ 5 のサブエージェントは Agent ツールを受け取らず、さらに生成することはできません。制限は固定されており、設定不可能です。

Claude Code v2.1.187 以降、バックグラウンドサブエージェントの深さは最初に生成されるときに固定され、後で[再開](#resume-subagents)しても深さは変わりません。例えば、メイン会話がサブエージェント A を生成し、A が深さ 2 でバックグラウンドサブエージェント B を生成する場合、B はメイン会話から直接再開するときも深さ 2 のままです。サブエージェントをより浅いコンテキストから再開しても、深さ制限が既に防止した追加レベルを生成させることはできません。

特定のサブエージェントが他のサブエージェントを生成するのを防ぐには、その [`tools`](#available-tools) リストから `Agent` を省略するか、`disallowedTools` に追加します。

[フォーク](#fork-the-current-conversation)は引き続き別のフォークを生成することはできません。他のサブエージェントタイプを生成でき、それらは深さ制限にカウントされます。

サブエージェントコンテキストを管理する

スタートアップで読み込まれるもの

各サブエージェントは、新しい分離されたコンテキストウィンドウで開始します。会話履歴、既に呼び出したスキル、または Claude が既に読み込んだファイルは表示されません。Claude はタスクを要約した委譲メッセージを作成し、サブエージェントはそこから動作します。例外は[フォーク](#fork-the-current-conversation)で、新規に開始するのではなく親会話を継承します。

非フォークサブエージェントの初期コンテキストには以下が含まれます：

- **システムプロンプト**：エージェント自身のプロンプトと Claude Code が追加する環境詳細。完全な Claude Code システムプロンプトではありません。カスタムサブエージェントは[マークダウン本体](#write-subagent-files)または `prompt` フィールドで定義します。組み込みエージェントは事前定義されたプロンプトを持ちます。
- **タスクメッセージ**：Claude が作業を引き継ぐときに作成する委譲プロンプト。
- **CLAUDE.md とメモリ**：メイン会話が読み込む[メモリ階層](/ja/memory#how-claude-md-files-load)のすべてのレベル。`~/.claude/CLAUDE.md`、プロジェクトルール、`CLAUDE.local.md`、および管理ポリシーファイルを含みます。組み込みの Explore および Plan エージェントはこれをスキップします。
- **Git ステータス**：親セッションの開始時に取得されたスナップショット。ワーキングディレクトリが Git リポジトリでない場合、または [`includeGitInstructions`](/ja/settings#available-settings)が `false` の場合は不在です。Explore および Plan はそれに関係なくスキップします。
- **プリロードされたスキル**：エージェントの [`skills` フィールド](#preload-skills-into-subagents)で名前が付けられたスキルの完全なコンテンツ。組み込みエージェントはスキルをプリロードしません。

Explore および Plan は、CLAUDE.md と git ステータスを省略する唯一のサブエージェントです。どのエージェントがそれらをスキップするかを変更するフロントマターフィールドまたはエージェント単位の設定はありません。

メイン会話は Explore および Plan の結果を完全な CLAUDE.md コンテキストで読み込むため、ほとんどのルールはサブエージェント自体に到達する必要はありません。「`vendor/` ディレクトリを無視する」などのルールが必須の場合は、委譲時に Claude に与えるプロンプトで再度述べてください。

サブエージェントを再開する

各サブエージェント呼び出しは、新しいコンテキストで新しいインスタンスを作成します。最初からやり直すのではなく、既存のサブエージェントの作業を続けるには、Claude に再開するよう依頼します。

再開されたサブエージェントは、すべての前のツール呼び出し、結果、および推論を含む、完全な会話履歴を保持します。サブエージェントは、新規に開始するのではなく、停止した場所から正確に再開します。

サブエージェントが完了すると、Claude はエージェント ID を受け取ります。組み込みの Explore および Plan エージェントは 1 回限りで、エージェント ID を返さないため、再開できません。作業を続ける必要がある場合は、`general-purpose` またはカスタムサブエージェントを使用してください。Claude は `SendMessage` ツールを使用してエージェントの ID を `to` フィールドとして使用してサブエージェントを再開します。`SendMessage` ツールは、[エージェントチーム](/ja/agent-teams)が有効になっている場合に常に利用可能です。`shutdown_request` および `plan_approval_response` などの構造化チームプロトコルメッセージには、[エージェントチーム](/ja/agent-teams)が有効になっている必要があります。

サブエージェントを再開するには、Claude に前の作業を続けるよう依頼します：

```text
Use the code-reviewer subagent to review the authentication module
[Agent completes]

Continue that code review and now analyze the authorization logic
[Claude resumes the subagent with full context from previous conversation]
```

停止したサブエージェントが `SendMessage` を受け取った場合、新しい `Agent` 呼び出しを必要とせずにバックグラウンドで自動再開します。

エージェント ID を明示的に参照したい場合は Claude に依頼することもできます。または、`~/.claude/projects/{project}/{sessionId}/subagents/` のトランスクリプトファイルで ID を見つけることができます。各トランスクリプトは `agent-{agentId}.jsonl` として保存されます。

サブエージェントトランスクリプトはメイン会話から独立して永続化されます：

- **メイン会話圧縮**：メイン会話が圧縮されると、サブエージェントトランスクリプトは影響を受けません。別のファイルに保存されます。
- **セッション永続性**：サブエージェントトランスクリプトはセッション内で永続化されます。Claude Code を再起動した後、同じセッションを再開することでサブエージェントを再開できます。
- **自動クリーンアップ**：トランスクリプトは `cleanupPeriodDays` 設定に基づいてクリーンアップされます（デフォルト：30 日）。

自動圧縮

サブエージェントは、メイン会話と同じロジックを使用した自動圧縮をサポートします。圧縮は同じ条件下でトリガーされ、`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` はサブエージェントにも適用されます。[環境変数](/ja/env-vars)を参照してください。オーバーライドがいつ有効になるかについて。

圧縮イベントはサブエージェントトランスクリプトファイルにログされます：

```json
{
  "type": "system",
  "subtype": "compact_boundary",
  "compactMetadata": {
    "trigger": "auto",
    "preTokens": 167189
  }
}
```

`preTokens` 値は、圧縮が発生する前に使用されたトークン数を示します。

現在の会話をフォークする

フォークされたサブエージェントは Claude Code v2.1.117 以降が必要です。v2.1.161 以降では `/fork` コマンドはデフォルトで有効になります。それより前のバージョンでは [`CLAUDE_CODE_FORK_SUBAGENT`](/ja/env-vars) 環境変数を `1` に設定する必要があります。Claude 自体がフォークをスポーンすることは実験的であり、将来のリリースで変更される可能性があります。この機能は、段階的なロールアウトの一部として、インタラクティブセッションでも有効にすることができます。

フォークは、これまでの会話全体を継承するサブエージェントです。これにより、サブエージェントが通常提供する入力分離が削除されます。フォークはメインセッションと同じシステムプロンプト、ツール、モデル、およびメッセージ履歴を表示するため、状況を再度説明することなく、サイドタスクを渡すことができます。フォークのツール呼び出しはまだ会話から除外され、最終結果のみが返されるため、メインコンテキストウィンドウはクリーンなままです。フォークを使用する場合は、名前付きサブエージェントが有用であるには背景が多すぎる場合、または同じ開始点から複数のアプローチを並行して試したい場合です。

フォークモードを段階的なロールアウトに関係なく制御するには、[`CLAUDE_CODE_FORK_SUBAGENT`](/ja/env-vars) を `1` に設定して明示的に有効にするか、`0` に設定して無効にします。この変数はインタラクティブモードおよび SDK または `claude -p` 経由で有効になります。

フォークモードを有効にすると、Claude Code が 2 つの方法で変更されます：

- Claude は、`fork` サブエージェントタイプを明示的にリクエストすることでフォークをスポーンできます。サブエージェントタイプなしのスポーンは、[汎用](#built-in-subagents)サブエージェントを使用し、Explore などの名前付きサブエージェントは以前と同じようにスポーンされます。
- すべてのサブエージェントスポーンは、[バックグラウンド](#run-subagents-in-foreground-or-background)で実行されます。フォークか名前付きサブエージェントかに関わらず実行されます。`CLAUDE_CODE_DISABLE_BACKGROUND_TASKS` を `1` に設定して、スポーンを同期的に保つことができます。

`/fork` の後に指示を続けて、フォークを自分で開始できます。変数が設定されているかどうかに関わらず実行できます。Claude Code はフォークに指示の最初の単語から名前を付けます。次の例は、メインセッションで実装を続ける間に、フォークが会話をドラフトテストケースに分岐させます：

```text
/fork draft unit tests for the parser changes so far
```

フォークはプロンプト入力の下のパネルに表示され、作業を続ける間にバックグラウンドで実行されます。完了すると、その結果がメイン会話にメッセージとして到着します。次のセクションでは、実行中のフォークを監視して操作するためのパネルコントロールについて説明します。

実行中のフォークを観察して操作する

実行中のフォークはプロンプト入力の下のパネルに表示され、メインセッション用に 1 行、各フォーク用に 1 行があります。これらのキーを使用してパネルと対話します：

| キー | アクション |
| :- | :- |
| `↑` / `↓` | 行間を移動 |
| `Enter` | 選択したフォークのトランスクリプトを開き、フォローアップメッセージを送信 |
| `x` | 完了したフォークを閉じるか、実行中のフォークを停止 |
| `Esc` | フォーカスをプロンプト入力に戻す |

フォークと名前付きサブエージェントの違い

フォークはメインセッションがその時点で持っているすべてを継承します。名前付きサブエージェントは独自の定義から開始します。

| | フォーク | 名前付きサブエージェント |
| :- | :- | :- |
| コンテキスト | 完全な会話履歴 | 渡すプロンプトを使用した新しいコンテキスト |
| システムプロンプトとツール | メインセッションと同じ | [定義ファイル](#write-subagent-files)から |
| モデル | メインセッションと同じ | サブエージェントの `model` フィールドから |
| 権限 | プロンプトがターミナルに表示 | バックグラウンド実行時に[メインセッションに表示](#run-subagents-in-foreground-or-background) |
| プロンプトキャッシュ | メインセッションと共有 | 別のキャッシュ |

フォークのシステムプロンプトとツール定義は親と同じであるため、最初のリクエストは親の [prompt cache](/ja/prompt-caching#subagents-and-the-cache) を再利用します。これにより、同じコンテキストが必要なタスクの場合、フォークは新しいサブエージェントをスポーンするよりも安価です。

Claude が Agent ツール経由でフォークをスポーンするときに、`isolation: "worktree"` を渡すことができるため、フォークのファイル編集は、チェックアウトではなく、別の git worktree に書き込まれます。

制限事項

`CLAUDE_CODE_FORK_SUBAGENT=1` を設定すると、インタラクティブセッション、[非インタラクティブモード](/ja/headless)、および Agent SDK でフォークモードが有効になります。`CLAUDE_CODE_FORK_SUBAGENT` を `0` に設定するとフォークモードが無効になり、サーバー側のロールアウトを含むすべての場所でフォークモードが無効になります。フォークはさらにフォークをスポーンできません。

サブエージェントの例

これらの例は、サブエージェントを構築するための効果的なパターンを示しています。出発点として使用するか、Claude を使用してカスタマイズされたバージョンを生成します。

**ベストプラクティス：**

- **焦点を絞ったサブエージェントを設計する：** 各サブエージェントは 1 つの特定のタスクに優れている必要があります
- **詳細な説明を書く：** Claude は説明を使用して委譲するかどうかを決定します
- **ツールアクセスを制限する：** セキュリティと焦点のために必要な権限のみを付与します
- **バージョン管理にチェックインする：** プロジェクトサブエージェントをチームと共有します

コードレビュアー

コードを変更せずにレビューする読み取り専用サブエージェント。この例は、制限されたツールアクセス（Edit または Write なし）と、何を探すべきか、出力をどのようにフォーマットするかを正確に指定する詳細なプロンプトを使用して、焦点を絞ったサブエージェントを設計する方法を示しています。

```markdown
---
name: code-reviewer
description: Expert code review specialist. Proactively reviews code for quality, security, and maintainability. Use immediately after writing or modifying code.
tools: Read, Grep, Glob, Bash
model: inherit
---

You are a senior code reviewer ensuring high standards of code quality and security.

When invoked:
1. Run git diff to see recent changes
2. Focus on modified files
3. Begin review immediately

Review checklist:
- Code is clear and readable
- Functions and variables are well-named
- No duplicated code
- Proper error handling
- No exposed secrets or API keys
- Input validation implemented
- Good test coverage
- Performance considerations addressed

Provide feedback organized by priority:
- Critical issues (must fix)
- Warnings (should fix)
- Suggestions (consider improving)

Include specific examples of how to fix issues.
```

デバッガー

問題を分析して修正できるサブエージェント。コードレビュアーとは異なり、このサブエージェントはバグの修正にはコード変更が必要なため、Edit を含みます。プロンプトは診断から検証までの明確なワークフローを提供します。

```markdown
---
name: debugger
description: Debugging specialist for errors, test failures, and unexpected behavior. Use proactively when encountering any issues.
tools: Read, Edit, Bash, Grep, Glob
---

You are an expert debugger specializing in root cause analysis.

When invoked:
1. Capture error message and stack trace
2. Identify reproduction steps
3. Isolate the failure location
4. Implement minimal fix
5. Verify solution works

Debugging process:
- Analyze error messages and logs
- Check recent code changes
- Form and test hypotheses
- Add strategic debug logging
- Inspect variable states

For each issue, provide:
- Root cause explanation
- Evidence supporting the diagnosis
- Specific code fix
- Testing approach
- Prevention recommendations

Focus on fixing the underlying issue, not the symptoms.
```

データサイエンティスト

データ分析作業向けのドメイン固有のサブエージェント。この例は、典型的なコーディングタスク以外の特化したワークフロー向けのサブエージェントを作成する方法を示しています。より有能な分析のために `model: sonnet` を明示的に設定します。

```markdown
---
name: data-scientist
description: Data analysis expert for SQL queries, BigQuery operations, and data insights. Use proactively for data analysis tasks and queries.
tools: Bash, Read, Write
model: sonnet
---

You are a data scientist specializing in SQL and BigQuery analysis.

When invoked:
1. Understand the data analysis requirement
2. Write efficient SQL queries
3. Use BigQuery command line tools (bq) when appropriate
4. Analyze and summarize results
5. Present findings clearly

Key practices:
- Write optimized SQL queries with proper filters
- Use appropriate aggregations and joins
- Include comments explaining complex logic
- Format results for readability
- Provide data-driven recommendations

For each analysis:
- Explain the query approach
- Document any assumptions
- Highlight key findings
- Suggest next steps based on data

Always ensure queries are efficient and cost-effective.
```

データベースクエリバリデーター

Bash アクセスを許可しますが、読み取り専用 SQL クエリのみを許可するようにコマンドを検証するサブエージェント。この例は、`tools` フィールドが提供するよりも細かい制御が必要な場合に、`PreToolUse` hooks を使用して条件付き検証を行う方法を示しています。

```markdown
---
name: db-reader
description: Execute read-only database queries. Use when analyzing data or generating reports.
tools: Bash
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate-readonly-query.sh"
---

You are a database analyst with read-only access. Execute SELECT queries to answer questions about the data.

When asked to analyze data:
1. Identify which tables contain the relevant data
2. Write efficient SELECT queries with appropriate filters
3. Present results clearly with context

You cannot modify data. If asked to INSERT, UPDATE, DELETE, or modify schema, explain that you only have read access.
```

Claude Code は[hook 入力を JSON として](/ja/hooks#pretooluse-input)stdin を通じて hook コマンドに渡します。検証スクリプトはこの JSON を読み取り、実行されるコマンドを抽出し、SQL 書き込み操作のリストに対してチェックします。書き込み操作が検出された場合、スクリプトは[終了コード 2](/ja/hooks#exit-code-2-behavior-per-event)で終了して、stderr を通じて Claude にエラーメッセージを返します。

プロジェクト内の任意の場所に検証スクリプトを作成します。パスは hook 設定の `command` フィールドと一致する必要があります：

```bash
#!/bin/bash
# Blocks SQL write operations, allows SELECT queries

# Read JSON input from stdin
INPUT=$(cat)

# Extract the command field from tool_input using jq
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [ -z "$COMMAND" ]; then
  exit 0
fi

# Block write operations (case-insensitive)
if echo "$COMMAND" | grep -iE '\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|REPLACE|MERGE)\b' > /dev/null; then
  echo "Blocked: Write operations not allowed. Use SELECT queries only." >&2
  exit 2
fi

exit 0
```

macOS と Linux では、スクリプトを実行可能にします：

```bash
chmod +x ./scripts/validate-readonly-query.sh
```

Windows では、検証スクリプトを PowerShell で記述し、hook エントリに `shell: powershell` を追加します。[PowerShell で hooks を実行する](/ja/hooks#windows-powershell-tool)を参照してください。

hook は stdin を通じて JSON を受け取り、Bash コマンドは `tool_input.command` にあります。終了コード 2 は操作をブロックし、エラーメッセージを Claude にフィードバックします。終了コードと出力の詳細については[Hooks](/ja/hooks#exit-code-output)を参照し、完全な入力スキーマについては[Hook 入力](/ja/hooks#pretooluse-input)を参照してください。

次のステップ

サブエージェントを理解したので、これらの関連機能を探索してください：

- [プラグインでサブエージェントを配布する](/ja/plugins)ことで、チームまたはプロジェクト全体でサブエージェントを共有します
- [Claude Code をプログラムで実行する](/ja/headless)ことで、Agent SDK を使用して CI/CD と自動化を行います
- [MCP サーバーを使用する](/ja/mcp)ことで、サブエージェントに外部ツールとデータへのアクセスを提供します
