---
title: hooks-guide
source: https://code.claude.com/docs/ja/hooks-guide.md
---

# hooks でワークフローを自動化する

> Claude Code がファイルを編集したり、タスクを完了したり、入力が必要になったりしたときに、シェルコマンドを自動的に実行します。コードをフォーマットし、通知を送信し、コマンドを検証し、プロジェクトルールを適用します。

Hooks は Claude Code のライフサイクルの特定のポイントで実行されるユーザー定義のシェルコマンドです。これらは Claude Code の動作に対して決定論的な制御を提供し、LLM が実行を選択するのに依存するのではなく、特定のアクションが常に発生することを保証します。Hooks を使用して、プロジェクトルールを適用し、反復的なタスクを自動化し、Claude Code を既存のツールと統合します。

判断が必要な決定については、決定論的なルールではなく、Claude モデルを使用して条件を評価する [プロンプトベースの hooks](#prompt-based-hooks) または [エージェントベースの hooks](#agent-based-hooks) を使用することもできます。

Claude Code を拡張する他の方法については、Claude に追加の指示と実行可能なコマンドを与えるための [skills](/ja/skills)、分離されたコンテキストでタスクを実行するための [subagents](/ja/sub-agents)、プロジェクト全体で共有する拡張機能をパッケージ化するための [plugins](/ja/plugins) を参照してください。

このガイドでは一般的なユースケースと始め方をカバーしています。完全なイベントスキーマ、JSON 入力/出力形式、非同期 hooks や MCP ツール hooks などの高度な機能については、[Hooks リファレンス](/ja/hooks) を参照してください。

## 最初の hook をセットアップする

Hook を作成するには、[設定ファイル](#configure-hook-location) に `hooks` ブロックを追加します。このチュートリアルではデスクトップ通知 hook を作成するため、Claude があなたの入力を待っているときにアラートを受け取ることができます。ターミナルを監視する代わりに。

`~/.claude/settings.json` を開き、`Notification` hook を追加します。以下の例は macOS 用に `osascript` を使用しています。Linux と Windows のコマンドについては、[Claude が入力を必要とするときに通知を受け取る](#get-notified-when-claude-needs-input) を参照してください。

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

設定ファイルに既に `hooks` キーがある場合は、オブジェクト全体を置き換えるのではなく、`Notification` を既存のイベントキーの兄弟として追加します。各イベント名は単一の `hooks` オブジェクト内のキーです：

```json theme={null}
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "command": "jq -r '.tool_input.file_path' | xargs npx prettier --write" }]
      }
    ],
    "Notification": [
      {
        "matcher": "",
        "hooks": [{ "type": "command", "command": "osascript -e 'display notification \"Claude Code needs your attention\" with title \"Claude Code\"'" }]
      }
    ]
  }
}
```

CLI で説明することで、Claude に hook を書いてもらうこともできます。

`/hooks` と入力して hooks ブラウザを開きます。利用可能なすべての hook イベントのリストが表示され、hooks が設定されているイベントの横に数が表示されます。`Notification` を選択して、新しい hook がリストに表示されることを確認します。Hook を選択すると、その詳細が表示されます：イベント、マッチャー、タイプ、ソースファイル、およびコマンド。

`Esc` を押して CLI に戻ります。Claude に許可が必要な何かをするよう依頼し、ターミナルから切り替えます。デスクトップ通知を受け取るはずです。

`/hooks` メニューは読み取り専用です。Hooks を追加、変更、または削除するには、設定 JSON を直接編集するか、Claude に変更を依頼します。

## 自動化できるもの

Hooks を使用すると、Claude Code のライフサイクルの主要なポイントでコードを実行できます：編集後にファイルをフォーマットし、実行前にコマンドをブロックし、Claude が入力を必要とするときに通知を送信し、セッション開始時にコンテキストを注入するなど。Hook イベントの完全なリストについては、[Hooks リファレンス](/ja/hooks#hook-lifecycle) を参照してください。

各例には、[設定ファイル](#configure-hook-location) に追加する準備ができた設定ブロックが含まれています。最も一般的なパターン：

- [Claude が入力を必要とするときに通知を受け取る](#get-notified-when-claude-needs-input)
- [編集後にコードを自動フォーマットする](#auto-format-code-after-edits)
- [保護されたファイルへの編集をブロックする](#block-edits-to-protected-files)
- [圧縮後にコンテキストを再注入する](#re-inject-context-after-compaction)
- [設定変更を監査する](#audit-configuration-changes)
- [ディレクトリまたはファイルが変更されたときに環境をリロードする](#reload-environment-when-directory-or-files-change)
- [特定の許可プロンプトを自動承認する](#auto-approve-specific-permission-prompts)

### Claude が入力を必要とするときに通知を受け取る

Claude が作業を完了して入力を必要とするときはいつでもデスクトップ通知を取得し、ターミナルをチェックせずに他のタスクに切り替えることができます。

この hook は `Notification` イベントを使用します。これは Claude が入力または許可を待っているときに発火します。以下の各タブはプラットフォームのネイティブ通知コマンドを使用します。これを `~/.claude/settings.json` に追加します：

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

`osascript` は組み込みの Script Editor アプリを通じて通知をルーティングします。Script Editor に通知権限がない場合、コマンドは静かに失敗し、macOS はそれを付与するよう求めません。Terminal でこれを 1 回実行して、Script Editor を通知設定に表示させます：

```bash theme={null}
osascript -e 'display notification "test"'
```

まだ何も表示されません。**System Settings > Notifications** を開き、リストで **Script Editor** を見つけて、**Allow Notifications** をオンにします。コマンドを再度実行して、テスト通知が表示されることを確認します。

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

空の `matcher` はすべての通知タイプで発火します。特定のイベントでのみ発火させるには、次のいずれかの値に設定します：

| Matcher | 発火するタイミング |
| :- | :- |
| `permission_prompt` | Claude がツール使用を承認する必要があるとき |
| `idle_prompt` | Claude が完了し、次のプロンプトを待っているとき |
| `auth_success` | 認証が完了したとき |
| `elicitation_dialog` | MCP サーバーが引き出しフォームを開くとき |
| `elicitation_complete` | MCP 引き出しフォームが送信または却下されたとき |
| `elicitation_response` | MCP 引き出し応答がサーバーに送り返されたとき |

`/hooks` と入力して `Notification` を選択し、hook が登録されていることを確認します。完全なイベントスキーマについては、[Notification リファレンス](/ja/hooks#notification) を参照してください。

### 編集後にコードを自動フォーマットする

Claude が編集するすべてのファイルで [Prettier](https://prettier.io/) を自動的に実行し、手動操作なしでフォーマットの一貫性を保ちます。

この hook は `PostToolUse` イベントを `Edit|Write` マッチャーで使用するため、ファイル編集ツールの後にのみ実行されます。コマンドは [`jq`](https://jqlang.github.io/jq/) で編集されたファイルパスを抽出し、Prettier に渡します。これをプロジェクトルートの `.claude/settings.json` に追加します：

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.file_path' | xargs npx prettier --write"
          }
        ]
      }
    ]
  }
}
```

このページの Bash の例は JSON 解析に `jq` を使用します。`brew install jq`（macOS）、`apt-get install jq`（Debian/Ubuntu）でインストールするか、[`jq` ダウンロード](https://jqlang.github.io/jq/download/) を参照してください。

### 保護されたファイルへの編集をブロックする

Claude が `.env`、`package-lock.json`、`.git/` 内のものなどの機密ファイルを変更するのを防ぎます。Claude は編集がブロックされた理由を説明するフィードバックを受け取るため、アプローチを調整できます。

この例は hook が呼び出す別のスクリプトファイルを使用します。スクリプトはターゲットファイルパスを保護されたパターンのリストに対してチェックし、終了コード 2 で編集をブロックします。

これを `.claude/hooks/protect-files.sh` に保存します：

```bash theme={null}
#!/bin/bash
# protect-files.sh

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

PROTECTED_PATTERNS=(".env" "package-lock.json" ".git/")

for pattern in "${PROTECTED_PATTERNS[@]}"; do
  if [[ "$FILE_PATH" == *"$pattern"* ]]; then
    echo "Blocked: $FILE_PATH matches protected pattern '$pattern'" >&2
    exit 2
  fi
done

exit 0
```

Claude Code が hook スクリプトを実行するには、実行可能である必要があります：

```bash theme={null}
chmod +x .claude/hooks/protect-files.sh
```

`.claude/settings.json` に `PreToolUse` hook を追加して、`Edit` または `Write` ツール呼び出しの前にスクリプトを実行します：

```json theme={null}
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/protect-files.sh"
          }
        ]
      }
    ]
  }
}
```

### 圧縮後にコンテキストを再注入する

Claude のコンテキストウィンドウがいっぱいになると、圧縮は会話を要約してスペースを解放します。これは重要な詳細を失う可能性があります。`compact` マッチャーで `SessionStart` hook を使用して、すべての圧縮後に重要なコンテキストを再注入します。

コマンドが stdout に書き込むテキストは Claude のコンテキストに追加されます。この例はプロジェクト規約と最近の作業を Claude に思い出させます。これをプロジェクトルートの `.claude/settings.json` に追加します：

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "compact",
        "hooks": [
          {
            "type": "command",
            "command": "echo 'Reminder: use Bun, not npm. Run bun test before committing. Current sprint: auth refactor.'"
          }
        ]
      }
    ]
  }
}
```

`echo` を `git log --oneline -5` などの動的出力を生成するコマンドに置き換えて、最近のコミットを表示できます。すべてのセッション開始時にコンテキストを注入する場合は、代わりに [CLAUDE.md](/ja/memory) を使用することを検討してください。環境変数については、リファレンスの [`CLAUDE_ENV_FILE`](/ja/hooks#persist-environment-variables) を参照してください。

### 設定変更を監査する

セッション中に設定またはスキルファイルが変更されたときを追跡します。`ConfigChange` イベントは外部プロセスまたはエディタが設定ファイルを変更したときに発火するため、コンプライアンスのために変更をログに記録したり、不正な変更をブロックしたりできます。

この例は各変更を監査ログに追加します。これを `~/.claude/settings.json` に追加します：

```json
{
  "hooks": {
    "ConfigChange": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "jq -c '{timestamp: now | todate, source: .source, file: .file_path}' >> ~/claude-config-audit.log"
          }
        ]
      }
    ]
  }
}
```

マッチャーは設定タイプでフィルタリングします：`user_settings`、`project_settings`、`local_settings`、`policy_settings`、または `skills`。変更が有効になるのをブロックするには、終了コード 2 で終了するか、`{"decision": "block"}` を返します。完全な入力スキーマについては、[ConfigChange リファレンス](/ja/hooks#configchange) を参照してください。

### ディレクトリまたはファイルが変更されたときに環境をリロードする

一部のプロジェクトは、どのディレクトリにいるかに応じて異なる環境変数を設定します。[direnv](https://direnv.net/) などのツールはシェルで自動的にこれを行いますが、Claude の Bash ツールはそれらの変更を自動的に取得しません。

`SessionStart` hook を `CwdChanged` hook とペアリングすることでこれを修正します。`SessionStart` は起動したディレクトリの変数をロードし、`CwdChanged` は Claude がディレクトリを変更するたびにそれらをリロードします。どちらも `CLAUDE_ENV_FILE` に書き込み、Claude Code は各 Bash コマンドの前にスクリプトプリアンブルとして実行します。これを `~/.claude/settings.json` に追加します：

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "direnv export bash > \"$CLAUDE_ENV_FILE\""
          }
        ]
      }
    ],
    "CwdChanged": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "direnv export bash > \"$CLAUDE_ENV_FILE\""
          }
        ]
      }
    ]
  }
}
```

`direnv allow` をすべてのディレクトリで 1 回実行して、direnv が `.envrc` をロードすることが許可されるようにします。direnv の代わりに devbox または nix を使用する場合、同じパターンは `direnv export bash` の代わりに `devbox shellenv` または `devbox global shellenv` で機能します。

すべてのディレクトリ変更ではなく、特定のファイルに反応するには、`FileChanged` を `matcher` で使用して、監視するファイル名をリストします（パイプで区切られています）。ウォッチリストを構築するために、この値は正規表現として評価されるのではなく、リテラルファイル名に分割されます。[FileChanged](/ja/hooks#filechanged) を参照して、同じ値がファイルが変更されたときにどの hook グループが実行されるかをフィルタリングする方法を確認してください。この例は現在のディレクトリの `.envrc` と `.env` を監視します：

```json
{
  "hooks": {
    "FileChanged": [
      {
        "matcher": ".envrc|.env",
        "hooks": [
          {
            "type": "command",
            "command": "direnv export bash > \"$CLAUDE_ENV_FILE\""
          }
        ]
      }
    ]
  }
}
```

入力スキーマ、`watchPaths` 出力、および `CLAUDE_ENV_FILE` の詳細については、[CwdChanged](/ja/hooks#cwdchanged) および [FileChanged](/ja/hooks#filechanged) リファレンスエントリを参照してください。

### 特定の許可プロンプトを自動承認する

常に許可するツール呼び出しの承認ダイアログをスキップします。この例は `ExitPlanMode` を自動承認します。これは Claude がプランの提示を終了して続行するよう求めるときに呼び出すツールです。プランが準備できるたびにプロンプトが表示されることはありません。

上記の終了コード例とは異なり、自動承認には hook が JSON 決定を stdout に書き込む必要があります。`PermissionRequest` hook は Claude Code が許可ダイアログを表示しようとするときに発火し、`"behavior": "allow"` を返すとあなたの代わりにそれに答えます。

マッチャーは hook を `ExitPlanMode` のみにスコープするため、他のプロンプトは影響を受けません。これを `~/.claude/settings.json` に追加します：

```json
{
  "hooks": {
    "PermissionRequest": [
      {
        "matcher": "ExitPlanMode",
        "hooks": [
          {
            "type": "command",
            "command": "echo '{\"hookSpecificOutput\": {\"hookEventName\": \"PermissionRequest\", \"decision\": {\"behavior\": \"allow\"}}}'"
          }
        ]
      }
    ]
  }
}
```

Hook が承認すると、Claude Code は Plan Mode を終了し、Plan Mode に入る前にアクティブだった許可モードを復元します。トランスクリプトは、ダイアログが表示されたはずの場所に「Allowed by PermissionRequest hook」と表示されます。Hook パスは常に現在の会話を保持します：ダイアログができるように、コンテキストをクリアして新しい実装セッションを開始することはできません。

特定の許可モードを設定する代わりに、hook の出力に `setMode` エントリを含む `updatedPermissions` 配列を含めることができます。`mode` 値は `default`、`acceptEdits`、または `bypassPermissions` などの任意の許可モードであり、`destination: "session"` は現在のセッションのみに適用します。

`bypassPermissions` は、セッションが既にバイパスモードで起動された場合にのみ適用されます：`--dangerously-skip-permissions`、`--permission-mode bypassPermissions`、`--allow-dangerously-skip-permissions`、または設定の `permissions.defaultMode: "bypassPermissions"`、および [`permissions.disableBypassPermissionsMode`](/ja/permissions#managed-settings) で無効化されていない場合。`defaultMode` として永続化されることはありません。

セッションを `acceptEdits` に切り替えるには、hook は stdout に次の JSON を書き込みます：

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PermissionRequest",
    "decision": {
      "behavior": "allow",
      "updatedPermissions": [
        { "type": "setMode", "mode": "acceptEdits", "destination": "session" }
      ]
    }
  }
}
```

