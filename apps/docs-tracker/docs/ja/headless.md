---
title: headless
source: https://code.claude.com/docs/ja/headless.md
---

# Claude Code をプログラムで実行する

> Agent SDK を使用して、CLI、Python、または TypeScript からプログラムで Claude Code を実行します。

[Agent SDK](/docs/ja/agent-sdk/overview) は、Claude Code を支える同じツール、エージェントループ、およびコンテキスト管理を提供します。スクリプトと CI/CD 用の CLI として、または完全なプログラムによる制御のための [Python](/docs/ja/agent-sdk/python) および [TypeScript](/docs/ja/agent-sdk/typescript) パッケージとして利用できます。

Claude Code を非対話型モードで実行するには、プロンプトと任意の [CLI オプション](/docs/ja/cli-reference) を指定して `-p` を渡します。

```bash
claude -p "Find and fix the bug in auth.py" --allowedTools "Read,Edit,Bash"
```

このページでは、CLI（`claude -p`）経由で Agent SDK を使用することについて説明しています。構造化された出力、ツール承認コールバック、およびネイティブメッセージオブジェクトを備えた Python および TypeScript SDK パッケージについては、[完全な Agent SDK ドキュメント](/docs/ja/agent-sdk/overview) を参照してください。

基本的な使用方法

任意の `claude` コマンドに `-p`（または `--print`）フラグを追加して、非対話的に実行します。すべての [CLI オプション](/docs/ja/cli-reference) は `-p` で機能します。以下を含みます。

