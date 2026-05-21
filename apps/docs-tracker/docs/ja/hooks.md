---
title: hooks
source: https://code.claude.com/docs/ja/hooks.md
---

# Hooks リファレンス

> Claude Code のフック イベント、設定スキーマ、JSON 入出力形式、終了コード、非同期フック、HTTP フック、プロンプト フック、MCP ツール フックのリファレンス。

例を含むクイックスタート ガイドについては、[ワークフローをフックで自動化する](/ja/hooks-guide)を参照してください。

フックは、Claude Code のライフサイクル内の特定のポイントで自動的に実行されるユーザー定義のシェル コマンド、HTTP エンドポイント、または LLM プロンプトです。このリファレンスを使用して、イベント スキーマ、設定オプション、JSON 入出力形式、非同期フック、HTTP フック、MCP ツール フックなどの高度な機能を検索してください。初めてフックを設定する場合は、代わりに[ガイド](/ja/hooks-guide)から始めてください。

## フック ライフサイクル

フックは Claude Code セッション中の特定のポイントで発火します。イベントが発火してマッチャーがマッチすると、Claude Code はイベントに関する JSON コンテキストをフック ハンドラーに渡します。コマンド フックの場合、入力は stdin に到着します。HTTP フックの場合、POST リクエスト本体として到着します。ハンドラーは入力を検査し、アクションを実行し、オプションで決定を返すことができます。イベントは 3 つのケイデンスに分類されます。セッションごとに 1 回（`SessionStart`、`SessionEnd`）、ターンごとに 1 回（`UserPromptSubmit`、`Stop`、`StopFailure`）、agentic ループ内のすべてのツール呼び出しで（`PreToolUse`、`PostToolUse`）です。

以下の表は、各イベントがいつ発火するかをまとめています。[フック イベント](#hook-events)セクションでは、各イベントの完全な入力スキーマと決定制御オプションについて説明しています。

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

### フックがどのように解決されるか

これらの部分がどのように組み合わさるかを理解するために、破壊的なシェル コマンドをブロックする `PreToolUse` フックを考えてみましょう。`matcher` は Bash ツール呼び出しに絞り込み、`if` 条件は `rm *` にマッチするコマンドにさらに絞り込むため、`block-rm.sh` は両方のフィルターがマッチするときのみ生成されます。

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "if": "Bash(rm *)",
            "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/block-rm.sh",
            "args": []
          }
        ]
      }
    ]
  }
}
```

スクリプトは stdin から JSON 入力を読み取り、コマンドを抽出し、`rm -rf` が含まれている場合は `permissionDecision` として `"deny"` を返します。

```bash
#!/bin/bash
# .claude/hooks/block-rm.sh
COMMAND=$(jq -r '.tool_input.command')

if echo "$COMMAND" | grep -q 'rm -rf'; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "Destructive command blocked by hook"
    }
  }'
else
  exit 0  # no decision; normal permission flow applies
fi
```

ここで Claude Code が `Bash "rm -rf /tmp/build"` を実行することにしたとします。以下が起こります。

`PreToolUse` イベントが発火します。Claude Code はツール入力を JSON として stdin のフックに送信します。

```json theme={null}
{ "tool_name": "Bash", "tool_input": { "command": "rm -rf /tmp/build" }, ... }
```

マッチャー `"Bash"` がツール名にマッチするため、このフック グループがアクティブになります。マッチャーを省略するか `"*"` を使用すると、グループはイベントのすべての出現でアクティブになります。

`if` 条件 `"Bash(rm *)"` は `rm -rf /tmp/build` が `rm *` にマッチするサブコマンドであるためマッチするため、このハンドラーが生成されます。コマンドが `npm test` だった場合、`if` チェックは失敗し、`block-rm.sh` は実行されず、プロセス生成のオーバーヘッドを回避します。`if` フィールドはオプションです。なければ、マッチしたグループ内のすべてのハンドラーが実行されます。

スクリプトは完全なコマンドを検査し、`rm -rf` を見つけるため、stdout に決定を出力します。

```json theme={null}
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Destructive command blocked by hook"
  }
}
```

コマンドが安全な `rm` バリアント（`rm file.txt` など）だった場合、スクリプトは代わりに `exit 0` に到達します。出力なしの終了コード 0 は、フックが報告する決定がないことを意味するため、ツール呼び出しは通常の[権限フロー](/ja/permissions)を通じて続行されます。フックは呼び出しを拒否できますが、沈黙を保つことは承認を意味しません。

Claude Code は JSON 決定を読み取り、ツール呼び出しをブロックし、Claude に理由を表示します。

以下の[設定](#configuration)セクションでは完全なスキーマについて説明し、各[フック イベント](#hook-events)セクションでは、コマンドが受け取る入力と返すことができる出力について説明しています。

## 設定

フックは JSON 設定ファイルで定義されます。設定には 3 つのネストレベルがあります。

1. 応答する[フック イベント](#hook-events)を選択します（`PreToolUse` や `Stop` など）
2. 発火するタイミングをフィルタリングする[マッチャー グループ](#matcher-patterns)を追加します（'Bash ツールのみ'など）
3. マッチしたときに実行する 1 つ以上の[フック ハンドラー](#hook-handler-fields)を定義します

完全なウォークスルーと注釈付きの例については、上記の[フックがどのように解決されるか](#how-a-hook-resolves)を参照してください。

このページでは各レベルに特定の用語を使用しています。**フック イベント**はライフサイクル ポイント、**マッチャー グループ**はフィルター、**フック ハンドラー**はシェル コマンド、HTTP エンドポイント、MCP ツール、プロンプト、または実行されるエージェントです。'フック'単独は一般的な機能を指します。

### フック位置

フックを定義する場所によって、そのスコープが決まります。

| 位置 | スコープ | 共有可能 |
| :- | :- | :- |
| `~/.claude/settings.json` | すべてのプロジェクト | いいえ、マシンにローカル |
| `.claude/settings.json` | 単一プロジェクト | はい、リポジトリにコミット可能 |
| `.claude/settings.local.json` | 単一プロジェクト | いいえ、gitignored |
| 管理ポリシー設定 | 組織全体 | はい、管理者が制御 |
| [プラグイン](/ja/plugins) `hooks/hooks.json` | プラグインが有効な場合 | はい、プラグインにバンドル |
| [スキル](/ja/skills)または[エージェント](/ja/sub-agents)フロントマター | コンポーネントがアクティブな場合 | はい、コンポーネント ファイルで定義 |

設定ファイル解決の詳細については、[設定](/ja/settings)を参照してください。エンタープライズ管理者は `allowManagedHooksOnly` を使用して、ユーザー、プロジェクト、プラグイン フックをブロックできます。管理設定で force-enabled されたプラグインからのフックは除外されるため、管理者は組織マーケットプレイスを通じて検証済みのフックを配布できます。[フック設定](/ja/settings#hook-configuration)を参照してください。

### マッチャー パターン

`matcher` フィールドは、フックが発火するタイミングをフィルタリングします。マッチャーの評価方法は、含まれている文字に依存します。

| マッチャー値 | 評価方法 | 例 |
| :- | :- | :- |
| `"*"`、`""`、または省略 | すべてにマッチ | イベントのすべての出現で発火 |
| 文字、数字、`_`、`\|` のみ | 完全一致、または `\|` で区切られた完全一致のリスト | `Bash` は Bash ツールのみにマッチ。`Edit\|Write` はいずれかのツールに完全にマッチ |
| その他の文字を含む | JavaScript 正規表現 | `^Notebook` は Notebook で始まるツールにマッチ。`mcp__memory__.*` は `memory` サーバーのすべてのツールにマッチ |

`FileChanged` イベントは監視リストを構築するときにこれらのルールに従いません。[FileChanged](#filechanged)を参照してください。

各イベント タイプは異なるフィールドでマッチします。

| イベント | マッチャーがフィルタリングするもの | マッチャー値の例 |
| :- | :- | :- |
| `PreToolUse`、`PostToolUse`、`PostToolUseFailure`、`PermissionRequest`、`PermissionDenied` | ツール名 | `Bash`、`Edit\|Write`、`mcp__.*` |
| `SessionStart` | セッションの開始方法 | `startup`、`resume`、`clear`、`compact` |
| `Setup` | セットアップをトリガーした CLI フラグ | `init`、`maintenance` |
| `SessionEnd` | セッションが終了した理由 | `clear`、`resume`、`logout`、`prompt_input_exit`、`bypass_permissions_disabled`、`other` |
| `Notification` | 通知タイプ | `permission_prompt`、`idle_prompt`、`auth_success`、`elicitation_dialog`、`elicitation_complete`、`elicitation_response` |
| `SubagentStart` | エージェント タイプ | `general-purpose`、`Explore`、`Plan`、またはカスタム エージェント名 |
| `PreCompact`、`PostCompact` | コンパクションをトリガーしたもの | `manual`、`auto` |
| `SubagentStop` | エージェント タイプ | `SubagentStart` と同じ値 |
| `ConfigChange` | 設定ソース | `user_settings`、`project_settings`、`local_settings`、`policy_settings`、`skills` |
| `CwdChanged` | マッチャー サポートなし | すべてのディレクトリ変更で常に発火 |
| `FileChanged` | 監視するリテラル ファイル名（[FileChanged](#filechanged)を参照） | `.envrc\|.env` |
| `StopFailure` | エラー タイプ | `rate_limit`、`authentication_failed`、`oauth_org_not_allowed`、`billing_error`、`invalid_request`、`model_not_found`、`server_error`、`max_output_tokens`、`unknown` |
| `InstructionsLoaded` | ロード理由 | `session_start`、`nested_traversal`、`path_glob_match`、`include`、`compact` |
| `UserPromptExpansion` | コマンド名 | スキルまたはコマンド名 |
| `Elicitation` | MCP サーバー名 | 設定された MCP サーバー名 |
| `ElicitationResult` | MCP サーバー名 | `Elicitation` と同じ値 |
| `UserPromptSubmit`、`PostToolBatch`、`Stop`、`TeammateIdle`、`TaskCreated`、`TaskCompleted`、`WorktreeCreate`、`WorktreeRemove` | マッチャー サポートなし | すべての出現で常に発火 |

マッチャーは、Claude Code がフックに stdin で送信する[JSON 入力](#hook-input-and-output)からのフィールドに対して実行されます。ツール イベントの場合、そのフィールドは `tool_name` です。各[フック イベント](#hook-events)セクションでは、マッチャー値の完全なセットとそのイベントの入力スキーマをリストしています。

この例は、Claude がファイルを書き込むまたは編集するときにのみ linting スクリプトを実行します。

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/lint-check.sh"
          }
        ]
      }
    ]
  }
}
```

`UserPromptSubmit`、`PostToolBatch`、`Stop`、`TeammateIdle`、`TaskCreated`、`TaskCompleted`、`WorktreeCreate`、`WorktreeRemove`、`CwdChanged` はマッチャーをサポートせず、すべての出現で常に発火します。これらのイベントに `matcher` フィールドを追加すると、サイレントに無視されます。

ツール イベントの場合、個別のフック ハンドラーで [`if` フィールド](#common-fields)を設定することで、より狭くフィルタリングできます。`if` は[権限ルール構文](/ja/permissions)を使用してツール名と引数を一緒にマッチするため、`"Bash(git *)"` は `git *` に一致する Bash 入力のサブコマンドのいずれかに対して実行され、`"Edit(*.ts)"` は TypeScript ファイルのみに対して実行されます。

#### MCP ツールをマッチ

[MCP](/ja/mcp) サーバー ツールはツール イベント（`PreToolUse`、`PostToolUse`、`PostToolUseFailure`、`PermissionRequest`、`PermissionDenied`）で通常のツールとして表示されるため、他のツール名と同じ方法でマッチできます。

MCP ツールは `mcp__<server>__<tool>` という命名パターンに従います。例えば、

- `mcp__memory__create_entities`: Memory サーバーの create entities ツール
- `mcp__filesystem__read_file`: Filesystem サーバーの read file ツール
- `mcp__github__search_repositories`: GitHub サーバーの search ツール

すべてのツールをサーバーからマッチするには、サーバー プレフィックスに `.*` を追加します。`.*` は必須です。`mcp__memory` のようなマッチャーは文字とアンダースコアのみを含むため、完全一致として比較され、ツールにマッチしません。

- `mcp__memory__.*` は `memory` サーバーのすべてのツールにマッチ
- `mcp__.*__write.*` は任意のサーバーから「write」で始まるツールにマッチ

この例は、すべてのメモリ サーバー操作をログし、任意の MCP サーバーからの書き込み操作を検証します。

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "mcp__memory__.*",
        "hooks": [
          {
            "type": "command",
            "command": "echo 'Memory operation initiated' >> ~/mcp-operations.log"
          }
        ]
      },
      {
        "matcher": "mcp__.*__write.*",
        "hooks": [
          {
            "type": "command",
            "command": "/home/user/scripts/validate-mcp-write.py"
          }
        ]
      }
    ]
  }
}
```

### フック ハンドラー フィールド

内側の `hooks` 配列の各オブジェクトはフック ハンドラーです。マッチャーがマッチしたときに実行されるシェル コマンド、HTTP エンドポイント、MCP ツール、LLM プロンプト、またはエージェントです。5 つのタイプがあります。

- **[コマンド フック](#command-hook-fields)** （`type: "command"`）: シェル コマンドを実行します。スクリプトはイベントの[JSON 入力](#hook-input-and-output)を stdin で受け取り、終了コードと stdout を通じて結果を通信します。
- **[HTTP フック](#http-hook-fields)** （`type: "http"`）: イベントの JSON 入力を HTTP POST リクエストとして URL に送信します。エンドポイントは、コマンド フックと同じ[JSON 出力形式](#json-output)を使用して、レスポンス本体を通じて結果を通信します。
- **[MCP ツール フック](#mcp-tool-hook-fields)** （`type: "mcp_tool"`）: 既に接続されている[MCP サーバー](/ja/mcp)上のツールを呼び出します。ツールのテキスト出力はコマンド フック stdout のように扱われます。
- **[プロンプト フック](#prompt-and-agent-hook-fields)** （`type: "prompt"`）: Claude モデルにプロンプトを送信して、単一ターンの評価を行います。モデルは yes/no 決定を JSON として返します。[プロンプト ベースのフック](#prompt-based-hooks)を参照してください。
- **[エージェント フック](#prompt-and-agent-hook-fields)** （`type: "agent"`）: Read、Grep、Glob などのツールを使用して条件を検証してから決定を返すことができるサブエージェントを生成します。エージェント フックは実験的であり、変更される可能性があります。[エージェント ベースのフック](#agent-based-hooks)を参照してください。

#### 共通フィールド

これらのフィールドはすべてのフック タイプに適用されます。

| フィールド | 必須 | 説明 |
| :- | :- | :- |
| `type` | はい | `"command"`、`"http"`、`"mcp_tool"`、`"prompt"`、または `"agent"` |
| `if` | いいえ | `"Bash(git *)"` または `"Edit(*.ts)"` などの権限ルール構文を使用してこのフックが実行されるタイミングをフィルタリングします。ツール呼び出しがパターンにマッチする場合のみ、フックが生成されます。または Bash コマンドが解析するには複雑すぎる場合。ツール イベントでのみ評価されます。`PreToolUse`、`PostToolUse`、`PostToolUseFailure`、`PermissionRequest`、`PermissionDenied`。他のイベントでは、`if` が設定されたフックは実行されません。[権限ルール](/ja/permissions)と同じ構文を使用します |
| `timeout` | いいえ | キャンセルまでの秒数。デフォルト: `command`、`http`、`mcp_tool` は 600、`prompt` は 30、`agent` は 60。[`UserPromptSubmit`](#userpromptsubmit) は `command`、`http`、`mcp_tool` のデフォルトを 30 に低下させます |
| `statusMessage` | いいえ | フックの実行中に表示されるカスタム スピナー メッセージ |
| `once` | いいえ | `true` の場合、セッションごとに 1 回だけ実行してから削除されます。[スキル フロントマター](#hooks-in-skills-and-agents)でのみ尊重されます。設定ファイルとエージェント フロントマターでは無視されます |

`if` フィールドは正確に 1 つの権限ルールを保持します。ルールを組み合わせるための `&&`、`||`、またはリスト構文はありません。複数の条件を適用するには、各条件に対して個別のフック ハンドラーを定義します。Bash の場合、ルールは先頭の `VAR=value` 割り当てが削除された後のツール入力の各サブコマンドに対してマッチされるため、`if: "Bash(git push *)"` は `FOO=bar git push` と `npm test && git push` の両方にマッチします。コマンドが解析するには複雑すぎる場合、いずれかのサブコマンドがマッチすると、またはいつでもフックが実行されます。

#### コマンド フック フィールド

[共通フィールド](#common-fields)に加えて、コマンド フックはこれらのフィールドを受け入れます。

| フィールド | 必須 | 説明 |
| :- | :- | :- |
| `command` | はい | 実行するシェル コマンド。`args` を使用する場合、直接生成する実行可能ファイル。[Exec フォームとシェル フォーム](#exec-form-and-shell-form)を参照してください |
| `args` | いいえ | 引数リスト。存在する場合、`command` は実行可能ファイルとして解決され、`args` を引数ベクトルとして直接生成されます。シェルは関与しません。[Exec フォームとシェル フォーム](#exec-form-and-shell-form)を参照してください |
| `async` | いいえ | `true` の場合、ブロックせずにバックグラウンドで実行されます。[バックグラウンドでフックを実行](#run-hooks-in-the-background)を参照してください |
| `asyncRewake` | いいえ | `true` の場合、バックグラウンドで実行され、終了コード 2 で Claude を起動します。`async` を暗黙的に指定します。フックの stderr、または stderr が空の場合は stdout が、Claude がシステム リマインダーとして長時間実行されるバックグラウンド失敗に反応できるように表示されます |
| `shell` | いいえ | このフックに使用するシェル。`"bash"`（デフォルト）または `"powershell"` を受け入れます。`"powershell"` を設定すると、Windows 上で PowerShell 経由でコマンドが実行されます。`CLAUDE_CODE_USE_POWERSHELL_TOOL` は不要です。フックは PowerShell を直接生成するため。`args` が設定されている場合は無視されます |

##### Exec フォームとシェル フォーム

コマンド フックは `args` が設定されている場合は exec フォームで実行され、`args` が省略されている場合はシェル フォームで実行されます。フックが[パス プレースホルダー](#reference-scripts-by-path)を参照する場合は常に `args` を設定してください。各要素は引用符なしで 1 つの引数として渡されるためです。パイプや `&&` などのシェル機能が必要な場合、または両方の懸念が適用されない場合は `args` を省略してください。

**Exec フォーム**は `args` が存在する場合に実行されます。Claude Code は `command` を `PATH` 上の実行可能ファイルとして解決し、`args` を引数ベクトルとして直接生成します。シェルがないため、各 `args` 要素は記述されたとおりに正確に 1 つの引数であり、`${CLAUDE_PLUGIN_ROOT}` などのパス プレースホルダーは `command` と各 `args` 要素にプレーン文字列として置換されます。アポストロフィ、`$`、バッククォートなどの特殊文字は、シェルが解釈しないため、そのまま渡されます。プラットフォーム上でシェル トークン化は発生しません。

**シェル フォーム**は `args` が存在しない場合に実行されます。`command` 文字列はシェルに渡されます。macOS と Linux では `sh -c`、Windows では Git Bash、または Git Bash がインストールされていない場合は PowerShell。`shell` フィールドを設定して明示的に選択します。シェルは文字列をトークン化し、変数を展開し、パイプ、`&&`、リダイレクト、グロブを解釈します。

Windows では、exec フォームは `command` が `.exe` などの実際の実行可能ファイルに解決されることが必要です。npm、npx、eslint、およびその他のツールが `node_modules/.bin` にインストールする `.cmd` と `.bat` シムは実行可能ファイルではなく、シェルなしで生成することはできません。exec フォームでそれらを実行するには、基になるスクリプトを `node` で直接呼び出します。例えば `"command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/node_modules/eslint/bin/eslint.js"]`。`node` プラス スクリプト パス パターンは、`node.exe` が実際のバイナリであるため、すべてのプラットフォームで機能します。`.cmd` または `.bat` シムを名前で実行するには、シェル フォームを使用します。

この例は、プラグインにバンドルされた Node スクリプトを実行します。Exec フォームは解決されたスクリプト パスを引用符なしで 1 つの引数として渡します。

```json
{
  "type": "command",
  "command": "node",
  "args": ["${CLAUDE_PLUGIN_ROOT}/scripts/format.js", "--fix"]
}
```

同等のシェル フォームは、スペースまたは特殊文字を含むパスを処理するために引用符が必要です。

```json
{
  "type": "command",
  "command": "node \"${CLAUDE_PLUGIN_ROOT}\"/scripts/format.js --fix"
}
```

両方のフォームは同じ[パス プレースホルダー](#reference-scripts-by-path)をサポートし、両方とも生成されたプロセスで環境変数 `CLAUDE_PROJECT_DIR`、`CLAUDE_PLUGIN_ROOT`、`CLAUDE_PLUGIN_DATA` としてエクスポートするため、スクリプトは起動方法に関係なく `process.env.CLAUDE_PLUGIN_ROOT` を読み取ることができます。プラグイン フックは追加で `${user_config.*}` 値を置換します。[ユーザー設定](/ja/plugins-reference#user-configuration)を参照してください。

Exec フォームでは、`command` は実行可能ファイル名またはパスのみです。`command` が空白を含むパス区切りなしの名前であり、`args` と一緒に空白を含む場合、Claude Code は警告をログします。生成が失敗するためです。`node script.js` という名前の実行可能ファイルはありません。余分なトークンを `args` に移動します。`C:\Program Files\nodejs\node.exe` などのスペースを含む絶対パスは、単一の有効な実行可能ファイルであり、警告をトリガーしません。

#### HTTP フック フィールド

[共通フィールド](#common-fields)に加えて、HTTP フックはこれらのフィールドを受け入れます。

| フィールド | 必須 | 説明 |
| :- | :- | :- |
| `url` | はい | POST リクエストを送信する URL |
| `headers` | いいえ | キー値ペアとしての追加 HTTP ヘッダー。値は `$VAR_NAME` または `${VAR_NAME}` 構文を使用した環境変数補間をサポートします。`allowedEnvVars` にリストされている変数のみが解決されます |
| `allowedEnvVars` | いいえ | ヘッダー値に補間される可能性のある環境変数名のリスト。リストされていない変数への参照は空の文字列に置き換えられます。環境変数補間が機能するために必須 |

Claude Code はフックの[JSON 入力](#hook-input-and-output)を `Content-Type: application/json` の POST リクエスト本体として送信します。レスポンス本体はコマンド フックと同じ[JSON 出力形式](#json-output)を使用します。

エラー処理はコマンド フックと異なります。2xx 以外のレスポンス、接続失敗、タイムアウトはすべて、実行を続行できる非ブロッキング エラーを生成します。ツール呼び出しをブロックまたは権限を拒否するには、`decision: "block"` または `hookSpecificOutput` を含む `permissionDecision: "deny"` を含む JSON 本体を持つ 2xx レスポンスを返します。

この例は `PreToolUse` イベントをローカル検証サービスに送信し、`MY_TOKEN` 環境変数からのトークンで認証します。

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "http",
            "url": "http://localhost:8080/hooks/pre-tool-use",
            "timeout": 30,
            "headers": {
              "Authorization": "Bearer $MY_TOKEN"
            },
            "allowedEnvVars": ["MY_TOKEN"]
          }
        ]
      }
    ]
  }
}
```