マッチャーをできるだけ狭く保ちます。`.*` でマッチングするか、マッチャーを空のままにすると、ファイル書き込みやシェルコマンドを含むすべての許可プロンプトが自動承認されます。決定フィールドの完全なセットについては、[PermissionRequest リファレンス](/ja/hooks#permissionrequest-decision-control) を参照してください。

## hooks の仕組み

Hook イベントは Claude Code のライフサイクルの特定のポイントで発火します。イベントが発火すると、すべてのマッチングする hooks が並列で実行され、同一の hook コマンドは自動的に重複排除されます。以下の表は各イベントとそれがトリガーされるときを示しています：

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

各 hook には、それがどのように実行されるかを決定する `type` があります。ほとんどの hooks は `"type": "command"` を使用し、シェルコマンドを実行します。他の 4 つのタイプが利用可能です：

- `"type": "http"`：イベントデータを URL に POST します。[HTTP hooks](#http-hooks) を参照してください。
- `"type": "mcp_tool"`：既に接続されている MCP サーバー上のツールを呼び出します。[MCP tool hooks](/ja/hooks#mcp-tool-hook-fields) を参照してください。
- `"type": "prompt"`：シングルターン LLM 評価。[プロンプトベースの hooks](#prompt-based-hooks) を参照してください。
- `"type": "agent"`：ツールアクセス付きマルチターン検証。エージェント hooks は実験的であり、変更される可能性があります。[エージェントベースの hooks](#agent-based-hooks) を参照してください。

### 複数の hooks からの結果を組み合わせる

複数の hooks が同じイベントにマッチする場合、すべての hook のコマンドが完了してから Claude Code は結果をマージします。1 つの hook が `deny` を返しても、兄弟 hooks の実行は停止されません。1 つの hook の `deny` が別の hook の副作用を抑制することに依存しないでください。

すべてのマッチングする hooks が完了した後、Claude Code はそれらの出力を組み合わせます。`PreToolUse` 許可決定については、最も制限的な答えが勝ちます：`deny` は `ask` をオーバーライドし、`ask` は `allow` をオーバーライドします。`additionalContext` からのテキストはすべての hook から保持され、Claude に一緒に渡されます。

以下の例は `Bash` に 2 つの `PreToolUse` hooks を登録しています。最初のものはすべてのコマンドをログファイルに追加して 0 で終了します。2 番目のものはスクリプトを実行し、コマンドに `rm -rf` が含まれている場合は 2 で終了して拒否します：

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r .tool_input.command >> ~/.claude/bash.log"
          },
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/block-rm-rf.sh"
          }
        ]
      }
    ]
  }
}
```

Claude が `rm -rf /tmp/build` を実行しようとするとき、両方の hooks が並列で実行されます。ログ hook はコマンドを `~/.claude/bash.log` に書き込み、0 で終了します。これは決定がないことを報告します。ガードレール hook は 2 で終了し、ツール呼び出しを拒否します。deny が勝つため、Claude Code はコマンドをブロックし、Claude にガードレールの stderr を表示します。ログエントリはまだ書き込まれます。なぜなら、ログ hook は既に実行されているからです。

### 入力を読み取り、出力を返す

Hooks は stdin、stdout、stderr、および終了コードを通じて Claude Code と通信します。イベントが発火すると、Claude Code はイベント固有のデータを JSON としてスクリプトの stdin に渡します。スクリプトはそのデータを読み取り、作業を行い、終了コードを通じて Claude Code に次に何をするかを伝えます。

#### Hook 入力

すべてのイベントには `session_id` と `cwd` などの共通フィールドが含まれていますが、各イベントタイプは異なるデータを追加します。たとえば、Claude が Bash コマンドを実行するとき、`PreToolUse` hook は stdin で次のようなものを受け取ります：

```json
{
  "session_id": "abc123",          // このセッションの一意の ID
  "cwd": "/Users/sarah/myproject", // イベントが発火したときの作業ディレクトリ
  "hook_event_name": "PreToolUse", // この hook をトリガーしたイベント
  "tool_name": "Bash",             // Claude が使用しようとしているツール
  "tool_input": {                  // Claude がツールに渡した引数
    "command": "npm test"          // Bash の場合、これはシェルコマンド
  }
}
```

スクリプトはその JSON を解析し、これらのフィールドのいずれかに基づいて動作できます。`UserPromptSubmit` hooks は代わりに `prompt` テキストを取得し、`SessionStart` hooks は `source`（startup、resume、clear、compact）を取得するなど。リファレンスの [共通入力フィールド](/ja/hooks#common-input-fields) で共有フィールドを参照し、各イベントのセクションでイベント固有のスキーマを参照してください。

#### Hook 出力

スクリプトは stdout または stderr に書き込み、特定のコードで終了することで、Claude Code に次に何をするかを伝えます。たとえば、コマンドをブロックしたい `PreToolUse` hook：

```bash
#!/bin/bash
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

