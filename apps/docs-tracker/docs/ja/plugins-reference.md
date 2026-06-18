---
title: plugins-reference
source: https://code.claude.com/docs/ja/plugins-reference.md
---

# プラグインリファレンス

> Claude Code プラグインシステムの完全な技術リファレンス。スキーマ、CLI コマンド、コンポーネント仕様を含みます。

プラグインをインストールしたいですか？[プラグインの検出とインストール](/ja/discover-plugins)を参照してください。プラグインの作成については、[プラグイン](/ja/plugins)を参照してください。プラグインの配布については、[プラグインマーケットプレイス](/ja/plugin-marketplaces)を参照してください。

このリファレンスは、Claude Code プラグインシステムの完全な技術仕様を提供します。コンポーネントスキーマ、CLI コマンド、開発ツールを含みます。

**プラグイン**は、Claude Code をカスタム機能で拡張する自己完結型のコンポーネントディレクトリです。プラグインコンポーネントには、skills、agents、hooks、MCP servers、LSP servers、monitors が含まれます。

プラグインコンポーネントリファレンス

Skills

プラグインは Claude Code に skills を追加し、`/name` ショートカットを作成します。これらは、あなたまたは Claude が呼び出すことができます。

**場所**: プラグインルートの `skills/` または `commands/` ディレクトリ、またはプラグインルートの単一の `SKILL.md` ファイル

**ファイル形式**: Skills はディレクトリで `SKILL.md` を含みます。commands はシンプルなマークダウンファイルです。

**Skill 構造**:

```text
skills/
├── pdf-processor/
│   ├── SKILL.md
│   ├── reference.md (optional)
│   └── scripts/ (optional)
└── code-reviewer/
    └── SKILL.md
```

**統合動作**:

- Skills と commands はプラグインがインストールされると自動的に検出されます
- Claude はタスクコンテキストに基づいて自動的にそれらを呼び出すことができます
- Skills は SKILL.md の横にサポートファイルを含めることができます

プラグインに `skills/` ディレクトリがなく、`skills` manifest フィールドがない場合、プラグインルートの `SKILL.md` は単一の skill として読み込まれます。frontmatter の `name` フィールドを設定して、skill の呼び出し名を制御します。これがない場合、Claude Code はインストールディレクトリ名にフォールバックします。マーケットプレイスからインストールされたプラグインの場合、これは更新のたびに変わるバージョン文字列です。複数の skill を配布するプラグインの場合は、上記の `skills/` ディレクトリレイアウトを使用してください。

詳細については、[Skills](/ja/skills)を参照してください。

Agents

プラグインは、特定のタスク用の特化した subagents を提供できます。Claude は必要に応じて自動的にそれらを呼び出すことができます。

**場所**: プラグインルートの `agents/` ディレクトリ

**ファイル形式**: エージェント機能を説明するマークダウンファイル

**Agent 構造**:

```markdown
---
name: agent-name
description: このエージェントが専門とする内容と、Claude がそれを呼び出すべき時期
model: sonnet
effort: medium
maxTurns: 20
disallowedTools: Write, Edit
---

エージェントの役割、専門知識、動作を説明する詳細なシステムプロンプト。
```

プラグインエージェントは `name`、`description`、`model`、`effort`、`maxTurns`、`tools`、`disallowedTools`、`skills`、`memory`、`background`、`isolation` frontmatter フィールドをサポートしています。唯一の有効な `isolation` 値は `"worktree"` です。セキュリティ上の理由から、`hooks`、`mcpServers`、`permissionMode` はプラグイン提供のエージェントではサポートされていません。

**統合ポイント**:

- Agents は `/agents` インターフェイスに表示されます
- Claude はタスクコンテキストに基づいて自動的にエージェントを呼び出すことができます
- Agents はユーザーが手動で呼び出すことができます
- プラグインエージェントは組み込みの Claude エージェントと一緒に動作します

詳細については、[Subagents](/ja/sub-agents)を参照してください。

Hooks

プラグインは Claude Code イベントに自動的に応答するイベントハンドラーを提供できます。

**場所**: プラグインルートの `hooks/hooks.json`、または plugin.json 内のインライン

**形式**: イベントマッチャーとアクションを含む JSON 設定