#### MCP ツール フック フィールド

[共通フィールド](#common-fields)に加えて、MCP ツール フックはこれらのフィールドを受け入れます。

| フィールド | 必須 | 説明 |
| :- | :- | :- |
| `server` | はい | 設定された MCP サーバーの名前。サーバーは既に接続されている必要があります。フックは OAuth または接続フローをトリガーしません |
| `tool` | はい | そのサーバー上で呼び出すツールの名前 |
| `input` | いいえ | ツールに渡される引数。文字列値は、フックの[JSON 入力](#hook-input-and-output)から `${path}` 置換をサポートします（例：`"${tool_input.file_path}"`） |

ツールのテキスト コンテンツはコマンド フック stdout のように扱われます。有効な[JSON 出力](#json-output)として解析される場合、決定として処理されます。そうでない場合は、プレーン テキストとして表示されます。指定されたサーバーが接続されていない場合、またはツールが `isError: true` を返す場合、フックは非ブロッキング エラーを生成し、実行は続行されます。

MCP ツール フックは、Claude Code が MCP サーバーに接続した後、すべてのフック イベントで利用可能です。`SessionStart` と `Setup` は通常、サーバーが接続を完了する前に発火するため、これらのイベント上のフックは最初の実行時に「接続されていない」エラーを予期する必要があります。

この例は、各 `Write` または `Edit` の後、`my_server` MCP サーバー上の `security_scan` ツールを呼び出し、編集されたファイルのパスを渡します。

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "mcp_tool",
            "server": "my_server",
            "tool": "security_scan",
            "input": { "file_path": "${tool_input.file_path}" }
          }
        ]
      }
    ]
  }
}
```

#### プロンプト フックとエージェント フック フィールド

[共通フィールド](#common-fields)に加えて、プロンプト フックとエージェント フックはこれらのフィールドを受け入れます。

| フィールド | 必須 | 説明 |
| :- | :- | :- |
| `prompt` | はい | モデルに送信するプロンプト テキスト。フック入力 JSON のプレースホルダーとして `$ARGUMENTS` を使用します |
| `model` | いいえ | 評価に使用するモデル。デフォルトは高速モデル |

すべてのマッチング フックは並列で実行され、同一のハンドラーは自動的に重複排除されます。コマンド フックはコマンド文字列と `args` で重複排除され、HTTP フックは URL で重複排除されます。ハンドラーは Claude Code の環境を持つ現在のディレクトリで実行されます。`$CLAUDE_CODE_REMOTE` 環境変数はリモート Web 環境で `"true"` に設定され、ローカル CLI では設定されません。

### パスでフック スクリプトを参照

フックが実行されるときの作業ディレクトリに関係なく、プロジェクトまたはプラグイン ルートを基準にしてフック スクリプトを参照するには、これらのプレースホルダーを使用します。

- `${CLAUDE_PROJECT_DIR}`: プロジェクト ルート。
- `${CLAUDE_PLUGIN_ROOT}`: プラグインの インストール ディレクトリ、[プラグイン](/ja/plugins)にバンドルされたスクリプト用。プラグイン更新時に変更されます。
- `${CLAUDE_PLUGIN_DATA}`: プラグインの[永続データ ディレクトリ](/ja/plugins-reference#persistent-data-directory)、プラグイン更新を通じて存続すべき依存関係と状態用。

パス プレースホルダーを参照するフックには[exec フォーム](#exec-form-and-shell-form)を優先してください。Exec フォームは各 `args` 要素を引用符なしで 1 つの引数として渡すため、スペースまたは特殊文字を含むパスは引用符が不要です。シェル フォームでは、各プレースホルダーをダブル クォートで囲みます。

この例は `${CLAUDE_PROJECT_DIR}` を使用して、`Write` または `Edit` ツール呼び出しの後、プロジェクトの `.claude/hooks/` ディレクトリからスタイル チェッカーを実行します。

```json theme={null}
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/check-style.sh",
            "args": []
          }
        ]
      }
    ]
  }
}
```

`hooks/hooks.json` でプラグイン フックを定義し、オプションのトップレベル `description` フィールドを使用します。プラグインが有効な場合、そのフックはユーザーおよびプロジェクト フックとマージされます。

この例は、プラグインにバンドルされたフォーマット スクリプトを実行します。

```json theme={null}
{
  "description": "Automatic code formatting",
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/format.sh",
            "args": [],
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

プラグイン フックの作成の詳細については、[プラグイン コンポーネント リファレンス](/ja/plugins-reference#hooks)を参照してください。

### スキルとエージェントのフック

設定ファイルとプラグインに加えて、フックは[スキル](/ja/skills)と[サブエージェント](/ja/sub-agents)でフロントマターを使用して直接定義できます。これらのフックはコンポーネントのライフサイクルにスコープされ、そのコンポーネントがアクティブな場合にのみ実行されます。

すべてのフック イベントがサポートされています。サブエージェントの場合、`Stop` フックは自動的に `SubagentStop` に変換されます。これはサブエージェントが完了したときに発火するイベントです。

フックは設定ベースのフックと同じ設定形式を使用しますが、コンポーネントのライフタイムにスコープされ、完了時にクリーンアップされます。

このスキルは、各 `Bash` コマンドの前にセキュリティ検証スクリプトを実行する `PreToolUse` フックを定義します。

```yaml
---
name: secure-operations
description: Perform operations with security checks
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/security-check.sh"
---
```

エージェントは YAML フロントマターで同じ形式を使用します。

### `/hooks` メニュー

Claude Code で `/hooks` と入力して、設定されたフックの読み取り専用ブラウザーを開きます。メニューはすべてのフック イベントを表示し、設定されたフックの数を示し、マッチャーにドリルダウンでき、各フック ハンドラーの完全な詳細を表示します。これを使用して設定を検証し、フックがどの設定ファイルから定義されたかを確認するか、フックのコマンド、プロンプト、または URL を検査します。

メニューは 5 つのフック タイプをすべて表示します。`command`、`prompt`、`agent`、`http`、`mcp_tool`。各フックには、そのソースを示す `[type]` プレフィックスとソース ラベルが付けられています。

- `User`: `~/.claude/settings.json` から
- `Project`: `.claude/settings.json` から
- `Local`: `.claude/settings.local.json` から
- `Plugin`: プラグインの `hooks/hooks.json` から
- `Session`: 現在のセッション用にメモリに登録
- `Built-in`: Claude Code によって内部的に登録

フックを選択すると、詳細ビューが開き、そのイベント、マッチャー、タイプ、ソース ファイル、および完全なコマンド、プロンプト、または URL が表示されます。メニューは読み取り専用です。フックを追加、変更、または削除するには、設定 JSON を直接編集するか、Claude にその変更を依頼してください。

### フックを無効化または削除

フックを削除するには、設定 JSON ファイルからそのエントリを削除します。

すべてのフックを削除せずに一時的に無効化するには、設定ファイルで `"disableAllHooks": true` を設定します。個別のフックを設定に保持したまま無効化する方法はありません。

`disableAllHooks` 設定は管理設定階層を尊重します。管理者が管理ポリシー設定を通じてフックを設定している場合、ユーザー、プロジェクト、またはローカル設定で設定された `disableAllHooks` は、それらの管理フックを無効化できません。管理設定レベルで設定された `disableAllHooks` のみが管理フックを無効化できます。

設定ファイルのフックへの直接編集は通常、ファイル ウォッチャーによって自動的に取得されます。

## フック入出力

コマンド フックは stdin 経由で JSON データを受け取り、終了コード、stdout、stderr を通じて結果を通信します。HTTP フックは同じ JSON をリクエスト本体として受け取り、HTTP レスポンス本体を通じて結果を通信します。このセクションでは、すべてのイベントに共通するフィールドと動作について説明します。[フック イベント](#hook-events)の各セクションには、その特定の入力スキーマと決定制御オプションが含まれています。

macOS と Linux では、コマンド フックは v2.1.139 以降、制御端末のない独自のセッションで実行されます。フック プロセスと子プロセスは `/dev/tty` を開くことも、エスケープ シーケンスを Claude Code インターフェイスに直接送信することもできません。Windows には `/dev/tty` がありません。任意のプラットフォームでユーザーにメッセージを表示するには、JSON 出力で[`systemMessage`](#json-output)を返します。デスクトップ通知をトリガーしたり、ウィンドウ タイトルを設定したり、ベルを鳴らしたりするには、代わりに[`terminalSequence`](#emit-terminal-notifications)を返します。

### 共通入力フィールド

フック イベントは、各[フック イベント](#hook-events)セクションで説明されているイベント固有のフィールドに加えて、これらのフィールドを JSON として受け取ります。コマンド フックの場合、この JSON は stdin 経由で到着します。HTTP フックの場合、POST リクエスト本体として到着します。

| フィールド | 説明 |
| :- | :- |
| `session_id` | 現在のセッション識別子 |
| `transcript_path` | 会話 JSON へのパス |
| `cwd` | フックが呼び出されるときの現在の作業ディレクトリ |
| `permission_mode` | 現在の[権限モード](/ja/permissions#permission-modes): `"default"`、`"plan"`、`"acceptEdits"`、`"auto"`、`"dontAsk"`、または `"bypassPermissions"`。すべてのイベントがこのフィールドを受け取るわけではありません。各イベントの JSON 例を確認してください |
| `effort` | アクティブな[努力レベル](/ja/model-config#adjust-effort-level)を保持する `level` フィールドを持つオブジェクト。ターンの場合: `"low"`、`"medium"`、`"high"`、`"xhigh"`、または `"max"`。リクエストされた努力レベルが現在のモデルがサポートしているものを超える場合、これはモデルが実際に使用したダウングレードされたレベルであり、リクエストしたレベルではありません。オブジェクトは[ステータス ライン](/ja/statusline#available-data)の `effort` フィールドと一致します。`PreToolUse`、`PostToolUse`、`Stop`、`SubagentStop` などのツール使用コンテキスト内で発火するイベント、および現在のモデルが努力パラメータをサポートする場合に存在します。レベルは、フック コマンドと Bash ツールに `$CLAUDE_EFFORT` 環境変数として利用可能です。 |
| `hook_event_name` | 発火したイベントの名前 |

`--agent` で実行するか、サブエージェント内で実行する場合、2 つの追加フィールドが含まれます。

| フィールド | 説明 |
| :- | :- |
| `agent_id` | サブエージェントの一意の識別子。フックがサブエージェント呼び出し内で発火する場合にのみ存在します。これを使用して、サブエージェント フック呼び出しをメイン スレッド呼び出しから区別します。 |
| `agent_type` | エージェント名（例えば、`"Explore"` または `"security-reviewer"`）。セッションが `--agent` を使用するか、フックがサブエージェント内で発火する場合に存在します。サブエージェントの場合、サブエージェントのタイプがセッションの `--agent` 値よりも優先されます。[カスタム サブエージェント](/ja/sub-agents)の場合、これはエージェントのフロントマターの `name` フィールドであり、ファイル名ではありません。 |

[`SessionStart`](#sessionstart) フックのみが `model` フィールドを受け取ります。`$CLAUDE_MODEL` 環境変数はありません。フック プロセスは親環境を継承するため、シェルで `$ANTHROPIC_MODEL` を設定した場合はそれを読み取ることができますが、セッション中に `/model` でモデルを切り替えるときにその値は変わりません。

例えば、Bash コマンドの `PreToolUse` フックは stdin で以下を受け取ります。

```json
{
  "session_id": "abc123",
  "transcript_path": "/home/user/.claude/projects/.../transcript.jsonl",
  "cwd": "/home/user/my-project",
  "permission_mode": "default",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "npm test"
  }
}
```

`tool_name` と `tool_input` フィールドはイベント固有です。各[フック イベント](#hook-events)セクションでは、そのイベントの追加フィールドについて説明しています。

### 終了コード出力

フック コマンドからの終了コードは、Claude Code にアクションが進行すべきか、ブロックされるべきか、無視されるべきかを伝えます。

**終了 0** は成功を意味します。Claude Code は stdout を[JSON 出力フィールド](#json-output)で解析します。JSON 出力は終了 0 でのみ処理されます。ほとんどのイベントでは、stdout はデバッグ ログに書き込まれますが、トランスクリプトには表示されません。例外は `UserPromptSubmit`、`UserPromptExpansion`、および `SessionStart` で、stdout は Claude が見て行動できるコンテキストとして追加されます。

**終了 2** はブロッキング エラーを意味します。Claude Code は stdout とそれ内の JSON を無視します。代わりに、stderr テキストがエラー メッセージとして Claude にフィードバックされます。効果はイベントに依存します。`PreToolUse` はツール呼び出しをブロックし、`UserPromptSubmit` はプロンプトを拒否します。完全なリストについては、[終了コード 2 動作](#exit-code-2-behavior-per-event)を参照してください。

**その他の終了コード** はほとんどのフック イベントの非ブロッキング エラーです。トランスクリプトは `<hook name> hook error` 通知を表示し、その後に stderr の最初の行が続くため、`--debug` なしで原因を特定できます。実行は続行され、完全な stderr はデバッグ ログに書き込まれます。

例えば、危険な Bash コマンドをブロックするフック コマンド スクリプト。

```bash
#!/bin/bash
# stdin から JSON 入力を読み取り、コマンドをチェック
command=$(jq -r '.tool_input.command' < /dev/stdin)

if [[ "$command" == rm* ]]; then
  echo "Blocked: rm commands are not allowed" >&2
  exit 2  # ブロッキング エラー: ツール呼び出しが防止される
fi

exit 0  # 成功: ツール呼び出しが進行
```

ほとんどのフック イベントでは、終了コード 2 のみがアクションをブロックします。Claude Code は終了コード 1 を非ブロッキング エラーとして扱い、1 が従来の Unix 失敗コードであっても、アクションを進行させます。フックがポリシーを実施することを目的としている場合は、`exit 2` を使用してください。例外は `WorktreeCreate` で、0 以外の終了コードはワークツリー作成を中止します。

#### イベントごとの終了コード 2 動作

終了コード 2 は、フックが「停止、これをしないでください」と通知する方法です。効果はイベントに依存します。一部のイベントはブロック可能なアクション（まだ発生していないツール呼び出しなど）を表し、他のイベントはすでに発生したか防止できないことを表すためです。

| フック イベント | ブロック可能？ | 終了 2 で何が起こるか |
| :- | :- | :- |
| `PreToolUse` | はい | ツール呼び出しをブロック |
| `PermissionRequest` | はい | 権限を拒否 |
| `UserPromptSubmit` | はい | プロンプト処理をブロックしてプロンプトを消去 |
| `UserPromptExpansion` | はい | 拡張をブロック |
| `Stop` | はい | Claude が停止するのを防ぎ、会話を続行 |
| `SubagentStop` | はい | サブエージェントが停止するのを防止 |
| `TeammateIdle` | はい | チームメイトがアイドル状態になるのを防止（チームメイトが作業を続行） |
| `TaskCreated` | はい | タスク作成をロールバック |
| `TaskCompleted` | はい | タスクが完了としてマークされるのを防止 |
| `ConfigChange` | はい | 設定変更が有効になるのをブロック（`policy_settings` を除く） |
| `StopFailure` | いいえ | 出力と終了コードは無視 |
| `PostToolUse` | いいえ | Claude に stderr を表示（ツールはすでに実行） |
| `PostToolUseFailure` | いいえ | Claude に stderr を表示（ツールはすでに失敗） |
| `PostToolBatch` | はい | 次のモデル呼び出しの前に agentic ループを停止 |
| `PermissionDenied` | いいえ | 終了コードと stderr は無視（拒否はすでに発生）。JSON `hookSpecificOutput.retry: true` を使用してモデルが再試行できることを伝える |
| `Notification` | いいえ | ユーザーのみに stderr を表示 |
| `SubagentStart` | いいえ | ユーザーのみに stderr を表示 |
| `SessionStart` | いいえ | ユーザーのみに stderr を表示 |
| `Setup` | いいえ | ユーザーのみに stderr を表示 |
| `SessionEnd` | いいえ | ユーザーのみに stderr を表示 |
| `CwdChanged` | いいえ | ユーザーのみに stderr を表示 |
| `FileChanged` | いいえ | ユーザーのみに stderr を表示 |
| `PreCompact` | はい | コンパクションをブロック |
| `PostCompact` | いいえ | ユーザーのみに stderr を表示 |
| `Elicitation` | はい | elicitation を拒否 |
| `ElicitationResult` | はい | レスポンスをブロック（アクションが decline になる） |
| `WorktreeCreate` | はい | 0 以外の終了コードでワークツリー作成が失敗 |
| `WorktreeRemove` | いいえ | 失敗はデバッグ モードでのみログ |
| `InstructionsLoaded` | いいえ | 終了コードは無視 |

### HTTP レスポンス処理

HTTP フックは終了コードと stdout の代わりに HTTP ステータス コードとレスポンス本体を使用します。

- **2xx で空の本体**: 成功、終了コード 0 で出力なしと同等
- **2xx でプレーン テキスト本体**: 成功、テキストがコンテキストとして追加
- **2xx で JSON 本体**: 成功、コマンド フックと同じ[JSON 出力](#json-output)スキーマを使用して解析
- **2xx 以外のステータス**: 非ブロッキング エラー、実行は続行
- **接続失敗またはタイムアウト**: 非ブロッキング エラー、実行は続行

コマンド フックとは異なり、HTTP フックはステータス コードのみでブロッキング エラーを通知できません。ツール呼び出しをブロックまたは権限を拒否するには、適切な決定フィールドを含む JSON 本体を持つ 2xx レスポンスを返します。

### JSON 出力

終了コードで許可またはブロックできますが、JSON 出力はより細かい制御を提供します。終了コード 2 でブロックする代わりに、終了 0 して stdout に JSON オブジェクトを出力します。Claude Code はその JSON から特定のフィールドを読み取り、ブロック、許可、またはユーザーへのエスカレーションを含む[決定制御](#decision-control)を通じた動作を制御します。

フックごとに 1 つのアプローチを選択する必要があります。両方ではありません。終了コードのみでシグナリングするか、終了 0 して構造化制御のために JSON を出力するかのいずれかです。Claude Code は終了 0 でのみ JSON を処理します。終了 2 の場合、JSON は無視されます。

フックの stdout には JSON オブジェクトのみが含まれている必要があります。シェル プロファイルがスタートアップ時にテキストを出力する場合、JSON 解析に干渉する可能性があります。トラブルシューティング ガイドの[JSON 検証に失敗](/ja/hooks-guide#json-validation-failed)を参照してください。

フック出力文字列（`additionalContext`、`systemMessage`、およびプレーン stdout を含む）は 10,000 文字でキャップされます。この制限を超える出力はファイルに保存され、プレビューとファイル パスに置き換えられます。大きなツール結果と同じ方法で処理されます。

JSON オブジェクトは 3 種類のフィールドをサポートしています。

- **`continue` などのユニバーサル フィールド**はすべてのイベント全体で機能します。これらは以下の表にリストされています。
- **トップレベルの `decision` と `reason`** は一部のイベントで使用され、ブロックまたはフィードバックを提供します。
- **`hookSpecificOutput`** はより豊かな制御が必要なイベント用のネストされたオブジェクトです。イベント名に設定された `hookEventName` フィールドが必要です。

| フィールド | デフォルト | 説明 |
| :- | :- | :- |
| `continue` | `true` | `false` の場合、フックが実行された後、Claude は完全に処理を停止します。イベント固有の決定フィールドよりも優先されます |
| `stopReason` | なし | `continue` が `false` のときにユーザーに表示されるメッセージ。Claude には表示されません |
| `suppressOutput` | `false` | `true` の場合、デバッグ ログから stdout を非表示にします |
| `systemMessage` | なし | ユーザーに表示される警告メッセージ |
| `terminalSequence` | なし | Claude Code が代わりに発行するターミナル エスケープ シーケンス（デスクトップ通知、ウィンドウ タイトル、ベルなど）。OSC `0`/`1`/`2`/`9`/`99`/`777` と BEL に制限されます。値に許可リスト外のものが含まれている場合、フィールドは無視されます。`/dev/tty` が利用できないフックの代わりにこれを使用してください |

Claude を完全に停止するには、イベント タイプに関係なく。

```json
{ "continue": false, "stopReason": "Build failed, fix errors before continuing" }
```

#### ターミナル通知を発行

`terminalSequence` フィールドには Claude Code v2.1.141 以降が必要です。

フックは制御端末なしで実行されるため、エスケープ シーケンスを `/dev/tty` に直接書き込むことは失敗します。代わりに、エスケープ シーケンスを `terminalSequence` フィールドで返し、Claude Code は独自のターミナル書き込みパスを通じてそれを発行します。これはレース フリーで、tmux と GNU screen 内で機能し、`/dev/tty` がない Windows で機能します。

フィールドは 1 つ以上の許可リストに登録されたエスケープ シーケンスの文字列を受け入れます。

- OSC `0`、`1`、`2`: ウィンドウとアイコン タイトル
- OSC `9`: iTerm2、ConEmu、Windows Terminal、WezTerm 通知（`9;4` タスクバー進捗を含む）
- OSC `99`: Kitty 通知
- OSC `777`: urxvt、Ghostty、Warp 通知
- 裸の BEL

シーケンスは BEL または ST で終了する場合があります。許可リスト外のもの（CSI カーソルと色シーケンス、OSC パレット シーケンス、OSC 8 ハイパーリンク、OSC 52 クリップボード書き込み、OSC 1337 を含む）は拒否され、フィールドは無視されます。

以下の例は `Notification` フックからデスクトップ通知を発火します。エスケープ シーケンスは `printf` 8 進数エスケープで構築されるため、制御バイトはシェル コマンド ラインに表示されず、`jq -n --arg` は JSON 出力を構築するため、通知メッセージの引用符、バックスラッシュ、改行は正しくエスケープされます。

```bash
#!/bin/bash
# Notification フック: Claude Code が注意を必要とするときにデスクトップに ping を送信します。
input=$(cat)
title="Claude Code'
body=$(jq -r '.message // "Needs your attention"' <<<"$input")
seq=$(printf '\033]777;notify;%s;%s\007' "$title" "$body")
jq -nc --arg seq "$seq" '{terminalSequence: $seq}'
```

`{ "terminalSequence": "..." }` の形状は、任意のシェルまたは言語から同じです。Windows では、PowerShell またはスクリプトでエスケープ文字列を構築し、同じ JSON オブジェクトを発行します。

`terminalSequence` は、以前に `/dev/tty` にエスケープ シーケンスを直接書き込んでいたフックの対応する置き換えです。許可リストはカーソルを移動したり色を変更したりできないシーケンスに制限されているため、フックはオンスクリーン プロンプトを破損することはできません。

#### Claude 用にコンテキストを追加

`additionalContext` フィールドは、フックから Claude のコンテキスト ウィンドウに文字列を渡します。Claude Code は文字列をシステム リマインダーでラップし、フックが発火した時点で会話に挿入します。Claude は次のモデル リクエストでリマインダーを読み取りますが、インターフェイスではチャット メッセージとして表示されません。

`hookSpecificOutput` 内でイベント名と一緒に `additionalContext` を返します。

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "This file is generated. Edit src/schema.ts and run `bun generate` instead."
  }
}
```

リマインダーが表示される場所はイベントに依存します。

- [SessionStart](#sessionstart)、[Setup](#setup)、および [SubagentStart](#subagentstart): 会話の開始時、最初のプロンプトの前
- [UserPromptSubmit](#userpromptsubmit) および [UserPromptExpansion](#userpromptexpansion): 送信されたプロンプトの横
- [PreToolUse](#pretooluse)、[PostToolUse](#posttooluse)、[PostToolUseFailure](#posttoolusefailure)、および [PostToolBatch](#posttoolbatch): ツール結果の横

複数のフックが同じイベントに対して `additionalContext` を返す場合、Claude はすべての値を受け取ります。値が 10,000 文字を超える場合、Claude Code はセッション ディレクトリ内のファイルに完全なテキストを書き込み、短いプレビューとファイル パスを Claude に渡します。

Claude が現在の環境の状態または実行されたばかりの操作について知っておくべき情報に `additionalContext` を使用します。

- **環境状態**: 現在のブランチ、デプロイ ターゲット、またはアクティブな機能フラグ
- **条件付きプロジェクト ルール**: 編集されたばかりのファイルに適用されるテスト コマンド、このワークツリーで読み取り専用のディレクトリ
- **外部データ**: 割り当てられたオープン イシュー、最近の CI 結果、内部サービスから取得されたコンテンツ

変わらない指示については、[CLAUDE.md](/ja/memory)を優先します。スクリプトを実行せずに読み込まれ、静的なプロジェクト規約の標準的な場所です。

テキストを命令型システム指示ではなく、事実的なステートメントとして記述します。「デプロイ ターゲットは本番環境です」または「このリポジトリは `bun test` を使用します」などのフレーズはプロジェクト情報として読み取られます。帯域外システム コマンドとしてフレーム化されたテキストは Claude のプロンプト インジェクション防御をトリガーする可能性があり、Claude がテキストをコンテキストとして扱う代わりに表示します。

注入されたテキストはセッション トランスクリプトに保存されます。`PostToolUse` または `UserPromptSubmit` などの中盤イベントの場合、`--continue` または `--resume` で再開すると、フックを再実行する代わりに保存されたテキストが再生されるため、タイムスタンプやコミット SHA などの値は再開時に古くなります。`SessionStart` フックは `source` を `"resume"` に設定して再開時に再度実行されるため、コンテキストをリフレッシュできます。

#### 決定制御

すべてのイベントが JSON を通じたブロッキングまたは動作制御をサポートしているわけではありません。サポートするイベントは、その決定を表現するために異なるフィールド セットを使用します。フックを書く前に、このテーブルをクイック リファレンスとして使用してください。

| イベント | 決定パターン | キー フィールド |
| :- | :- | :- |
| UserPromptSubmit、UserPromptExpansion、PostToolUse、PostToolUseFailure、PostToolBatch、Stop、SubagentStop、ConfigChange、PreCompact | トップレベル `decision` | `decision: "block"`、`reason` |
| TeammateIdle、TaskCreated、TaskCompleted | 終了コードまたは `continue: false` | 終了コード 2 はアクションをブロックし、stderr フィードバックを使用します。JSON `{"continue": false, "stopReason": "..."}` はチームメイト全体を停止し、`Stop` フック動作と一致します |
| PreToolUse | `hookSpecificOutput` | `permissionDecision`（allow/deny/ask/defer）、`permissionDecisionReason` |
| PermissionRequest | `hookSpecificOutput` | `decision.behavior`（allow/deny） |
| PermissionDenied | `hookSpecificOutput` | `retry: true` はモデルが拒否されたツール呼び出しを再試行できることを伝える |
| WorktreeCreate | パス戻り値 | コマンド フックは stdout にパスを出力します。HTTP フックは `hookSpecificOutput.worktreePath` 経由で返します。フック失敗またはパス欠落で作成が失敗 |
| Elicitation | `hookSpecificOutput` | `action`（accept/decline/cancel）、`content`（accept の場合のフォーム フィールド値） |
| ElicitationResult | `hookSpecificOutput` | `action`（accept/decline/cancel）、`content`（フォーム フィールド値をオーバーライド） |
| SessionStart、Setup、SubagentStart | コンテキストのみ | `hookSpecificOutput.additionalContext` は Claude 用にコンテキストを追加します。SessionStart は [`initialUserMessage` と `watchPaths`](#sessionstart-decision-control)も受け入れます。ブロッキングまたは決定制御なし |
| WorktreeRemove、Notification、SessionEnd、PostCompact、InstructionsLoaded、StopFailure、CwdChanged、FileChanged | なし | 決定制御なし。ログやクリーンアップなどの副作用に使用 |

各パターンの実行例を以下に示します。

`UserPromptSubmit`、`UserPromptExpansion`、`PostToolUse`、`PostToolUseFailure`、`PostToolBatch`、`Stop`、`SubagentStop`、`ConfigChange`、`PreCompact` で使用されます。唯一の値は `"block"` です。アクションを進行させるには、JSON から `decision` を省略するか、JSON なしで終了 0 で終了します。

```json theme={null}
{
  "decision": "block",
  "reason": "Test suite must pass before proceeding"
}
```

より豊かな制御のために `hookSpecificOutput` を使用します。許可、拒否、またはユーザーへのエスカレーション。ツール入力を実行前に変更したり、Claude 用に追加コンテキストを注入することもできます。オプションの完全なセットについては、[PreToolUse 決定制御](#pretooluse-decision-control)を参照してください。

```json theme={null}
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Database writes are not allowed"
  }
}
```

`hookSpecificOutput` を使用して、ユーザーに代わって権限リクエストを許可または拒否します。許可する場合、ツールの入力を変更したり、権限ルールを適用して、ユーザーが再度プロンプトされないようにすることもできます。オプションの完全なセットについては、[PermissionRequest 決定制御](#permissionrequest-decision-control)を参照してください。

```json theme={null}
{
  "hookSpecificOutput": {
    "hookEventName": "PermissionRequest",
    "decision": {
      "behavior": "allow",
      "updatedInput": {
        "command": "npm run lint"
      }
    }
  }
}
```

Bash コマンド検証、プロンプト フィルタリング、自動承認スクリプトを含む拡張例については、ガイドの[自動化できること](/ja/hooks-guide#what-you-can-automate)と[Bash コマンド バリデーター リファレンス実装](https://github.com/anthropics/claude-code/blob/main/examples/hooks/bash_command_validator_example.py)を参照してください。

## フック イベント

各イベントは Claude Code のライフサイクル内のポイントに対応し、フックが実行できます。以下のセクションはライフサイクルに一致する順序で配置されています。セッション セットアップから agentic ループを経由してセッション終了まで。各セクションでは、イベントがいつ発火するか、サポートするマッチャー、受け取る JSON 入力、出力を通じた動作制御方法について説明しています。

### SessionStart

Claude Code が新しいセッションを開始するか、既存のセッションを再開するときに実行されます。既存の問題や最近のコードベース変更など、開発コンテキストをロードしたり、環境変数をセットアップしたりするのに便利です。静的コンテキストでスクリプトが不要な場合は、代わりに[CLAUDE.md](/ja/memory)を使用してください。

SessionStart はすべてのセッションで実行されるため、これらのフックを高速に保ちます。`type: "command"` と `type: "mcp_tool"` フックのみがサポートされています。

マッチャー値はセッションがどのように開始されたかに対応しています。

| マッチャー | いつ発火するか |
| :- | :- |
| `startup` | 新しいセッション |
| `resume` | `--resume`、`--continue`、または `/resume` |
| `clear` | `/clear` |
| `compact` | 自動またはマニュアル コンパクション |

#### SessionStart 入力

[共通入力フィールド](#common-input-fields)に加えて、SessionStart フックは `source`、`model`、およびオプションで `agent_type` を受け取ります。`source` フィールドはセッションがどのように開始されたかを示します。新しいセッションの場合は `"startup"`、再開されたセッションの場合は `"resume"`、`/clear` の後は `"clear"`、コンパクション後は `"compact"`。`model` フィールドはモデル識別子を含みます。`claude --agent <name>` で Claude Code を開始する場合、`agent_type` フィールドはエージェント名を含みます。

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "hook_event_name": "SessionStart",
  "source": "startup",
  "model": "claude-sonnet-4-6"
}
```

#### SessionStart 決定制御

フック スクリプトが stdout に出力するテキストは Claude のコンテキストとして追加されます。すべてのフックで利用可能な[JSON 出力フィールド](#json-output)に加えて、これらのイベント固有のフィールドを返すことができます。

| フィールド | 説明 |
| :- | :- |
| `additionalContext` | Claude のコンテキストの開始時に追加される文字列。最初のプロンプトの前。[Claude のコンテキストを追加](#add-context-for-claude)を参照して、テキストがどのように配信されるか、何を含めるかを確認してください |
| `initialUserMessage` | セッションの最初のユーザー メッセージとして使用される文字列。[非対話型モード](/ja/headless)（`-p`）で適用され、プロンプトが提供されない場合でも最初のターンになります。プロンプトが提供される場合、次のターンとして続きます。`additionalContext` とは異なり、既存のターンに付加されるのではなく、このターンを作成します |
| `watchPaths` | このセッション中に[FileChanged](#filechanged)イベントを監視する絶対パスの配列 |

```json
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "Current branch: feat/auth-refactor\nUncommitted changes: src/auth.ts, src/login.tsx\nActive issue: #4211 Migrate to OAuth2"
  }
}
```

このイベントではプレーン stdout が既に Claude に到達するため、コンテキストのみをロードするフックは JSON を構築せずに stdout に直接出力できます。`suppressOutput` などの他のフィールドとコンテキストを組み合わせる必要がある場合は JSON 形式を使用します。

#### 環境変数を永続化

SessionStart フックは `CLAUDE_ENV_FILE` 環境変数にアクセスでき、後続の Bash コマンド用に環境変数を永続化できるファイル パスを提供します。

個別の環境変数を設定するには、`export` ステートメントを `CLAUDE_ENV_FILE` に書き込みます。他のフックで設定された変数を保持するには、追加（`>>`）を使用します。

```bash
#!/bin/bash

if [ -n "$CLAUDE_ENV_FILE" ]; then
  echo 'export NODE_ENV=production' >> "$CLAUDE_ENV_FILE"
  echo 'export DEBUG_LOG=true' >> "$CLAUDE_ENV_FILE"
  echo 'export PATH="$PATH:./node_modules/.bin"' >> "$CLAUDE_ENV_FILE"
fi

exit 0
```

環境からのすべての変更をキャプチャするには、セットアップ コマンドの前後でエクスポートされた変数を比較します。

```bash
#!/bin/bash

ENV_BEFORE=$(export -p | sort)

# 環境を変更するセットアップ コマンドを実行
source ~/.nvm/nvm.sh
nvm use 20

if [ -n "$CLAUDE_ENV_FILE" ]; then
  ENV_AFTER=$(export -p | sort)
  comm -13 <(echo "$ENV_BEFORE") <(echo "$ENV_AFTER") >> "$CLAUDE_ENV_FILE"
fi

exit 0
```

このファイルに書き込まれた変数は、セッション中に Claude Code が実行するすべての後続の Bash コマンドで利用可能になります。

`CLAUDE_ENV_FILE` は SessionStart、[Setup](#setup)、[CwdChanged](#cwdchanged)、[FileChanged](#filechanged)フックで利用可能です。他のフック タイプはこの変数にアクセスできません。

### Setup

`--init-only` で Claude Code を起動するか、プリント モード（`-p`）で `--init` または `--maintenance` で起動するときのみ発火します。通常のスタートアップでは発火しません。CI またはスクリプトから明示的にトリガーする 1 回限りの依存関係インストールまたはスケジュール済みクリーンアップに使用します。通常のセッション スタートアップとは別です。セッションごとの初期化の場合は、代わりに[SessionStart](#sessionstart)を使用してください。

マッチャー値はフックをトリガーした CLI フラグに対応しています。

| マッチャー | いつ発火するか |
| :- | :- |
| `init` | `claude --init-only` または `claude -p --init` |
| `maintenance` | `claude -p --maintenance` |

`--init-only` は Setup フックと `startup` マッチャーを持つ SessionStart フックを実行してから、会話を開始せずに終了します。`--init` と `--maintenance` は `-p`（プリント モード）と組み合わせた場合のみ Setup フックを発火させます。対話型セッションでは、これら 2 つのフラグは現在 Setup フックを発火させません。

Setup はすべての起動で発火しないため、依存関係がインストールされている必要があるプラグインは Setup のみに依存できません。実用的なパターンは、最初の使用時に依存関係をチェックし、欠落している場合はインストールすることです。例えば、`${CLAUDE_PLUGIN_DATA}/node_modules` をテストし、欠落している場合は `npm install` を実行するフックまたはスキル。永続データ ディレクトリについては、[永続データ ディレクトリ](/ja/plugins-reference#persistent-data-directory)を参照して、インストールされた依存関係を保存する場所を確認してください。

#### Setup 入力

[共通入力フィールド](#common-input-fields)に加えて、Setup フックは `trigger` フィールドを受け取ります。これは `"init"` または `"maintenance"` に設定されます。

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "hook_event_name": "Setup",
  "trigger": "init"
}
```

#### Setup 決定制御

Setup フックはブロックできません。終了コード 2 では、stderr がユーザーに表示されます。その他の非ゼロ終了コードでは、stderr は `--verbose` で起動した場合のみ表示されます。どちらの場合も実行は続行されます。Claude のコンテキストに情報を渡すには、JSON 出力で `additionalContext` を返します。プレーン stdout はデバッグ ログにのみ書き込まれます。すべてのフックで利用可能な[JSON 出力フィールド](#json-output)に加えて、これらのイベント固有のフィールドを返すことができます。

| フィールド | 説明 |
| :- | :- |
| `additionalContext` | Claude のコンテキストに追加される文字列。複数のフックの値は連結されます |

```json
{
  "hookSpecificOutput": {
    "hookEventName": "Setup",
    "additionalContext": "Dependencies installed: node_modules, .venv"
  }
}
```

Setup フックは `CLAUDE_ENV_FILE` にアクセスできます。そのファイルに書き込まれた変数は、[SessionStart フック](#persist-environment-variables)と同じように、セッション中の後続の Bash コマンドに永続化されます。`type: "command"` と `type: "mcp_tool"` フックのみがサポートされています。

### InstructionsLoaded

`CLAUDE.md` または `.claude/rules/*.md` ファイルがコンテキストにロードされるときに発火します。このイベントはセッション開始時に熱心にロードされたファイルに対して発火し、後で Claude がネストされた `CLAUDE.md` を含むサブディレクトリにアクセスするときなど、遅延ロードされたファイルに対して再度発火します。または `paths:` フロントマターを持つ条件付きルールがマッチするとき。フックはブロッキングまたは決定制御をサポートしません。観測可能性の目的で非同期に実行されます。

マッチャーは `load_reason` に対して実行されます。例えば、`"matcher": "session_start"` を使用してセッション開始時にロードされたファイルのみに対して発火するか、`"matcher": "path_glob_match|nested_traversal"` を使用して遅延ロードのみに対して発火します。

#### InstructionsLoaded 入力

[共通入力フィールド](#common-input-fields)に加えて、InstructionsLoaded フックはこれらのフィールドを受け取ります。

| フィールド | 説明 |
| :- | :- |
| `file_path` | ロードされた命令ファイルへの絶対パス |
| `memory_type` | ファイルのスコープ: `"User"`、`"Project"`、`"Local"`、または `"Managed"` |
| `load_reason` | ファイルがロードされた理由: `"session_start"`、`"nested_traversal"`、`"path_glob_match"`、`"include"`、または `"compact"`。`"compact"` 値はコンパクション イベント後に命令ファイルが再ロードされるときに発火します |
| `globs` | ファイルの `paths:` フロントマターからのパス グロブ パターン（存在する場合）。`path_glob_match` ロードの場合のみ存在 |
| `trigger_file_path` | 遅延ロードの場合、このロードをトリガーしたファイルへのパス |
| `parent_file_path` | `include` ロードの場合、このファイルを含む親命令ファイルへのパス |

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../transcript.jsonl",
  "cwd": "/Users/my-project",
  "hook_event_name": "InstructionsLoaded",
  "file_path": "/Users/my-project/CLAUDE.md",
  "memory_type": "Project",
  "load_reason": "session_start"
}
```

#### InstructionsLoaded 決定制御

InstructionsLoaded フックは決定制御がありません。命令ロードをブロックまたは変更できません。このイベントを監査ログ、コンプライアンス追跡、または観測可能性に使用します。

### UserPromptSubmit

ユーザーがプロンプトを送信するときに実行されます。Claude がそれを処理する前に。これにより、プロンプト/会話に基づいて追加コンテキストを追加したり、プロンプトを検証したり、特定のタイプのプロンプトをブロックしたりできます。

`UserPromptSubmit` フックは `command`、`http`、`mcp_tool` タイプのデフォルト タイムアウトが 30 秒で、他のイベントでのこれらのタイプの 600 秒のデフォルトより短くなっています。このフックはすべてのプロンプトの前に実行され、モデル処理がそれが完了するまでブロックされるため、スタックしたフックはセッションを停止させます。フックにより多くの時間が必要な場合は、フック エントリで `timeout` フィールドを設定します。

#### UserPromptSubmit 入力

[共通入力フィールド](#common-input-fields)に加えて、UserPromptSubmit フックはユーザーが送信したテキストを含む `prompt` フィールドを受け取ります。

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "permission_mode": "default",
  "hook_event_name": "UserPromptSubmit",
  "prompt": "Write a function to calculate the factorial of a number"
}
```

#### UserPromptSubmit 決定制御

`UserPromptSubmit` フックは、ユーザー プロンプトが処理されるかどうかを制御し、コンテキストを追加できます。すべての[JSON 出力フィールド](#json-output)が利用可能です。

終了コード 0 で会話にコンテキストを追加する 2 つの方法があります。

- **プレーン テキスト stdout**: stdout に書き込まれた JSON 以外のテキストはコンテキストとして追加されます
- **`additionalContext` を含む JSON**: より多くの制御のために以下の JSON 形式を使用します。`additionalContext` フィールドはコンテキストとして追加されます

プレーン stdout はトランスクリプトのフック出力として表示されます。`additionalContext` フィールドはより慎重に追加されます。

プロンプトをブロックするには、`decision` を `"block"` に設定した JSON オブジェクトを返します。

| フィールド | 説明 |
| :- | :- |
| `decision` | `"block"` はプロンプトが処理されるのを防ぎ、コンテキストから消去します。許可するには省略 |
| `reason` | `decision` が `"block"` のときにユーザーに表示されます。コンテキストに追加されません |
| `additionalContext` | Claude のコンテキストに追加される文字列。[Claude のコンテキストを追加](#add-context-for-claude)を参照してください |
| `sessionTitle` | セッション タイトルを設定します。プロンプト コンテンツに基づいてセッションを自動的に名前付けするのに使用 |
| `suppressOriginalPrompt` | `decision` が `"block"` のときに `true` の場合、ユーザーに表示されるブロック メッセージから元のプロンプト テキストを省略 |

```json
{
  "decision": "block",
  "reason": "Explanation for decision",
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "My additional context here",
    "sessionTitle": "My session title"
  }
}
```

JSON 形式は単純なユースケースには必須ではありません。コンテキストを追加するには、終了コード 0 で stdout にプレーン テキストを出力できます。プロンプトをブロックしたい場合、またはより構造化された制御が必要な場合は JSON を使用します。

### UserPromptExpansion

ユーザーが入力したスラッシュ コマンドが Claude に到達する前にプロンプトに展開されるときに実行されます。特定のコマンドを直接呼び出しからブロックしたり、特定のスキルのコンテキストを注入したり、ユーザーが呼び出すコマンドをログしたりするのに使用します。例えば、`deploy` にマッチするフックは、承認ファイルが存在しない限り `/deploy` をブロックできます。または、レビュー スキルにマッチするフックはチームのレビュー チェックリストを `additionalContext` として追加できます。

このイベントは `PreToolUse` がカバーしないパスをカバーします。`PreToolUse` フックが `Skill` ツールにマッチするのは Claude がツールを呼び出すときのみですが、`/skillname` を直接入力すると `PreToolUse` をバイパスします。`UserPromptExpansion` はその直接パスで発火します。

`command_name` でマッチします。マッチャーを空のままにして、すべてのプロンプト タイプのスラッシュ コマンドで発火します。

#### UserPromptExpansion 入力

[共通入力フィールド](#common-input-fields)に加えて、UserPromptExpansion フックは `expansion_type`、`command_name`、`command_args`、`command_source`、および元の `prompt` 文字列を受け取ります。`expansion_type` フィールドはスキルとカスタム コマンドの場合は `slash_command`、MCP サーバー プロンプトの場合は `mcp_prompt` です。

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../00893aaf.jsonl",
  "cwd": "/Users/...",
  "permission_mode": "default",
  "hook_event_name": "UserPromptExpansion",
  "expansion_type": "slash_command",
  "command_name": "example-skill",
  "command_args": "arg1 arg2",
  "command_source": "plugin",
  "prompt": "/example-skill arg1 arg2"
}
```

#### UserPromptExpansion 決定制御

`UserPromptExpansion` フックは展開をブロックするか、コンテキストを追加できます。すべての[JSON 出力フィールド](#json-output)が利用可能です。

| フィールド | 説明 |
| :- | :- |
| `decision` | `"block"` はスラッシュ コマンドが展開されるのを防止。許可するには省略 |
| `reason` | `decision` が `"block"` のときにユーザーに表示されます |
| `additionalContext` | 展開されたプロンプトと一緒に Claude のコンテキストに追加される文字列。[Claude のコンテキストを追加](#add-context-for-claude)を参照してください |

```json
{
  "decision": "block",
  "reason": "This slash command is not available",
  "hookSpecificOutput": {
    "hookEventName": "UserPromptExpansion",
    "additionalContext": "Additional context for this expansion"
  }
}
```

### PreToolUse

Claude がツール パラメーターを作成した後、ツール呼び出しを処理する前に実行されます。ツール名でマッチします。`Bash`、`Edit`、`Write`、`Read`、`Glob`、`Grep`、`Agent`、`WebFetch`、`WebSearch`、`AskUserQuestion`、`ExitPlanMode`、および任意の[MCP ツール名](#match-mcp-tools)。

[PreToolUse 決定制御](#pretooluse-decision-control)を使用して、ツールの使用を許可、拒否、質問、または遅延します。

#### PreToolUse 入力

[共通入力フィールド](#common-input-fields)に加えて、PreToolUse フックは `tool_name`、`tool_input`、`tool_use_id` を受け取ります。`tool_input` フィールドはツールに依存します。

##### Bash

シェル コマンドを実行します。

| フィールド | タイプ | 例 | 説明 |
| :- | :- | :- | :- |
| `command` | 文字列 | `"npm test"` | 実行するシェル コマンド |
| `description` | 文字列 | `"Run test suite"` | コマンドが何をするかのオプション説明 |
| `timeout` | 数値 | `120000` | ミリ秒単位のオプション タイムアウト |
| `run_in_background` | ブール値 | `false` | コマンドをバックグラウンドで実行するかどうか |

##### Write

ファイルを作成または上書きします。

| フィールド | タイプ | 例 | 説明 |
| :- | :- | :- | :- |
| `file_path` | 文字列 | `"/path/to/file.txt"` | 書き込むファイルへの絶対パス |
| `content` | 文字列 | `"file content"` | ファイルに書き込むコンテンツ |

##### Edit

既存ファイル内の文字列を置換します。

| フィールド | タイプ | 例 | 説明 |
| :- | :- | :- | :- |
| `file_path` | 文字列 | `"/path/to/file.txt"` | 編集するファイルへの絶対パス |
| `old_string` | 文字列 | `"original text"` | 検索して置換するテキスト |
| `new_string` | 文字列 | `"replacement text"` | 置換テキスト |
| `replace_all` | ブール値 | `false` | すべての出現を置換するかどうか |

##### Read

ファイル コンテンツを読み取ります。

| フィールド | タイプ | 例 | 説明 |
| :- | :- | :- | :- |
| `file_path` | 文字列 | `"/path/to/file.txt"` | 読み取るファイルへの絶対パス |
| `offset` | 数値 | `10` | 読み取りを開始する行番号のオプション |
| `limit` | 数値 | `50` | 読み取る行数のオプション |

##### Glob

グロブ パターンにマッチするファイルを検索します。

| フィールド | タイプ | 例 | 説明 |
| :- | :- | :- | :- |
| `pattern` | 文字列 | `"**/*.ts"` | ファイルにマッチするグロブ パターン |
| `path` | 文字列 | `"/path/to/dir"` | 検索するオプション ディレクトリ。デフォルトは現在の作業ディレクトリ |

##### Grep

正規表現でファイル コンテンツを検索します。

| フィールド | タイプ | 例 | 説明 |
| :- | :- | :- | :- |
| `pattern` | 文字列 | `"TODO.*fix"` | 検索する正規表現パターン |
| `path` | 文字列 | `"/path/to/dir"` | 検索するオプション ファイルまたはディレクトリ |
| `glob` | 文字列 | `"*.ts"` | ファイルをフィルタリングするオプション グロブ パターン |
| `output_mode` | 文字列 | `"content"` | `"content"`、`"files_with_matches"`、または `"count"`。デフォルトは `"files_with_matches"` |
| `-i` | ブール値 | `true` | 大文字小文字を区別しない検索 |
| `multiline` | ブール値 | `false` | 複数行マッチングを有効化 |

##### WebFetch

Web コンテンツを取得して処理します。

| フィールド | タイプ | 例 | 説明 |
| :- | :- | :- | :- |
| `url` | 文字列 | `"https://example.com/api"` | コンテンツを取得する URL |
| `prompt` | 文字列 | `"Extract the API endpoints"` | 取得したコンテンツで実行するプロンプト |

##### WebSearch

Web を検索します。

| フィールド | タイプ | 例 | 説明 |
| :- | :- | :- | :- |
| `query` | 文字列 | `"react hooks best practices"` | 検索クエリ |
| `allowed_domains` | 配列 | `["docs.example.com"]` | オプション: これらのドメインからのみ結果を含める |
| `blocked_domains` | 配列 | `["spam.example.com"]` | オプション: これらのドメインからの結果を除外 |

##### Agent

[サブエージェント](/ja/sub-agents)を生成します。

| フィールド | タイプ | 例 | 説明 |
| :- | :- | :- | :- |
| `prompt` | 文字列 | `"Find all API endpoints"` | エージェントが実行するタスク |
| `description` | 文字列 | `"Find API endpoints"` | タスクの短い説明 |
| `subagent_type` | 文字列 | `"Explore"` | 使用する特殊エージェントのタイプ |
| `model` | 文字列 | `"sonnet"` | デフォルトをオーバーライドするオプション モデル エイリアス |

`PostToolUse` では、完了した Agent 呼び出しの `tool_response` はサブエージェントの最終テキストと使用テレメトリを含みます。フックからサブエージェント単位のコストを記録するためにこれらのフィールドを読み取ります。

| フィールド | タイプ | 例 | 説明 |
| :- | :- | :- | :- |
| `status` | 文字列 | `"completed"` | 同期呼び出しの場合は `"completed"`、`run_in_background: true` の場合は `"async_launched"` |
| `agentId` | 文字列 | `"a4d2c8f1e0b3a297"` | サブエージェント実行の識別子 |
| `content` | 配列 | `[{"type": "text", "text": "Found 12 endpoints..."}]` | サブエージェントの最終テキスト ブロック |
| `totalTokens` | 数値 | `12450` | サブエージェントのターン全体で請求されたトークン合計 |
| `totalDurationMs` | 数値 | `48211` | サブエージェント実行の実時間 |
| `totalToolUseCount` | 数値 | `7` | サブエージェントが行ったツール呼び出しの数 |
| `usage` | オブジェクト | `{"input_tokens": 8320, ...}` | タイプ別トークン分解: `input_tokens`、`output_tokens`、`cache_creation_input_tokens`、`cache_read_input_tokens` |

`run_in_background: true` 呼び出しの場合、ツールはサブエージェント起動後すぐに返されるため、`tool_response` は使用フィールドを含みません。`status: "async_launched"`、`agentId`、`description`、`prompt`、`outputFile` を含みます。

##### AskUserQuestion

ユーザーに 1 つから 4 つの複数選択肢の質問をします。

| フィールド | タイプ | 例 | 説明 |
| :- | :- | :- | :- |
| `questions` | 配列 | `[{"question": "Which framework?", "header": "Framework", "options": [{"label": "React"}], "multiSelect": false}]` | 提示する質問。各質問には `question` 文字列、短い `header`、`options` 配列、およびオプションの `multiSelect` フラグがあります |
| `answers` | オブジェクト | `{"Which framework?": "React"}` | オプション。質問テキストを選択されたオプション ラベルにマップします。複数選択の回答はラベルをコンマで結合します。Claude はこのフィールドを設定しません。`updatedInput` 経由で提供して、プログラムで回答します |

##### ExitPlanMode

Claude が[プラン モード](/ja/permission-modes#analyze-before-you-edit-with-plan-mode)を離れる前にプランを提示し、ユーザーに承認を求めます。Claude はツールを呼び出す前にプランをディスク上のファイルに書き込むため、モデルからのリテラル `tool_input` は `allowedPrompts` のみを含みます。Claude Code はプラン コンテンツとファイル パスをフックに渡す前に注入します。

| フィールド | タイプ | 例 | 説明 |
| :- | :- | :- | :- |
| `plan` | 文字列 | `"## Refactor auth\n1. Extract..."` | Markdown のプラン コンテンツ。ディスク上のプラン ファイルから注入 |
| `planFilePath` | 文字列 | `"/Users/.../plans/refactor-auth.md"` | プラン ファイルへのパス。注入 |
| `allowedPrompts` | 配列 | `[{"tool": "Bash", "prompt": "run tests"}]` | オプション。Claude がプランを実装するために要求しているプロンプト ベースの権限。各エントリは `tool` 名とアクションのカテゴリを説明する `prompt` を含みます |

`PostToolUse` では、`tool_response` は `plan` と `filePath` フィールドを含むオブジェクトで、承認されたプランと内部ステータス フラグを保持します。ディスクからファイルを再度読み取るのではなく、`tool_response.plan` でプラン コンテンツを読み取ります。

#### PreToolUse 決定制御

`PreToolUse` フックはツール呼び出しが進行するかどうかを制御できます。トップレベル `decision` フィールドを使用する他のフックとは異なり、PreToolUse は `hookSpecificOutput` オブジェクト内に決定を返します。これにより、より豊かな制御が可能になります。4 つの結果（許可、拒否、質問、遅延）と、実行前にツール入力を変更する機能。

| フィールド | 説明 |
| :- | :- |
| `permissionDecision` | `"allow"` はツール呼び出しをスキップします。`"deny"` はツール呼び出しを防止します。`"ask"` はユーザーに確認を促します。`"defer"` は優雅に終了して、ツールを後で再開できるようにします。[拒否と質問ルール](/ja/permissions#manage-permissions)は、フックが返す内容に関係なく引き続き評価されます |
| `permissionDecisionReason` | `"allow"` と `"ask"` の場合、ユーザーに表示されますが Claude には表示されません。`"deny"` の場合、Claude に表示されます。`"defer"` の場合、無視されます |
| `updatedInput` | 実行前にツールの入力パラメーターを変更します。入力オブジェクト全体を置き換えるため、変更されていないフィールドを変更されたフィールドと一緒に含めます。`"allow"` と組み合わせて自動承認するか、`"ask"` と組み合わせて変更された入力をユーザーに表示します。`"defer"` の場合、無視されます |
| `additionalContext` | ツール実行前に Claude のコンテキストに追加される文字列。`"defer"` の場合、無視されます。[Claude のコンテキストを追加](#add-context-for-claude)を参照してください |

複数の PreToolUse フックが異なる決定を返す場合、優先順位は `deny` > `defer` > `ask` > `allow` です。

フックが `"ask"` を返すと、ユーザーに表示される権限プロンプトには、フックの出所を識別するラベルが含まれます。例えば、`[User]`、`[Project]`、`[Plugin]`、または `[Local]`。これにより、ユーザーはどの設定ソースが確認を要求しているかを理解できます。

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "permissionDecisionReason": "My reason here",
    "updatedInput": {
      "field_to_modify": "new value"
    },
    "additionalContext": "Current environment: production. Proceed with caution."
  }
}
```

`AskUserQuestion` と `ExitPlanMode` はユーザー操作が必要で、通常は[非対話型モード](/ja/headless)で `-p` フラグでブロックします。`permissionDecision: "allow"` を `updatedInput` と一緒に返すことでその要件を満たします。フックは stdin からツールの入力を読み取り、独自の UI を通じて回答を収集し、ツールがプロンプトなしで実行されるように `updatedInput` で返します。`"allow"` のみを返すことはこれらのツールには十分ではありません。`AskUserQuestion` の場合、元の `questions` 配列をエコーバックし、各質問のテキストを選択された回答にマップする [`answers`](#askuserquestion) オブジェクトを追加します。

PreToolUse は以前、トップレベル `decision` と `reason` フィールドを使用していましたが、このイベントでは非推奨です。代わりに `hookSpecificOutput.permissionDecision` と `hookSpecificOutput.permissionDecisionReason` を使用してください。非推奨の値 `"approve"` と `"block"` は `"allow"` と `"deny"` にマップされます。PostToolUse と Stop などの他のイベントは、現在の形式としてトップレベル `decision` と `reason` を使用し続けます。

#### ツール呼び出しを後で再開するために遅延

`"defer"` は `claude -p` をサブプロセスとして実行し、その JSON 出力を読み取る Agent SDK アプリまたはカスタム UI などの統合用です。これにより、その呼び出しプロセスは Claude をツール呼び出しで一時停止し、独自のインターフェースを通じて入力を収集し、中断したところから再開できます。Claude Code は[非対話型モード](/ja/headless)で `-p` フラグでのみこの値を尊重します。対話型セッションではログ警告を記録し、フック結果を無視します。

`defer` 値には Claude Code v2.1.89 以降が必要です。以前のバージョンはこれを認識せず、ツールは通常の権限フローを通じて進行します。

`AskUserQuestion` ツールが典型的なケースです。Claude はユーザーに何かを尋ねたいのですが、応答するターミナルがありません。ラウンド トリップは次のように機能します。

1. Claude が `AskUserQuestion` を呼び出します。`PreToolUse` フックが発火します。
2. フックは `permissionDecision: "defer"` を返します。ツールは実行されません。プロセスは `stop_reason: "tool_deferred"` で終了し、トランスクリプトに保留中のツール呼び出しが保持されます。
3. 呼び出しプロセスは SDK 結果から `deferred_tool_use` を読み取り、独自の UI で質問を表示し、回答を待ちます。
4. 呼び出しプロセスは `claude -p --resume <session-id>` を実行します。同じツール呼び出しが `PreToolUse` を再度発火させます。
5. フックは `permissionDecision: "allow"` を返し、`updatedInput` に回答を含めます。ツールが実行され、Claude が続行します。

`deferred_tool_use` フィールドはツールの `id`、`name`、`input` を含みます。`input` は実行前にキャプチャされたツール呼び出しのパラメーターです。

```json
{
  "type": "result",
  "subtype": "success",
  "stop_reason": "tool_deferred",
  "session_id": "abc123",
  "deferred_tool_use": {
    "id": "toolu_01abc",
    "name": "AskUserQuestion",
    "input": { "questions": [{ "question": "Which framework?", "header": "Framework", "options": [{"label": "React"}, {"label": "Vue"}], "multiSelect": false }] }
  }
}
```

タイムアウトまたは再試行制限はありません。セッションはディスク上に残ります。回答の準備ができていないときに再開する場合、フックは再度 `"defer"` を返すことができ、プロセスは同じ方法で終了します。呼び出しプロセスはループを破るタイミングを制御し、最終的に `"allow"` または `"deny"` を返します。

`"defer"` は Claude が単一のツール呼び出しを行うときのみ機能します。Claude が一度に複数のツール呼び出しを行う場合、`"defer"` は警告で無視され、ツールは通常の権限フローを通じて進行します。制約が存在するのは、再開が 1 つのツールのみを再実行できるためです。バッチから 1 つの呼び出しを遅延させる方法はなく、他の呼び出しは未解決のままになります。

遅延されたツールが再開時に利用できなくなった場合、プロセスは `stop_reason: "tool_deferred_unavailable"` と `is_error: true` で終了し、フックが発火する前に。これは、提供されたツールの MCP サーバーが再開されたセッションに接続されていない場合に発生します。`deferred_tool_use` ペイロードは引き続き含まれるため、どのツールが欠落しているかを識別できます。

`--resume` は前のセッションから権限モードを復元します。遅延されたときにアクティブだった権限モードが復元されるため、再開時に `--permission-mode` を再度渡す必要はありません。例外は `plan` と `bypassPermissions` で、これらは決して引き継がれません。再開時に `--permission-mode` を明示的に渡すと、復元された値がオーバーライドされます。

### PermissionRequest

ユーザーに権限ダイアログが表示されるときに実行されます。
[PermissionRequest 決定制御](#permissionrequest-decision-control)を使用して、ユーザーに代わって許可または拒否します。

ツール名でマッチします。PreToolUse と同じ値。

#### PermissionRequest 入力

PermissionRequest フックは PreToolUse フックのような `tool_name` と `tool_input` フィールドを受け取りますが、`tool_use_id` はありません。オプションの `permission_suggestions` 配列には、ユーザーが通常権限ダイアログで見る「常に許可」オプションが含まれています。違いはフックが発火するタイミングです。PermissionRequest フックはユーザーに権限ダイアログが表示されようとしているときに実行され、PreToolUse フックは権限ステータスに関係なくツール実行前に実行されます。

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "permission_mode": "default",
  "hook_event_name": "PermissionRequest",
  "tool_name": "Bash",
  "tool_input": {
    "command": "rm -rf node_modules",
    "description": "Remove node_modules directory"
  },
  "permission_suggestions": [
    {
      "type": "addRules",
      "rules": [{ "toolName": "Bash", "ruleContent": "rm -rf node_modules" }],
      "behavior": "allow",
      "destination": "localSettings"
    }
  ]
}
```

#### PermissionRequest 決定制御

`PermissionRequest` フックは権限リクエストを許可または拒否できます。すべてのフックで利用可能な[JSON 出力フィールド](#json-output)に加えて、フック スクリプトはこれらのイベント固有のフィールドを持つ `decision` オブジェクトを返すことができます。

| フィールド | 説明 |
| :- | :- |
| `behavior` | `"allow"` は権限を付与、`"deny"` は拒否。[拒否と質問ルール](/ja/permissions#manage-permissions)は引き続き評価されるため、`"allow"` を返すフックは一致する拒否ルールをオーバーライドしません |
| `updatedInput` | `"allow"` のみ: 実行前にツールの入力パラメーターを変更します。入力オブジェクト全体を置き換えるため、変更されていないフィールドを変更されたフィールドと一緒に含めます。変更された入力は拒否と質問ルールに対して再評価されます |
| `updatedPermissions` | `"allow"` のみ: 適用する[権限更新エントリ](#permission-update-entries)の配列。許可ルールを追加したり、セッション権限モードを変更したりするなど |
| `message` | `"deny"` のみ: 権限が拒否された理由を Claude に伝える |
| `interrupt` | `"deny"` のみ: `true` の場合、Claude を停止 |

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PermissionRequest",
    "decision": {
      "behavior": "allow",
      "updatedInput": {
        "command": "npm run lint"
      }
    }
  }
}
```

#### 権限更新エントリ

`updatedPermissions` 出力フィールドと[`permission_suggestions` 入力フィールド](#permissionrequest-input)の両方が同じエントリ オブジェクトの配列を使用します。各エントリには、その他のフィールドを決定する `type` と、変更が書き込まれる場所を制御する `destination` があります。

| `type` | フィールド | 効果 |
| :- | :- | :- |
| `addRules` | `rules`、`behavior`、`destination` | 権限ルールを追加します。`rules` は `{toolName, ruleContent?}` オブジェクトの配列です。ツール全体にマッチするには `ruleContent` を省略します。`behavior` は `"allow"`、`"deny"`、または `"ask"` |
| `replaceRules` | `rules`、`behavior`、`destination` | `destination` で指定された `behavior` のすべてのルールを提供されたルールに置き換えます |
| `removeRules` | `rules`、`behavior`、`destination` | 指定された `behavior` の一致するルールを削除 |
| `setMode` | `mode`、`destination` | 権限モードを変更します。有効なモードは `default`、`auto`、`acceptEdits`、`dontAsk`、`bypassPermissions`、`plan` |
| `addDirectories` | `directories`、`destination` | 作業ディレクトリを追加します。`directories` はパス文字列の配列 |
| `removeDirectories` | `directories`、`destination` | 作業ディレクトリを削除 |

`setMode` で `bypassPermissions` を使用する場合、セッションが既にバイパス モードで起動されている場合のみ有効です。`--dangerously-skip-permissions`、`--permission-mode bypassPermissions`、`--allow-dangerously-skip-permissions`、または設定の `permissions.defaultMode: "bypassPermissions"` を使用し、モードが [`permissions.disableBypassPermissionsMode`](/ja/permissions#managed-settings)で無効化されていない場合。それ以外の場合、更新は no-op です。`bypassPermissions` は `destination` に関係なく `defaultMode` として永続化されません。

すべてのエントリの `destination` フィールドは、変更がメモリに留まるか設定ファイルに永続化されるかを決定します。

| `destination` | 書き込み先 |
| :- | :- |
| `session` | メモリのみ、セッション終了時に破棄 |
| `localSettings` | `.claude/settings.local.json` |
| `projectSettings` | `.claude/settings.json` |
| `userSettings` | `~/.claude/settings.json` |

フックは受け取った `permission_suggestions` の 1 つを独自の `updatedPermissions` 出力として反映できます。これは、ユーザーがダイアログで「常に許可」オプションを選択するのと同等です。

### PostToolUse

ツールが正常に完了した直後に実行されます。

ツール名でマッチします。PreToolUse と同じ値。

#### PostToolUse 入力

`PostToolUse` フックはツールがすでに正常に実行された後に発火します。入力には、ツールに送信された引数である `tool_input` と、返された結果である `tool_response` の両方が含まれます。両方の正確なスキーマはツールに依存します。

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "permission_mode": "default",
  "hook_event_name": "PostToolUse",
  "tool_name": "Write",
  "tool_input": {
    "file_path": "/path/to/file.txt",
    "content": "file content"
  },
  "tool_response": {
    "filePath": "/path/to/file.txt",
    "success": true
  },
  "tool_use_id": "toolu_01ABC123...",
  "duration_ms": 12
}
```

| フィールド | 説明 |
| :- | :- |
| `duration_ms` | オプション。ツール実行時間（ミリ秒）。権限プロンプトと PreToolUse フックに費やされた時間は除外 |

#### PostToolUse 決定制御

`PostToolUse` フックはツール実行後に Claude にフィードバックを提供できます。すべてのフックで利用可能な[JSON 出力フィールド](#json-output)に加えて、フック スクリプトはこれらのイベント固有のフィールドを返すことができます。

| フィールド | 説明 |
| :- | :- |
| `decision` | `"block"` は Claude に `reason` でプロンプトを表示。許可するには省略 |
| `reason` | `decision` が `"block"` のときに Claude に表示される説明 |
| `additionalContext` | Claude のコンテキストに追加される文字列。[Claude のコンテキストを追加](#add-context-for-claude)を参照してください |
| `updatedToolOutput` | ツールの出力を提供された値に置換してから Claude に送信。値はツールの出力形状と一致する必要があります |
| `updatedMCPToolOutput` | [MCP ツール](#match-mcp-tools)のみ: ツールの出力を置換。すべてのツールで機能する `updatedToolOutput` を優先 |

以下の例は `Bash` 呼び出しの出力を置換します。置換値は `Bash` ツールの出力形状と一致します。

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "Additional information for Claude",
    "updatedToolOutput": {
      "stdout": "[redacted]",
      "stderr": "",
      "interrupted": false,
      "isImage": false
    }
  }
}
```

`updatedToolOutput` は Claude が見るものだけを変更します。フックが発火するまでにツールはすでに実行されているため、書き込まれたファイル、実行されたコマンド、送信されたネットワーク リクエストはすでに有効になっています。OpenTelemetry ツール スパンやアナリティクス イベントなどのテレメトリも、フックが実行される前に元の出力をキャプチャします。ツール呼び出しを実行前に防止または変更するには、代わりに[PreToolUse](#pretooluse)フックを使用します。

置換値はツールの出力形状と一致する必要があります。組み込みツールは単純な文字列ではなく構造化オブジェクトを返します。例えば、`Bash` は `stdout`、`stderr`、`interrupted`、`isImage` フィールドを持つオブジェクトを返します。組み込みツールの場合、ツールの出力スキーマと一致しない値は無視され、元の出力が使用されます。MCP ツール出力はスキーマ検証なしで渡されます。Claude が必要とするエラー詳細を削除すると、Claude が誤った仮定で進行する可能性があります。

### PostToolUseFailure

ツール実行が失敗するときに実行されます。このイベントはエラーをスロー、または失敗結果を返すツール呼び出しに対して発火します。これを使用して失敗をログ、アラートを送信、または Claude に是正フィードバックを提供します。

ツール名でマッチします。PreToolUse と同じ値。

#### PostToolUseFailure 入力

PostToolUseFailure フックは PostToolUse と同じ `tool_name` と `tool_input` フィールドを受け取り、エラー情報をトップレベル フィールドとして受け取ります。

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "permission_mode": "default",
  "hook_event_name": "PostToolUseFailure",
  "tool_name": "Bash",
  "tool_input": {
    "command": "npm test",
    "description": "Run test suite"
  },
  "tool_use_id": "toolu_01ABC123...",
  "error": "Command exited with non-zero status code 1",
  "is_interrupt": false,
  "duration_ms": 4187
}
```

| フィールド | 説明 |
| :- | :- |
| `error` | 何が悪かったかを説明する文字列 |
| `is_interrupt` | 失敗がユーザー割り込みによって引き起こされたかどうかを示すオプション ブール値 |
| `duration_ms` | オプション。ツール実行時間（ミリ秒）。権限プロンプトと PreToolUse フックに費やされた時間は除外 |

#### PostToolUseFailure 決定制御

`PostToolUseFailure` フックはツール失敗後に Claude にコンテキストを提供できます。すべてのフックで利用可能な[JSON 出力フィールド](#json-output)に加えて、フック スクリプトはこれらのイベント固有のフィールドを返すことができます。

| フィールド | 説明 |
| :- | :- |
| `additionalContext` | Claude のコンテキストに追加される文字列。[Claude のコンテキストを追加](#add-context-for-claude)を参照してください |

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUseFailure",
    "additionalContext": "Additional information about the failure for Claude"
  }
}
```

### PostToolBatch

バッチ内のすべてのツール呼び出しが解決された後、Claude Code が次のモデル リクエストを送信する前に、1 回実行されます。`PostToolUse` はツールごとに 1 回発火します。つまり、Claude が並列ツール呼び出しを行うときに同時に発火します。`PostToolBatch` は完全なバッチで正確に 1 回発火するため、単一のツールではなく、実行されたツールのセットに依存するコンテキストを注入するのに適切な場所です。このイベントにはマッチャーがありません。

#### PostToolBatch 入力

[共通入力フィールド](#common-input-fields)に加えて、PostToolBatch フックはバッチ内のすべてのツール呼び出しを説明する `tool_calls` 配列を受け取ります。

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "permission_mode": "default",
  "hook_event_name": "PostToolBatch",
  "tool_calls": [
    {
      "tool_name": "Read",
      "tool_input": {"file_path": "/.../ledger/accounts.py"},
      "tool_use_id": "toolu_01...",
      "tool_response": "     1\tfrom __future__ import annotations\n     2\t..."
    },
    {
      "tool_name": "Read",
      "tool_input": {"file_path": "/.../ledger/transactions.py"},
      "tool_use_id": "toolu_02...",
      "tool_response": "     1\tfrom __future__ import annotations\n     2\t..."
    }
  ]
}
```

`tool_response` はモデルが対応する `tool_result` ブロックで受け取るのと同じコンテンツを含みます。値はツールが発行したのと同じように、シリアル化された文字列またはコンテンツ ブロック配列です。`Read` の場合、これは生のファイル コンテンツではなく、行番号が付いたテキストを意味します。応答は大きくなる可能性があるため、必要なフィールドのみを解析してください。

`tool_response` の形状は `PostToolUse` のものと異なります。`PostToolUse` はツールの構造化 `Output` オブジェクト（`Write` の場合は `{filePath: "...", success: true}` など）を渡します。`PostToolBatch` はモデルが見るシリアル化された `tool_result` コンテンツを渡します。

#### PostToolBatch 決定制御

`PostToolBatch` フックは Claude のコンテキストを注入できます。すべてのフックで利用可能な[JSON 出力フィールド](#json-output)に加えて、フック スクリプトはこれらのイベント固有のフィールドを返すことができます。

| フィールド | 説明 |
| :- | :- |
| `additionalContext` | 次のモデル呼び出しの前に 1 回注入されるコンテキスト文字列。[Claude のコンテキストを追加](#add-context-for-claude)を参照してください |

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolBatch",
    "additionalContext": "These files are part of the ledger module. Run pytest before marking the task complete."
  }
}
```

`decision: "block"` または `continue: false` を返すと、次のモデル呼び出しの前に agentic ループが停止します。

### PermissionDenied

[自動モード](/ja/permission-modes#eliminate-prompts-with-auto-mode)分類器がツール呼び出しを拒否するときに実行されます。このフックは自動モードでのみ発火します。手動で権限ダイアログを拒否するとき、`PreToolUse` フックがコールをブロックするとき、または `deny` ルールがマッチするときは実行されません。これを使用して分類器の拒否をログ、設定を調整、またはモデルがツール呼び出しを再試行できることを伝えます。

ツール名でマッチします。PreToolUse と同じ値。

#### PermissionDenied 入力

[共通入力フィールド](#common-input-fields)に加えて、PermissionDenied フックは `tool_name`、`tool_input`、`tool_use_id`、`reason` を受け取ります。

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "permission_mode": "auto",
  "hook_event_name": "PermissionDenied",
  "tool_name": "Bash",
  "tool_input": {
    "command": "rm -rf /tmp/build",
    "description": "Clean build directory"
  },
  "tool_use_id": "toolu_01ABC123...",
  "reason": "Auto mode denied: command targets a path outside the project"
}
```

| フィールド | 説明 |
| :- | :- |
| `reason` | ツール呼び出しが拒否された理由の分類器の説明 |

#### PermissionDenied 決定制御

PermissionDenied フックはモデルが拒否されたツール呼び出しを再試行できることを伝えることができます。`hookSpecificOutput.retry` を `true` に設定した JSON オブジェクトを返します。

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PermissionDenied",
    "retry": true
  }
}
```

`retry` が `true` の場合、Claude Code は会話にメッセージを追加し、モデルがツール呼び出しを再試行できることを伝えます。拒否自体は反転されません。フックが JSON を返さない場合、または `retry: false` を返す場合、拒否は立ったままで、モデルは元の拒否メッセージを受け取ります。

### Notification

Claude Code が通知を送信するときに実行されます。通知タイプでマッチします。`permission_prompt`、`idle_prompt`、`auth_success`、`elicitation_dialog`、`elicitation_complete`、`elicitation_response`。マッチャーを省略して、すべての通知タイプのフックを実行します。

異なるマッチャーを使用して、通知タイプに応じて異なるハンドラーを実行します。この設定は、Claude が権限承認を必要とするときに権限固有のアラート スクリプトをトリガーし、Claude がアイドル状態になったときに異なる通知をトリガーします。

```json
{
  "hooks": {
    "Notification": [
      {
        "matcher": "permission_prompt",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/permission-alert.sh"
          }
        ]
      },
      {
        "matcher": "idle_prompt",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/idle-notification.sh"
          }
        ]
      }
    ]
  }
}
```

#### Notification 入力

[共通入力フィールド](#common-input-fields)に加えて、Notification フックは通知テキストを含む `message`、オプションの `title`、発火したタイプを示す `notification_type` を受け取ります。

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "hook_event_name": "Notification",
  "message": "Claude needs your permission to use Bash",
  "title": "Permission needed",
  "notification_type": "permission_prompt"
}
```

Notification フックは通知をブロックまたは変更できません。これらは副作用（外部サービスへの通知の転送など）を目的としています。すべてのフックで利用可能な[JSON 出力フィールド](#json-output)（`systemMessage` など）が適用されます。

### SubagentStart

Agent ツール経由でサブエージェントが生成されるときに実行されます。エージェント タイプ名でフィルタリングするマッチャーをサポート（`general-purpose`、`Explore`、`Plan` などの組み込みエージェント、または[カスタム サブエージェント](/ja/sub-agents)の場合はエージェントのフロントマターの `name` フィールド。ファイル名ではありません）。

#### SubagentStart 入力

[共通入力フィールド](#common-input-fields)に加えて、SubagentStart フックはサブエージェントの一意の識別子を含む `agent_id` とエージェント名を含む `agent_type`（`"general-purpose"`、`"Explore"`、`"Plan"` などの組み込みエージェント、またはカスタム エージェント名）を受け取ります。

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "hook_event_name": "SubagentStart",
  "agent_id": "agent-abc123",
  "agent_type": "Explore"
}
```

SubagentStart フックはサブエージェント作成をブロックできませんが、サブエージェントにコンテキストを注入できます。すべてのフックで利用可能な[JSON 出力フィールド](#json-output)に加えて、以下を返すことができます。

| フィールド | 説明 |
| :- | :- |
| `additionalContext` | サブエージェントのコンテキストの開始時に追加される文字列。最初のプロンプトの前。[Claude のコンテキストを追加](#add-context-for-claude)を参照してください |

```json
{
  "hookSpecificOutput": {
    "hookEventName": "SubagentStart",
    "additionalContext": "Follow security guidelines for this task"
  }
}
```

### SubagentStop

Claude Code サブエージェントが応答を終了したときに実行されます。エージェント タイプでマッチします。SubagentStart と同じ値。

#### SubagentStop 入力

[共通入力フィールド](#common-input-fields)に加えて、SubagentStop フックは `stop_hook_active`、`agent_id`、`agent_type`、`agent_transcript_path`、`last_assistant_message` を受け取ります。`agent_type` フィールドはマッチャー フィルタリングに使用される値です。`transcript_path` はメイン セッションのトランスクリプト、`agent_transcript_path` はネストされた `subagents/` フォルダに保存されたサブエージェント独自のトランスクリプトです。`last_assistant_message` フィールドはサブエージェントの最終応答のテキスト コンテンツを含むため、フックはトランスクリプト ファイルを解析せずにアクセスできます。

SubagentStop フックは、Claude Code v2.1.145 以降で利用可能な、[Stop 入力](#stop-input)で説明されている `background_tasks` と `session_crons` 配列も受け取ります。両方の配列はサブエージェントではなく親セッションにスコープされています。

```json
{
  "session_id": "abc123",
  "transcript_path": "~/.claude/projects/.../abc123.jsonl",
  "cwd": "/Users/...",
  "permission_mode": "default",
  "hook_event_name": "SubagentStop",
  "stop_hook_active": false,
  "agent_id": "def456",
  "agent_type": "Explore",
  "agent_transcript_path": "~/.claude/projects/.../abc123/subagents/agent-def456.jsonl",
  "last_assistant_message": "Analysis complete. Found 3 potential issues...",
  "background_tasks": [],
  "session_crons": []
}
```

SubagentStop フックは[Stop フック](#stop-decision-control)と同じ決定制御形式を使用します。`additionalContext` をサポートしません。`decision: "block"` を `reason` と一緒に返すとサブエージェントを実行し続け、`reason` をサブエージェントの次の命令として配信します。サブエージェントが戻った後に親セッションにコンテキストを注入するには、代わりに `Agent` ツール上の [`PostToolUse`](#posttooluse)フックを使用します。

### TaskCreated

タスクが `TaskCreate` ツール経由で作成されるときに実行されます。命名規則を実施したり、タスク説明を要求したり、特定のタスクが作成されるのを防いだりするのに使用します。

`TaskCreated` フックが終了コード 2 で終了すると、タスクは作成されず、stderr メッセージはモデルへのフィードバックとしてフィードバックされます。チームメイト全体を停止する代わりに再実行するには、`{"continue": false, "stopReason": "..."}` を含む JSON を返します。TaskCreated フックはマッチャーをサポートせず、すべての出現で発火します。

#### TaskCreated 入力

[共通入力フィールド](#common-input-fields)に加えて、TaskCreated フックは `task_id`、`task_subject`、およびオプションで `task_description`、`teammate_name`、`team_name` を受け取ります。

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "permission_mode": "default",
  "hook_event_name": "TaskCreated",
  "task_id": "task-001",
  "task_subject": "Implement user authentication",
  "task_description": "Add login and signup endpoints",
  "teammate_name": "implementer",
  "team_name": "my-project"
}
```

| フィールド | 説明 |
| :- | :- |
| `task_id` | 作成されるタスクの識別子 |
| `task_subject` | タスクのタイトル |
| `task_description` | タスクの詳細説明。存在しない可能性があります |
| `teammate_name` | タスクを作成しているチームメイトの名前。存在しない可能性があります |
| `team_name` | チームの名前。存在しない可能性があります |

#### TaskCreated 決定制御

TaskCreated フックはタスク作成を制御する 2 つの方法をサポートしています。

- **終了コード 2**: タスクは作成されず、stderr メッセージはモデルへのフィードバックとしてフィードバックされます。
- **JSON `{"continue": false, "stopReason": "..."}`**: チームメイト全体を停止し、`Stop` フック動作と一致します。`stopReason` はユーザーに表示されます。

この例は、タスク件名が必要な形式に従わない場合、タスク作成をブロックします。

```bash
#!/bin/bash
INPUT=$(cat)
TASK_SUBJECT=$(echo "$INPUT" | jq -r '.task_subject')

if [[ ! "$TASK_SUBJECT" =~ ^\[TICKET-[0-9]+\] ]]; then
  echo "Task subject must start with a ticket number, e.g. '[TICKET-123] Add feature'" >&2
  exit 2
fi

exit 0
```

### TaskCompleted

タスクが完了としてマークされるときに実行されます。これは 2 つの状況で発火します。任意のエージェントが TaskUpdate ツール経由でタスクを明示的に完了としてマークするとき、または[エージェント チーム](/ja/agent-teams)チームメイトが進行中のタスクでターンを終了するとき。これを使用してチームメイトが作業を停止する前に品質ゲートを実施します。例えば、lint チェックの合格を要求したり、出力ファイルが存在することを確認したりします。

`TaskCompleted` フックが終了コード 2 で終了すると、タスクは完了としてマークされず、stderr メッセージはモデルへのフィードバックとしてフィードバックされます。チームメイト全体を停止する代わりに再実行するには、`{"continue": false, "stopReason": "..."}` を含む JSON を返します。TaskCompleted フックはマッチャーをサポートせず、すべての出現で発火します。

#### TaskCompleted 入力

[共通入力フィールド](#common-input-fields)に加えて、TaskCompleted フックは `task_id`、`task_subject`、およびオプションで `task_description`、`teammate_name`、`team_name` を受け取ります。

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "permission_mode": "default",
  "hook_event_name": "TaskCompleted",
  "task_id": "task-001",
  "task_subject": "Implement user authentication",
  "task_description": "Add login and signup endpoints",
  "teammate_name": "implementer",
  "team_name": "my-project"
}
```

| フィールド | 説明 |
| :- | :- |
| `task_id` | 完了しているタスクの識別子 |
| `task_subject` | タスクのタイトル |
| `task_description` | タスクの詳細説明。存在しない可能性があります |
| `teammate_name` | タスクを完了しているチームメイトの名前。存在しない可能性があります |
| `team_name` | チームの名前。存在しない可能性があります |

#### TaskCompleted 決定制御

TaskCompleted フックはタスク完了を制御する 2 つの方法をサポートしています。

- **終了コード 2**: タスクは完了としてマークされず、stderr メッセージはモデルへのフィードバックとしてフィードバックされます。
- **JSON `{"continue": false, "stopReason": "..."}`**: チームメイト全体を停止し、`Stop` フック動作と一致します。`stopReason` はユーザーに表示されます。

この例はテストを実行し、失敗した場合はタスク完了をブロックします。

```bash
#!/bin/bash
INPUT=$(cat)
TASK_SUBJECT=$(echo "$INPUT" | jq -r '.task_subject')

# テスト スイートを実行
if ! npm test 2>&1; then
  echo "Tests not passing. Fix failing tests before completing: $TASK_SUBJECT" >&2
  exit 2
fi

exit 0
```

### Stop

メイン Claude Code エージェントが応答を終了したときに実行されます。ユーザー割り込みが原因で停止が発生した場合は実行されません。API エラーは代わりに[StopFailure](#stopfailure)を発火させます。

[`/goal`](/ja/goal)コマンドは、セッション スコープのプロンプト ベースの Stop フックの組み込みショートカットです。Claude が条件が成立するまで作業を続けるようにしたいが、フック設定を書きたくない場合に使用します。

#### Stop 入力

[共通入力フィールド](#common-input-fields)に加えて、Stop フックは `stop_hook_active`、`last_assistant_message`、`background_tasks`、`session_crons` を受け取ります。`stop_hook_active` フィールドは、Claude Code がすでに stop フックの結果として続行している場合は `true` です。この値をチェックするか、Claude Code が無限に実行されるのを防ぐためにトランスクリプトを処理します。`last_assistant_message` フィールドは Claude の最終応答のテキスト コンテンツを含むため、フックはトランスクリプト ファイルを解析せずにアクセスできます。

`background_tasks` と `session_crons` 配列は、Claude Code v2.1.145 以降で利用可能で、フックが「セッションが完了」と「セッションが一時停止してバックグラウンド作業が再開されるのを待機」を区別できます。タスク レジストリに到達可能な場合は両方の配列が存在し、何も進行中または予定されていない場合は空です。

`background_tasks` の各エントリは 1 つの進行中のタスクを説明し、これらのフィールドを使用します。

| フィールド | 説明 |
| :- | :- |
| `id` | タスク識別子 |
| `type` | フレンドリーなタスク タイプ ラベル（`shell`、`subagent`、`monitor`、`workflow`、`teammate`、`cloud session`、`MCP task` など）。各ラベルは Claude Code のどの機能がタスクを作成したかを識別します。認識されないタイプの場合は生の判別式にフォールバック |
| `status` | 現在のタスク ステータス |
| `description` | フリー テキスト説明。1000 文字でキャップされ、クリップされた場合は文字列内に `… [+N chars]` マーカー |
| `command` | シェル コマンド ライン。1000 文字でキャップ。`shell` タスクの場合のみ存在 |
| `agent_type` | サブエージェント タイプ名。`subagent` タスクの場合のみ存在 |
| `server` | MCP サーバー名。`monitor` と `MCP task` タスクの場合のみ存在 |
| `tool` | MCP ツール名。`monitor` と `MCP task` タスクの場合のみ存在 |
| `name` | ワークフロー名。`workflow` タスクの場合のみ存在 |

`session_crons` の各エントリは 1 つのセッション スコープのスケジュール済みウェイクアップを説明し、`CronCreate`、`ScheduleWakeup`、`/loop` から取得されます。

| フィールド | 説明 |
| :- | :- |
| `id` | Cron タスク識別子 |
| `schedule` | Cron 式（例：`0 9 * * 1-5`） |
| `recurring` | スケジュールが単一の発火時刻をエンコードする 1 回限りのウェイクアップの場合は `false`、すべてのマッチで再発火するタスクの場合は `true` |
| `prompt` | Cron が発火するときに送信されるプロンプト。1000 文字でキャップされ、同じ `… [+N chars]` マーカー |

この例は、1 つの進行中のシェル タスクと 1 つの定期的な cron を含む Stop 入力を示しています。

```json
{
  "session_id": "abc123",
  "transcript_path": "~/.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "permission_mode": "default",
  "hook_event_name": "Stop",
  "stop_hook_active": true,
  "last_assistant_message": "I've completed the refactoring. Here's a summary...",
  "background_tasks": [
    {
      "id": "task-001",
      "type": "shell",
      "status": "running",
      "description": "tail logs",
      "command": "tail -f /var/log/syslog"
    }
  ],
  "session_crons": [
    {
      "id": "cron-001",
      "schedule": "0 9 * * 1-5",
      "recurring": true,
      "prompt": "check the build"
    }
  ]
}
```

#### Stop 決定制御

`Stop` と `SubagentStop` フックは Claude が続行するかどうかを制御できます。すべてのフックで利用可能な[JSON 出力フィールド](#json-output)に加えて、フック スクリプトはこれらのイベント固有のフィールドを返すことができます。

| フィールド | 説明 |
| :- | :- |
| `decision` | `"block"` は Claude が停止するのを防止。Claude を停止させるには省略 |
| `reason` | `decision` が `"block"` のときに必須。Claude が続行すべき理由を伝える |

```json
{
  "decision": "block",
  "reason": "Must be provided when Claude is blocked from stopping"
}
```

### StopFailure

[Stop](#stop)の代わりに、ターンが API エラーのために終了するときに実行されます。出力と終了コードは無視されます。Claude が API エラーのため応答を完了できない場合、失敗をログ、アラートを送信、または回復アクションを実行するのに使用します。

#### StopFailure 入力

[共通入力フィールド](#common-input-fields)に加えて、StopFailure フックは `error`、オプションの `error_details`、およびオプションの `last_assistant_message` を受け取ります。`error` フィールドはエラー タイプを識別し、マッチャー フィルタリングに使用されます。

| フィールド | 説明 |
| :- | :- |
| `error` | エラー タイプ: `rate_limit`、`authentication_failed`、`oauth_org_not_allowed`、`billing_error`、`invalid_request`、`model_not_found`、`server_error`、`max_output_tokens`、または `unknown` |
| `error_details` | 利用可能な場合、エラーに関する追加詳細 |
| `last_assistant_message` | 会話に表示されるレンダリングされたエラー テキスト。`Stop` と `SubagentStop` とは異なり、このフィールドは Claude の会話出力ではなく、`"API Error: Rate limit reached"` などの API エラー文字列を含みます |

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "hook_event_name": "StopFailure",
  "error": "rate_limit",
  "error_details": "429 Too Many Requests",
  "last_assistant_message": "API Error: Rate limit reached"
}
```

StopFailure フックは決定制御がありません。通知とログの目的でのみ実行されます。

### TeammateIdle

[エージェント チーム](/ja/agent-teams)チームメイトがターンを終了した後、アイドル状態になろうとしているときに実行されます。これを使用してチームメイトが作業を停止する前に品質ゲートを実施します。例えば、lint チェックの合格を要求したり、出力ファイルが存在することを確認したりします。

`TeammateIdle` フックが終了コード 2 で終了すると、チームメイトは stderr メッセージをフィードバックとして受け取り、アイドル状態になる代わりに作業を続行します。チームメイト全体を停止する代わりに再実行するには、`{"continue": false, "stopReason": "..."}` を含む JSON を返します。TeammateIdle フックはマッチャーをサポートせず、すべての出現で発火します。

#### TeammateIdle 入力

[共通入力フィールド](#common-input-fields)に加えて、TeammateIdle フックは `teammate_name` と `team_name` を受け取ります。

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "permission_mode": "default",
  "hook_event_name": "TeammateIdle",
  "teammate_name": "researcher",
  "team_name": "my-project"
}
```

| フィールド | 説明 |
| :- | :- |
| `teammate_name` | アイドル状態になろうとしているチームメイトの名前 |
| `team_name` | チームの名前 |

#### TeammateIdle 決定制御

TeammateIdle フックはチームメイト動作を制御する 2 つの方法をサポートしています。

- **終了コード 2**: チームメイトは stderr メッセージをフィードバックとして受け取り、アイドル状態になる代わりに作業を続行します。
- **JSON `{"continue": false, "stopReason": "..."}`**: チームメイト全体を停止し、`Stop` フック動作と一致します。`stopReason` はユーザーに表示されます。

この例は、チームメイトがアイドル状態になることを許可する前に、ビルド アーティファクトが存在することをチェックします。

```bash
#!/bin/bash

if [ ! -f "./dist/output.js" ]; then
  echo "Build artifact missing. Run the build before stopping." >&2
  exit 2
fi

exit 0
```

### ConfigChange

セッション中に設定ファイルが変更されるときに実行されます。設定変更を監査したり、セキュリティ ポリシーを実施したり、設定ファイルへの不正な変更をブロックしたりするのに使用します。

ConfigChange フックは設定ファイル、管理ポリシー設定、スキル ファイルの変更に対して発火します。入力の `source` フィールドは、どのタイプの設定が変更されたかを示し、オプションの `file_path` フィールドは変更されたファイルへのパスを提供します。

マッチャーは設定ソースでフィルタリングします。

| マッチャー | いつ発火するか |
| :- | :- |
| `user_settings` | `~/.claude/settings.json` が変更 |
| `project_settings` | `.claude/settings.json` が変更 |
| `local_settings` | `.claude/settings.local.json` が変更 |
| `policy_settings` | 管理ポリシー設定が変更 |
| `skills` | `.claude/skills/` のスキル ファイルが変更 |

この例は、セキュリティ監査のためにすべての設定変更をログします。

```json
{
  "hooks": {
    "ConfigChange": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/audit-config-change.sh",
            "args": []
          }
        ]
      }
    ]
  }
}
```

#### ConfigChange 入力

[共通入力フィールド](#common-input-fields)に加えて、ConfigChange フックは `source` とオプションで `file_path` を受け取ります。`source` フィールドは、どのタイプの設定が変更されたかを示し、`file_path` は変更されたファイルへのパスを提供します。

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "hook_event_name": "ConfigChange",
  "source": "project_settings",
  "file_path": "/Users/.../my-project/.claude/settings.json"
}
```

#### ConfigChange 決定制御

ConfigChange フックは設定変更が有効になるのをブロックできます。終了コード 2 または JSON `decision` を使用して変更を防止します。ブロックされた場合、新しい設定は実行中のセッションに適用されません。

| フィールド | 説明 |
| :- | :- |
| `decision` | `"block"` は設定変更が適用されるのを防止。変更を許可するには省略 |
| `reason` | `decision` が `"block"` のときにユーザーに表示される説明 |

```json
{
  "decision": "block",
  "reason": "Configuration changes to project settings require admin approval"
}
```

`policy_settings` の変更はブロックできません。フックは `policy_settings` ソースに対して引き続き発火するため、監査ログに使用できますが、ブロッキング決定は無視されます。これにより、エンタープライズ管理設定が常に有効になることが保証されます。

### CwdChanged

セッション中に作業ディレクトリが変更されるときに実行されます。例えば、Claude が `cd` コマンドを実行するとき。これを使用してディレクトリ変更に反応します。環境変数をリロードしたり、プロジェクト固有のツールチェーンをアクティブにしたり、セットアップ スクリプトを自動的に実行したりします。[FileChanged](#filechanged)とペアになり、[direnv](https://direnv.net/)などのツール用に、ディレクトリごとの環境を管理します。

CwdChanged フックは `CLAUDE_ENV_FILE` にアクセスできます。そのファイルに書き込まれた変数は、[SessionStart フック](#persist-environment-variables)と同じように、セッション中の後続の Bash コマンドに永続化されます。

CwdChanged はマッチャーをサポートせず、すべてのディレクトリ変更で発火します。

#### CwdChanged 入力

[共通入力フィールド](#common-input-fields)に加えて、CwdChanged フックは `old_cwd` と `new_cwd` を受け取ります。

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../transcript.jsonl",
  "cwd": "/Users/my-project/src",
  "hook_event_name": "CwdChanged",
  "old_cwd": "/Users/my-project",
  "new_cwd": "/Users/my-project/src"
}
```

#### CwdChanged 出力

すべてのフックで利用可能な[JSON 出力フィールド](#json-output)に加えて、CwdChanged フックは `watchPaths` を返して、[FileChanged](#filechanged)が監視するファイル パスを動的に設定できます。

| フィールド | 説明 |
| :- | :- |
| `watchPaths` | 絶対パスの配列。現在の動的監視リストを置き換えます（マッチャー設定からのパスは常に監視されます）。新しいディレクトリに入るときは、空の配列を返すのが一般的です |

CwdChanged フックは決定制御がありません。ディレクトリ変更をブロックできません。

### FileChanged

監視されたファイルがディスク上で変更されるときに実行されます。プロジェクト設定ファイルが変更されたときに環境変数をリロードするのに便利です。

このイベントの `matcher` は 2 つの役割を果たします。

- **監視リストを構築**: 値は `|` で分割され、各セグメントは作業ディレクトリのリテラル ファイル名として登録されるため、`.envrc|.env` はこれら 2 つのファイルを正確に監視します。正規表現パターンはここでは役に立ちません。`^\.env` のような値は `^\.env` という文字通りの名前のファイルを監視します。
- **どのフックが実行されるかをフィルタリング**: 監視されたファイルが変更されると、同じ値は標準[マッチャー ルール](#matcher-patterns)を使用して、変更されたファイルのベース名に対してどのフック グループが実行されるかをフィルタリングします。

FileChanged フックは `CLAUDE_ENV_FILE` にアクセスできます。そのファイルに書き込まれた変数は、[SessionStart フック](#persist-environment-variables)と同じように、セッション中の後続の Bash コマンドに永続化されます。

#### FileChanged 入力

[共通入力フィールド](#common-input-fields)に加えて、FileChanged フックは `file_path` と `event` を受け取ります。

| フィールド | 説明 |
| :- | :- |
| `file_path` | 変更されたファイルへの絶対パス |
| `event` | 何が起こったか: `"change"`（ファイル変更）、`"add"`（ファイル作成）、または `"unlink"`（ファイル削除） |

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../transcript.jsonl",
  "cwd": "/Users/my-project",
  "hook_event_name": "FileChanged",
  "file_path": "/Users/my-project/.envrc",
  "event": "change"
}
```

#### FileChanged 出力

すべてのフックで利用可能な[JSON 出力フィールド](#json-output)に加えて、FileChanged フックは `watchPaths` を返して、監視されるファイル パスを動的に更新できます。

| フィールド | 説明 |
| :- | :- |
| `watchPaths` | 絶対パスの配列。現在の動的監視リストを置き換えます（マッチャー設定からのパスは常に監視されます）。フック スクリプトが変更されたファイルに基づいて検出した追加ファイルを監視する場合に使用します |

FileChanged フックは決定制御がありません。ファイル変更をブロックできません。

### WorktreeCreate

`claude --worktree` を実行するか、[サブエージェントが `isolation: "worktree"` を使用](/ja/sub-agents#choose-the-subagent-scope)する場合、Claude Code は `git worktree` を使用して分離された作業コピーを作成します。WorktreeCreate フックを設定する場合、デフォルトの git 動作を置き換え、SVN、Perforce、Mercurial などの別のバージョン管理システムを使用できます。

フックは作成されたワークツリー ディレクトリへの絶対パスを返す必要があります。Claude Code はこのパスを分離されたセッションの作業ディレクトリとして使用します。コマンド フックは stdout にパスを出力します。HTTP フックは `hookSpecificOutput.worktreePath` 経由で返します。

フックはデフォルトの git 動作を完全に置き換えるため、[`.worktreeinclude`](/ja/worktrees#copy-gitignored-files-into-worktrees)は処理されません。`.env` などのローカル設定ファイルを新しいワークツリーにコピーする必要がある場合は、フック スクリプト内で実行してください。

この例は SVN 作業コピーを作成し、Claude Code が使用するパスを出力します。リポジトリ URL を自分のものに置き換えます。

```json
{
  "hooks": {
    "WorktreeCreate": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash -c 'NAME=$(jq -r .name); DIR=\"$HOME/.claude/worktrees/$NAME\"; svn checkout https://svn.example.com/repo/trunk \"$DIR\" >&2 && echo \"$DIR\"'"
          }
        ]
      }
    ]
  }
}
```

フックは stdin から JSON 入力からワークツリー `name` を読み取り、新しいディレクトリに新しいコピーをチェックアウトし、ディレクトリ パスを出力します。最後の行の `echo` は Claude Code が読み取るワークツリー パスです。他の出力を stderr にリダイレクトして、パスに干渉しないようにします。

#### WorktreeCreate 入力

[共通入力フィールド](#common-input-fields)に加えて、WorktreeCreate フックは `name` フィールドを受け取ります。これは新しいワークツリーのスラッグ識別子で、ユーザーが指定するか自動生成されます（例えば、`bold-oak-a3f2`）。

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "hook_event_name": "WorktreeCreate",
  "name": "feature-auth"
}
```

#### WorktreeCreate 出力

WorktreeCreate フックは標準的な許可/ブロック決定モデルを使用しません。代わりに、フックの成功または失敗が結果を決定します。フックは作成されたワークツリー ディレクトリへの絶対パスを返す必要があります。

- **コマンド フック** (`type: "command"`): stdout にパスを出力します。
- **HTTP フック** (`type: "http"`): レスポンス本体で `{ "hookSpecificOutput": { "hookEventName": "WorktreeCreate", "worktreePath": "/absolute/path" } }` を返します。

フックが失敗するか出力を生成しない場合、ワークツリー作成はエラーで失敗します。

### WorktreeRemove

[WorktreeCreate](#worktreecreate)のクリーンアップ対応。このフックはワークツリーが削除されるときに発火します。`--worktree` セッションを終了して削除を選択するか、`isolation: "worktree"` を持つサブエージェントが完了するとき。git ベースのワークツリーの場合、Claude は `git worktree remove` で自動的にクリーンアップを処理します。git 以外のバージョン管理システムの WorktreeCreate フックを設定した場合、クリーンアップを処理するために WorktreeRemove フックとペアにします。なければ、ワークツリー ディレクトリはディスク上に残ります。

Claude Code は WorktreeCreate が返したパスを `worktree_path` としてフック入力に渡します。この例はそのパスを読み取り、ディレクトリを削除します。

```json
{
  "hooks": {
    "WorktreeRemove": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash -c 'jq -r .worktree_path | xargs rm -rf'"
          }
        ]
      }
    ]
  }
}
```

#### WorktreeRemove 入力

[共通入力フィールド](#common-input-fields)に加え、WorktreeRemove フックは削除されるワークツリーへの絶対パスである `worktree_path` フィールドを受け取ります。

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "hook_event_name": "WorktreeRemove",
  "worktree_path": "/Users/.../my-project/.claude/worktrees/feature-auth"
}
```

WorktreeRemove フックは決定制御がありません。ワークツリー削除をブロックできませんが、バージョン管理状態の削除やアーカイブ変更などのクリーンアップ タスクを実行できます。フック失敗はデバッグ モードでのみログされます。

### PreCompact

Claude Code がコンパクション操作を実行しようとしている前に実行されます。

マッチャー値は、コンパクションが手動でトリガーされたか自動的にトリガーされたかを示します。

| マッチャー | いつ発火するか |
| :- | :- |
| `manual` | `/compact` |
| `auto` | コンテキスト ウィンドウが満杯のときの自動コンパクション |

終了コード 2 でコンパクションをブロック。手動の `/compact` の場合、stderr メッセージはユーザーに表示されます。JSON で `"decision": "block"` を返してブロックすることもできます。

自動コンパクションのブロックは、いつ発火するかに応じて異なる効果があります。コンテキスト制限の前にコンパクションがプロアクティブにトリガーされた場合、Claude Code はそれをスキップし、会話は非圧縮で続行されます。コンテキスト制限エラーから回復するためにコンパクションがトリガーされた場合、基礎となるエラーが表示され、現在のリクエストが失敗します。

#### PreCompact 入力

[共通入力フィールド](#common-input-fields)に加えて、PreCompact フックは `trigger` と `custom_instructions` を受け取ります。`manual` の場合、`custom_instructions` はユーザーが `/compact` に渡すものを含みます。`auto` の場合、`custom_instructions` は空です。

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "hook_event_name": "PreCompact",
  "trigger": "manual",
  "custom_instructions": ""
}
```

### PostCompact

Claude Code がコンパクション操作を完了した後に実行されます。このイベントを使用して、新しいコンパクト状態に反応します。例えば、生成されたサマリーをログしたり、外部状態を更新したりします。

`PreCompact` と同じマッチャー値が適用されます。

| マッチャー | いつ発火するか |
| :- | :- |
| `manual` | `/compact` の後 |
| `auto` | コンテキスト ウィンドウが満杯のときの自動コンパクション後 |

#### PostCompact 入力

[共通入力フィールド](#common-input-fields)に加えて、PostCompact フックは `trigger` と `compact_summary` を受け取ります。`compact_summary` フィールドはコンパクション操作によって生成された会話サマリーを含みます。

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "hook_event_name": "PostCompact",
  "trigger": "manual",
  "compact_summary": "Summary of the compacted conversation..."
}
```

PostCompact フックは決定制御がありません。コンパクション結果に影響を与えることはできませんが、フォローアップ タスクを実行できます。

### SessionEnd

Claude Code セッションが終了するときに実行されます。クリーンアップ タスク、セッション統計のログ、またはセッション状態の保存に便利です。終了理由でフィルタリングするマッチャーをサポートします。

フック入力の `reason` フィールドはセッションが終了した理由を示します。

| 理由 | 説明 |
| :- | :- |
| `clear` | `/clear` コマンドでセッションをクリア |
| `resume` | インタラクティブ `/resume` 経由でセッションを切り替え |
| `logout` | ユーザーがログアウト |
| `prompt_input_exit` | プロンプト入力が表示されている間にユーザーが終了 |
| `bypass_permissions_disabled` | バイパス権限モードが無効化 |
| `other` | その他の終了理由 |

#### SessionEnd 入力

[共通入力フィールド](#common-input-fields)に加えて、SessionEnd フックはセッションが終了した理由を示す `reason` フィールドを受け取ります。上記の[理由テーブル](#sessionend)をすべての値について参照してください。

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "hook_event_name": "SessionEnd",
  "reason": "other"
}
```

SessionEnd フックは決定制御がありません。セッション終了をブロックできませんが、クリーンアップ タスクを実行できます。

SessionEnd フックのデフォルト タイムアウトは 1.5 秒です。これはセッション終了、`/clear`、およびインタラクティブ `/resume` 経由でのセッション切り替えに適用されます。フックにより多くの時間が必要な場合は、フック設定でフックごとの `timeout` を設定します。全体的な予算は、設定ファイルで設定されたフックごとのタイムアウトの最高値に自動的に引き上げられ、最大 60 秒です。プラグイン提供のフックに設定されたタイムアウトは予算を引き上げません。予算を明示的にオーバーライドするには、`CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS` 環境変数をミリ秒単位で設定します。

```bash
CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS=5000 claude
```

### Elicitation

MCP サーバーがタスク中にユーザー入力をリクエストするときに実行されます。デフォルトでは、Claude Code はユーザーが応答するためのインタラクティブ ダイアログを表示します。フックはこのリクエストをインターセプトして、プログラムで応答し、ダイアログを完全にスキップできます。

マッチャー フィールドは MCP サーバー名に対してマッチします。

#### Elicitation 入力

[共通入力フィールド](#common-input-fields)に加えて、Elicitation フックは `mcp_server_name`、`message`、およびオプションで `mode`、`url`、`elicitation_id`、`requested_schema` フィールドを受け取ります。

フォーム モード elicitation（最も一般的なケース）の場合。

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "permission_mode": "default",
  "hook_event_name": "Elicitation",
  "mcp_server_name": "my-mcp-server",
  "message": "Please provide your credentials",
  "mode": "form",
  "requested_schema": {
    "type": "object",
    "properties": {
      "username": { "type": "string", "title": "Username" }
    }
  }
}
```

URL モード elicitation（ブラウザベースの認証）の場合。

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "permission_mode": "default",
  "hook_event_name": "Elicitation",
  "mcp_server_name": "my-mcp-server",
  "message": "Please authenticate",
  "mode": "url",
  "url": "https://auth.example.com/login"
}
```

#### Elicitation 出力

ダイアログを表示せずにプログラムで応答するには、`hookSpecificOutput` を含む JSON オブジェクトを返します。

```json
{
  "hookSpecificOutput": {
    "hookEventName": "Elicitation",
    "action": "accept",
    "content": {
      "username": "alice"
    }
  }
}
```

| フィールド | 値 | 説明 |
| :- | :- | :- |
| `action` | `accept`、`decline`、`cancel` | リクエストを受け入れるか、拒否するか、キャンセルするか |
| `content` | オブジェクト | 送信するフォーム フィールド値。`action` が `accept` のときのみ使用 |

終了コード 2 は elicitation を拒否し、stderr をユーザーに表示します。

### ElicitationResult

ユーザーが MCP elicitation に応答した後に実行されます。フックは応答を観察、変更、またはブロックしてから、MCP サーバーに送り返すことができます。

マッチャー フィールドは MCP サーバー名に対してマッチします。

#### ElicitationResult 入力

[共通入力フィールド](#common-input-fields)に加えて、ElicitationResult フックは `mcp_server_name`、`action`、およびオプションで `mode`、`elicitation_id`、`content` フィールドを受け取ります。

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "permission_mode": "default",
  "hook_event_name": "ElicitationResult",
  "mcp_server_name": "my-mcp-server",
  "action": "accept",
  "content": { "username": "alice" },
  "mode": "form",
  "elicitation_id": "elicit-123"
}
```

#### ElicitationResult 出力

ユーザーの応答をオーバーライドするには、`hookSpecificOutput` を含む JSON オブジェクトを返します。

```json
{
  "hookSpecificOutput": {
    "hookEventName": "ElicitationResult",
    "action": "decline",
    "content": {}
  }
}
```

| フィールド | 値 | 説明 |
| :- | :- | :- |
| `action` | `accept`、`decline`、`cancel` | ユーザーのアクションをオーバーライド |
| `content` | オブジェクト | フォーム フィールド値をオーバーライド。`action` が `accept` のときのみ意味がある |

終了コード 2 はレスポンスをブロックし、有効なアクションを `decline` に変更します。

## プロンプト ベースのフック

コマンド、HTTP、MCP ツール フックに加えて、Claude Code はプロンプト ベースのフック（`type: "prompt"`）をサポートしており、LLM を使用してアクションを許可またはブロックするかどうかを評価し、エージェント フック（`type: "agent"`）はツール アクセスを持つ agentic ベリファイアーを生成します。すべてのイベントがすべてのフック タイプをサポートしているわけではありません。

5 つのフック タイプ（`command`、`http`、`mcp_tool`、`prompt`、`agent`）すべてをサポートするイベント：

- `PermissionDenied`
- `PermissionRequest`
- `PostToolBatch`
- `PostToolUse`
- `PostToolUseFailure`
- `PreToolUse`
- `Stop`
- `SubagentStop`
- `TaskCompleted`
- `TaskCreated`
- `TeammateIdle`
- `UserPromptExpansion`
- `UserPromptSubmit`

`command`、`http`、`mcp_tool` フックをサポートするが、`prompt` または `agent` をサポートしないイベント：

- `ConfigChange`
- `CwdChanged`
- `Elicitation`
- `ElicitationResult`
- `FileChanged`
- `InstructionsLoaded`
- `Notification`
- `PostCompact`
- `PreCompact`
- `SessionEnd`
- `StopFailure`
- `SubagentStart`
- `WorktreeCreate`
- `WorktreeRemove`

`SessionStart` と `Setup` は `command` と `mcp_tool` フックをサポートしています。これらは `http`、`prompt`、`agent` フックをサポートしていません。

### プロンプト ベースのフックの仕組み

プロンプト ベースのフックは Bash コマンドを実行する代わりに：

1. フック入力とプロンプトを Claude モデル（デフォルトは Haiku）に送信
2. LLM は決定を含む構造化 JSON で応答
3. Claude Code は決定を自動的に処理

### プロンプト フック設定

`type` を `"prompt"` に設定し、`command` の代わりに `prompt` 文字列を提供します。`$ARGUMENTS` プレースホルダーを使用して、フックの JSON 入力データをプロンプト テキストに注入します。Claude Code は結合されたプロンプトと入力を高速 Claude モデルに送信し、JSON 決定を返します。

この `Stop` フックは、Claude が終了する前にすべてのタスクが完了しているかどうかを評価するよう LLM に求めます：

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Evaluate if Claude should stop: $ARGUMENTS. Check if all tasks are complete."
          }
        ]
      }
    ]
  }
}
```

| フィールド | 必須 | 説明 |
| :- | :- | :- |
| `type` | はい | `"prompt"` である必要があります |
| `prompt` | はい | LLM に送信するプロンプト テキスト。フック入力 JSON のプレースホルダーとして `$ARGUMENTS` を使用します。`$ARGUMENTS` が存在しない場合、入力 JSON がプロンプトに追加されます |
| `model` | いいえ | 評価に使用するモデル。デフォルトは高速モデル |
| `timeout` | いいえ | タイムアウト（秒単位）。デフォルト：30 |
| `continueOnBlock` | いいえ | プロンプトが `ok: false` を返すとき、理由を Claude にフィードバックして、停止する代わりにターンを続行します。デフォルト：`false`。結果の `decision: "block"` に `continue: true` として実装されます。イベント ごとの動作については、[レスポンス スキーマ](#response-schema)を参照してください |

### レスポンス スキーマ

LLM は以下を含む JSON で応答する必要があります：

```json
{
  "ok": true | false,
  "reason": "Explanation for the decision"
}
```

| フィールド | 説明 |
| :- | :- |
| `ok` | `true` はアクションを許可、`false` は `decision: "block"` を生成します。以下のイベント ごとの動作を参照してください |
| `reason` | `ok` が `false` のときに必須。ブロック理由として使用されます |

`ok: false` で何が起こるかはイベントによって異なります：

- `Stop` と `SubagentStop`：理由は Claude の次の指示としてフィードバックされ、ターンが続行されます
- `PreToolUse`：ツール呼び出しが拒否され、理由は Claude にツール エラーとして返されます。これはコマンド フックの `permissionDecision: "deny"` と同等です
- `PostToolUse`：デフォルトではターンが終了し、理由は警告行としてチャットに表示されます。`continueOnBlock: true` を設定して、理由を Claude にフィードバックし、ターンを続行する代わりに使用します
- `PostToolBatch`、`UserPromptSubmit`、`UserPromptExpansion`：ターンが終了し、理由は警告行として表示されます。これらのイベントは `continue` に関係なく `decision: "block"` でターンを終了します
- `PostToolUseFailure`、`TaskCreated`、`TaskCompleted`：理由は Claude にツール エラーとして返されます。`PreToolUse` と同様です
- `TeammateIdle`：デフォルトではチームメイトが停止し、理由は警告行として表示されます。`continueOnBlock: true` を設定して、理由をチームメイトにフィードバックし、代わりに作業を続行させます
- `PermissionRequest`：`ok: false` は効果がありません。フックから承認を拒否するには、[コマンド フック](#command-hook-fields)を使用して `hookSpecificOutput.decision.behavior: "deny"` を返します
- `PermissionDenied`：`ok: false` は効果がありません。拒否は既に発生しているためです。このイベントが読み取る唯一の出力は `hookSpecificOutput.retry` です。プロンプト フックとエージェント フックはこれを設定できません。これらはこのイベントで実行されますが、その出力は破棄されます。`retry` を返すには、[コマンド フック](#command-hook-fields)を使用してください

任意のイベントでより細かい制御が必要な場合は、[決定制御](#decision-control)で説明されているイベント ごとのフィールドを使用して、[コマンド フック](#command-hook-fields)を使用してください。

### 例：マルチ基準 Stop フック

この `Stop` フックは詳細なプロンプトを使用して、Claude が停止することを許可する前に 3 つの条件をチェックします。`"ok"` が `false` の場合、Claude は提供された理由を次の指示として受け取り、作業を続行します。`SubagentStop` フックは同じ形式を使用して、[サブエージェント](/ja/sub-agents)が停止すべきかどうかを評価します：

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "prompt",
            "prompt": "You are evaluating whether Claude should stop working. Context: $ARGUMENTS\n\nAnalyze the conversation and determine if:\n1. All user-requested tasks are complete\n2. Any errors need to be addressed\n3. Follow-up work is needed\n\nRespond with JSON: {\"ok\": true} to allow stopping, or {\"ok\": false, \"reason\": \"your explanation\"} to continue working.",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

## エージェント ベースのフック

エージェント フックは実験的です。動作と設定は将来のリリースで変更される可能性があります。本番ワークフローの場合は、[コマンド フック](#command-hook-fields)を優先してください。

エージェント ベースのフック（`type: "agent"`）はプロンプト ベースのフックのようですが、マルチターン ツール アクセスを備えています。単一の LLM 呼び出しの代わりに、エージェント フックはサブエージェントを生成し、ファイルを読み取り、コードを検索し、コードベースを検査して条件を検証できます。エージェント フックはプロンプト ベースのフックと同じイベントをサポートしています。

### エージェント フックの仕組み

エージェント フックが発火するとき：

1. Claude Code はプロンプトとフックの JSON 入力を持つサブエージェントを生成します
2. サブエージェントは Read、Grep、Glob などのツールを使用して調査できます
3. 最大 50 ターン後、サブエージェントは構造化 `{ "ok": true/false }` 決定を返します
4. Claude Code はプロンプト フックと同じ方法で決定を処理します

エージェント フックは、フック入力データのみを評価するのではなく、実際のファイルを検査したりテスト出力を検査したりする必要がある場合に便利です。

### エージェント フック設定

`type` を `"agent"` に設定し、`prompt` 文字列を提供します。設定フィールドは[プロンプト フック](#prompt-hook-configuration)と同じですが、より長いデフォルト タイムアウトです：

| フィールド | 必須 | 説明 |
| :- | :- | :- |
| `type` | はい | `"agent"` である必要があります |
| `prompt` | はい | 検証する内容を説明するプロンプト。フック入力 JSON のプレースホルダーとして `$ARGUMENTS` を使用します |
| `model` | いいえ | 使用するモデル。デフォルトは高速モデル |
| `timeout` | いいえ | タイムアウト（秒単位）。デフォルト：60 |

レスポンス スキーマはプロンプト フックと同じです：許可するには `{ "ok": true }` を、ブロックするには `{ "ok": false, "reason": "..." }` を返します。

この `Stop` フックは、Claude が終了することを許可する前にすべてのユニット テストが合格することを検証します：

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "agent",
            "prompt": "Verify that all unit tests pass. Run the test suite and check the results. $ARGUMENTS",
            "timeout": 120
          }
        ]
      }
    ]
  }
}
```

## バックグラウンドでフックを実行

デフォルトでは、フックは完了するまで Claude の実行をブロックします。デプロイメント、テスト スイート、外部 API 呼び出しなどの長時間実行タスクの場合、`"async": true` を設定してフックをバックグラウンドで実行し、Claude が作業を続行できるようにします。非同期フックはブロックまたは Claude の動作を制御できません。`decision`、`permissionDecision`、`continue` などのレスポンス フィールドは、制御しようとしたアクションがすでに完了しているため、効果がありません。

### 非同期フックを設定

コマンド フックの設定に `"async": true` を追加して、Claude をブロックせずにバックグラウンドで実行します。このフィールドは `type: "command"` フックでのみ利用可能です。

このフックは、すべての `Write` ツール呼び出しの後にテスト スクリプトを実行します。Claude は `run-tests.sh` が最大 120 秒間実行されている間、すぐに作業を続行します。スクリプトが完了すると、その出力は次の会話ターンで配信されます。

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/run-tests.sh",
            "async": true,
            "timeout": 120
          }
        ]
      }
    ]
  }
}
```

`timeout` フィールドはバックグラウンド プロセスの最大時間（秒単位）を設定します。指定されない場合、非同期フックは同期フックと同じ 10 分のデフォルトを使用します。

### 非同期フックの実行方法

非同期フックが発火すると、Claude Code はフック プロセスを開始し、完了を待たずにすぐに続行します。フックは同期フックと同じ JSON 入力を stdin 経由で受け取ります。

バックグラウンド プロセスが終了した後、フックが `additionalContext` フィールドを含む JSON レスポンスを生成した場合、そのコンテンツは次の会話ターンで Claude にコンテキストとして配信されます。`systemMessage` フィールドは Claude ではなく、あなたに表示されます。

非同期フック完了通知はデフォルトで抑制されます。これらを表示するには、`Ctrl+O` で詳細モードを有効にするか、`--verbose` で Claude Code を開始します。

### 例: ファイル変更後にテストを実行

このフックは Claude がファイルを書き込むたびにバックグラウンドでテスト スイートを開始し、テストが完了したら結果を Claude に報告します。このスクリプトをプロジェクトの `.claude/hooks/run-tests-async.sh` に保存し、`chmod +x` で実行可能にします。

```bash
#!/bin/bash
# run-tests-async.sh