if echo "$COMMAND" | grep -q "drop table"; then
  echo "Blocked: dropping tables is not allowed" >&2  # stderr は Claude のフィードバックになります
  exit 2 # exit 2 = アクションをブロック
fi

exit 0  # exit 0 = 決定なし。通常の許可フローが適用されます
```

終了コードは次に何が起こるかを決定します：

- **終了 0**：hook は異議を報告せず、アクションは通常どおり進行します。`PreToolUse` hook の場合、これはツール呼び出しを承認しません：通常の [許可フロー](/ja/permissions) が引き続き適用されます。`UserPromptSubmit`、`UserPromptExpansion`、および `SessionStart` hooks の場合、stdout に書き込むすべてのものが Claude のコンテキストに追加されます。
- **終了 2**：アクションがブロックされます。stderr に理由を書き込み、Claude はそれをフィードバックとして受け取るため、調整できます。一部のイベントはブロックできません：`SessionStart`、`Setup`、`Notification` などの場合、終了 2 は stderr をユーザーに表示し、実行は続行されます。[イベントごとの終了コード 2 の動作](/ja/hooks#exit-code-2-behavior-per-event) で完全なリストを参照してください。
- **その他の終了コード**：アクションが続行されます。トランスクリプトは `<hook name> hook error` 通知を表示し、その後 stderr の最初の行が続きます。完全な stderr は [デバッグログ](/ja/hooks#debug-hooks) に記録されます。

#### 構造化 JSON 出力

終了コードはブロックするか沈黙するかのみを許可します。より多くの制御のために、終了 0 して stdout に JSON オブジェクトを出力します。

終了 2 で stderr メッセージでブロックするか、終了 0 で JSON で構造化制御を使用します。混在させないでください：Claude Code は終了 2 のときに JSON を無視します。

たとえば、`PreToolUse` hook はツール呼び出しを拒否して理由を Claude に伝えたり、ユーザーの承認のためにエスカレートしたりできます：

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Use rg instead of grep for better performance"
  }
}
```