- `--continue` は [会話を続ける](#continue-conversations) 場合
- `--allowedTools` は [ツールを自動承認する](#auto-approve-tools) 場合
- `--output-format` は [構造化された出力を取得する](#get-structured-output) 場合

この例は、コードベースについて Claude に質問し、応答を出力します。

```bash
claude -p "What does the auth module do?"
```

ベアモードでより高速に開始する

`--bare` を追加して、hooks、skills、plugins、MCP サーバー、auto memory、および CLAUDE.md の自動検出をスキップすることで、起動時間を短縮します。これがない場合、`claude -p` は対話型セッションと同じ [コンテキスト](/docs/ja/how-claude-code-works#the-context-window) を読み込みます。これには、作業ディレクトリまたは `~/.claude` で設定されたすべてのものが含まれます。

ベアモードは、すべてのマシンで同じ結果が必要な CI とスクリプトに役立ちます。チームメイトの `~/.claude` のフック、またはプロジェクトの `.mcp.json` の MCP サーバーは実行されません。ベアモードはそれらを読み込まないためです。明示的に渡すフラグのみが有効になります。

この例は、ベアモードで 1 回限りの要約タスクを実行し、Read ツールを事前承認して、呼び出しが許可プロンプトなしで完了するようにします。

```bash
claude --bare -p "Summarize this file" --allowedTools "Read"
```

ベアモードでは、Claude は Bash、ファイル読み取り、およびファイル編集ツールにアクセスできます。フラグを使用して必要なコンテキストを渡します。

| 読み込むもの | 使用するもの |
| - | - |
| システムプロンプト追加 | `--append-system-prompt`、`--append-system-prompt-file` |
| 設定 | `--settings <file-or-json>` |
| MCP サーバー | `--mcp-config <file-or-json>` |
| カスタムエージェント | `--agents <json>` |
| プラグイン | `--plugin-dir <path>`、`--plugin-url <url>` |

ベアモードは OAuth とキーチェーン読み取りをスキップします。Anthropic 認証は `ANTHROPIC_API_KEY` または `--settings` に渡される JSON の `apiKeyHelper` から取得する必要があります。Amazon Bedrock、Google Cloud の Agent Platform、および Microsoft Foundry は通常のプロバイダー認証情報を使用します。

`--bare` はスクリプトおよび SDK 呼び出しの推奨モードであり、将来のリリースで `-p` のデフォルトになります。

終了時のバックグラウンドタスク

Claude が `claude -p` 実行中に [バックグラウンド Bash タスク](/docs/ja/tools-reference#bash-tool-behavior) を開始する場合（例えば、開発サーバーまたはウォッチビルド）、そのシェルは Claude が最終結果を返し、stdin が閉じられてから約 5 秒後に終了します。猶予期間により、結果の直後に終了するタスクでも出力を配信できます。v2.1.163 より前では、終了しないバックグラウンドプロセスは `claude -p` 呼び出しを無期限に開いたままにしていました。

バックグラウンド [サブエージェント](/docs/ja/sub-agents) とワークフローは、その結果が最終出力の一部であるため、5 秒の猶予期間から除外されます。そのため `claude -p` はそれらが完了するまで待機します。v2.1.182 から、その待機はデフォルトで 10 分に制限されているため、スタックしたバックグラウンドエージェントがプロセスを無期限に開いたままにすることはできません。[`CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS`](/docs/ja/env-vars) で上限を調整するか、`0` に設定して制限なく待機します。

例

これらの例は、一般的な CLI パターンを強調しています。CI およびその他のスクリプト呼び出しの場合は、[`--bare`](#start-faster-with-bare-mode) を追加して、ローカルで設定されているものを取得しないようにします。

Claude にデータをパイプする

非対話モードは stdin を読み取るため、他のコマンドラインツールと同様にデータをパイプして応答をリダイレクトできます。

この例は、ビルドログを Claude にパイプし、説明をファイルに書き込みます。

```bash
cat build-error.txt | claude -p 'concisely explain the root cause of this build error' > output.txt
```

`--output-format json` を使用すると、応答ペイロードに `total_cost_usd` とモデルごとのコスト内訳が含まれるため、スクリプト呼び出し元は [使用状況ダッシュボード](/docs/ja/costs) を参照せずに呼び出しごとの支出を追跡できます。

Claude Code v2.1.128 以降、パイプされた stdin は 10MB に制限されています。制限を超える場合、Claude Code は明確なエラーと 0 以外のステータスで終了します。より大きな入力を処理するには、コンテンツをファイルに書き込み、パイプする代わりにプロンプトでファイルパスを参照してください。

ビルドスクリプトに Claude を追加する

非対話呼び出しをスクリプトでラップして、Claude をプロジェクト固有のリンターまたはレビュアーとして使用できます。

この `package.json` スクリプトは、`main` に対する diff を Claude にパイプし、タイプミスを報告するよう要求します。diff をパイプすることで、Claude は読み取り権限を必要とせず、エスケープされたダブルクォートはスクリプトを Windows に対応させます。

```json
{
  "scripts": {
    "lint:claude": "git diff main | claude -p \"you are a typo linter. for each typo in this diff, report filename:line on one line and the issue on the next. return nothing else.\""
  }
}
```

構造化された出力を取得する

`--output-format` を使用して、応答がどのように返されるかを制御します。

- `text`（デフォルト）：プレーンテキスト出力
- `json`：結果、セッション ID、およびメタデータを含む構造化 JSON
- `stream-json`：リアルタイムストリーミング用の改行区切り JSON

この例は、セッションメタデータを含む JSON としてプロジェクト概要を返し、テキスト結果は `result` フィールドに含まれます。

```bash
claude -p "Summarize this project" --output-format json
```

特定のスキーマに準拠した出力を取得するには、`--output-format json` を `--json-schema` および [JSON Schema](https://json-schema.org/) 定義と共に使用します。応答には、リクエストに関するメタデータ（セッション ID、使用状況など）が含まれ、構造化された出力は `structured_output` フィールドに含まれます。

この例は、auth.py から関数名を抽出し、文字列の配列として返します。

```bash
claude -p "Extract the main function names from auth.py" \
  --output-format json \
  --json-schema '{"type":"object","properties":{"functions":{"type":"array","items":{"type":"string"}}},"required":["functions"]}'
```

値が有効な JSON Schema でない場合、`claude` は `Error: --json-schema is not a valid JSON Schema` で終了し、その後にバリデータの診断が続きます。Claude Code は `format` キーワード（例：`"format": "email"`）を使用するスキーマを受け入れますが、`format` を注釈として扱い、強制しません。v2.1.205 より前では、Claude Code は無効なスキーマを黙って無視し、構造化されていないテキストを返し、`format` を含むスキーマを無効として扱いました。

[jq](https://jqlang.github.io/jq/) などのツールを使用して応答を解析し、特定のフィールドを抽出します。

```bash theme={null}
# テキスト結果を抽出
claude -p "Summarize this project" --output-format json | jq -r '.result'

# 構造化された出力を抽出
claude -p "Extract function names from auth.py" \
  --output-format json \
  --json-schema '{"type":"object","properties":{"functions":{"type":"array","items":{"type":"string"}}},"required":["functions"]}' \
  | jq '.structured_output'
```

レスポンスをストリーミングする

`--output-format stream-json` を `--verbose` および `--include-partial-messages` と共に使用して、生成されるトークンをリアルタイムで受け取ります。各行はイベントを表す JSON オブジェクトです。

```bash
claude -p "Explain recursion" --output-format stream-json --verbose --include-partial-messages
```

ストリームの最後の行は、最終的な応答テキスト、コスト、およびセッションメタデータを含む `result` メッセージです。v2.1.208 より前では、大きな応答をパイプすると最後の行が切り詰められ、`result` メッセージが省略される可能性がありました。

次の例は、[jq](https://jqlang.github.io/jq/) を使用してテキストデルタをフィルタリングし、ストリーミングテキストのみを表示します。`-r` フラグは生の文字列を出力し（引用符なし）、`-j` は改行なしで結合するため、トークンは継続的にストリーミングされます。

```bash
claude -p "Write a poem" --output-format stream-json --verbose --include-partial-messages | \
  jq -rj 'select(.type == "stream_event" and .event.delta.type? == "text_delta") | .event.delta.text'
```

API リクエストが再試行可能なエラーで失敗すると、Claude Code は再試行前に `system/api_retry` イベントを発行します。これを使用して、再試行の進行状況を表示したり、カスタムバックオフロジックを実装したりできます。

| フィールド | 型 | 説明 |
| - | - | - |
| `type` | `"system"` | メッセージタイプ |
| `subtype` | `"api_retry"` | これが再試行イベントであることを識別します |
| `attempt` | 整数 | 現在の試行番号（1 から開始） |
| `max_retries` | 整数 | 許可される再試行の合計 |
| `retry_delay_ms` | 整数 | 次の試行までのミリ秒 |
| `error_status` | 整数または null | HTTP ステータスコード、または HTTP レスポンスのない接続エラーの場合は `null` |
| `error` | 文字列 | エラーカテゴリ：`authentication_failed`、`oauth_org_not_allowed`、`billing_error`、`rate_limit`、`overloaded`、`invalid_request`、`model_not_found`、`server_error`、`max_output_tokens`、または `unknown` |
| `uuid` | 文字列 | 一意のイベント識別子 |
| `session_id` | 文字列 | イベントが属するセッション |

`system/init` イベントは、モデル、ツール、MCP サーバー、および読み込まれたプラグインを含むセッションメタデータを報告します。これはスタートアップイベントが先行しない限り、ストリームの最初のイベントです。

- `plugin_install` イベント（[`CLAUDE_CODE_SYNC_PLUGIN_INSTALL`](/docs/ja/env-vars) が設定されている場合）。
- [`hook_started`、`hook_progress`、および `hook_response` イベント](/docs/ja/agent-sdk/typescript#sdkhookstartedmessage)（設定された [`SessionStart`](/docs/ja/hooks#sessionstart) または [`Setup`](/docs/ja/hooks#setup) フックが実行されている間）。これらはフックが生成するときにストリーミングされます。Claude Code v2.1.169 から v2.1.203 はフック完了後に 1 つのバッチで配信し、それでも `system/init` より前でしたが、v2.1.204 はライブ配信を復元しました。

イベントは、このバージョンの Claude Code が実装するプロトコル動作（例：`interrupt_receipt_v1`）の名前を付けるオプションの `capabilities` 文字列配列も含みます。バージョン文字列を比較する代わりに、機能検出に使用し、認識しない値は無視してください。このフィールドは Claude Code v2.1.205 以降が必要であり、以前のバージョンでは存在しません。機能リストについては、[`SDKSystemMessage`](/docs/ja/agent-sdk/typescript#sdksystemmessage) を参照してください。

プラグインフィールドを使用して、プラグインが読み込まれなかった場合に CI を失敗させます。

| フィールド | 型 | 説明 |
| - | - | - |
| `plugins` | 配列 | 正常に読み込まれたプラグイン。各プラグインは `name` と `path` を持ちます |
| `plugin_errors` | 配列 | プラグイン読み込み時エラー。各エラーは `plugin`、`type`、および `message` を持ちます。満たされていない依存関係バージョンおよび `--plugin-dir` 読み込み失敗（パスの欠落または無効なアーカイブなど）が含まれます。影響を受けたプラグインは降格され、`plugins` から削除されます。エラーがない場合、キーは省略されます |

[`CLAUDE_CODE_SYNC_PLUGIN_INSTALL`](/docs/ja/env-vars) が設定されている場合、Claude Code は最初のターンの前にマーケットプレイスプラグインがインストールされている間、`system/plugin_install` イベントを発行します。これらを使用して、独自の UI にインストール進行状況を表示します。

| フィールド | 型 | 説明 |
| - | - | - |
| `type` | `"system"` | メッセージタイプ |
| `subtype` | `"plugin_install"` | これがプラグインインストールイベントであることを識別します |
| `status` | `"started"`、`"installed"`、`"failed"`、または `"completed"` | `started` と `completed` は全体的なインストールを囲みます。`installed` と `failed` は個別のマーケットプレイスを報告します |
| `name` | 文字列（オプション） | マーケットプレイス名。`installed` と `failed` に存在します |
| `error` | 文字列（オプション） | 失敗メッセージ。`failed` に存在します |
| `uuid` | 文字列 | 一意のイベント識別子 |
| `session_id` | 文字列 | イベントが属するセッション |

コールバックとメッセージオブジェクトを使用したプログラムによるストリーミングについては、Agent SDK ドキュメントの [リアルタイムでレスポンスをストリーミングする](/docs/ja/agent-sdk/streaming-output) を参照してください。

ツールを自動承認する

`--allowedTools` を使用して、Claude が確認を求めずに特定のツールを使用できるようにします。この例はテストスイートを実行し、失敗を修正し、Claude が許可を求めずに Bash コマンドを実行し、ファイルを読み取り/編集できるようにします。

```bash
claude -p "Run the test suite and fix any failures" \
  --allowedTools "Bash,Read,Edit"
```

セッション全体のベースラインを設定する代わりに個別のツールをリストするには、[権限モード](/docs/ja/permission-modes) を渡します。`dontAsk` は `permissions.allow` ルールまたは [読み取り専用コマンドセット](/docs/ja/permissions#read-only-commands) にないものをすべて拒否します。これはロックダウンされた CI 実行に役立ちます。`AskUserQuestion`、組織が [`ask`](/docs/ja/mcp#organization-controls-on-connector-tools) に設定したコネクタツール、および [`requiresUserInteraction`](/docs/ja/mcp#require-approval-for-a-specific-tool) とマークされた MCP ツールは、許可ルールが一致する場合でも拒否されます。

`acceptEdits` を使用すると、Claude はプロンプトなしでファイルを書き込むことができ、`mkdir`、`touch`、`mv`、`cp` などの一般的なファイルシステムコマンドも自動承認します。その他のシェルコマンドとネットワークリクエストは、`--allowedTools` エントリまたは `permissions.allow` ルールが必要です。そうでない場合、実行が試みられると実行が中止されます。

```bash
claude -p "Apply the lint fixes" --permission-mode acceptEdits
```

コミットを作成する

この例は、ステージされた変更を確認し、適切なメッセージを含むコミットを作成します。

```bash
claude -p "Look at my staged changes and create an appropriate commit" \
  --allowedTools "Bash(git diff *),Bash(git log *),Bash(git status *),Bash(git commit *)"
```

`--allowedTools` フラグは [パーミッションルール構文](/docs/ja/settings#permission-rule-syntax) を使用します。末尾の ` *` はプレフィックスマッチングを有効にするため、`Bash(git diff *)` は `git diff` で始まるすべてのコマンドを許可します。スペースは重要です。スペースがない場合、`Bash(git diff*)` は `git diff-index` にも一致します。

ユーザーが呼び出した [skills](/docs/ja/skills) およびカスタムコマンドは `-p` モードで機能します。プロンプト文字列に `/skill-name` を含めると、Claude Code は実行前にそれを展開します。`/login` などの対話ダイアログを開く組み込みコマンドは、`-p` モードでは利用できません。`/model`、`/effort`、`/fast`、`/color`、および `/rename` は値を引数として受け入れます。例えば `/model sonnet` のように、`/mcp` は引数なしでサーバーステータスのテキスト概要を出力します。これらの形式は Claude Code v2.1.205 以降が必要であり、各コマンドの [利用可能性に関する注記](/docs/ja/commands#all-commands) に従います。`-p` 呼び出しから設定を変更するには、`/config` に `key=value` を渡します。例えば `/config thinking=false` です。

システムプロンプトをカスタマイズする

`--append-system-prompt` を使用して、Claude Code のデフォルト動作を保持しながら指示を追加します。この例は PR diff を Claude にパイプし、セキュリティ脆弱性をレビューするよう指示します。

```bash
gh pr diff "$1" | claude -p \
  --append-system-prompt "You are a security engineer. Review for vulnerabilities." \
  --output-format json
```

デフォルトプロンプトを完全に置き換える `--system-prompt` を含む詳細なオプションについては、[システムプロンプトフラグ](/docs/ja/cli-reference#system-prompt-flags) を参照してください。

会話を続ける

`--continue` を使用して最新の会話を続けるか、`--resume` をセッション ID と共に使用して特定の会話を続けます。この例はレビューを実行し、その後フォローアッププロンプトを送信します。

```bash
# 最初のリクエスト
claude -p "Review this codebase for performance issues"

# 最新の会話を続ける
claude -p "Now focus on the database queries" --continue
claude -p "Generate a summary of all issues found" --continue
```

複数の会話を実行している場合は、セッション ID をキャプチャして特定の会話を再開します。

```bash
session_id=$(claude -p "Start a review" --output-format json | jq -r '.session_id')
claude -p "Continue that review" --resume "$session_id"
```

同じディレクトリから両方のコマンドを実行します。セッション ID ルックアップは現在のプロジェクトディレクトリとその git worktrees にスコープされます。完全なスコープルールについては、[セッションを再開する](/docs/ja/sessions#resume-a-session) を参照してください。

次のステップ

- [Agent SDK クイックスタート](/docs/ja/agent-sdk/quickstart)：Python または TypeScript で最初のエージェントを構築します
- [CLI リファレンス](/docs/ja/cli-reference)：すべての CLI フラグとオプション
- [GitHub Actions](/docs/ja/github-actions)：GitHub ワークフローで Agent SDK を使用します
- [GitLab CI/CD](/docs/ja/gitlab-ci-cd)：GitLab パイプラインで Agent SDK を使用します
