---
title: cli-reference
source: https://code.claude.com/docs/ja/cli-reference.md
---

# CLI リファレンス

> Claude Code コマンドラインインターフェースの完全なリファレンス。コマンドとフラグを含みます。

## CLI コマンド

これらのコマンドを使用して、セッションを開始し、コンテンツをパイプし、会話を再開し、更新を管理できます。

| コマンド | 説明 | 例 |
| :- | :- | :- |
| `claude` | インタラクティブセッションを開始 | `claude` |
| `claude "query"` | 初期プロンプト付きでインタラクティブセッションを開始 | `claude "explain this project"` |
| `claude -p "query"` | SDK 経由でクエリを実行してから終了 | `claude -p "explain this function"` |
| `cat file \| claude -p "query"` | パイプされたコンテンツを処理 | `cat logs.txt \| claude -p "explain"` |
| `claude -c` | 現在のディレクトリで最新の会話を続行 | `claude -c` |
| `claude -c -p "query"` | SDK 経由で続行 | `claude -c -p "Check for type errors"` |
| `claude -r "<session>" "query"` | セッション ID または名前でセッションを再開 | `claude -r "auth-refactor" "Finish this PR"` |
| `claude update` | 最新バージョンに更新 | `claude update` |
| `claude install [version]` | ネイティブバイナリをインストールまたは再インストールします。`2.1.118` のようなバージョン、または `stable` または `latest` を受け入れます。[特定のバージョンをインストール](/ja/setup#install-a-specific-version) を参照してください | `claude install stable` |
| `claude auth login` | Anthropic アカウントにサインインします。`--email` を使用してメールアドレスを事前入力し、`--sso` を使用して SSO 認証を強制し、`--console` を使用して Claude サブスクリプションの代わりに Anthropic Console で API 使用料金をサインインできます | `claude auth login --console` |
| `claude auth logout` | Anthropic アカウントからログアウト | `claude auth logout` |
| `claude auth status` | 認証ステータスを JSON として表示します。`--text` を使用して人間が読める形式で表示できます。ログイン済みの場合はコード 0 で終了し、ログインしていない場合は 1 で終了します | `claude auth status` |
| `claude agents` | [エージェントビュー](/ja/agent-view) を開いて、並列バックグラウンドセッションを監視およびディスパッチします。`--cwd <path>` を使用して、そのディレクトリの下で開始されたセッションのみを表示するか、`--json` を使用してライブセッションを JSON 配列として出力してスクリプト作成用にします。`--permission-mode`、`--model`、または `--effort` を渡して、[ディスパッチされたセッションのデフォルト](/ja/agent-view#permission-mode-model-and-effort) を設定します。トップレベルの `claude` コマンドと同様に `--settings`、`--add-dir`、`--plugin-dir`、および `--mcp-config` を受け入れます。エージェントビューを開くにはインタラクティブターミナルが必要です | `claude agents --json` |
| `claude attach <id>` | このターミナルで [バックグラウンドセッション](/ja/agent-view#manage-sessions-from-the-shell) に接続します | `claude attach 7c5dcf5d` |
| `claude auto-mode defaults` | 組み込み [auto mode](/ja/permission-modes#eliminate-prompts-with-auto-mode) 分類器ルールを JSON として出力します。`claude auto-mode config` を使用して、設定が適用された有効な設定を確認してください | `claude auto-mode defaults > rules.json` |
| `claude daemon status` | バックグラウンドセッション [スーパーバイザー](/ja/agent-view#the-supervisor-process) の状態、バージョン、ソケットディレクトリ、および診断用のワーカー数を出力します。スーパーバイザーが実行されていない場合は 1 で終了します | `claude daemon status` |
| `claude logs <id>` | [バックグラウンドセッション](/ja/agent-view#manage-sessions-from-the-shell) からの最近の出力を出力します | `claude logs 7c5dcf5d` |
| `claude mcp` | Model Context Protocol（MCP）サーバーを設定 | [Claude Code MCP ドキュメント](/ja/mcp) を参照してください。 |
| `claude plugin` | Claude Code [plugins](/ja/plugins) を管理します。エイリアス：`claude plugins`。サブコマンドについては [plugin reference](/ja/plugins-reference#cli-commands-reference) を参照してください | `claude plugin install code-review@claude-plugins-official` |
| `claude project purge [path]` | プロジェクトのすべてのローカル Claude Code 状態を削除します：トランスクリプト、タスクリスト、デバッグログ、ファイル編集履歴、プロンプト履歴行、および `~/.claude.json` 内のプロジェクトエントリ。`[path]` を省略して、インタラクティブリストから選択します。フラグ：`--dry-run` でプレビュー、`-y`/`--yes` で確認をスキップ、`-i`/`--interactive` で各項目を確認、`--all` ですべてのプロジェクト。[ローカルデータをクリア](/ja/claude-directory#clear-local-data) を参照してください | `claude project purge ~/work/repo --dry-run` |
| `claude remote-control` | [Remote Control](/ja/remote-control) サーバーを開始して、Claude.ai または Claude アプリから Claude Code を制御します。サーバーモード（ローカルインタラクティブセッションなし）で実行されます。[サーバーモードフラグ](/ja/remote-control#start-a-remote-control-session) を参照してください | `claude remote-control --name "My Project"` |
| `claude respawn <id>` | 会話を保持したまま、[バックグラウンドセッション](/ja/agent-view#manage-sessions-from-the-shell) を再開します。実行中または停止中。`--all` を使用してすべての実行中セッションを再開します。たとえば、更新された Claude Code バイナリを取得するため | `claude respawn 7c5dcf5d` |
| `claude rm <id>` | [バックグラウンドセッション](/ja/agent-view#manage-sessions-from-the-shell) をリストから削除します。会話トランスクリプトはローカルマシンに残り、`claude --resume` を通じて利用可能です | `claude rm 7c5dcf5d` |
| `claude setup-token` | CI とスクリプト用の長期間有効な OAuth トークンを生成します。ターミナルにトークンを出力し、保存しません。Claude サブスクリプションが必要です。[長期間有効なトークンを生成](/ja/authentication#generate-a-long-lived-token) を参照してください | `claude setup-token` |
| `claude stop <id>` | [バックグラウンドセッション](/ja/agent-view#manage-sessions-from-the-shell) を停止します。`claude kill` も受け入れます | `claude stop 7c5dcf5d` |
| `claude ultrareview [target]` | [ultrareview](/ja/ultrareview#run-ultrareview-non-interactively) を非対話的に実行します。結果を stdout に出力し、成功時は 0 で終了し、失敗時は 1 で終了します。`--json` を使用して生のペイロードを取得し、`--timeout <minutes>` を使用して 30 分のデフォルトをオーバーライドできます | `claude ultrareview 1234 --json` |

サブコマンドを誤入力した場合、Claude Code は最も近い一致を提案して、セッションを開始せずに終了します。たとえば、`claude udpate` は `Did you mean claude update?` と出力します。

## CLI フラグ

これらのコマンドラインフラグを使用して Claude Code の動作をカスタマイズします。`claude --help` はすべてのフラグをリストしていないため、`--help` にフラグが表示されていないことは、そのフラグが利用できないことを意味しません。

| フラグ | 説明 | 例 |
| :- | :- | :- |
| `--add-dir` | Claude がファイルを読み取り、編集するための追加の作業ディレクトリを追加します。ファイルアクセスを許可します。ほとんどの `.claude/` 設定は [これらのディレクトリから検出されません](/ja/permissions#additional-directories-grant-file-access-not-configuration)。各パスがディレクトリとして存在することを検証します。これらのディレクトリをセッション全体で永続化するには、設定で [`permissions.additionalDirectories`](/ja/settings#permission-settings) を設定してください | `claude --add-dir ../apps ../lib` |
| `--agent` | 現在のセッションのエージェントを指定します（`agent` 設定をオーバーライドします） | `claude --agent my-custom-agent` |
| `--agents` | JSON 経由でカスタム subagents を動的に定義します。subagent [frontmatter](/ja/sub-agents#supported-frontmatter-fields) と同じフィールド名を使用し、さらにエージェントの指示用の `prompt` フィールドを追加します | `claude --agents '{"reviewer":{"description":"Reviews code","prompt":"You are a code reviewer"}}'` |
| `--allow-dangerously-skip-permissions` | `Shift+Tab` モードサイクルに `bypassPermissions` を追加します。これを開始時に有効にしません。`plan` のような別のモードで開始し、後で `bypassPermissions` に切り替えることができます。[権限モード](/ja/permission-modes#skip-all-checks-with-bypasspermissions-mode) を参照してください | `claude --permission-mode plan --allow-dangerously-skip-permissions` |
| `--allowedTools` | 権限を求めずに実行するツール。パターンマッチングについては [権限ルール構文](/ja/settings#permission-rule-syntax) を参照してください。利用可能なツールを制限するには、代わりに `--tools` を使用してください | `"Bash(git log *)" "Bash(git diff *)" "Read"` |
| `--append-system-prompt` | デフォルトシステムプロンプトの末尾にカスタムテキストを追加します | `claude --append-system-prompt "Always use TypeScript"` |
| `--append-system-prompt-file` | ファイルから追加のシステムプロンプトテキストを読み込み、デフォルトプロンプトに追加します | `claude --append-system-prompt-file ./extra-rules.txt` |
| `--bare` | 最小限モード：hooks、skills、plugins、MCP サーバー、自動メモリ、CLAUDE.md の自動検出をスキップして、スクリプト化された呼び出しをより高速に開始します。Claude は Bash、ファイル読み取り、ファイル編集ツールにアクセスできます。[`CLAUDE_CODE_SIMPLE`](/ja/env-vars) を設定します。[bare mode](/ja/headless#start-faster-with-bare-mode) を参照してください | `claude --bare -p "query"` |
| `--betas` | API リクエストに含めるベータヘッダー（API キーユーザーのみ） | `claude --betas interleaved-thinking` |
| `--bg` | セッションを [バックグラウンドエージェント](/ja/agent-view) として開始し、すぐに戻ります。セッション ID と管理コマンドを出力します。`--agent` と組み合わせて特定の subagent を実行します | `claude --bg "investigate the flaky test"` |
| `--channels` | （研究プレビュー）Claude がこのセッションでリッスンすべき [channel](/ja/channels) 通知を持つ MCP サーバー。`plugin:<name>@<marketplace>` エントリのスペース区切りリスト。Claude.ai 認証が必要です | `claude --channels plugin:my-notifier@my-marketplace` |
| `--chrome` | Web 自動化とテストのための [Chrome ブラウザ統合](/ja/chrome) を有効にします | `claude --chrome` |
| `--continue`, `-c` | 現在のディレクトリで最新の会話を読み込みます。このディレクトリを `/add-dir` で追加したセッションを含みます | `claude --continue` |
| `--dangerously-load-development-channels` | 承認されたアローリストにない [channels](/ja/channels-reference#test-during-the-research-preview) をローカル開発用に有効にします。`plugin:<name>@<marketplace>` および `server:<name>` エントリを受け入れます。確認を求めます | `claude --dangerously-load-development-channels server:webhook` |
| `--dangerously-skip-permissions` | すべての権限プロンプトをスキップします。`--permission-mode bypassPermissions` と同等です。[権限モード](/ja/permission-modes#skip-all-checks-with-bypasspermissions-mode) を参照して、これが何をスキップし、何をスキップしないかを確認してください | `claude --dangerously-skip-permissions` |
| `--debug` | オプションのカテゴリフィルタリング付きでデバッグモードを有効にします（例：`"api,hooks"` または `"!statsig,!file"`） | `claude --debug "api,mcp"` |
| `--debug-file <path>` | デバッグログを特定のファイルパスに書き込みます。暗黙的にデバッグモードを有効にします。`CLAUDE_CODE_DEBUG_LOGS_DIR` より優先されます | `claude --debug-file /tmp/claude-debug.log` |
| `--disable-slash-commands` | このセッションのすべてのスキルとコマンドを無効にします | `claude --disable-slash-commands` |
| `--disallowedTools` | 拒否ルール。ベアツール名はそのツールをモデルのコンテキストから削除します。`Bash(rm *)` のようなスコープ付きルールはツールを利用可能なままにし、一致する呼び出しのみを拒否します | `"Bash(git log *)" "Bash(git diff *)" "Edit"` |
| `--effort` | 現在のセッションの [努力レベル](/ja/model-config#adjust-effort-level) を設定します。オプション：`low`、`medium`、`high`、`xhigh`、`max`。利用可能なレベルはモデルによって異なります。[`effortLevel`](/ja/settings#available-settings) 設定をこのセッションでオーバーライドし、永続化されません | `claude --effort high` |
| `--enable-auto-mode` | v2.1.111 で削除されました。Auto mode は現在 `Shift+Tab` サイクルにデフォルトで含まれています。`--permission-mode auto` を使用して開始してください | `claude --permission-mode auto` |
| `--exclude-dynamic-system-prompt-sections` | システムプロンプトからマシンごとのセクション（作業ディレクトリ、環境情報、メモリパス、git リポジトリフラグ）を最初のユーザーメッセージに移動します。異なるユーザーとマシンで同じタスクを実行する場合、prompt-cache の再利用を改善します。デフォルトシステムプロンプトにのみ適用されます。`--system-prompt` または `--system-prompt-file` が設定されている場合は無視されます。スクリプト化された複数ユーザーのワークロードの場合は `-p` と一緒に使用してください | `claude -p --exclude-dynamic-system-prompt-sections "query"` |
| `--fallback-model` | デフォルトモデルが過負荷の場合、指定されたモデルへの自動フォールバックを有効にします。プリントモード（`-p`）と [バックグラウンドセッション](/ja/agent-view) で有効になります。バックグラウンドセッションは非インタラクティブで実行されます。インタラクティブセッションでは無視されます | `claude -p --fallback-model sonnet "query"` |
| `--fork-session` | 再開時に、元のセッション ID を再利用する代わりに新しいセッション ID を作成します（`--resume` または `--continue` と一緒に使用） | `claude --resume abc123 --fork-session` |
| `--from-pr` | 特定のプルリクエストにリンクされたセッションを再開します。PR 番号、GitHub または GitHub Enterprise PR URL、GitLab マージリクエスト URL、または Bitbucket プルリクエスト URL を受け入れます。Claude がプルリクエストを作成するときに、セッションは自動的にリンクされます | `claude --from-pr 123` |
| `--ide` | 起動時に、正確に 1 つの有効な IDE が利用可能な場合、自動的に IDE に接続します | `claude --ide` |
| `--init` | セッション開始前に `init` マッチャーで [Setup hooks](/ja/hooks#setup) を実行します（プリントモードのみ） | `claude -p --init "query"` |
| `--init-only` | [Setup](/ja/hooks#setup) および `SessionStart` hooks を実行してから、会話を開始せずに終了します | `claude --init-only` |
| `--include-hook-events` | すべてのフックライフサイクルイベントを出力ストリームに含めます。`--output-format stream-json` が必要です | `claude -p --output-format stream-json --verbose --include-hook-events "query"` |
| `--include-partial-messages` | 部分的なストリーミングイベントを出力に含めます。`--print` と `--output-format stream-json` が必要です | `claude -p --output-format stream-json --verbose --include-partial-messages "query"` |
| `--input-format` | プリントモードの入力形式を指定します（オプション：`text`、`stream-json`） | `claude -p --output-format json --input-format stream-json` |
| `--json-schema` | エージェントがワークフローを完了した後、JSON Schema に一致する検証済み JSON 出力を取得します（プリントモードのみ。[構造化出力](/ja/agent-sdk/structured-outputs) を参照） | `claude -p --json-schema '{"type":"object","properties":{...}}' "query"` |
| `--maintenance` | セッション開始前に `maintenance` マッチャーで [Setup hooks](/ja/hooks#setup) を実行します（プリントモードのみ） | `claude -p --maintenance "query"` |
| `--max-budget-usd` | 停止する前に API 呼び出しに費やす最大ドル金額（プリントモードのみ） | `claude -p --max-budget-usd 5.00 "query"` |
| `--max-turns` | agentic ターンの数を制限します（プリントモードのみ）。制限に達するとエラーで終了します。デフォルトでは制限なし | `claude -p --max-turns 3 "query"` |
| `--mcp-config` | JSON ファイルまたは文字列から MCP サーバーを読み込みます（スペース区切り） | `claude --mcp-config ./mcp.json` |
| `--model` | 現在のセッションのモデルを、最新モデルのエイリアス（`sonnet` または `opus`）またはモデルの完全な名前で設定します。[`model`](/ja/settings#available-settings) 設定と [`ANTHROPIC_MODEL`](/ja/model-config#environment-variables) をオーバーライドします | `claude --model claude-sonnet-4-6` |
| `--name`, `-n` | セッションの表示名を設定します。`/resume` とターミナルタイトルに表示されます。`claude --resume <name>` で名前付きセッションを再開できます。[`/rename`](/ja/commands) はセッション中に名前を変更し、プロンプトバーにも表示します | `claude -n "my-feature-work"` |
| `--no-chrome` | このセッションの [Chrome ブラウザ統合](/ja/chrome) を無効にします | `claude --no-chrome` |
| `--no-session-persistence` | セッション永続化を無効にして、セッションがディスクに保存されず、再開できないようにします（プリントモードのみ）。[`CLAUDE_CODE_SKIP_PROMPT_HISTORY`](/ja/env-vars) 環境変数は任意のモードで同じことを行います | `claude -p --no-session-persistence "query"` |
| `--output-format` | プリントモードの出力形式を指定します（オプション：`text`、`json`、`stream-json`） | `claude -p "query" --output-format json` |
| `--permission-mode` | 指定された [権限モード](/ja/permission-modes) で開始します。`default`、`acceptEdits`、`plan`、`auto`、`dontAsk`、または `bypassPermissions` を受け入れます。設定ファイルの `defaultMode` をオーバーライドします | `claude --permission-mode plan` |
| `--permission-prompt-tool` | 非インタラクティブモードで権限プロンプトを処理する MCP ツールを指定します | `claude -p --permission-prompt-tool mcp_auth_tool "query"` |
| `--plugin-dir` | このセッションのみのプラグインをディレクトリまたは `.zip` アーカイブから読み込みます。各フラグは 1 つのパスを取ります。複数のプラグインの場合はフラグを繰り返します：`--plugin-dir A --plugin-dir B.zip` | `claude --plugin-dir ./my-plugin` |
| `--plugin-url` | このセッションのみのプラグイン `.zip` アーカイブを URL から取得します。複数のプラグインの場合はフラグを繰り返すか、スペース区切りの URL を単一の引用符で囲まれた値で渡します | `claude --plugin-url https://example.com/plugin.zip` |
| `--print`, `-p` | インタラクティブモードなしで応答を出力します（プログラムによる使用の詳細については [Agent SDK ドキュメント](/ja/agent-sdk/overview) を参照） | `claude -p "query"` |
| `--remote` | 提供されたタスク説明で claude.ai に新しい [Web セッション](/ja/claude-code-on-the-web) を作成します | `claude --remote "Fix the login bug"` |
| `--remote-control`, `--rc` | [Remote Control](/ja/remote-control#start-a-remote-control-session) を有効にしてインタラクティブセッションを開始し、claude.ai または Claude アプリからも制御できるようにします。オプションでセッションの名前を渡すことができます | `claude --remote-control "My Project"` |
| `--remote-control-session-name-prefix <prefix>` | 明示的な名前が設定されていない場合、自動生成される [Remote Control](/ja/remote-control) セッション名のプレフィックス。デフォルトはマシンのホスト名で、`myhost-graceful-unicorn` のような名前が生成されます。同じ効果を得るには `CLAUDE_REMOTE_CONTROL_SESSION_NAME_PREFIX` を設定してください | `claude remote-control --remote-control-session-name-prefix dev-box` |
| `--replay-user-messages` | stdin からのユーザーメッセージを stdout に再発行して確認します。`--input-format stream-json` と `--output-format stream-json` が必要です | `claude -p --input-format stream-json --output-format stream-json --verbose --replay-user-messages` |
| `--resume`, `-r` | ID または名前で特定のセッションを再開するか、セッションを選択するためのインタラクティブピッカーを表示します。このディレクトリを `/add-dir` で追加したセッションを含みます。v2.1.144 以降、[バックグラウンドセッション](/ja/agent-view) はピッカーに `bg` でマークされて表示されます | `claude --resume auth-refactor` |
| `--session-id` | 会話に特定のセッション ID を使用します（有効な UUID である必要があります） | `claude --session-id "550e8400-e29b-41d4-a716-446655440000"` |
| `--setting-sources` | 読み込む設定ソースのカンマ区切りリスト（`user`、`project`、`local`） | `claude --setting-sources user,project` |
| `--settings` | 設定 JSON ファイルまたはインライン JSON 文字列へのパス。ここで設定した値は、このセッションの `settings.json` ファイル内の同じキーをオーバーライドします。省略したキーはファイルベースの値を保持します。[設定の優先順位](/ja/settings#settings-precedence) を参照してください | `claude --settings ./settings.json` |
| `--strict-mcp-config` | `--mcp-config` からのみ MCP サーバーを使用し、他のすべての MCP 設定を無視します | `claude --strict-mcp-config --mcp-config ./mcp.json` |
| `--system-prompt` | デフォルトシステムプロンプト全体をカスタムテキストで置き換えます | `claude --system-prompt "You are a Python expert"` |
| `--system-prompt-file` | ファイルからシステムプロンプトを読み込み、デフォルトプロンプトを置き換えます | `claude --system-prompt-file ./custom-prompt.txt` |
| `--teleport` | [Web セッション](/ja/claude-code-on-the-web) をローカルターミナルで再開します | `claude --teleport` |
| `--teammate-mode` | [エージェントチーム](/ja/agent-teams) のチームメイトの表示方法を設定します：`auto`（デフォルト）、`in-process`、または `tmux`。このセッションの [`teammateMode`](/ja/settings#available-settings) 設定をオーバーライドします。[ディスプレイモードを選択](/ja/agent-teams#choose-a-display-mode) を参照してください | `claude --teammate-mode in-process` |
| `--tmux` | worktree 用に tmux セッションを作成します。`--worktree` が必要です。利用可能な場合は iTerm2 ネイティブペインを使用します。従来の tmux の場合は `--tmux=classic` を渡します | `claude -w feature-auth --tmux` |
| `--tools` | Claude が使用できる組み込みツールを制限します。`""` を使用してすべてを無効にし、`"default"` を使用してすべてを有効にするか、`"Bash,Edit,Read"` のようなツール名を使用します | `claude --tools "Bash,Edit,Read"` |
| `--verbose` | 詳細ログを有効にし、ターンごとの完全な出力を表示します。このセッションの [`viewMode`](/ja/settings#available-settings) 設定をオーバーライドします | `claude --verbose` |
| `--version`, `-v` | バージョン番号を出力します | `claude -v` |
| `--worktree`, `-w` | Claude を `<repo>/.claude/worktrees/<name>` の分離された [git worktree](/ja/worktrees) で開始します。名前が指定されていない場合は、自動生成されます。`#<number>` または GitHub プルリクエスト URL を渡して、`origin` からその PR をフェッチし、worktree をそこからブランチします | `claude -w feature-auth` |

### システムプロンプトフラグ

Claude Code は、システムプロンプトをカスタマイズするための 4 つのフラグを提供します。すべて 4 つはインタラクティブモードと非インタラクティブモードの両方で機能します。

| フラグ | 動作 | 例 |
| :- | :- | :- |
| `--system-prompt` | デフォルトプロンプト全体を置き換えます | `claude --system-prompt "You are a Python expert"` |
| `--system-prompt-file` | ファイルの内容で置き換えます | `claude --system-prompt-file ./prompts/review.txt` |
| `--append-system-prompt` | デフォルトプロンプトに追加します | `claude --append-system-prompt "Always use TypeScript"` |
| `--append-system-prompt-file` | ファイルの内容をデフォルトプロンプトに追加します | `claude --append-system-prompt-file ./style-rules.txt` |

`--system-prompt` と `--system-prompt-file` は相互に排他的です。追加フラグは、置き換えフラグのいずれかと組み合わせることができます。

Claude Code のデフォルトの ID がタスクに適合しているかどうかに基づいて選択してください。Claude が追加のルールも従うコーディングアシスタントのままである場合は、追加フラグを使用してください：呼び出しごとの指示、出力形式設定、または `-p` スクリプトのドメインコンテキスト。追加することで、デフォルトのツールガイダンス、安全指示、およびコーディング規約が保持されるため、異なる部分のみを提供します。システムプロンプトの表面、ID、または権限モデルが Claude Code のものと異なる場合は、置き換えフラグを使用してください。例えば、人間が監視していないパイプラインの非コーディングエージェント。置き換えることで、デフォルトプロンプト全体が削除されます。ツールガイダンスと安全指示を含めて、タスクがまだ必要とするものについて責任を負います。

これらのフラグは現在の呼び出しにのみ適用されます。プロジェクト全体で切り替えて共有できる永続的なペルソナについては、[出力スタイル](/ja/output-styles) を使用してください。Claude が常に従うべきプロジェクト規約については、[CLAUDE.md](/ja/memory) を使用してください。[Agent SDK ガイドのシステムプロンプト](/ja/agent-sdk/modifying-system-prompts#decide-on-a-starting-point) は、より詳細に同じ決定をカバーしています。

## 関連項目

- [Chrome 拡張機能](/ja/chrome) - ブラウザ自動化と Web テスト
- [インタラクティブモード](/ja/interactive-mode) - ショートカット、入力モード、インタラクティブ機能
- [クイックスタートガイド](/ja/quickstart) - Claude Code の開始方法
- [一般的なワークフロー](/ja/common-workflows) - 高度なワークフローとパターン
- [設定](/ja/settings) - 設定オプション
- [Agent SDK ドキュメント](/ja/agent-sdk/overview) - プログラムによる使用と統合