`"deny"` を使用すると、Claude Code はツール呼び出しをキャンセルし、`permissionDecisionReason` を Claude にフィードバックとして返します。これらの `permissionDecision` 値は `PreToolUse` に固有です：

- `"allow"`：インタラクティブな許可プロンプトをスキップします。Deny および ask ルール（エンタープライズ管理 deny リストを含む）は引き続き適用されます
- `"deny"`：ツール呼び出しをキャンセルし、理由を Claude に送信します
- `"ask"`：通常どおりユーザーに許可プロンプトを表示します

4 番目の値 `"defer"` は、`-p` フラグ付きの [非インタラクティブモード](/ja/headless) で利用可能です。プロセスを終了し、ツール呼び出しを保持して、Agent SDK ラッパーが入力を収集して再開できるようにします。リファレンスの [ツール呼び出しを後で延期する](/ja/hooks#defer-a-tool-call-for-later) を参照してください。

`"allow"` を返すとインタラクティブプロンプトをスキップしますが、[許可ルール](/ja/permissions#manage-permissions) をオーバーライドしません。Deny ルールがツール呼び出しにマッチする場合、hook が `"allow"` を返しても呼び出しはブロックされます。Ask ルールがマッチする場合、ユーザーはまだプロンプトが表示されます。これは、[管理設定](/ja/settings#settings-files) を含むすべての設定スコープからの deny ルールが、hook 承認よりも常に優先されることを意味します。

他のイベントは異なる決定パターンを使用します。たとえば、`PostToolUse` および `Stop` hooks はトップレベルの `decision: "block"` フィールドを使用し、`PermissionRequest` は `hookSpecificOutput.decision.behavior` を使用します。リファレンスの [サマリーテーブル](/ja/hooks#decision-control) でイベント別の完全な内訳を参照してください。

`UserPromptSubmit` hooks の場合、代わりに `additionalContext` を使用して Claude のコンテキストにテキストを注入します。プロンプトベースの hooks（`type: "prompt"`）は出力を異なる方法で処理します：[プロンプトベースの hooks](#prompt-based-hooks) を参照してください。

### マッチャーで hooks をフィルタリングする

マッチャーなしでは、hook はそのイベントのすべての発生で発火します。マッチャーを使用すると、それを絞り込むことができます。たとえば、ファイル編集後にのみフォーマッターを実行したい場合（すべてのツール呼び出しの後ではなく）、`PostToolUse` hook にマッチャーを追加します：

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "prettier --write ..." }
        ]
      }
    ]
  }
}
```

`"Edit|Write"` マッチャーは `Edit` または `Write` ツール呼び出しでのみ発火し、`Bash`、`Read`、または他のツールでは発火しません。[マッチャーパターン](/ja/hooks#matcher-patterns) を参照して、プレーン名と正規表現がどのように評価されるかを確認してください。

Claude はまた、`Bash` ツールを通じてシェルコマンドを実行することでファイルを作成または変更できます。コンプライアンススキャンまたは監査ログなど、hook がすべてのファイル変更を確認する必要がある場合は、ターンごとに 1 回作業ツリーをスキャンする [`Stop`](/ja/hooks#stop) hook を追加してください。呼び出しごとのカバレッジの場合は、`Bash` もマッチさせ、スクリプトで `git status --porcelain` を使用して変更されたファイルと追跡されていないファイルをリストアップしてください。

各イベントタイプは特定のフィールドでマッチします：

| イベント | マッチャーがフィルタリングするもの | マッチャー値の例 |
| :- | :- | :- |
| `PreToolUse`、`PostToolUse`、`PostToolUseFailure`、`PermissionRequest`、`PermissionDenied` | ツール名 | `Bash`、`Edit\|Write`、`mcp__.*` |
| `SessionStart` | セッションがどのように開始されたか | `startup`、`resume`、`clear`、`compact` |
| `Setup` | どの CLI フラグがセットアップをトリガーしたか | `init`、`maintenance` |
| `SessionEnd` | セッションが終了した理由 | `clear`、`resume`、`logout`、`prompt_input_exit`、`bypass_permissions_disabled`、`other` |
| `Notification` | 通知タイプ | `permission_prompt`、`idle_prompt`、`auth_success`、`elicitation_dialog`、`elicitation_complete`、`elicitation_response` |
| `SubagentStart` | エージェントタイプ | `general-purpose`、`Explore`、`Plan`、またはカスタムエージェント名 |
| `PreCompact`、`PostCompact` | 圧縮をトリガーしたもの | `manual`、`auto` |
| `SubagentStop` | エージェントタイプ | `SubagentStart` と同じ値 |
| `ConfigChange` | 設定ソース | `user_settings`、`project_settings`、`local_settings`、`policy_settings`、`skills` |
| `StopFailure` | エラータイプ | `rate_limit`、`authentication_failed`、`oauth_org_not_allowed`、`billing_error`、`invalid_request`、`model_not_found`、`server_error`、`max_output_tokens`、`unknown` |
| `InstructionsLoaded` | ロード理由 | `session_start`、`nested_traversal`、`path_glob_match`、`include`、`compact` |
| `Elicitation` | MCP サーバー名 | 設定した MCP サーバー名 |
| `ElicitationResult` | MCP サーバー名 | `Elicitation` と同じ値 |
| `FileChanged` | リテラルファイル名を監視（[FileChanged](/ja/hooks#filechanged) を参照） | `.envrc\|.env` |
| `UserPromptExpansion` | コマンド名 | スキルまたはコマンド名 |
| `UserPromptSubmit`、`PostToolBatch`、`Stop`、`TeammateIdle`、`TaskCreated`、`TaskCompleted`、`WorktreeCreate`、`WorktreeRemove`、`CwdChanged` | マッチャーサポートなし | すべての発生で常に発火 |

異なるイベントタイプのマッチャーを示すいくつかの例：

`Bash` ツール呼び出しのみをマッチし、各コマンドをファイルにログに記録します。`PostToolUse` イベントはコマンドが完了した後に発火するため、`tool_input.command` は実行されたものを含みます。Hook は stdin で JSON としてイベントデータを受け取り、`jq -r '.tool_input.command'` はコマンド文字列のみを抽出し、`>>` はログファイルに追加します：

```json theme={null}
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.command' >> ~/.claude/command-log.txt"
          }
        ]
      }
    ]
  }
}
```

MCP ツールは組み込みツールとは異なる命名規則を使用します：`mcp__<server>__<tool>`。ここで `<server>` は MCP サーバー名で、`<tool>` はそれが提供するツールです。たとえば、`mcp__github__search_repositories` または `mcp__filesystem__read_file`。特定のサーバーからすべてのツールをターゲットするために正規表現マッチャーを使用するか、`mcp__.*__write.*` のようなパターンでサーバー全体でマッチします。リファレンスの [MCP ツールをマッチさせる](/ja/hooks#match-mcp-tools) を参照して、完全な例のリストを確認してください。

以下のコマンドは hook の JSON 入力からツール名を `jq` で抽出し、stderr に書き込みます。stderr に書き込むことで stdout をクリーンに保ち、メッセージを [デバッグログ](/ja/hooks#debug-hooks) に送信します：

```json theme={null}
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "mcp__github__.*",
        "hooks": [
          {
            "type": "command",
            "command": "echo \"GitHub tool called: $(jq -r '.tool_name')\" >&2"
          }
        ]
      }
    ]
  }
}
```

`SessionEnd` イベントはセッションが終了した理由のマッチャーをサポートします。この hook は `clear`（`/clear` を実行するとき）でのみ発火し、通常の終了では発火しません：

```json theme={null}
{
  "hooks": {
    "SessionEnd": [
      {
        "matcher": "clear",
        "hooks": [
          {
            "type": "command",
            "command": "rm -f /tmp/claude-scratch-*.txt"
          }
        ]
      }
    ]
  }
}
```

完全なマッチャー構文については、[Hooks リファレンス](/ja/hooks#configuration) を参照してください。

#### `if` フィールドでツール名と引数でフィルタリングする

`if` フィールドには Claude Code v2.1.85 以降が必要です。以前のバージョンはそれを無視し、マッチしたすべての呼び出しで hook を実行します。

`if` フィールドは [許可ルール構文](/ja/permissions) を使用して、ツール名と引数の両方で hooks をフィルタリングするため、hook プロセスはツール呼び出しがマッチするときにのみ生成されます。これは `matcher` を超えており、ツール名のみでグループレベルでフィルタリングします。

たとえば、すべての Bash コマンドではなく、Claude が `git` コマンドを使用するときにのみ hook を実行するには：

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "if": "Bash(git *)",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/check-git-policy.sh"
          }
        ]
      }
    ]
  }
}
```