**Hook 設定**:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}\"/scripts/format-code.sh"
          }
        ]
      }
    ]
  }
}
```

プラグイン hooks は[ユーザー定義 hooks](/ja/hooks)と同じライフサイクルイベントに応答します:

| Event | When it fires |
| :- | :- |
| `SessionStart` | When a session begins or resumes |
| `Setup` | When you start Claude Code with `--init-only`, or with `--init` or `--maintenance` in `-p` mode. For one-time preparation in CI or scripts |
| `UserPromptSubmit` | When you submit a prompt, before Claude processes it |
| `UserPromptExpansion` | When a user-typed command expands into a prompt, before it reaches Claude. Can block the expansion |
| `PreToolUse` | Before a tool call executes. Can block it |
| `PermissionRequest` | When a permission dialog appears |
| `PermissionDenied` | When a tool call is denied by the auto mode classifier. Return `{retry: true}` to tell the model it may retry the denied tool call |
| `PostToolUse` | After a tool call succeeds |
| `PostToolUseFailure` | After a tool call fails |
| `PostToolBatch` | After a full batch of parallel tool calls resolves, before the next model call |
| `Notification` | When Claude Code sends a notification |
| `MessageDisplay` | While assistant message text is displayed |
| `SubagentStart` | When a subagent is spawned |
| `SubagentStop` | When a subagent finishes |
| `TaskCreated` | When a task is being created via `TaskCreate` |
| `TaskCompleted` | When a task is being marked as completed |
| `Stop` | When Claude finishes responding |
| `StopFailure` | When the turn ends due to an API error. Output and exit code are ignored |
| `TeammateIdle` | When an [agent team](/en/agent-teams) teammate is about to go idle |
| `InstructionsLoaded` | When a CLAUDE.md or `.claude/rules/*.md` file is loaded into context. Fires at session start and when files are lazily loaded during a session |
| `ConfigChange` | When a configuration file changes during a session |
| `CwdChanged` | When the working directory changes, for example when Claude executes a `cd` command. Useful for reactive environment management with tools like direnv |
| `FileChanged` | When a watched file changes on disk. The `matcher` field specifies which filenames to watch |
| `WorktreeCreate` | When a worktree is being created via `--worktree` or `isolation: "worktree"`. Replaces default git behavior |
| `WorktreeRemove` | When a worktree is being removed, either at session exit or when a subagent finishes |
| `PreCompact` | Before context compaction |
| `PostCompact` | After context compaction completes |
| `Elicitation` | When an MCP server requests user input during a tool call |
| `ElicitationResult` | After a user responds to an MCP elicitation, before the response is sent back to the server |
| `SessionEnd` | When a session terminates |

**Hook タイプ**:

- `command`: シェルコマンドまたはスクリプトを実行
- `http`: イベント JSON を URL への POST リクエストとして送信
- `mcp_tool`: 設定された[MCP server](/ja/mcp)上のツールを呼び出す
- `prompt`: LLM でプロンプトを評価（コンテキストの `$ARGUMENTS` プレースホルダーを使用）
- `agent`: 複雑な検証タスク用のツール付き agentic verifier を実行

MCP servers

プラグインは Model Context Protocol（MCP）servers をバンドルして、Claude Code を外部ツールおよびサービスに接続できます。

**場所**: プラグインルートの `.mcp.json`、または plugin.json 内のインライン

**形式**: 標準 MCP サーバー設定

**MCP サーバー設定**:

```json
{
  "mcpServers": {
    "plugin-database": {
      "command": "${CLAUDE_PLUGIN_ROOT}/servers/db-server",
      "args": ["--config", "${CLAUDE_PLUGIN_ROOT}/config.json"],
      "env": {
        "DB_PATH": "${CLAUDE_PLUGIN_ROOT}/data"
      }
    },
    "plugin-api-client": {
      "command": "npx",
      "args": ["@company/mcp-server", "--plugin-mode"],
      "cwd": "${CLAUDE_PLUGIN_ROOT}"
    }
  }
}
```

**統合動作**:

- プラグイン MCP servers はプラグインが有効になると自動的に開始されます
- Servers は Claude のツールキットに標準 MCP ツールとして表示されます
- サーバー機能は Claude の既存ツールとシームレスに統合されます
- プラグインサーバーはユーザー MCP servers とは独立して設定できます

LSP servers

LSP プラグインを使用したいですか？公式マーケットプレイスからインストールしてください。`/plugin` Discover タブで「lsp」を検索してください。このセクションでは、公式マーケットプレイスでカバーされていない言語用の LSP プラグインを作成する方法を説明しています。

プラグインは [Language Server Protocol](https://microsoft.github.io/language-server-protocol/)（LSP）servers を提供して、Claude がコードベースで作業する際にリアルタイムコード インテリジェンスを得ることができます。

LSP 統合は以下を提供します:

- **即座の診断**: Claude は各編集後すぐにエラーと警告を確認できます
- **コードナビゲーション**: 定義へのジャンプ、参照の検索、ホバー情報
- **言語認識**: コードシンボルの型情報とドキュメント

**場所**: プラグインルートの `.lsp.json`、または `plugin.json` 内のインライン

**形式**: 言語サーバー名をその設定にマップする JSON 設定

**`.lsp.json` ファイル形式**:

```json
{
  "go": {
    "command": "gopls",
    "args": ["serve"],
    "extensionToLanguage": {
      ".go": "go"
    }
  }
}
```

**`plugin.json` 内のインライン**:

```json
{
  "name": "my-plugin",
  "lspServers": {
    "go": {
      "command": "gopls",
      "args": ["serve"],
      "extensionToLanguage": {
        ".go": "go"
      }
    }
  }
}
```

**必須フィールド:**

| フィールド | 説明 |
| :- | :- |
| `command` | 実行する LSP バイナリ（PATH に含まれている必要があります） |
| `extensionToLanguage` | ファイル拡張子を言語識別子にマップ |

**オプションフィールド:**

| フィールド | 説明 |
| :- | :- |
| `args` | LSP サーバーのコマンドライン引数 |
| `transport` | 通信トランスポート: `stdio`（デフォルト）または `socket` |
| `env` | サーバー起動時に設定する環境変数 |
| `initializationOptions` | 初期化中にサーバーに渡されるオプション |
| `settings` | `workspace/didChangeConfiguration` 経由で渡される設定 |
| `workspaceFolder` | サーバーのワークスペースフォルダーパス |
| `startupTimeout` | サーバー起動を待つ最大時間（ミリ秒） |
| `maxRestarts` | 諦める前の最大再起動試行回数 |
| `diagnostics` | 編集後に診断を Claude のコンテキストにプッシュするかどうか（デフォルト `true`）。コードナビゲーションは保持しながら自動診断注入を抑制するには `false` に設定します。 |

**言語サーバーバイナリを別途インストールする必要があります。** LSP プラグインは Claude Code が言語サーバーに接続する方法を設定しますが、サーバー自体は含まれていません。`/plugin` Errors タブに `Executable not found in $PATH` が表示される場合は、言語に必要なバイナリをインストールしてください。

**利用可能な LSP プラグイン:**

| プラグイン | 言語サーバー | インストールコマンド |
| :- | :- | :- |
| `pyright-lsp` | Pyright（Python） | `pip install pyright` または `npm install -g pyright` |
| `typescript-lsp` | TypeScript Language Server | `npm install -g typescript-language-server typescript` |
| `rust-analyzer-lsp` | rust-analyzer | [rust-analyzer インストールを参照](https://rust-analyzer.github.io/manual.html#installation) |

言語サーバーをまずインストールしてから、マーケットプレイスからプラグインをインストールしてください。

Monitors

プラグインは、プラグインがアクティブな場合に Claude Code が自動的に開始するバックグラウンド monitors を宣言できます。各 monitor はセッションの期間中シェルコマンドを実行し、すべての stdout 行を Claude に通知として配信するため、Claude は自分自身に開始するよう求められることなく、ログエントリ、ステータス変更、またはポーリングされたイベントに反応できます。

プラグイン monitors は[Monitor tool](/ja/tools-reference#monitor-tool)と同じメカニズムを使用し、その可用性制約を共有します。これらはインタラクティブ CLI セッションでのみ実行され、[hooks](#hooks)と同じ信頼レベルでサンドボックス化されずに実行され、Monitor tool が利用できないホストではスキップされます。

プラグイン monitors には Claude Code v2.1.105 以降が必要です。

**場所**: プラグインルートの `monitors/monitors.json`、または plugin.json 内のインライン

**形式**: monitor エントリの JSON 配列

次の `monitors/monitors.json` はデプロイメントステータスエンドポイントとローカルエラーログを監視します:

```json
[
  {
    "name": "deploy-status",
    "command": "\"${CLAUDE_PLUGIN_ROOT}\"/scripts/poll-deploy.sh ${user_config.api_endpoint}",
    "description": "Deployment status changes"
  },
  {
    "name": "error-log",
    "command": "tail -F ./logs/error.log",
    "description": "Application error log",
    "when": "on-skill-invoke:debug"
  }
]
```

monitors をインラインで宣言するには、`plugin.json` の `experimental.monitors` を同じ配列に設定します。デフォルト以外のパスから読み込むには、`experimental.monitors` を `"./config/monitors.json"` などの相対パス文字列に設定します。Monitors は[実験的コンポーネント](#experimental-components)です。

**必須フィールド:**

| フィールド | 説明 |
| :- | :- |
| `name` | プラグイン内で一意の識別子。プラグインが再読み込みされるか skill が再度呼び出されるときに重複プロセスを防ぎます |
| `command` | セッション作業ディレクトリで永続的なバックグラウンドプロセスとして実行されるシェルコマンド |
| `description` | 監視対象の簡潔な概要。タスクパネルと通知サマリーに表示されます |

**オプションフィールド:**

| フィールド | 説明 |
| :- | :- |
| `when` | monitor がいつ開始するかを制御します。`"always"` はセッション開始時とプラグイン再読み込み時に開始し、デフォルトです。`"on-skill-invoke:<skill-name>"` はこのプラグイン内の名前付き skill が最初にディスパッチされるときに開始します |

`command` 値は MCP および LSP サーバー設定と同じ[変数置換](#environment-variables)をサポートします: `${CLAUDE_PLUGIN_ROOT}`、`${CLAUDE_PLUGIN_DATA}`、`${CLAUDE_PROJECT_DIR}`、`${user_config.*}`、および環境からの任意の `${ENV_VAR}`。スクリプトがプラグイン自体のディレクトリから実行される必要がある場合は、コマンドの前に `cd "${CLAUDE_PLUGIN_ROOT}" && ` を付けます。

セッション中にプラグインを無効にしても、既に実行中の monitors は停止しません。セッションが終了するときに停止します。

Themes

プラグインは、`/theme` に組み込みプリセットおよびユーザーのローカルテーマと一緒に表示される色テーマを配布できます。テーマは `themes/` 内の JSON ファイルで、`base` プリセットと色トークンのスパース `overrides` マップを持ちます。Themes は[実験的コンポーネント](#experimental-components)です。

```json
{
  "name": "Dracula",
  "base": "dark",
  "overrides": {
    "claude": "#bd93f9",
    "error": "#ff5555",
    "success": "#50fa7b"
  }
}
```

プラグインテーマを選択すると、`custom:<plugin-name>:<slug>` がユーザーの設定に保持されます。プラグインテーマは読み取り専用です。`/theme` で `Ctrl+E` を押すと、それが `~/.claude/themes/` にコピーされるため、ユーザーはコピーを編集できます。

***

プラグインインストールスコープ

プラグインをインストールするときは、プラグインが利用可能な場所と他のユーザーが使用できるかどうかを決定する**スコープ**を選択します。

| スコープ | 設定ファイル | ユースケース |
| :- | :- | :- |
| `user` | `~/.claude/settings.json` | すべてのプロジェクト全体で利用可能な個人プラグイン（デフォルト） |
| `project` | `.claude/settings.json` | バージョン管理経由で共有されるチームプラグイン |
| `local` | `.claude/settings.local.json` | プロジェクト固有のプラグイン、gitignored |
| `managed` | [管理設定](/ja/settings#settings-files) | 管理プラグイン（読み取り専用、更新のみ） |

プラグインは他の Claude Code 設定と同じスコープシステムを使用します。インストール手順とスコープフラグについては、[プラグインのインストール](/ja/discover-plugins#install-plugins)を参照してください。スコープの完全な説明については、[設定スコープ](/ja/settings#configuration-scopes)を参照してください。

***

Skills ディレクトリプラグイン

`.claude-plugin/plugin.json` マニフェストを含む skills ディレクトリの下のフォルダは、次のセッションで `<name>@skills-dir` という名前のプラグインとして読み込まれます。マーケットプレイスもインストール手順もありません。[`plugin init`](#plugin-init)でスキャフォルドしてください。マーケットプレイスインストールとは異なり、プラグインはプラグインキャッシュにコピーされるのではなく、所定の場所で検出されます。

skills ディレクトリツリーは 3 つの異なるものをサポートします:

| 何を持っているか | それは何か |
| :- | :- |
| `<skills-dir>/foo/SKILL.md` マニフェストなし | `foo` という名前の単純な[skill](/ja/skills) |
| `<skills-dir>/foo/.claude-plugin/plugin.json` | プラグイン `foo@skills-dir`。独自の skills、agents、hooks などをバンドルできます |
| `<plugin>/skills/bar/SKILL.md` | プラグイン内にパッケージされた skill `bar` |

プラグインが読み込まれる場所を選択

| Skills ディレクトリ | スコープ | 読み込み |
| :- | :- | :- |
| `~/.claude/skills/` | personal | すべてのプロジェクトで。場所があなただけのものだから |
| `<cwd>/.claude/skills/` | project | そのフォルダのワークスペース[信頼ダイアログ](/ja/settings)を受け入れた後のみ |

プロジェクトスコープ プラグインはリポジトリにチェックインされ、クローンしたすべての共同作業者に到達します。そのコンテンツはあなたではなくリポジトリから来るため、`.claude/settings.json` を管理するのと同じ信頼ゲートの後にのみ読み込まれます。コードを実行するコンポーネントはさらに制限されます:

- 宣言する MCP servers は、プロジェクト `.mcp.json` と同じ[サーバーごとの承認](/ja/mcp)を通過します
- LSP servers はワークスペースを信頼した後にのみ開始します
- [バックグラウンド monitors](#monitors)は読み込まれません

個人スコープ プラグインにはこれらの制限はありません。

プロジェクトスコープ `@skills-dir` プラグインは、Claude Code を開始したディレクトリの `.claude/skills/` からのみ読み込まれます。plain skills と commands が行うように[リポジトリルートまでウォークアップ](/ja/skills#automatic-discovery-from-parent-and-nested-directories)しません。そのため、サブディレクトリから起動するとリポジトリルートに存在するプラグインが見つかりません。リポジトリルートから起動するか、ディレクトリを変更した後に `/reload-plugins` を実行してください。

Skills ディレクトリプラグインを編集、再読み込み、無効化

skill の `SKILL.md` に加えた変更は現在のセッションで即座に有効になります。プラグインの他のコンポーネント（`hooks/`、`.mcp.json`、`agents/`、`output-styles/` など）への変更は有効になりません。`/reload-plugins` を実行するか Claude Code を再起動してそれらを取得してください。[ライブ変更検出](/ja/skills#live-change-detection)を参照してください。

skills ディレクトリプラグインの読み込みを停止するには、そのフォルダを削除するか、名前で無効にしてください。マーケットプレイスから何もインストールされなかったため、`uninstall` ステップはありません。

```bash
claude plugin disable my-tool@skills-dir
```

***

プラグインマニフェストスキーマ

`.claude-plugin/plugin.json` ファイルはプラグインのメタデータと設定を定義します。このセクションでは、サポートされているすべてのフィールドとオプションを説明しています。

マニフェストはオプションです。省略された場合、Claude Code は[デフォルト場所](#file-locations-reference)のコンポーネントを自動検出し、ディレクトリ名からプラグイン名を導出します。メタデータを提供するか、カスタムコンポーネントパスが必要な場合はマニフェストを使用してください。

完全なスキーマ

```json
{
  "name": "plugin-name",
  "displayName": "Plugin Name",
  "version": "1.2.0",
  "description": "Brief plugin description",
  "author": {
    "name": "Author Name",
    "email": "author@example.com",
    "url": "https://github.com/author"
  },
  "homepage": "https://docs.example.com/plugin",
  "repository": "https://github.com/author/plugin",
  "license": "MIT",
  "keywords": ["keyword1", "keyword2"],
  "skills": "./custom/skills/",
  "commands": ["./custom/commands/special.md"],
  "agents": ["./custom/agents/reviewer.md"],
  "hooks": "./config/hooks.json",
  "mcpServers": "./mcp-config.json",
  "outputStyles": "./styles/",
  "lspServers": "./.lsp.json",
  "experimental": {
    "themes": "./themes/",
    "monitors": "./monitors.json"
  },
  "dependencies": [
    "helper-lib",
    { "name": "secrets-vault", "version": "~2.1.0" }
  ]
}
```

必須フィールド

マニフェストを含める場合、`name` は唯一の必須フィールドです。

| フィールド | 型 | 説明 | 例 |
| :- | :- | :- | :- |
| `name` | string | 一意の識別子（kebab-case、スペースなし） | `"deployment-tools"` |

この名前はコンポーネントの名前空間に使用されます。たとえば、UI では、名前が `plugin-dev` のプラグインのエージェント `agent-creator` は `plugin-dev:agent-creator` として表示されます。

認識されないフィールド

Claude Code は認識しないトップレベルフィールドを無視します。別のエコシステムからのメタデータを `plugin.json` に保持でき、プラグインは引き続き読み込まれます。これにより、VS Code または Cursor 拡張マニフェスト、npm `package.json`、または MCPB/DXT バンドルマニフェストとしても機能する 1 つのマニフェストを保持することが実用的になります。

`claude plugin validate` は認識されないフィールドを警告として報告し、エラーではありません。フィールドが認識されたフィールドから 1 文字または 2 文字異なる場合、警告は意図された可能性のある名前を提案します。認識されないフィールド警告のみを持つプラグインは検証に合格し、実行時に読み込まれます。

型が間違っているフィールドは引き続き失敗します。たとえば、`keywords` 値が配列ではなく文字列である場合は読み込みエラーであり、`claude plugin validate` はそれをエラーとして報告します。

`--strict` を渡して警告をエラーとして扱います。CI で使用して、公開前に別のツールのマニフェストから残されたスペルミスのあるフィールド名またはフィールドをキャッチします。ただし、プラグインは実行時に読み込まれます。

```bash
claude plugin validate ./my-plugin --strict
```

メタデータフィールド

| フィールド | 型 | 説明 | 例 |
| :- | :- | :- | :- |
| `$schema` | string | エディタのオートコンプリートと検証用の JSON Schema URL。Claude Code はロード時にこのフィールドを無視します。 | `"https://json.schemastore.org/claude-code-plugin-manifest.json"` |
| `displayName` | string | `/plugin` ピッカーおよび他の UI サーフェスに表示される人間が読める名前。省略された場合は `name` にフォールバックします。`name` とは異なり、スペースと任意の大文字小文字を含むことができます。名前空間またはルックアップには使用されません。Claude Code v2.1.143 以降が必要です。 | `"Deployment Tools"` |
| `version` | string | オプション。セマンティックバージョン。これを設定するとプラグインをそのバージョン文字列にピン留めするため、ユーザーはバージョンをバンプしたときのみ更新を受け取ります。省略された場合、Claude Code は git コミット SHA にフォールバックするため、すべてのコミットが新しいバージョンとして扱われます。マーケットプレイスエントリにも設定されている場合、`plugin.json` が優先されます。[バージョン管理](#version-management)を参照してください。 | `"2.1.0"` |
| `description` | string | プラグインの目的の簡潔な説明 | `"Deployment automation tools"` |
| `author` | object | 著者情報 | `{"name": "Dev Team", "email": "dev@company.com"}` |
| `homepage` | string | ドキュメント URL | `"https://docs.example.com"` |
| `repository` | string | ソースコード URL | `"https://github.com/user/plugin"` |
| `license` | string | ライセンス識別子 | `"MIT"`、`"Apache-2.0"` |
| `keywords` | array | 検出タグ | `["deployment", "ci-cd"]` |
| `defaultEnabled` | boolean | ユーザーが設定を設定していない場合、プラグインが有効な状態で開始するかどうか。デフォルトは `true`。[デフォルト有効化](#default-enablement)を参照してください。Claude Code v2.1.154 以降が必要です。 | `false` |

デフォルト有効化

`plugin.json` で `defaultEnabled: false` を設定して、無効な状態でインストールされるプラグインを配布します。ユーザーは `claude plugin enable <plugin>` または `/plugin` インターフェイスでそれをオンにします。外部サービスに接続するプラグインなど、ユーザーがオプトインすべきコストまたはスコープを追加するプラグインに使用します。これには Claude Code v2.1.154 以降が必要です。以前のバージョンはフィールドを無視し、インストール時にプラグインを有効にします。

`defaultEnabled` は、他に何もプラグインの状態を決定していない場合のフォールバックです。2 つのことがそれより優先されます:

- **ユーザーの設定**: 任意の設定スコープの `enabledPlugins` のプラグインのエントリ。書き込まれると、プラグイン更新と再インストール全体で保持されるため、後のリリースで `defaultEnabled` を変更しても既存ユーザーをフリップしません。
- **依存関係要件**: プラグインがアクティブな別のプラグインによって必要とされる場合、Claude Code はインストール時または有効化時にそれに対して `true` を書き込みます。これにより明示的な設定が与えられるため、独自のデフォルトはもはや適用されません。[依存関係を持つプラグインを有効または無効にする](/ja/plugin-dependencies#enable-or-disable-a-plugin-with-dependencies)を参照してください。

同じフィールドはプラグインのマーケットプレイスエントリに表示でき、`plugin.json` の値より優先されます。[オプションプラグインフィールド](/ja/plugin-marketplaces#optional-plugin-fields)を参照してください。

コンポーネントパスフィールド

| フィールド | 型 | 説明 | 例 |
| :- | :- | :- | :- |
| `skills` | string\|array | `<name>/SKILL.md` を含むカスタム skill ディレクトリ（デフォルト `skills/` に加えて） | `"./custom/skills/"` |
| `commands` | string\|array | カスタムフラット `.md` skill ファイルまたはディレクトリ（デフォルト `commands/` を置き換え） | `"./custom/cmd.md"` または `["./cmd1.md"]` |
| `agents` | string\|array | カスタムエージェントファイル（デフォルト `agents/` を置き換え） | `"./custom/agents/reviewer.md"` |
| `hooks` | string\|array\|object | Hook 設定パスまたはインライン設定 | `"./my-extra-hooks.json"` |
| `mcpServers` | string\|array\|object | MCP 設定パスまたはインライン設定 | `"./my-extra-mcp-config.json"` |
| `outputStyles` | string\|array | カスタム出力スタイルファイル/ディレクトリ（デフォルト `output-styles/` を置き換え） | `"./styles/"` |
| `lspServers` | string\|array\|object | [Language Server Protocol](https://microsoft.github.io/language-server-protocol/)コード インテリジェンス用の設定（定義へのジャンプ、参照の検索など） | `"./.lsp.json"` |
| `experimental.themes` | string\|array | カラーテーマファイル/ディレクトリ（デフォルト `themes/` を置き換え）。[テーマ](#themes)を参照してください | `"./themes/"` |
| `experimental.monitors` | string\|array | プラグインがアクティブな場合に自動的に開始されるバックグラウンド[Monitor](/ja/tools-reference#monitor-tool)設定。[Monitors](#monitors)を参照してください | `"./monitors.json"` |
| `userConfig` | object | ユーザー設定可能な値は有効化時にプロンプトされます。[ユーザー設定](#user-configuration)を参照してください | 下記を参照 |
| `channels` | array | メッセージ注入用のチャネル宣言（Telegram、Slack、Discord スタイル）。[チャネル](#channels)を参照してください | 下記を参照 |
| `dependencies` | array | このプラグインが必要とする他のプラグイン。オプションで semver バージョン制約付き。[プラグイン依存関係バージョンを制約](/ja/plugin-dependencies)を参照してください | `[{ "name": "secrets-vault", "version": "~2.1.0" }]` |

実験的コンポーネント

`experimental` キーの下のコンポーネント、`themes` と `monitors` は、安定化する間にリリース間でマニフェストスキーマが変更される可能性があります。それらを宣言する場所は別の移行です。トップレベルはまだ機能し、`claude plugin validate` は警告を表示し、将来のリリースでは `experimental.*` が必要になります。

ユーザー設定

`userConfig` フィールドは、プラグインが有効になったときに Claude Code がユーザーにプロンプトする値を宣言します。ユーザーに `settings.json` を手動で編集させる代わりにこれを使用してください。

```json
{
  "userConfig": {
    "api_endpoint": {
      "type": "string",
      "title": "API endpoint",
      "description": "Your team's API endpoint"
    },
    "api_token": {
      "type": "string",
      "title": "API token",
      "description": "API authentication token",
      "sensitive": true
    }
  }
}
```

キーは有効な識別子である必要があります。各オプションはこれらのフィールドをサポートします:

| フィールド | 必須 | 説明 |
| :- | :- | :- |
| `type` | はい | `string`、`number`、`boolean`、`directory`、または `file` のいずれか |
| `title` | はい | 設定ダイアログに表示されるラベル |
| `description` | はい | フィールドの下に表示されるヘルプテキスト |
| `sensitive` | いいえ | `true` の場合、入力をマスクし、値を `settings.json` ではなくセキュアストレージに保存 |
| `required` | いいえ | `true` の場合、フィールドが空のときに検証が失敗 |
| `default` | いいえ | ユーザーが何も提供しない場合に使用される値 |
| `multiple` | いいえ | `string` タイプの場合、文字列の配列を許可 |
| `min` / `max` | いいえ | `number` タイプの境界 |

各値は MCP および LSP サーバー設定、hook コマンド、monitor コマンド、および skill とエージェントコンテンツ（機密でない値のみ）で `${user_config.KEY}` として置換可能です。すべての値はプラグインサブプロセスに `CLAUDE_PLUGIN_OPTION_<KEY>` 環境変数としてエクスポートされます。

機密でない値は `settings.json` の `pluginConfigs[<plugin-id>].options` に保存されます。機密値はシステムキーチェーン（またはキーチェーンが利用できない場合は `~/.claude/.credentials.json`）に移動します。キーチェーンストレージは OAuth トークンと共有され、約 2 KB の合計制限があるため、機密値は小さく保ってください。

チャネル

`channels` フィールドを使用すると、プラグインは 1 つ以上のメッセージチャネルを宣言して、会話にコンテンツを注入できます。各チャネルはプラグインが提供する MCP サーバーにバインドされます。

```json
{
  "channels": [
    {
      "server": "telegram",
      "userConfig": {
        "bot_token": {
          "type": "string",
          "title": "Bot token",
          "description": "Telegram bot token",
          "sensitive": true
        },
        "owner_id": {
          "type": "string",
          "title": "Owner ID",
          "description": "Your Telegram user ID"
        }
      }
    }
  ]
}
```

`server` フィールドは必須で、プラグインの `mcpServers` のキーと一致する必要があります。オプションのチャネルごとの `userConfig` はトップレベルフィールドと同じスキーマを使用し、プラグインがプラグイン有効化時にボットトークンまたはオーナー ID をプロンプトできるようにします。

パス動作ルール

カスタムパスがプラグインのデフォルトディレクトリを置き換えるか拡張するかは、フィールドによって異なります:

- **デフォルトを置き換える**: `commands`、`agents`、`outputStyles`、`experimental.themes`、`experimental.monitors`。たとえば、マニフェストが `commands` を指定する場合、デフォルト `commands/` ディレクトリはスキャンされません。デフォルトを保持してさらに追加するには、明示的にリストします: `"commands": ["./commands/", "./extras/"]`
- **デフォルトに追加**: `skills`。デフォルト `skills/` ディレクトリは常にスキャンされ、`skills` にリストされているディレクトリはそれと一緒に読み込まれます。例外: [マーケットプレイスエントリの `source` がマーケットプレイスルートに解決される](/ja/plugin-marketplaces#advanced-plugin-entries)場合、特定のサブディレクトリを宣言するとスキャンが置き換えられます
- **独自のマージルール**: [hooks](#hooks)、[MCP servers](#mcp-servers)、[LSP servers](#lsp-servers)。各セクションで複数のソースがどのように結合されるかを参照してください

プラグインがデフォルトフォルダと一致するマニフェストキーの両方を持つ場合、Claude Code v2.1.140 以降は無視されたフォルダを `/doctor`、`claude plugin list`、および `/plugin` 詳細ビューでフラグします。プラグインはマニフェストパスを使用して読み込まれます。マニフェストキーがデフォルトフォルダを指す場合（例: `"commands": ["./commands/deploy.md"]`）は警告は表示されません。その場合、フォルダは明示的にアドレス指定されているためです。

すべてのパスフィールドについて:

- すべてのパスはプラグインルートに相対的で、`./` で始まる必要があります
- カスタムパスからのコンポーネントは同じ命名と名前空間ルールを使用します
- 複数のパスを配列として指定できます
- skill パスが `SKILL.md` を直接含むディレクトリを指す場合（例: `"skills": ["./"]` がプラグインルートを指す）、`SKILL.md` の frontmatter `name` フィールドが skill の呼び出し名を決定します。これはインストールディレクトリに関係なく安定した名前を提供します。frontmatter に `name` が設定されていない場合、ディレクトリ basename がフォールバックとして使用されます。

ルートに `SKILL.md` があり、`skills/` サブディレクトリがなく、`skills` マニフェストフィールドがないプラグインは、Claude Code v2.1.142 以降で単一 skill プラグインとして自動的に読み込まれます。このレイアウトの場合、`plugin.json` で `"skills": ["./"]` を設定する必要はありません。skill の呼び出し名は上記と同じルールに従います: frontmatter `name` フィールド、またはフォールバックとしてのディレクトリ basename。

**パスの例**:

```json
{
  "commands": [
    "./specialized/deploy.md",
    "./utilities/batch-process.md"
  ],
  "agents": [
    "./custom-agents/reviewer.md",
    "./custom-agents/tester.md"
  ]
}
```

環境変数

Claude Code は、プラグインパスを参照するための 3 つの変数を提供します。すべては skill コンテンツ、エージェントコンテンツ、hook コマンド、monitor コマンド、MCP または LSP サーバー設定に表示される場所にインラインで置換されます。すべては hook プロセスおよび MCP または LSP サーバーサブプロセスに環境変数としてエクスポートされます。

**`${CLAUDE_PLUGIN_ROOT}`**: プラグインのインストールディレクトリへの絶対パス。プラグインにバンドルされたスクリプト、バイナリ、設定ファイルを参照するために使用します。hook コマンドでは、[exec form](/ja/hooks#exec-form-and-shell-form)を `args` で使用して、パスが 1 つの引数として引用符なしで渡されるようにしてください。shell-form hooks および monitor コマンドでは、`"${CLAUDE_PLUGIN_ROOT}"` のようにダブルクォートで囲みます。このパスはプラグインが更新されると変更されます。前のバージョンのディレクトリは更新後約 7 日間ディスク上に残りますが、これを一時的なものとして扱い、ここに状態を書き込まないでください。

プラグインがセッション中に更新されると、hook コマンド、monitors、MCP サーバー、LSP サーバーは前のバージョンのパスを使用し続けます。`/reload-plugins` を実行して、hook、MCP サーバー、LSP サーバーを新しいパスに切り替えます。monitors はセッション再起動が必要です。

**`${CLAUDE_PLUGIN_DATA}`**: 更新後も保持される永続ディレクトリ。`node_modules` または Python 仮想環境などのインストール済み依存関係、生成されたコード、キャッシュ、およびプラグインバージョン全体で保持する必要があるその他のファイルに使用します。このディレクトリは、この変数が最初に参照されるときに自動的に作成されます。

**`${CLAUDE_PROJECT_DIR}`**: プロジェクトルート。これは hook が `CLAUDE_PROJECT_DIR` 変数で受け取るのと同じディレクトリです。プロジェクトローカルスクリプトまたは設定ファイルを参照するために使用します。スペースを含むパスを処理するためにクォートで囲みます。たとえば `"${CLAUDE_PROJECT_DIR}/scripts/server.sh"`。MCP サーバーは MCP `roots/list` リクエストを呼び出すこともでき、Claude Code が起動されたディレクトリを返します。

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}\"/scripts/process.sh"
          }
        ]
      }
    ]
  }
}
```

永続データディレクトリ

`${CLAUDE_PLUGIN_DATA}` ディレクトリは `~/.claude/plugins/data/{id}/` に解決されます。ここで `{id}` はプラグイン識別子で、`a-z`、`A-Z`、`0-9`、`_`、`-` 以外の文字が `-` に置き換えられます。`formatter@my-marketplace` としてインストールされたプラグインの場合、ディレクトリは `~/.claude/plugins/data/formatter-my-marketplace/` です。

一般的な使用法は、言語依存関係を 1 回インストールしてセッションとプラグイン更新全体で再利用することです。データディレクトリは単一のプラグインバージョンより長く存在するため、ディレクトリ存在チェックだけでは、更新がプラグインの依存関係マニフェストを変更したときを検出できません。推奨パターンはバンドルされたマニフェストをデータディレクトリのコピーと比較し、異なる場合は再インストールします。

この `SessionStart` hook は最初の実行時に `node_modules` をインストールし、プラグイン更新に変更された `package.json` が含まれるたびに再度インストールします:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "diff -q \"${CLAUDE_PLUGIN_ROOT}/package.json\" \"${CLAUDE_PLUGIN_DATA}/package.json\" >/dev/null 2>&1 || (cd \"${CLAUDE_PLUGIN_DATA}\" && cp \"${CLAUDE_PLUGIN_ROOT}/package.json\" . && npm install) || rm -f \"${CLAUDE_PLUGIN_DATA}/package.json\""
          }
        ]
      }
    ]
  }
}
```

`diff` は保存されたコピーが不足しているか、バンドルされたコピーと異なる場合にゼロ以外で終了し、最初の実行と依存関係変更更新の両方をカバーします。`npm install` が失敗した場合、末尾の `rm` はコピーされたマニフェストを削除して、次のセッションが再試行します。

`${CLAUDE_PLUGIN_ROOT}` にバンドルされたスクリプトは、永続化された `node_modules` に対して実行できます:

```json
{
  "mcpServers": {
    "routines": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/server.js"],
      "env": {
        "NODE_PATH": "${CLAUDE_PLUGIN_DATA}/node_modules"
      }
    }
  }
}
```

データディレクトリは、インストールされている最後のスコープからプラグインをアンインストールするときに自動的に削除されます。`/plugin` インターフェイスはディレクトリサイズを表示し、削除前にプロンプトします。CLI はデフォルトで削除します。[`--keep-data`](#plugin-uninstall)を渡して保持します。

***

プラグインキャッシングとファイル解決

プラグインは 2 つの方法で指定されます:

- `claude --plugin-dir` または `claude --plugin-url` を通じて、セッションの期間。
- マーケットプレイスを通じて、将来のセッション用にインストール。

セキュリティと検証の目的で、Claude Code は\_マーケットプレイス\_プラグインをユーザーのローカル**プラグインキャッシュ**（`~/.claude/plugins/cache`）にコピーします。これらを所定の場所で使用するのではなく。この動作を理解することは、外部ファイルを参照するプラグインを開発する際に重要です。

各インストール済みバージョンはキャッシュ内の別のディレクトリです。プラグインを更新またはアンインストールすると、前のバージョンディレクトリは孤立したものとしてマークされ、7 日後に自動的に削除されます。猶予期間により、既に古いバージョンを読み込んだ同時実行 Claude Code セッションがエラーなく実行を続けることができます。

Claude の Glob および Grep ツールは検索中に孤立したバージョンディレクトリをスキップするため、ファイル結果には古いプラグインコードが含まれません。

パストラバーサル制限

インストールされたプラグインはディレクトリの外側のファイルを参照できません。プラグインルートの外側をトラバースするパス（`../shared-utils` など）は、これらの外部ファイルがキャッシュにコピーされないため、インストール後は機能しません。

マーケットプレイス内でシンボリックリンクを使用してファイルを共有

プラグインが同じマーケットプレイスの他の部分とファイルを共有する必要がある場合、プラグインディレクトリ内にシンボリックリンクを作成できます。プラグインがキャッシュにコピーされるときにシンボリックリンクがどのように処理されるかは、そのターゲットがどこに解決されるかによって異なります:

- **プラグイン自体のディレクトリ内:** シンボリックリンクはキャッシュ内の相対シンボリックリンクとして保持されるため、実行時にコピーされたターゲットへの解決を続けます。
- **同じマーケットプレイス内の他の場所:** シンボリックリンクは逆参照されます。ターゲットのコンテンツはキャッシュにコピーされます。これにより、メタプラグインの `skills/` ディレクトリがマーケットプレイス内の他のプラグインで定義されたスキルにリンクできます。
- **マーケットプレイス外:** シンボリックリンクはセキュリティのためにスキップされます。これにより、プラグインがシステムパスなどの任意のホストファイルをキャッシュに取り込むことを防ぎます。

`--plugin-dir` でインストールされたプラグイン、またはローカルパスからのプラグインの場合、プラグイン自体のディレクトリ内で解決されるシンボリックリンクのみが保持されます。その他はすべてスキップされます。

次のコマンドは、マーケットプレイスプラグイン内から兄弟プラグインで定義された共有スキルへのリンクを作成します。Windows では、昇格されたコマンドプロンプトから `mklink /D` を使用するか、開発者モードを有効にします:

```bash
ln -s ../../shared-plugin/skills/foo ./skills/foo
```

これはキャッシングシステムのセキュリティ上の利点を維持しながら柔軟性を提供します。

***

プラグインディレクトリ構造

標準プラグインレイアウト

完全なプラグインは次の構造に従います:

```text
enterprise-plugin/
├── .claude-plugin/           # メタデータディレクトリ（オプション）
│   └── plugin.json             # プラグインマニフェスト
├── skills/                   # Skills
│   ├── code-reviewer/
│   │   └── SKILL.md
│   └── pdf-processor/
│       ├── SKILL.md
│       └── scripts/
├── commands/                 # フラット .md ファイルとしての Skills
│   ├── status.md
│   └── logs.md
├── agents/                   # Subagent 定義
│   ├── security-reviewer.md
│   ├── performance-tester.md
│   └── compliance-checker.md
├── output-styles/            # 出力スタイル定義
│   └── terse.md
├── themes/                   # カラーテーマ定義
│   └── dracula.json
├── monitors/                 # バックグラウンド monitor 設定
│   └── monitors.json
├── hooks/                    # Hook 設定
│   ├── hooks.json           # メイン hook 設定
│   └── security-hooks.json  # 追加 hooks
├── bin/                      # PATH に追加されるプラグイン実行可能ファイル
│   └── my-tool               # Bash tool で裸のコマンドとして呼び出し可能
├── settings.json            # プラグインのデフォルト設定
├── .mcp.json                # MCP サーバー定義
├── .lsp.json                # LSP サーバー設定
├── scripts/                 # Hook とユーティリティスクリプト
│   ├── security-scan.sh
│   ├── format-code.py
│   └── deploy.js
├── LICENSE                  # ライセンスファイル
└── CHANGELOG.md             # バージョン履歴
```

`.claude-plugin/` ディレクトリは `plugin.json` ファイルを含みます。他のすべてのディレクトリ（commands/、agents/、skills/、output-styles/、themes/、monitors/、hooks/）は `.claude-plugin/` 内ではなく、プラグインルートにある必要があります。

プラグインルートの `CLAUDE.md` ファイルはプロジェクトコンテキストとして読み込まれません。プラグインは CLAUDE.md ではなく、skills、agents、hooks を通じてコンテキストを提供します。Claude のコンテキストに読み込まれる命令を配布するには、[skill](#skills) に配置してください。

ファイル場所リファレンス

| コンポーネント | デフォルト場所 | 目的 |
| :- | :- | :- |
| **マニフェスト** | `.claude-plugin/plugin.json` | プラグインメタデータと設定（オプション） |
| **Skills** | `skills/` | `<name>/SKILL.md` 構造の Skills |
| **コマンド** | `commands/` | フラット Markdown ファイルとしての Skills。新しいプラグインには `skills/` を使用 |
| **Agents** | `agents/` | Subagent Markdown ファイル |
| **出力スタイル** | `output-styles/` | 出力スタイル定義 |
| **テーマ** | `themes/` | カラーテーマ定義 |
| **Hooks** | `hooks/hooks.json` | Hook 設定 |
| **MCP servers** | `.mcp.json` | MCP サーバー定義 |
| **LSP servers** | `.lsp.json` | 言語サーバー設定 |
| **Monitors** | `monitors/monitors.json` | バックグラウンド monitor 設定 |
| **実行可能ファイル** | `bin/` | Bash tool の `PATH` に追加される実行可能ファイル。ここのファイルはプラグインが有効な場合、任意の Bash tool 呼び出しで裸のコマンドとして呼び出し可能 |
| **設定** | `settings.json` | プラグインが有効になったときに適用されるデフォルト設定。現在、[`agent`](/ja/sub-agents)および[`subagentStatusLine`](/ja/statusline#subagent-status-lines)キーのみがサポートされています |

***

CLI コマンドリファレンス

Claude Code は非対話的なプラグイン管理用の CLI コマンドを提供します。スクリプトと自動化に役立ちます。

plugin init

`~/.claude/skills/<name>/` に新しいプラグインをスキャフォルドします。次の Claude Code セッションで、`<name>@skills-dir` として自動的に読み込まれ、インストール手順なしで `/plugin` と `claude plugin list` に表示されます。

[Skills ディレクトリプラグイン](#skills-directory-plugins)のスコープと信頼要件を参照してください。

```bash
claude plugin init <name> [options]
```

**引数:**

- `<name>`: プラグイン名。skill 名前空間と `~/.claude/skills/` の下のディレクトリ名になるため、スペースやパス区切り文字を含むことはできません。

**オプション:**

| オプション | 説明 | デフォルト |
| :- | :- | :- |
| `--description <text>` | マニフェスト説明 | |
| `--author <name>` | 著者名 | `git config user.name` |
| `--author-email <email>` | 著者メール | `git config user.email` |
| `--with <components...>` | コンポーネントフォルダもスキャフォルド。有効な値: `skills`、`agents`、`hooks`、`mcp`、`lsp`、`output-style`、`channel` | |
| `-f, --force` | ターゲットの既存 `.claude-plugin/` を上書き | |
| `-h, --help` | コマンドのヘルプを表示 | |

**エイリアス:** `new`

各 `--with` 値は、そのコンポーネントのスターターファイルを追加し、編集準備ができています:

| コンポーネント | スキャフォルドされるもの |
| :- | :- |
| `skills` | デフォルトの横に追加の名前空間 `<name>:example` skill |
| `agents` | `agents/` subagent 定義 |
| `hooks` | サンプルイベントハンドラー付き `hooks/hooks.json` |
| `mcp` | HTTP と stdio サーバーの例を含む `.mcp.json` |
| `lsp` | `.lsp.json` 言語サーバーの例 |
| `output-style` | プラグインが有効な場合に自動的に適用される `output-styles/<name>.md` |
| `channel` | MCP ベースの[チャネル](/ja/channels): stdio サーバー（`server.ts`）、その `.mcp.json`、および `package.json` |

スキャフォルドされたプラグインはマーケットプレイスではなく `@skills-dir` ソースを使用します。管理者は `strictKnownMarketplaces` でこのソースをブロックするか、[管理設定](/ja/plugin-marketplaces#managed-marketplace-restrictions)の `blockedMarketplaces` に `{"source": "skills-dir"}` を追加することでブロックできます。ブロックされると、`plugin init` は書き込み前に失敗します。

**例:**

```bash
# 最小限のプラグインをスキャフォルド
claude plugin init my-helper

# skill と hook フォルダでスキャフォルド
claude plugin init my-helper --with skills hooks

# 既存のスキャフォルドを上書き
claude plugin init my-helper --force
```

plugin install

利用可能なマーケットプレイスからプラグインをインストールします。

```bash
claude plugin install <plugin> [options]
```

**引数:**

- `<plugin>`: プラグイン名または特定のマーケットプレイス用の `plugin-name@marketplace-name`

**オプション:**

| オプション | 説明 | デフォルト |
| :- | :- | :- |
| `-s, --scope <scope>` | インストールスコープ: `user`、`project`、または `local` | `user` |
| `-h, --help` | コマンドのヘルプを表示 | |

スコープはインストールされたプラグインが追加される設定ファイルを決定します。たとえば、`--scope project` は `.claude/settings.json` の `enabledPlugins` に書き込み、プロジェクトリポジトリをクローンした全員がプラグインを利用できるようにします。

**例:**

```bash
# ユーザースコープにインストール（デフォルト）
claude plugin install formatter@my-marketplace

# プロジェクトスコープにインストール（チームと共有）
claude plugin install formatter@my-marketplace --scope project

# ローカルスコープにインストール（gitignored）
claude plugin install formatter@my-marketplace --scope local
```

plugin uninstall

インストール済みプラグインを削除します。

```bash
claude plugin uninstall <plugin> [options]
```

**引数:**

- `<plugin>`: プラグイン名または `plugin-name@marketplace-name`

**オプション:**

| オプション | 説明 | デフォルト |
| :- | :- | :- |
| `-s, --scope <scope>` | スコープからアンインストール: `user`、`project`、または `local` | `user` |
| `--keep-data` | プラグインの[永続データディレクトリ](#persistent-data-directory)を保持 | |
| `--prune` | 他のプラグインが必要としない自動インストール依存関係も削除します。[plugin prune](#plugin-prune) を参照してください | |
| `-y, --yes` | `--prune` 確認プロンプトをスキップします。stdin が TTY でない場合は必須です | |
| `-h, --help` | コマンドのヘルプを表示 | |

**エイリアス:** `remove`、`rm`

デフォルトでは、最後に残っているスコープからアンインストールすると、プラグインの `${CLAUDE_PLUGIN_DATA}` ディレクトリも削除されます。たとえば、新しいバージョンをテストした後に再インストールする場合は、`--keep-data` を使用して保持します。

plugin prune

インストール済みプラグインによって不要になった自動インストール プラグイン依存関係を削除します。Claude Code が別のプラグインの [`dependencies`](/ja/plugin-dependencies) フィールドを満たすために取得した依存関係は削除されます。直接インストールしたプラグインは決して削除されません。

```bash
claude plugin prune [options]
```

**オプション:**

| オプション | 説明 | デフォルト |
| :- | :- | :- |
| `-s, --scope <scope>` | スコープでプルーン: `user`、`project`、または `local` | `user` |
| `--dry-run` | 削除されるものをリストアップします。実際には削除しません | |
| `-y, --yes` | 確認プロンプトをスキップします。stdin が TTY でない場合は必須です | |
| `-h, --help` | コマンドのヘルプを表示 | |

**エイリアス:** `autoremove`

このコマンドは孤立した依存関係をリストアップし、削除する前に確認を求めます。プラグインを削除し、その依存関係をクリーンアップする場合は、1 ステップで `claude plugin uninstall <plugin> --prune` を実行します。

`claude plugin prune` には Claude Code v2.1.121 以降が必要です。

plugin enable

無効なプラグインを有効にします。プラグインが [dependencies](/ja/plugin-dependencies) を宣言している場合、Claude Code はそれらを同じスコープで推移的に有効にし、依存関係がインストールされていない場合はコマンドが失敗します。

```bash
claude plugin enable <plugin> [options]
```

**引数:**

- `<plugin>`: プラグイン名または `plugin-name@marketplace-name`

**オプション:**

| オプション | 説明 | デフォルト |
| :- | :- | :- |
| `-s, --scope <scope>` | 有効にするスコープ: `user`、`project`、または `local` | `user` |
| `-h, --help` | コマンドのヘルプを表示 | |

plugin disable

プラグインをアンインストールせずに無効にします。別の有効なプラグインが [ターゲットに依存している](/ja/plugin-dependencies#enable-or-disable-a-plugin-with-dependencies) 場合は失敗します。エラーメッセージには、最初にすべての依存プラグインを無効にするチェーンコマンドが含まれます。

```bash
claude plugin disable <plugin> [options]
```

**引数:**

- `<plugin>`: プラグイン名または `plugin-name@marketplace-name`

**オプション:**

| オプション | 説明 | デフォルト |
| :- | :- | :- |
| `-s, --scope <scope>` | 無効にするスコープ: `user`、`project`、または `local` | `user` |
| `-h, --help` | コマンドのヘルプを表示 | |

plugin update

プラグインを最新バージョンに更新します。

```bash
claude plugin update <plugin> [options]
```

**引数:**

- `<plugin>`: プラグイン名または `plugin-name@marketplace-name`

**オプション:**

| オプション | 説明 | デフォルト |
| :- | :- | :- |
| `-s, --scope <scope>` | 更新するスコープ: `user`、`project`、`local`、または `managed` | `user` |
| `-h, --help` | コマンドのヘルプを表示 | |

***

plugin list

インストール済みプラグインをバージョン、ソースマーケットプレイス、有効状態とともにリストします。

```bash
claude plugin list [options]
```

**オプション:**

| オプション | 説明 | デフォルト |
| :- | :- | :- |
| `--json` | JSON として出力 | |
| `--available` | マーケットプレイスから利用可能なプラグインを含めます。`--json` が必要です | |
| `-h, --help` | コマンドのヘルプを表示 | |

対話型セッション内では、`/plugin list` は同じリストをインラインで出力します。対話型フォームは `--enabled` または `--disabled` を受け入れて、その状態のプラグインのみを表示し、`ls` を `list` の短縮形として使用できます。

plugin details

プラグインのコンポーネントインベントリと予想トークンコストを表示します。出力には、プラグインが提供するすべてのコンポーネントがリストアップされ、Skills、Agents、Hooks、MCP サーバー、LSP サーバーとしてグループ化され、各セッションに追加されるトークン数の推定値が表示されます。Skills グループには `skills/` と `commands/` エントリの両方が含まれます。

```bash
claude plugin details <name>
```

**引数:**

- `<name>`: プラグイン名または `plugin-name@marketplace-name`

**オプション:**

| オプション | 説明 | デフォルト |
| :- | :- | :- |
| `-h, --help` | コマンドのヘルプを表示 | |

出力には、各コンポーネントの 2 つのコスト数値が表示されます:

- **Always-on:** スキルの説明、エージェントの説明、コマンド名など、プラグインのリスティングテキストによってすべてのセッションに追加されるトークン。コンポーネントが実行されるかどうかに関係なく追加されます。
- **On-invoke:** コンポーネントが実行されるときのコンポーネントのコスト。プラグイン全体ではなくコンポーネントごとに表示されます。これは、典型的なセッションではコンポーネントのサブセットのみを呼び出すためです。

この例は、2 つのスキルを持つプラグインの出力がどのように見えるかを示しています:

```
dependency-guard 1.2.0
  Dependency analysis for Claude Code sessions
  Source: dependency-guard@example-marketplace

Component inventory
  Skills (2)  scan-dependencies, review-changes
  Agents (0)
  Hooks (1)  (harness-only — no model context cost)
  MCP servers (0)
  LSP servers (0)

Projected token cost
  Always-on:   ~180 tok   added to every session

Per-component (rounded)
  component            always-on  on-invoke
  scan-dependencies        ~100      ~2400
  review-changes            ~80      ~1800

  On-invoke cost is paid each time a skill or agent fires.
  Token counts are estimates and may differ from actual usage.
```

Always-on の合計は、アクティブなモデルの `count_tokens` API を使用して計算されます。コンポーネントごとの数値は、その合計から比例的にスケーリングされます。API に到達できない場合、コマンドは文字ベースの推定値にフォールバックします。

plugin tag

現在のディレクトリ内のプラグインのリリース git タグを作成します。プラグインのフォルダ内から実行してください。[プラグインリリースにタグを付ける](/ja/plugin-dependencies#tag-plugin-releases-for-version-resolution)を参照してください。

```bash
claude plugin tag [options]
```

**オプション:**

| オプション | 説明 | デフォルト |
| :- | :- | :- |
| `--push` | タグを作成した後、リモートにプッシュします | |
| `--dry-run` | タグを作成せずに、タグ付けされる内容を出力します | |
| `-f, --force` | ワーキングツリーがダーティであるか、タグが既に存在する場合でもタグを作成します | |
| `-h, --help` | コマンドのヘルプを表示 | |

***

デバッグと開発ツール

デバッグコマンド

`claude --debug` を使用してプラグイン読み込みの詳細を確認します:

これは以下を表示します:

- どのプラグインが読み込まれているか
- プラグインマニフェストのエラー
- Skill、agent、hook 登録
- MCP サーバー初期化

一般的な問題

| 問題 | 原因 | 解決策 |
| :- | :- | :- |
| プラグインが読み込まれない | 無効な `plugin.json` | `claude plugin validate` または `/plugin validate` で `plugin.json`、skill/agent/command frontmatter、`hooks/hooks.json` の構文とスキーマを確認 |
| Skills が表示されない | ディレクトリ構造が間違っている | `skills/` または `commands/` がプラグインルートにあることを確認。`.claude-plugin/` 内ではない |
| Hooks が発火しない | スクリプトが実行可能でない | `chmod +x script.sh` を実行 |
| MCP サーバーが失敗 | `${CLAUDE_PLUGIN_ROOT}` が不足 | すべてのプラグインパスに変数を使用 |
| パスエラー | 絶対パスが使用されている | すべてのパスは相対的で `./` で始まる必要があります |
| LSP `Executable not found in $PATH` | 言語サーバーがインストールされていない | バイナリをインストール（例: `npm install -g typescript-language-server typescript`） |

エラーメッセージの例

**マニフェスト検証エラー**:

- `Invalid JSON syntax: Unexpected token } in JSON at position 142`: コンマの欠落、余分なコンマ、またはクォートされていない文字列を確認
- `Plugin has an invalid manifest file at .claude-plugin/plugin.json. Validation errors: name: Required`: 必須フィールドが不足
- `Plugin has a corrupt manifest file at .claude-plugin/plugin.json. JSON parse error: ...`: JSON 構文エラー

**プラグイン読み込みエラー**:

- `Warning: No commands found in plugin my-plugin custom directory: ./cmds. Expected .md files or SKILL.md in subdirectories.`: コマンドパスが存在するが有効なコマンドファイルが含まれていない
- `Plugin directory not found at path: ./plugins/my-plugin. Check that the marketplace entry has the correct path.`: marketplace.json の `source` パスが存在しないディレクトリを指している
- `Plugin my-plugin has conflicting manifests: both plugin.json and marketplace entry specify components.`: 重複するコンポーネント定義を削除するか、marketplace エントリから `strict: false` を削除

Hook トラブルシューティング

**Hook スクリプトが実行されない**:

1. スクリプトが実行可能であることを確認: `chmod +x ./scripts/your-script.sh`
2. shebang 行を確認: 最初の行は `#!/bin/bash` または `#!/usr/bin/env bash` である必要があります
3. パスが `${CLAUDE_PLUGIN_ROOT}` を使用していることを確認: `"command": "\"${CLAUDE_PLUGIN_ROOT}\"/scripts/your-script.sh"`
4. スクリプトを手動でテスト: `./scripts/your-script.sh`

**Hook が予期されたイベントでトリガーされない**:

1. イベント名が正しいことを確認（大文字小文字を区別）: `PostToolUse`、`postToolUse` ではない
2. マッチャーパターンがツールと一致することを確認: ファイル操作の場合 `"matcher": "Write|Edit"`
3. hook タイプが有効であることを確認: `command`、`http`、`mcp_tool`、`prompt`、または `agent`

MCP サーバートラブルシューティング

**サーバーが起動しない**:

1. コマンドが存在し、実行可能であることを確認
2. すべてのパスが `${CLAUDE_PLUGIN_ROOT}` 変数を使用していることを確認
3. MCP サーバーログを確認: `claude --debug` は初期化エラーを表示
4. Claude Code の外部でサーバーを手動でテスト

**サーバーツールが表示されない**:

1. サーバーが `.mcp.json` または `plugin.json` で正しく設定されていることを確認
2. サーバーが MCP プロトコルを正しく実装していることを確認
3. デバッグ出力で接続タイムアウトを確認

ディレクトリ構造の間違い

**症状**: プラグインは読み込まれるがコンポーネント（skills、agents、hooks）が不足している。

**正しい構造**: コンポーネントはプラグインルートにある必要があり、`.claude-plugin/` 内ではありません。`.claude-plugin/` には `plugin.json` のみが属します。

```text
my-plugin/
├── .claude-plugin/
│   └── plugin.json      ← マニフェストのみここ
├── commands/            ← ルートレベル
├── agents/              ← ルートレベル
└── hooks/               ← ルートレベル
```

コンポーネントが `.claude-plugin/` 内にある場合は、プラグインルートに移動してください。

**デバッグチェックリスト**:

1. `claude --debug` を実行し、「loading plugin」メッセージを探す
2. 各コンポーネントディレクトリがデバッグ出力にリストされていることを確認
3. プラグインファイルを読み取ることができるファイルパーミッションを確認

***

配布とバージョン管理リファレンス

バージョン管理

Claude Code はプラグインのバージョンをキャッシュキーとして使用し、更新が利用可能かどうかを判断します。`/plugin update` を実行するか自動更新が実行されると、Claude Code は現在のバージョンを計算し、既にインストールされているものと一致する場合は更新をスキップします。

バージョンは、設定されている最初のものから解決されます：

1. プラグインの `plugin.json` の `version` フィールド
2. `marketplace.json` のプラグインのマーケットプレイスエントリの `version` フィールド
3. git でホストされているマーケットプレイスの `github`、`url`、`git-subdir`、および相対パスソースのプラグインソースの git コミット SHA
4. npm ソースまたは git リポジトリ内にないローカルディレクトリの場合は `unknown`

これにより、プラグインをバージョン管理する 2 つの方法が提供されます：

| アプローチ | 方法 | 更新動作 | 最適な用途 |
| :- | :- | :- | :- |
| **明示的バージョン** | `plugin.json` で `"version": "2.1.0"` を設定 | ユーザーはこのフィールドをバンプした場合のみ更新を取得します。新しいコミットをプッシュしてもバンプしない場合は効果がなく、`/plugin update` は「既に最新バージョンです」と報告します。 | 安定したリリースサイクルを持つ公開プラグイン |
| **コミット SHA バージョン** | `plugin.json` とマーケットプレイスエントリの両方から `version` を省略 | ユーザーはプラグインの git ソースへの新しいコミットのたびに更新を取得します | 積極的に開発中の内部またはチームプラグイン |

`plugin.json` で `version` を設定する場合、ユーザーが変更を受け取るたびにバンプする必要があります。新しいコミットをプッシュするだけでは不十分です。Claude Code は同じバージョン文字列を認識し、キャッシュされたコピーを保持するためです。迅速に反復している場合は、`version` を設定しないままにして、代わりに git コミット SHA が使用されるようにしてください。

明示的なバージョンを使用する場合は、[semantic versioning](https://semver.org)（`MAJOR.MINOR.PATCH`）に従ってください：破壊的変更の場合は MAJOR をバンプし、新機能の場合は MINOR をバンプし、バグ修正の場合は PATCH をバンプしてください。`CHANGELOG.md` で変更を文書化してください。

***

関連項目

- [プラグイン](/ja/plugins) - チュートリアルと実践的な使用法
- [プラグインマーケットプレイス](/ja/plugin-marketplaces) - マーケットプレイスの作成と管理
- [Skills](/ja/skills) - Skill 開発の詳細
- [Subagents](/ja/sub-agents) - エージェント設定と機能
- [Hooks](/ja/hooks) - イベント処理と自動化
- [MCP](/ja/mcp) - 外部ツール統合
- [設定](/ja/settings) - プラグインの設定オプション