# stdin からフック入力を読み取る
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# ソース ファイルのみテストを実行
if [[ "$FILE_PATH" != *.ts && "$FILE_PATH" != *.js ]]; then
  exit 0
fi

# テストを実行し、additionalContext 経由で結果を Claude に報告
RESULT=$(npm test 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  MSG="Tests passed after editing $FILE_PATH"
else
  MSG="Tests failed after editing $FILE_PATH: $RESULT"
fi
jq -nc --arg msg "$MSG" '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $msg}}'
```

次に、プロジェクト ルートの `.claude/settings.json` にこの設定を追加します。`async: true` フラグにより、Claude はテストの実行中に作業を続行できます。

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/run-tests-async.sh",
            "args": [],
            "async": true,
            "timeout": 300
          }
        ]
      }
    ]
  }
}
```

### 制限事項

非同期フックは同期フックと比べていくつかの制約があります。

- `async` をサポートするのは `type: "command"` フックのみです。プロンプト ベースのフックは非同期で実行できません。
- 非同期フックはツール呼び出しをブロックまたは決定を返すことができません。フックが完了するまでに、トリガーするアクションはすでに進行しています。
- フック出力は次の会話ターンで配信されます。セッションがアイドル状態の場合、レスポンスは次のユーザー操作まで待機します。例外: `asyncRewake` フックが終了コード 2 で終了すると、セッションがアイドル状態でも Claude を直ちに起動します。
- 各実行は個別のバックグラウンド プロセスを作成します。同じ非同期フックの複数の発火全体で重複排除はありません。

## セキュリティに関する考慮事項

### 免責事項

コマンド フックはシステム ユーザーの完全な権限で実行されます。

コマンド フックはユーザー アカウントの完全な権限でシェル コマンドを実行します。ユーザー アカウントがアクセスできるファイルを変更、削除、またはアクセスできます。フック コマンドを設定に追加する前に、すべてのフック コマンドを確認してテストしてください。

### セキュリティ ベストプラクティス

フックを書くときは、これらのプラクティスに留意してください。

- **入力を検証およびサニタイズ**: 入力データを盲目的に信頼しないでください
- **常にシェル変数を引用**: `$VAR` ではなく `"$VAR"` を使用
- **パス トラバーサルをブロック**: ファイル パスで `..` をチェック
- **絶対パスを使用**: スクリプトの完全なパスを指定します。exec 形式では、`${CLAUDE_PROJECT_DIR}` を使用し、パスは引用符で囲む必要がありません。シェル形式では、ダブル クォートで囲みます
- **機密ファイルをスキップ**: `.env`、`.git/`、キーなどを避ける

## Windows PowerShell ツール

Windows では、コマンド フックで `"shell": "powershell"` を設定することで、個別のフックを PowerShell で実行できます。フックは PowerShell を直接生成するため、`CLAUDE_CODE_USE_POWERSHELL_TOOL` が設定されているかどうかに関係なく機能します。Claude Code は `pwsh.exe`（PowerShell 7 以上）を自動検出し、`powershell.exe`（5.1）にフォールバックします。

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "shell": "powershell",
            "command": "Write-Host 'File written'"
          }
        ]
      }
    ]
  }
}
```

## フックをデバッグ

フック実行の詳細、マッチしたフック、終了コード、完全な stdout と stderr はデバッグ ログ ファイルに書き込まれます。`claude --debug-file <path>` で既知の場所にログを書き込むか、`claude --debug` を実行してログを `~/.claude/debug/<session-id>.txt` で読み取ります。`--debug` フラグはターミナルに出力しません。

```text
[DEBUG] Executing hooks for PostToolUse:Write
[DEBUG] Found 1 hook commands to execute
[DEBUG] Executing hook command: <Your command> with timeout 600000ms
[DEBUG] Hook command completed with status 0: <Your stdout>
```

より詳細なフック マッチング詳細については、`CLAUDE_CODE_DEBUG_LOG_LEVEL=verbose` を設定して、フック マッチャー数とクエリ マッチングなどの追加ログ行を確認します。

フックが発火しない、Stop フックが実行をブロックし続ける、または設定エラーなどの一般的な問題のトラブルシューティングについては、ガイドの[制限事項とトラブルシューティング](/ja/hooks-guide#limitations-and-troubleshooting)を参照してください。`/context`、`/doctor`、および設定の優先順位をカバーするより広範な診断チュートリアルについては、[設定をデバッグ](/ja/debug-your-config)を参照してください。