Hook プロセスは Bash コマンドが `git *` にマッチするときにのみ生成されます。または、コマンドが解析するには複雑すぎるときです。`npm test && git push` のような複合コマンドの場合、Claude Code は各サブコマンドを評価し、`git push` がマッチするため hook を発火させます。`if` フィールドは許可ルールと同じパターンを受け入れます：`"Bash(git *)"`、`"Edit(*.ts)"` など。複数のツール名をマッチさせるには、それぞれ独自の `if` 値を持つ別のハンドラーを使用するか、パイプ交替がサポートされている `matcher` レベルでマッチします。

`if` はツールイベントでのみ機能します：`PreToolUse`、`PostToolUse`、`PostToolUseFailure`、`PermissionRequest`、および `PermissionDenied`。他のイベントに追加すると、hook が実行されるのを防ぎます。

### hook の場所を設定する

Hook を追加する場所がそのスコープを決定します：

| 場所 | スコープ | 共有可能 |
| :- | :- | :- |
| `~/.claude/settings.json` | すべてのプロジェクト | いいえ、マシンにローカル |
| `.claude/settings.json` | 単一プロジェクト | はい、リポジトリにコミット可能 |
| `.claude/settings.local.json` | 単一プロジェクト | いいえ、gitignored |
| 管理ポリシー設定 | 組織全体 | はい、管理者制御 |
| [Plugin](/ja/plugins) `hooks/hooks.json` | プラグインが有効なとき | はい、プラグインにバンドル |
| [Skill](/ja/skills) または [agent](/ja/sub-agents) frontmatter | スキルまたはエージェントがアクティブなとき | はい、コンポーネントファイルで定義 |

Claude Code で [`/hooks`](/ja/hooks#the-hooks-menu) を実行して、イベント別にグループ化されたすべての設定済み hooks を参照します。すべての hooks を一度に無効にするには、設定ファイルで `"disableAllHooks": true` を設定します。管理設定で設定された Hooks は、`disableAllHooks` がそこにも設定されていない限り、実行されます。

Claude Code が実行中に設定ファイルを直接編集する場合、ファイルウォッチャーは通常、hook の変更を自動的に取得します。

## プロンプトベースの hooks

決定論的なルールではなく判断が必要な決定については、`type: "prompt"` hooks を使用します。シェルコマンドを実行する代わりに、Claude Code はプロンプトと hook の入力データを Claude モデル（デフォルトでは Haiku）に送信して決定を下します。より多くの機能が必要な場合は、`model` フィールドで異なるモデルを指定できます。

モデルの唯一の仕事は、yes/no 決定を JSON として返すことです：

- `"ok": true`：アクションが続行されます
- `"ok": false`：何が起こるかはイベントによって異なります：
  - `Stop` および `SubagentStop`：`reason` は Claude にフィードバックとして返されるため、作業を続けます
  - `PreToolUse`：ツール呼び出しが拒否され、`reason` はツールエラーとして Claude に返されるため、調整して続行できます
  - `PostToolUse`、`PostToolBatch`、`UserPromptSubmit`、および `UserPromptExpansion`：ターンが終了し、`reason` は警告行としてチャットに表示されます

この例は `Stop` hook を使用して、要求されたすべてのタスクが完了しているかどうかをモデルに尋ねます。モデルが `"ok": false` を返す場合、Claude は作業を続け、`reason` を次の指示として使用します：

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Check if all tasks are complete. If not, respond with {\"ok\": false, \"reason\": \"what remains to be done\"}."
          }
        ]
      }
    ]
  }
}
```

完全な設定オプションについては、リファレンスの [プロンプトベースの hooks](/ja/hooks#prompt-based-hooks) を参照してください。

## エージェントベースの hooks

エージェント hooks は実験的です。動作と設定は将来のリリースで変更される可能性があります。本番ワークフローについては、[コマンド hooks](/ja/hooks#command-hook-fields) を優先してください。

検証がファイルの検査またはコマンドの実行を必要とする場合、`type: "agent"` hooks を使用します。プロンプト hooks は単一の LLM 呼び出しを行いますが、エージェント hooks は条件を返す前にファイルを読み取り、コードを検索し、他のツールを使用できる subagent を生成します。

エージェント hooks はプロンプト hooks と同じ `"ok"` / `"reason"` 応答形式を使用しますが、デフォルトのタイムアウトが 60 秒で、最大 50 ツール使用ターンです。

この例は Claude が停止することを許可する前にテストが合格することを検証します：

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

Hook 入力データだけで決定を下すのに十分な場合はプロンプト hooks を使用します。コードベースの実際の状態に対して何かを検証する必要がある場合はエージェント hooks を使用します。

完全な設定オプションについては、リファレンスの [エージェントベースの hooks](/ja/hooks#agent-based-hooks) を参照してください。

## HTTP hooks

`type: "http"` hooks を使用して、シェルコマンドを実行する代わりに、イベントデータを HTTP エンドポイントに POST します。エンドポイントはコマンド hook が stdin で受け取るのと同じ JSON を受け取り、HTTP レスポンスボディを使用して同じ JSON 形式で結果を返します。

HTTP hooks は、Web サーバー、クラウド関数、または外部サービスに hook ロジックを処理させたい場合に便利です。たとえば、チーム全体のツール使用イベントをログに記録する共有監査サービス。

この例はすべてのツール使用をローカルログサービスに POST します：

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "hooks": [
          {
            "type": "http",
            "url": "http://localhost:8080/hooks/tool-use",
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

エンドポイントは、コマンド hooks と同じ [出力形式](/ja/hooks#json-output) を使用して JSON レスポンスボディを返す必要があります。ツール呼び出しをブロックするには、適切な `hookSpecificOutput` フィールドで 2xx レスポンスを返します。HTTP ステータスコードだけではアクションをブロックできません。

ヘッダー値は `$VAR_NAME` または `${VAR_NAME}` 構文を使用した環境変数補間をサポートします。`allowedEnvVars` 配列にリストされている変数のみが解決されます。他のすべての `$VAR` 参照は空のままです。

完全な設定オプションとレスポンス処理については、リファレンスの [HTTP hooks](/ja/hooks#http-hook-fields) を参照してください。

## 制限とトラブルシューティング

### 制限

- コマンド hooks は stdout、stderr、および終了コードを通じてのみ通信します。これらは `/` コマンドまたはツール呼び出しをトリガーできません。`additionalContext` を通じて返されたテキストは、Claude が平文として読むシステムリマインダーとして注入されます。HTTP hooks はレスポンスボディを通じて通信します。
- Hook タイムアウトはタイプによって異なります。`timeout` フィールド（秒単位）で hook ごとにオーバーライドできます。
  - `command`、`http`、`mcp_tool`：10 分。`UserPromptSubmit` はこれらを 30 秒に短縮します。
  - `prompt`：30 秒。
  - `agent`：60 秒。
- `PostToolUse` hooks はツールが既に実行されているため、アクションを元に戻すことはできません。
- `PermissionRequest` hooks は [非インタラクティブモード](/ja/headless)（`-p`）では発火しません。自動化された許可決定には `PreToolUse` hooks を使用します。
- `Stop` hooks はタスク完了時だけでなく、Claude が応答を終了するたびに発火します。ユーザーの割り込みでは発火しません。API エラーは代わりに [StopFailure](/ja/hooks#stopfailure) を発火させます。
- 複数の PreToolUse hooks が [`updatedInput`](/ja/hooks#pretooluse) を返してツールの引数を書き直す場合、最後に完了したものが勝ちます。Hooks は並列で実行されるため、順序は非決定的です。同じツールの入力を変更する複数の hooks を持つことを避けてください。

### Hooks と許可モード

PreToolUse hooks は任意の許可モードチェックの前に発火します。`permissionDecision: "deny"` を返す hook は、`bypassPermissions` モードまたは `--dangerously-skip-permissions` でもツールをブロックします。これにより、ユーザーが許可モードを変更してバイパスできないポリシーを適用できます。

逆は真ではありません：`"allow"` を返す hook は、設定からの deny ルールをバイパスしません。Hooks は制限を厳しくできますが、許可ルールが許可する範囲を超えて緩和することはできません。

### Hook が発火しない

Hook は設定されていますが、実行されません。

- `/hooks` を実行し、hook が正しいイベントの下に表示されることを確認します
- マッチャーパターンがツール名と正確にマッチすることを確認します（マッチャーは大文字小文字を区別します）
- 正しいイベントタイプをトリガーしていることを確認します（例：`PreToolUse` はツール実行前に発火し、`PostToolUse` は後に発火します）
- 非インタラクティブモード（`-p`）で `PermissionRequest` hooks を使用している場合は、代わりに `PreToolUse` に切り替えます

### Hook エラーが出力に表示される

トランスクリプトに「PreToolUse hook error: ...」というメッセージが表示されます。

- スクリプトが予期せずゼロ以外のコードで終了しました。サンプル JSON をパイプして手動でテストします：
  ```bash theme={null}
  echo '{"tool_name":"Bash","tool_input":{"command":"ls"}}' | ./my-hook.sh
  echo $?  # 終了コードを確認
  ```
- 「command not found」が表示される場合は、絶対パスを使用するか、スクリプトを参照するために `${CLAUDE_PROJECT_DIR}` を使用します。シェルクォーティングを完全に回避するには、`"args": []` を追加して [exec form](/ja/hooks#exec-form-and-shell-form) に切り替えます。これはシェルなしでスクリプトを直接生成します
- 「jq: command not found」が表示される場合は、`jq` をインストールするか、JSON 解析に Python/Node.js を使用します
- スクリプトがまったく実行されていない場合は、実行可能にします：`chmod +x ./my-hook.sh`

### `/hooks` に設定された hooks が表示されない

設定ファイルを編集しましたが、hooks がメニューに表示されません。

- ファイル編集は通常自動的に取得されます。数秒後に表示されていない場合、ファイルウォッチャーが変更を見逃した可能性があります：セッションを再開して強制的にリロードします。
- JSON が有効であることを確認します（末尾のコンマとコメントは許可されていません）
- 設定ファイルが正しい場所にあることを確認します：プロジェクト hooks の場合は `.claude/settings.json`、グローバル hooks の場合は `~/.claude/settings.json`

### Stop hook がブロック上限に達する

Claude は無限ループで作業を続け、停止する代わりに、Stop hook が連続して 8 回ブロックしたという警告でターンを終了します。

Claude Code は Stop hook が進捗なしで 8 回連続でブロックした後、それをオーバーライドします。Hook スクリプトは、それが既にトリガーされたかどうかをチェックする必要があります。JSON 入力から `stop_hook_active` フィールドを解析し、`true` の場合は早期に終了します：

```bash
#!/bin/bash
INPUT=$(cat)
if [ "$(echo "$INPUT" | jq -r '.stop_hook_active')" = "true" ]; then
  exit 0  # Claude が停止することを許可
fi
# ... hook ロジックの残り
```

Hook が収束するために 8 回以上の反復が正当に必要な場合は、[`CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`](/ja/env-vars) で上限を引き上げます。

### JSON 検証に失敗しました

Claude Code は hook スクリプトが有効な JSON を出力しているにもかかわらず、JSON 解析エラーを表示します。

Claude Code がシェル形式のコマンド hook（`args` なし）を実行する場合、デフォルトで macOS と Linux では `sh -c` を、Windows では Git Bash を生成します。このシェルは非インタラクティブですが、Git Bash と一部の設定（`BASH_ENV` が `~/.bashrc` を指すなど）は依然としてプロファイルをソースします。そのプロファイルに無条件の `echo` ステートメントが含まれている場合、その出力は hook の JSON に前置されます：

```text
Shell ready on arm64
{"decision": "block", "reason": "Not allowed"}
```

Claude Code はこれを JSON として解析しようとして失敗します。これを修正するには、シェルプロファイルの echo ステートメントをラップして、インタラクティブシェルでのみ実行するようにします：

```bash
# ~/.zshrc または ~/.bashrc 内
if [[ $- == *i* ]]; then
  echo "Shell ready"
fi
```

`$-` 変数はシェルフラグを含み、`i` はインタラクティブを意味します。Hooks は非インタラクティブシェルで実行されるため、echo はスキップされます。

### デバッグ技術

トランスクリプトビュー（`Ctrl+O` で切り替え）は、発火した各 hook の 1 行のサマリーを表示します：成功は無音、ブロッキングエラーは stderr を表示し、非ブロッキングエラーは `<hook name> hook error` 通知を表示し、その後 stderr の最初の行が続きます。

完全な実行詳細（どの hooks がマッチしたか、それらの終了コード、stdout、stderr など）については、デバッグログを読みます。`claude --debug-file /tmp/claude.log` で Claude Code を開始して既知のパスに書き込み、別のターミナルで `tail -f /tmp/claude.log` を実行します。そのフラグなしで開始した場合は、セッション中に `/debug` を実行してログを有効にし、ログパスを見つけます。

## 詳細を学ぶ

- [Hooks リファレンス](/ja/hooks)：完全なイベントスキーマ、JSON 出力形式、非同期 hooks、および MCP ツール hooks
- [セキュリティに関する考慮事項](/ja/hooks#security-considerations)：共有または本番環境に hooks をデプロイする前に確認してください
- [Bash コマンドバリデーター例](https://github.com/anthropics/claude-code/blob/main/examples/hooks/bash_command_validator_example.py)：完全なリファレンス実装
