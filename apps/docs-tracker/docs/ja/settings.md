---
title: settings
source: https://code.claude.com/docs/ja/settings.md
---

# Claude Code の設定

> Claude Code をグローバル設定とプロジェクトレベルの設定、および環境変数で構成します。

Claude Code は、ニーズに合わせて動作を構成するためのさまざまな設定を提供しています。インタラクティブ REPL を使用する際に `/config` コマンドを実行することで Claude Code を構成できます。これにより、ステータス情報を表示し、構成オプションを変更できるタブ付き設定インターフェースが開きます。

## 構成スコープ

Claude Code は、**スコープシステム**を使用して、構成がどこに適用され、誰と共有されるかを決定します。スコープを理解することで、個人使用、チーム協力、またはエンタープライズデプロイメント用に Claude Code を構成する方法を決定するのに役立ちます。

### 利用可能なスコープ

| スコープ | 場所 | 影響を受けるユーザー | チームと共有? |
| :- | :- | :- | :- |
| **Managed** | サーバー管理設定、plist / レジストリ、またはシステムレベルの `managed-settings.json` | マシン上のすべてのユーザー | はい（IT により展開） |
| **User** | `~/.claude/` ディレクトリ | すべてのプロジェクト全体でのあなた | いいえ |
| **Project** | リポジトリ内の `.claude/` | このリポジトリのすべてのコラボレーター | はい（git にコミット） |
| **Local** | `.claude/settings.local.json` | このリポジトリ内のあなたのみ | いいえ（gitignored） |

### 各スコープを使用する場合

**Managed スコープ**は以下の用途です：

- 組織全体で強制する必要があるセキュリティポリシー
- オーバーライドできないコンプライアンス要件
- IT/DevOps により展開される標準化された構成

**User スコープ**は以下の用途に最適です：

- すべての場所で必要な個人設定（テーマ、エディター設定）
- すべてのプロジェクト全体で使用するツールとプラグイン
- API キーと認証（安全に保存）

**Project スコープ**は以下の用途に最適です：

- チーム共有設定（権限、hooks、MCP サーバー）
- チーム全体が持つべきプラグイン
- コラボレーター全体でのツール標準化

**Local スコープ**は以下の用途に最適です：

- 特定のプロジェクトの個人的なオーバーライド
- チームと共有する前に構成をテストする
- 他のユーザーには機能しないマシン固有の設定

### スコープの相互作用

同じ設定が複数のスコープで構成されている場合、Claude Code は優先順位の順序でそれらを適用します：

1. **Managed**（最高） - 何によってもオーバーライドできない
2. **コマンドライン引数** - 一時的なセッションオーバーライド
3. **Local** - プロジェクトとユーザー設定をオーバーライド
4. **Project** - ユーザー設定をオーバーライド
5. **User**（最低） - 他に何も設定を指定しない場合に適用

たとえば、ユーザー設定で `spinnerTipsEnabled` が `true` に設定されており、プロジェクト設定で `false` に設定されている場合、プロジェクト値が適用されます。権限ルールはオーバーライドするのではなく、スコープ全体でマージされるため、異なる動作をします。[設定の優先順位](#settings-precedence)を参照してください。

### スコープを使用する機能

スコープは多くの Claude Code 機能に適用されます：

| 機能 | ユーザーの場所 | プロジェクトの場所 | ローカルの場所 |
| :- | :- | :- | :- |
| **Settings** | `~/.claude/settings.json` | `.claude/settings.json` | `.claude/settings.local.json` |
| **Subagents** | `~/.claude/agents/` | `.claude/agents/` | なし |
| **MCP servers** | `~/.claude.json` | `.mcp.json` | `~/.claude.json`（プロジェクトごと） |
| **Plugins** | `~/.claude/settings.json` | `.claude/settings.json` | `.claude/settings.local.json` |
| **CLAUDE.md** | `~/.claude/CLAUDE.md` | `CLAUDE.md` または `.claude/CLAUDE.md` | `CLAUDE.local.md` |

Windows では、`~/.claude` として表示されるパスは `%USERPROFILE%\.claude` に解決されます。

***

## 設定ファイル

`settings.json` ファイルは、階層的な設定を通じて Claude Code を構成するための公式メカニズムです：

- **ユーザー設定**は `~/.claude/settings.json` で定義され、すべてのプロジェクトに適用されます。
- **プロジェクト設定**はプロジェクトディレクトリに保存されます：
  - `.claude/settings.json` ソース管理にチェックインされ、チームと共有される設定用
  - `.claude/settings.local.json` チェックインされない設定用。個人設定と実験に役立ちます。Claude Code は作成時に `.claude/settings.local.json` を無視するように git を構成します。
- **Managed 設定**：集中管理が必要な組織向けに、Claude Code は managed 設定の複数の配信メカニズムをサポートしています。すべて同じ JSON 形式を使用し、ユーザー設定またはプロジェクト設定でオーバーライドできません：

  - **サーバー管理設定**：Anthropic のサーバーから Claude.ai 管理コンソール経由で配信されます。[サーバー管理設定](/ja/server-managed-settings)を参照してください。
  - **MDM/OS レベルのポリシー**：macOS と Windows のネイティブデバイス管理を通じて配信されます：
    - macOS：`com.anthropic.claudecode` managed preferences ドメイン。plist のトップレベルキーは `managed-settings.json` をミラーリングし、ネストされた設定は辞書として、配列は plist 配列として機能します。Jamf、Iru（Kandji）、または同様の MDM ツールの構成プロファイルを通じて展開します。
    - Windows：`HKLM\SOFTWARE\Policies\ClaudeCode` レジストリキーと JSON を含む `Settings` 値（REG\_SZ または REG\_EXPAND\_SZ）。グループポリシーまたは Intune を通じて展開します
    - Windows（ユーザーレベル）：`HKCU\SOFTWARE\Policies\ClaudeCode`（最低ポリシー優先度、管理者レベルのソースが存在しない場合のみ使用）
  - **ファイルベース**：`managed-settings.json` と `managed-mcp.json` をシステムディレクトリに展開：

    - macOS：`/Library/Application Support/ClaudeCode/`
    - Linux と WSL：`/etc/claude-code/`
    - Windows：`C:\Program Files\ClaudeCode\`

    レガシー Windows パス `C:\ProgramData\ClaudeCode\managed-settings.json` は v2.1.75 以降サポートされなくなりました。そのロケーションに設定を展開した管理者は、ファイルを `C:\Program Files\ClaudeCode\managed-settings.json` に移行する必要があります。

    ファイルベースの managed 設定は、`managed-settings.json` と同じシステムディレクトリ内の `managed-settings.d/` ドロップインディレクトリもサポートしています。これにより、別々のチームが単一ファイルの編集を調整することなく、独立したポリシーフラグメントを展開できます。

    systemd 規則に従い、`managed-settings.json` が最初にベースとしてマージされ、その後、ドロップインディレクトリ内のすべての `*.json` ファイルがアルファベット順にソートされてマージされます。スカラー値の場合、後のファイルが前のファイルをオーバーライドします。配列は連結され、重複排除されます。オブジェクトはディープマージされます。`.` で始まる隠しファイルは無視されます。

    マージ順序を制御するには、数値プレフィックスを使用します。たとえば、`10-telemetry.json` と `20-security.json` です。

  [managed 設定](/ja/permissions#managed-only-settings)と [Managed MCP 構成](/ja/mcp#managed-mcp-configuration)の詳細を参照してください。

  このリポジトリには、Jamf、Iru（Kandji）、Intune、およびグループポリシー用のスターターデプロイメントテンプレートが含まれています。これらを出発点として使用し、ニーズに合わせて調整してください。

  Managed デプロイメントは、`strictKnownMarketplaces` を使用して**プラグインマーケットプレイスの追加**を制限することもできます。詳細については、[Managed マーケットプレイス制限](/ja/plugin-marketplaces#managed-marketplace-restrictions)を参照してください。
- **その他の構成**は `~/.claude.json` に保存されます。このファイルには、OAuth セッション、[MCP サーバー](/ja/mcp)ユーザーおよびローカルスコープの構成、プロジェクトごとの状態（許可されたツール、信頼設定）、およびさまざまなキャッシュが含まれます。プロジェクトスコープの MCP サーバーは `.mcp.json` に別途保存されます。

Claude Code は構成ファイルのタイムスタンプ付きバックアップを自動的に作成し、データ損失を防ぐために最新の 5 つのバックアップを保持します。

```JSON Example settings.json theme={null}
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "permissions": {
    "allow": [
      "Bash(npm run lint)",
      "Bash(npm run test *)",
      "Read(~/.zshrc)"
    ],
    "deny": [
      "Bash(curl *)",
      "Read(./.env)",
      "Read(./.env.*)",
      "Read(./secrets/**)"
    ]
  },
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_METRICS_EXPORTER": "otlp"
  },
  "companyAnnouncements": [
    "Welcome to Acme Corp! Review our code guidelines at docs.acme.com",
    "Reminder: Code reviews required for all PRs",
    "New security policy in effect"
  ]
}
```

上記の例の `$schema` 行は、Claude Code 設定の[公式 JSON スキーマ](https://json.schemastore.org/claude-code-settings.json)を指しています。これを `settings.json` に追加すると、VS Code、Cursor、および JSON スキーマ検証をサポートする他のエディターでオートコンプリートとインライン検証が有効になります。

公開されたスキーマは定期的に更新され、最新の CLI リリースで追加された設定を含まない場合があるため、最近ドキュメント化されたフィールドの検証警告は、必ずしも構成が無効であることを意味しません。

### 利用可能な設定

`settings.json` は多くのオプションをサポートしています：

| キー | 説明 | 例 |
| :- | :- | :- |
| `agent` | メインスレッドを名前付き subagent として実行します。その subagent のシステムプロンプト、ツール制限、およびモデルを適用します。[subagents を明示的に呼び出す](/ja/sub-agents#invoke-subagents-explicitly)を参照してください | `"code-reviewer"` |
| `allowedChannelPlugins` | （Managed 設定のみ）メッセージをプッシュできるチャネルプラグインのホワイトリスト。設定されている場合、デフォルトの Anthropic ホワイトリストを置き換えます。未定義 = デフォルトにフォールバック、空配列 = すべてのチャネルプラグインをブロック。`channelsEnabled: true` が必要です。[チャネルプラグインが実行できるものを制限](/ja/channels#restrict-which-channel-plugins-can-run)を参照してください | `[{ "marketplace": "claude-plugins-official", "plugin": "telegram" }]` |
| `allowedHttpHookUrls` | HTTP hooks がターゲットにできる URL パターンのホワイトリスト。`*` をワイルドカードとしてサポートします。設定されている場合、一致しない URL を持つ hooks はブロックされます。未定義 = 制限なし、空配列 = すべての HTTP hooks をブロック。配列はすべての設定ソース全体でマージされます。[Hook 構成](#hook-configuration)を参照してください | `["https://hooks.example.com/*"]` |
| `allowedMcpServers` | managed-settings.json で設定されている場合、ユーザーが構成できる MCP サーバーのホワイトリスト。未定義 = 制限なし、空配列 = ロックダウン。すべてのスコープに適用されます。拒否リストが優先されます。[Managed MCP 構成](/ja/mcp#managed-mcp-configuration)を参照してください | `[{ "serverName": "github" }]` |
| `allowManagedHooksOnly` | （Managed 設定のみ）managed hooks、SDK hooks、および managed 設定 `enabledPlugins` で強制的に有効にされたプラグインからの hooks のみが読み込まれます。ユーザー、プロジェクト、およびその他すべてのプラグイン hooks はブロックされます。[Hook 構成](#hook-configuration)を参照してください | `true` |
| `allowManagedMcpServersOnly` | （Managed 設定のみ）managed 設定からの `allowedMcpServers` のみが尊重されます。`deniedMcpServers` はすべてのソースからマージされます。ユーザーは引き続き MCP サーバーを追加できますが、管理者定義のホワイトリストのみが適用されます。[Managed MCP 構成](/ja/mcp#managed-mcp-configuration)を参照してください | `true` |
| `allowManagedPermissionRulesOnly` | （Managed 設定のみ）ユーザーおよびプロジェクト設定が `allow`、`ask`、または `deny` 権限ルールを定義するのを防止します。managed 設定のルールのみが適用されます。[Managed のみの設定](/ja/permissions#managed-only-settings)を参照してください | `true` |
| `alwaysThinkingEnabled` | すべてのセッションに対してデフォルトで[拡張思考](/ja/model-config#extended-thinking)を有効にします。通常は直接編集するのではなく `/config` コマンドを通じて構成されます。思考を強制的にオフにするには、`env` で [`CLAUDE_CODE_DISABLE_THINKING`](/ja/env-vars)を設定します | `true` |
| `apiKeyHelper` | `/bin/sh` で実行される認証値を生成するカスタムスクリプト。この値は、モデルリクエストの `X-Api-Key` および `Authorization: Bearer` ヘッダーとして送信されます。[`CLAUDE_CODE_API_KEY_HELPER_TTL_MS`](/ja/env-vars)でリフレッシュ間隔を設定します | `/bin/generate_temp_api_key.sh` |
| `attribution` | git コミットとプルリクエストの属性をカスタマイズします。[属性設定](#attribution-settings)を参照してください | `{"commit": "🤖 Generated with Claude Code", "pr": ""}` |
| `autoMemoryDirectory` | [自動メモリ](/ja/memory#storage-location)ストレージ用のカスタムディレクトリ。絶対パスまたは `~/` プレフィックス付きパスを受け入れます。ポリシーおよびユーザー設定から、および `--settings` フラグから受け入れられます。クローンされたリポジトリがメモリ書き込みを機密の場所にリダイレクトするのを防ぐため、プロジェクトまたはローカル設定からは受け入れられません | `"~/my-memory-dir"` |
| `autoMemoryEnabled` | [自動メモリ](/ja/memory#enable-or-disable-auto-memory)を有効にします。`false` の場合、Claude は自動メモリディレクトリから読み込んだり、書き込んだりしません。デフォルト：`true`。セッション中に `/memory` でこれを切り替えることもできます。環境変数で無効にするには、`env` で [`CLAUDE_CODE_DISABLE_AUTO_MEMORY`](/ja/env-vars)を設定します | `false` |
| `autoMode` | [自動モード](/ja/permission-modes#eliminate-prompts-with-auto-mode)分類器がブロックおよび許可するものをカスタマイズします。`environment`、`allow`、`soft_deny`、および `hard_deny` 配列の散文ルールを含みます。リテラル文字列 `"$defaults"` を配列に含めて、その位置で組み込みルールを継承します。[自動モードを構成](/ja/auto-mode-config)を参照してください。共有プロジェクト設定から読み込まれません | `{"soft_deny": ["$defaults", "Never run terraform apply"]}` |
| `autoScrollEnabled` | [フルスクリーンレンダリング](/ja/fullscreen)で、新しい出力を会話の下部に追従します。デフォルト：`true`。`/config` に**自動スクロール**として表示されます。権限プロンプトはこれがオフの場合でもビューにスクロールします | `false` |
| `autoUpdatesChannel` | 更新に従うリリースチャネル。約 1 週間古いバージョンで、大きな回帰のあるバージョンをスキップする `"stable"` を使用するか、最新リリースの `"latest"`（デフォルト）を使用します。自動更新を完全に無効にするには、`env` で [`DISABLE_AUTOUPDATER`](/ja/setup#disable-auto-updates)を設定します | `"stable"` |
| `availableModels` | `/model`、`--model`、または `ANTHROPIC_MODEL` を通じてユーザーが選択できるモデルを制限します。デフォルトオプションには影響しません。[モデル選択を制限](/ja/model-config#restrict-model-selection)を参照してください | `["sonnet", "haiku"]` |
| `awaySummaryEnabled` | 数分間ターミナルから離れた後に戻ったときに、1 行のセッション要約を表示します。`false` に設定するか、`/config` でセッション要約をオフにして無効にします。[`CLAUDE_CODE_ENABLE_AWAY_SUMMARY`](/ja/env-vars)と同じです | `true` |
| `awsAuthRefresh` | `.aws` ディレクトリを変更するカスタムスクリプト（[高度な認証情報構成](/ja/amazon-bedrock#advanced-credential-configuration)を参照） | `aws sso login --profile myprofile` |
| `awsCredentialExport` | AWS 認証情報を含む JSON を出力するカスタムスクリプト（[高度な認証情報構成](/ja/amazon-bedrock#advanced-credential-configuration)を参照） | `/bin/generate_aws_grant.sh` |
| `blockedMarketplaces` | （Managed 設定のみ）マーケットプレイスソースのブロックリスト。マーケットプレイス追加時およびプラグインのインストール、更新、リフレッシュ、自動更新時に適用されるため、ポリシーが設定される前に追加されたマーケットプレイスは使用できません。ブロックされたソースはダウンロード前にチェックされるため、ファイルシステムに触れることはありません。[Managed マーケットプレイス制限](/ja/plugin-marketplaces#managed-marketplace-restrictions)を参照してください | `[{ "source": "github", "repo": "untrusted/plugins" }]` |
| `channelsEnabled` | （Managed 設定のみ）組織に対して[チャネル](/ja/channels)を許可します。Claude.ai Team および Enterprise プランでは、これが未設定または `false` の場合、チャネルはブロックされます。[Anthropic Console](/ja/authentication#claude-console-authentication)アカウントで API キー認証を使用している場合、チャネルはデフォルトで許可されます。ただし、組織が managed 設定をデプロイしている場合は、このキーを `true` に設定する必要があります | `true` |
| `claudeMd` | （Managed 設定のみ）CLAUDE.md スタイルの命令が組織管理メモリとして注入されます。managed またはポリシー設定で設定されている場合のみ尊重され、ユーザー、プロジェクト、およびローカル設定では無視されます。[組織全体の CLAUDE.md](/ja/memory#deploy-organization-wide-claude-md)を参照してください | `"Always run make lint before committing."` |
| `claudeMdExcludes` | [メモリ](/ja/memory)を読み込むときにスキップする `CLAUDE.md` ファイルの Glob パターンまたは絶対パス。パターンは絶対ファイルパスに対してマッチします。ユーザー、プロジェクト、およびローカルメモリのみに適用されます。managed ポリシーファイルは除外できません | `["**/vendor/**/CLAUDE.md"]` |
| `cleanupPeriodDays` | この期間より長く非アクティブなセッションは起動時に削除されます（デフォルト：30 日、最小 1）。`0` に設定するとバリデーションエラーで拒否されます。また、起動時に[孤立した subagent worktrees](/ja/worktrees#clean-up-worktrees)の自動削除の年齢カットオフも制御します。トランスクリプト書き込みを完全に無効にするには、[`CLAUDE_CODE_SKIP_PROMPT_HISTORY`](/ja/env-vars)環境変数を設定するか、非インタラクティブモード（`-p`）で `--no-session-persistence` フラグまたは `persistSession: false` SDK オプションを使用します。 | `20` |
| `companyAnnouncements` | 起動時にユーザーに表示するアナウンス。複数のアナウンスが提供される場合、ランダムにサイクルされます。 | `["Welcome to Acme Corp! Review our code guidelines at docs.acme.com"]` |
| `defaultShell` | 入力ボックス `!` コマンドのデフォルトシェル。`"bash"`（デフォルト）または `"powershell"` を受け入れます。`"powershell"` を設定すると、インタラクティブ `!` コマンドが Windows 上の PowerShell を通じてルーティングされます。`CLAUDE_CODE_USE_POWERSHELL_TOOL=1` が必要です。[PowerShell ツール](/ja/tools-reference#powershell-tool)を参照してください | `"powershell"` |
| `deniedMcpServers` | managed-settings.json で設定されている場合、明示的にブロックされた MCP サーバーの拒否リスト。managed サーバーを含むすべてのスコープに適用されます。拒否リストがホワイトリストよりも優先されます。[Managed MCP 構成](/ja/mcp#managed-mcp-configuration)を参照してください | `[{ "serverName": "filesystem" }]` |
| `disableAgentView` | [バックグラウンドエージェントとエージェントビュー](/ja/agent-view)をオフにするために `true` に設定します：`claude agents`、`--bg`、`/background`、およびオンデマンドスーパーバイザー。通常は [managed 設定](/ja/permissions#managed-settings)で設定されます。`CLAUDE_CODE_DISABLE_AGENT_VIEW` を `1` に設定するのと同等です | `true` |
| `disableAllHooks` | すべての [hooks](/ja/hooks) とカスタム [ステータスライン](/ja/statusline)を無効にします | `true` |
| `disableAutoMode` | [自動モード](/ja/permission-modes#eliminate-prompts-with-auto-mode)の有効化を防ぐために `"disable"` に設定します。`Shift+Tab` サイクルから `auto` を削除し、起動時に `--permission-mode auto` を拒否します。[managed 設定](/ja/permissions#managed-settings)で最も役立ちます。ユーザーはこれをオーバーライドできません | `"disable"` |
| `disableDeepLinkRegistration` | Claude Code が起動時にオペレーティングシステムで `claude-cli://` プロトコルハンドラーを登録するのを防ぐために `"disable"` に設定します。[ディープリンク](/ja/deep-links)を使用すると、外部ツールは事前入力されたプロンプトで Claude Code セッションを開くことができます。プロトコルハンドラー登録が制限されているか、別途管理されている環境で役立ちます | `"disable"` |
| `disabledMcpjsonServers` | `.mcp.json` ファイルから拒否する特定の MCP サーバーのリスト | `["filesystem"]` |
| `disableRemoteControl` | [リモートコントロール](/ja/remote-control)を無効にします：`claude remote-control`、`--remote-control` フラグ、自動開始、およびセッション内トグルをブロックします。通常は [managed 設定](/ja/permissions#managed-settings)に配置されます。デバイスごとの MDM 強制用ですが、任意のスコープから機能します。Claude Code v2.1.128 以降が必要です | `true` |
| `disableSkillShellExecution` | [skills](/ja/skills) およびユーザー、プロジェクト、プラグイン、または追加ディレクトリソースからのカスタムコマンド内の `` !`...` `` および ` ```! ` ブロックのインラインシェル実行を無効にします。コマンドは実行される代わりに `[shell command execution disabled by policy]` に置き換えられます。バンドルされた skills および managed skills は影響を受けません。[managed 設定](/ja/permissions#managed-settings)で最も役立ちます。ユーザーはこれをオーバーライドできません | `true` |
| `editorMode` | 入力プロンプトのキーバインディングモード：`"normal"` または `"vim"`。デフォルト：`"normal"`。`/config` に**エディターモード**として表示されます | `"vim"` |
| `effortLevel` | [努力レベル](/ja/model-config#adjust-effort-level)をセッション全体で永続化します。`"low"`、`"medium"`、`"high"`、または `"xhigh"` を受け入れます。これらの値のいずれかで `/effort` を実行すると自動的に書き込まれます。`--effort` と [`CLAUDE_CODE_EFFORT_LEVEL`](/ja/env-vars)はこれを 1 セッション間オーバーライドします。[努力レベルを調整](/ja/model-config#adjust-effort-level)でサポートされているモデルを参照してください | `"xhigh"` |
| `enableAllProjectMcpServers` | プロジェクト `.mcp.json` ファイルで定義されたすべての MCP サーバーを自動的に承認します | `true` |
| `enabledMcpjsonServers` | `.mcp.json` ファイルから承認する特定の MCP サーバーのリスト | `["memory", "github"]` |
| `env` | すべてのセッションに適用される環境変数。v2.1.143 以降、`NO_COLOR` と `FORCE_COLOR` がここで設定されている場合、サブプロセスに渡されますが、Claude Code 自体のインターフェイスの色は変更されません。インターフェイスの色を変更するには、`claude` を起動する前にシェルでこれらを設定します | `{"FOO": "bar"}` |
| `fastModePerSessionOptIn` | `true` の場合、高速モードはセッション全体で永続化されません。各セッションは高速モードがオフで開始され、ユーザーが `/fast` で有効にする必要があります。ユーザーの高速モード設定は引き続き保存されます。[セッションごとのオプトインを要求](/ja/fast-mode#require-per-session-opt-in)を参照してください | `true` |
| `feedbackSurveyRate` | [セッション品質調査](/ja/data-usage#session-quality-surveys)が適格な場合に表示される確率（0～1）。完全に抑制するには `0` に設定するか、`env` で [`CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY`](/ja/env-vars)を設定します。Bedrock、Vertex、または Foundry を使用する場合に役立ちます。デフォルトのサンプルレートは適用されません | `0.05` |
| `fileSuggestion` | `@` ファイルオートコンプリート用のカスタムスクリプトを構成します。[ファイル提案設定](#file-suggestion-settings)を参照してください | `{"type": "command", "command": "~/.claude/file-suggestion.sh"}` |
| `forceLoginMethod` | `claudeai` を使用して Claude.ai アカウントへのログインを制限するか、`console` を使用して Claude Console（API 使用量請求）アカウントへのログインを制限します | `claudeai` |
| `forceLoginOrgUUID` | ログインが特定の組織に属することを要求します。単一の UUID 文字列を受け入れます。これはログイン中にその組織を自動的に事前選択するか、リストされた組織のいずれかが受け入れられる UUID の配列を受け入れます。事前選択なし。managed 設定で設定されている場合、認証されたアカウントがリストされた組織に属していない場合、ログインは失敗します。空配列は失敗して閉じられ、ログインを設定ミスメッセージでブロックします | `"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"` または `["xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy"]` |
| `forceRemoteSettingsRefresh` | （Managed 設定のみ）リモート managed 設定がサーバーから新しく取得されるまで CLI スタートアップをブロックします。フェッチが失敗した場合、キャッシュされた設定または設定なしで続行するのではなく、CLI は終了します。設定されていない場合、スタートアップはリモート設定を待たずに続行します。[fail-closed 強制](/ja/server-managed-settings#enforce-fail-closed-startup)を参照してください | `true` |
| `gcpAuthRefresh` | GCP Application Default Credentials が期限切れになったか読み込めない場合にリフレッシュするカスタムスクリプト。[高度な認証情報構成](/ja/google-vertex-ai#advanced-credential-configuration)を参照してください | `gcloud auth application-default login` |
| `hooks` | ライフサイクルイベントで実行するカスタムコマンドを構成します。形式については [hooks ドキュメント](/ja/hooks)を参照してください | [hooks](/ja/hooks)を参照 |
| `httpHookAllowedEnvVars` | HTTP hooks がヘッダーに補間できる環境変数名のホワイトリスト。設定されている場合、各 hook の有効な `allowedEnvVars` はこのリストとの交差です。未定義 = 制限なし。配列はすべての設定ソース全体でマージされます。[Hook 構成](#hook-configuration)を参照してください | `["MY_TOKEN", "HOOK_SECRET"]` |
| `includeCoAuthoredBy` | **非推奨**：代わりに `attribution` を使用してください。git コミットとプルリクエストに `co-authored-by Claude` バイラインを含めるかどうか（デフォルト：`true`） | `false` |
| `includeGitInstructions` | Claude のシステムプロンプトに組み込みコミットおよび PR ワークフロー命令と git ステータススナップショットを含めます（デフォルト：`true`）。たとえば、独自の git ワークフロースキルを使用する場合は、これらの命令を削除するために `false` に設定します。`CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` 環境変数が設定されている場合、この設定よりも優先されます | `false` |
| `language` | Claude の優先応答言語を構成します（例：`"japanese"`、`"spanish"`、`"french"`）。Claude はデフォルトでこの言語で応答します。また、[音声ディクテーション](/ja/voice-dictation#change-the-dictation-language)言語も設定します | `"japanese"` |
| `maxSkillDescriptionChars` | [スキルリスティング](/ja/skills#skill-descriptions-are-cut-short)Claude が各ターンで見る `description` と `when_to_use` テキストの結合されたスキルごとの文字上限（デフォルト：`1536`）。この長さより長いテキストは切り詰められます。長い説明を保持するために上げるか、より多くのスキルを [`skillListingBudgetFraction`](#available-settings)の下に収めるために下げます。Claude Code v2.1.105 以降が必要です | `2048` |
| `minimumVersion` | 背景自動更新と `claude update` が特定のバージョン以下にインストールするのを防止するフロア。`"latest"` チャネルから `"stable"` に `/config` を通じて切り替えると、現在のバージョンに留まるか、ダウングレードを許可するかを求めるプロンプトが表示されます。留まることを選択すると、この値が設定されます。また、[managed 設定](/ja/permissions#managed-settings)で組織全体の最小値をピンするのに役立ちます | `"2.1.100"` |
| `model` | Claude Code に使用するデフォルトモデルをオーバーライドします。`--model` と [`ANTHROPIC_MODEL`](/ja/model-config#environment-variables)はこれを 1 セッション間オーバーライドします | `"claude-sonnet-4-6"` |
| `modelOverrides` | Anthropic モデル ID を Bedrock 推論プロファイル ARN などのプロバイダー固有のモデル ID にマップします。各モデルピッカーエントリは、プロバイダー API を呼び出すときにマップされた値を使用します。[バージョンごとにモデル ID をオーバーライド](/ja/model-config#override-model-ids-per-version)を参照してください | `{"claude-opus-4-6": "arn:aws:bedrock:..."}` |
| `otelHeadersHelper` | 動的 OpenTelemetry ヘッダーを生成するスクリプト。起動時および定期的に実行されます。[`CLAUDE_CODE_OTEL_HEADERS_HELPER_DEBOUNCE_MS`](/ja/env-vars)でリフレッシュ間隔を設定します。[動的ヘッダー](/ja/monitoring-usage#dynamic-headers)を参照してください | `/bin/generate_otel_headers.sh` |
| `outputStyle` | システムプロンプトを調整するための出力スタイルを構成します。[出力スタイルドキュメント](/ja/output-styles)を参照してください | `"Explanatory"` |
| `parentSettingsBehavior` | （Managed 設定のみ）Agent SDK または IDE 拡張機能などの埋め込みホストプロセスによってプログラム的に提供される managed 設定が、管理者デプロイ済みの managed ティアも存在する場合に適用されるかどうかを制御します。`"first-wins"`：親提供の設定は削除され、管理者ティアのみが適用されます。`"merge"`：親提供の設定は管理者ティアの下で適用され、ポリシーを厳しくできるが緩くできないようにフィルタリングされます。管理者ティアがデプロイされていない場合は効果がありません。デフォルト：`"first-wins"`。Claude Code v2.1.133 以降が必要です | `"merge"` |
| `permissions` | 権限の構造については、以下の表を参照してください。 | |
| `plansDirectory` | プランファイルが保存される場所をカスタマイズします。パスはプロジェクトルートに相対的です。デフォルト：`~/.claude/plans` | `"./plans"` |
| `pluginTrustMessage` | （Managed 設定のみ）インストール前に表示されるプラグイン信頼警告に追加されるカスタムメッセージ。これを使用して、組織固有のコンテキストを追加します。たとえば、内部マーケットプレイスからのプラグインが検証されていることを確認します。 | `"All plugins from our marketplace are approved by IT"` |
| `policyHelper` | 起動時に managed 設定を動的に計算する管理者デプロイ済みの実行可能ファイル。MDM またはシステム `managed-settings.json` ファイルからのみ尊重されます。[ポリシーヘルパーで managed 設定を計算](#compute-managed-settings-with-a-policy-helper)を参照してください。Claude Code v2.1.136 以降が必要です | `{"path": "/usr/local/bin/claude-policy"}` |
| `preferredNotifChannel` | タスク完了および権限プロンプト通知の方法：`"auto"`、`"terminal_bell"`、`"iterm2"`、`"iterm2_with_bell"`、`"kitty"`、`"ghostty"`、または `"notifications_disabled"`。デフォルト：`"auto"`。iTerm2、Ghostty、Kitty ではデスクトップ通知を送信し、他のターミナルでは何もしません。任意のターミナルでベル文字を鳴らすには `"terminal_bell"` を設定します。`/config` に**通知**として表示されます。[ターミナルベルまたは通知を取得](/ja/terminal-config#get-a-terminal-bell-or-notification)を参照してください | `"terminal_bell"` |
| `prefersReducedMotion` | アクセシビリティのために UI アニメーション（スピナー、シマー、フラッシュエフェクト）を削減または無効にします | `true` |
| `prUrlTemplate` | フッターおよびツール結果サマリーに表示される PR バッジの URL テンプレート。`gh` レポートされた PR URL から `{host}`、`{owner}`、`{repo}`、`{number}`、および `{url}` を置き換えます。PR リンクを `github.com` の代わりに内部コードレビューツールにポイントするために使用します。Claude の散文の `#123` オートリンクには影響しません | `"https://reviews.example.com/{owner}/{repo}/pull/{number}"` |
| `respectGitignore` | `@` ファイルピッカーが `.gitignore` パターンを尊重するかどうかを制御します。`true`（デフォルト）の場合、`.gitignore` パターンに一致するファイルは提案から除外されます | `false` |
| `showClearContextOnPlanAccept` | プラン受け入れ画面に「コンテキストをクリア」オプションを表示します。デフォルトは `false` です。`true` に設定してオプションを復元します | `true` |
| `showThinkingSummaries` | [拡張思考](/ja/model-config#extended-thinking)サマリーをインタラクティブセッションに表示します。未設定または `false`（インタラクティブモードのデフォルト）の場合、思考ブロックは API によって編集され、折りたたまれたスタブとして表示されます。編集は表示内容のみを変更し、モデルが生成するものは変更しません：思考支出を削減するには、[予算を低下させるか思考を無効にする](/ja/model-config#extended-thinking)代わりに。この設定は非インタラクティブモード（`-p`）、Agent SDK、または VS Code などの IDE 拡張機能には影響しません | `true` |
| `showTurnDuration` | レスポンス後のターン期間メッセージを表示します（例：「Cooked for 1m 6s」）。デフォルト：`true`。`/config` に**ターン期間を表示**として表示されます | `false` |
| `skillListingBudgetFraction` | [スキルリスティング](/ja/skills#skill-descriptions-are-cut-short)Claude が各ターンで見るモデルのコンテキストウィンドウ用に予約されたフラクション（デフォルト：`0.01` = 1%）。リスティングが予算を超える場合、最も使用頻度の低いスキルの説明は、Claude が引き続き呼び出すことができるが理由を見ることができないように、ベアネームに折りたたまれます。より多くの説明を表示するために上げるか、より多くのスキルを収めるために下げます。`/doctor` は現在の切り詰めカウントと影響を受けるスキルを表示します。Claude Code v2.1.105 以降が必要です | `0.02` |
| `skillOverrides` | スキル名でキー付けされたスキルごとの可視性オーバーライド。値は `"on"`、`"name-only"`、`"user-invocable-only"`、または `"off"` です。スキルの SKILL.md を編集することなく、スキルを非表示または折りたたむことができます。プラグインスキルには適用されません。これらは `/plugin` を通じて管理されます。`/skills` メニューはこれらを `.claude/settings.local.json` に書き込みます。[設定からスキルの可視性をオーバーライド](/ja/skills#override-skill-visibility-from-settings)を参照してください。Claude Code v2.1.129 以降が必要です | `{"legacy-context": "name-only", "deploy": "off"}` |
| `skipWebFetchPreflight` | [WebFetch ドメイン安全チェック](/ja/data-usage#webfetch-domain-safety-check)をスキップします。このチェックは、フェッチ前に各リクエストされたホスト名を `api.anthropic.com` に送信します。Bedrock、Vertex AI、または制限的な出力を持つ Foundry デプロイメントなど、Anthropic へのトラフィックをブロックする環境で `true` に設定します。スキップされた場合、WebFetch はブロックリストを参照せずに任意の URL を試みます | `true` |
| `spinnerTipsEnabled` | Claude が作業中にスピナーにヒントを表示します。ヒントを無効にするには `false` に設定します（デフォルト：`true`） | `false` |
| `spinnerTipsOverride` | スピナーヒントをカスタム文字列でオーバーライドします。`tips`：ヒント文字列の配列。`excludeDefault`：`true` の場合、カスタムヒントのみを表示します。`false` または不在の場合、カスタムヒントは組み込みヒントとマージされます | `{ "excludeDefault": true, "tips": ["Use our internal tool X"] }` |
| `spinnerVerbs` | スピナーに表示されるアクション動詞をカスタマイズします。`mode` を `"replace"` に設定して動詞のみを使用するか、`"append"` に設定してデフォルトに追加します | `{"mode": "append", "verbs": ["Pondering", "Crafting"]}` |
| `sshConfigs` | [Desktop](/ja/desktop#pre-configure-ssh-connections-for-your-team)環境ドロップダウンに表示する SSH 接続。各エントリには `id`、`name`、および `sshHost` が必要です。`sshPort`、`sshIdentityFile`、および `startDirectory` はオプションです。managed 設定で設定されている場合、接続はユーザーに対して読み取り専用です。managed およびユーザー設定からのみ読み込まれます | `[{"id": "dev-vm", "name": "Dev VM", "sshHost": "user@dev.example.com"}]` |
| `statusLine` | コンテキストを表示するカスタムステータスラインを構成します。[`statusLine` ドキュメント](/ja/statusline)を参照してください | `{"type": "command", "command": "~/.claude/statusline.sh"}` |
| `strictKnownMarketplaces` | （Managed 設定のみ）プラグインマーケットプレイスソースのホワイトリスト。未定義 = 制限なし、空配列 = ロックダウン。マーケットプレイス追加時およびプラグインのインストール、更新、リフレッシュ、自動更新時に適用されるため、ポリシーが設定される前に追加されたマーケットプレイスは使用できません。[Managed マーケットプレイス制限](/ja/plugin-marketplaces#managed-marketplace-restrictions)を参照してください | `[{ "source": "github", "repo": "acme-corp/plugins" }]` |
| `syntaxHighlightingDisabled` | diff、コードブロック、ファイルプレビューの構文強調表示を無効にします | `true` |
| `teammateMode` | [エージェントチーム](/ja/agent-teams)チームメイトの表示方法：`auto`（tmux または iTerm2 で分割ペインを選択、それ以外の場合はインプロセス）、`in-process`、または `tmux`。`--teammate-mode` はこれを 1 セッション間オーバーライドします。[表示モードを選択](/ja/agent-teams#choose-a-display-mode)を参照してください | `"in-process"` |
| `terminalProgressBarEnabled` | サポートされているターミナルでターミナル進行状況バーを表示します：ConEmu、Ghostty 1.2.0 以降、および iTerm2 3.6.6 以降。デフォルト：`true`。`/config` に**ターミナル進行状況バー**として表示されます | `false` |
| `tui` | ターミナル UI レンダラー。フリッカーのない[alt-screen レンダラー](/ja/fullscreen)を備えた仮想スクロールバック用に `"fullscreen"` を使用します。クラシックメインスクリーンレンダラー用に `"default"` を使用します。`/tui` で設定します。[`CLAUDE_CODE_NO_FLICKER`](/ja/env-vars)環境変数を設定することもできます | `"fullscreen"` |
| `useAutoModeDuringPlan` | プラン モードが自動モードが利用可能な場合に自動モードセマンティクスを使用するかどうか。デフォルト：`true`。共有プロジェクト設定から読み込まれません。`/config` に「プラン中に自動モードを使用」として表示されます | `false` |
| `viewMode` | 起動時のデフォルトトランスクリプトビューモード：`"default"`、`"verbose"`、または `"focus"`。設定されている場合、スティッキー `/focus` 選択をオーバーライドします。`--verbose` フラグはこれを 1 セッション間オーバーライドします | `"verbose"` |
| `voice` | [音声ディクテーション](/ja/voice-dictation)設定：`enabled` はディクテーションをオンにし、`mode` は `"hold"` または `"tap"` を選択し、`autoSubmit` はホールドモードでキーリリース時にプロンプトを送信します。`/voice` を実行すると自動的に書き込まれます。Claude.ai アカウントが必要です | `{ "enabled": true, "mode": "tap" }` |
| `voiceEnabled` | `voice.enabled` のレガシーエイリアス。`voice` オブジェクトを優先します | `true` |
| `wslInheritsWindowsSettings` | （Windows managed 設定のみ）`true` の場合、WSL 上の Claude Code は `/etc/claude-code` に加えて Windows ポリシーチェーンから managed 設定を読み込み、Windows ソースが優先されます。HKLM レジストリキーまたは `C:\Program Files\ClaudeCode\managed-settings.json` で設定されている場合のみ尊重されます。どちらも Windows 管理者が書き込む必要があります。HKCU ポリシーが WSL でも適用されるようにするには、フラグを HKCU 自体にも設定する必要があります。ネイティブ Windows には影響しません | `true` |

### グローバル構成設定

これらの設定は `settings.json` ではなく `~/.claude.json` に保存されます。これらを `settings.json` に追加すると、スキーマ検証エラーがトリガーされます。

v2.1.119 より前のバージョンでは、`autoScrollEnabled`、`editorMode`、`showTurnDuration`、`teammateMode`、および `terminalProgressBarEnabled` も `settings.json` ではなくここに保存されます。

| キー | 説明 | 例 |
| :- | :- | :- |
| `autoConnectIde` | Claude Code が外部ターミナルから起動するときに、実行中の IDE に自動的に接続します。デフォルト：`false`。VS Code または JetBrains ターミナルの外で実行する場合、`/config` に\*\*IDE に自動接続（外部ターミナル）\*\*として表示されます。[`CLAUDE_CODE_AUTO_CONNECT_IDE`](/ja/env-vars)環境変数が設定されている場合、これをオーバーライドします | `true` |
| `autoInstallIdeExtension` | VS Code ターミナルから実行するときに Claude Code IDE 拡張機能を自動的にインストールします。デフォルト：`true`。VS Code または JetBrains ターミナル内で実行する場合、`/config` に**IDE 拡張機能を自動インストール**として表示されます。[`CLAUDE_CODE_IDE_SKIP_AUTO_INSTALL`](/ja/env-vars)環境変数を設定することもできます | `false` |
| `externalEditorContext` | `Ctrl+G` で外部エディターを開くときに Claude の前の応答を `#` コメント付きコンテキストとして先頭に追加します。デフォルト：`false`。`/config` に**外部エディターに最後の応答を表示**として表示されます | `true` |
| `teammateDefaultModel` | [エージェントチーム](/ja/agent-teams)チームメイトのデフォルトモデル。spawn プロンプトが指定しない場合。`"sonnet"` などのモデルエイリアスに設定するか、リーダーの現在の `/model` 選択を継承するために `null` に設定します。`/config` に**デフォルトチームメイトモデル**として表示されます | `"sonnet"` |

### Worktree 設定

`--worktree` が git worktrees を作成および管理する方法を構成します。

| キー | 説明 | 例 |
| :- | :- | :- |
| `worktree.baseRef` | 新しい worktrees がブランチする ref。`"fresh"`（デフォルト）は `origin/<default-branch>` からブランチして、リモートと一致するクリーンツリーを取得します。`"head"` は現在のローカル `HEAD` からブランチするため、プッシュされていないコミットとフィーチャーブランチの状態が worktree に存在します。`--worktree`、`EnterWorktree` ツール、および subagent 分離に適用されます | `"head"` |
| `worktree.symlinkDirectories` | メインリポジトリから各 worktree にシンボリックリンクするディレクトリ。ディスク上の大規模なディレクトリの重複を避けるため。デフォルトではディレクトリはシンボリックリンクされません | `["node_modules", ".cache"]` |
| `worktree.sparsePaths` | git sparse-checkout を通じて各 worktree でチェックアウトするディレクトリ。リストされたパスのみがディスクに書き込まれます。大規模なモノレポではより高速です | `["packages/my-app", "shared/utils"]` |
| `worktree.bgIsolation` | [バックグラウンドセッション](/ja/agent-view#how-file-edits-are-isolated)の分離モード。`"worktree"`（デフォルト）は `EnterWorktree` が呼び出されるまでメインチェックアウトで `Edit`/`Write` をブロックします。`"none"` はバックグラウンドジョブがワーキングコピーを直接編集できるようにします。Claude Code v2.1.143 以降が必要です | `"none"` |

gitignored ファイル（`.env` など）を新しい worktrees にコピーするには、設定の代わりにプロジェクトルートの [`.worktreeinclude` ファイル](/ja/worktrees#copy-gitignored-files-into-worktrees)を使用します。

### 権限設定

| キー | 説明 | 例 |
| :- | :- | :- |
| `allow` | ツール使用を許可する権限ルールの配列。パターンマッチングの詳細については、以下の[権限ルール構文](#permission-rule-syntax)を参照してください | `[ "Bash(git diff *)" ]` |
| `ask` | ツール使用時に確認を求める権限ルールの配列。[権限ルール構文](#permission-rule-syntax)を参照してください | `[ "Bash(git push *)" ]` |
| `deny` | ツール使用を拒否する権限ルールの配列。これを使用して、機密ファイルを Claude Code アクセスから除外します。[権限ルール構文](#permission-rule-syntax)と [Bash 権限制限](/ja/permissions#tool-specific-permission-rules)を参照してください | `[ "WebFetch", "Bash(curl *)", "Read(./.env)", "Read(./secrets/**)" ]` |
| `additionalDirectories` | Claude がアクセスできる追加の[作業ディレクトリ](/ja/permissions#working-directories) | `[ "../docs/" ]` |
| `defaultMode` | Claude Code を開くときのデフォルト[権限モード](/ja/permission-modes)。有効な値：`default`、`acceptEdits`、`plan`、`auto`、`dontAsk`、`bypassPermissions`。Claude Code v2.1.142 以降、`auto` はプロジェクトまたはローカル設定（`.claude/settings.json`、`.claude/settings.local.json`）で設定されている場合は無視されるため、リポジトリはそれ自体に自動モードを付与できません。代わりに `~/.claude/settings.json` で設定します。`--permission-mode` CLI フラグは単一セッションのこの設定をオーバーライドします | `"acceptEdits"` |
| `disableBypassPermissionsMode` | `"disable"` に設定して `bypassPermissions` モードの有効化を防止します。これにより `--dangerously-skip-permissions` フラグが無効になります。通常は [managed 設定](/ja/permissions#managed-settings)に配置されます。ユーザーはこれをオーバーライドできません | `"disable"` |
| `skipDangerousModePermissionPrompt` | `--dangerously-skip-permissions` または `defaultMode: "bypassPermissions"` を通じてバイパス権限モードに入る前に表示される確認プロンプトをスキップします。信頼されていないリポジトリがプロンプトを自動バイパスするのを防ぐため、プロジェクト設定（`.claude/settings.json`）で設定されている場合は無視されます | `true` |

### 権限ルール構文

権限ルールは `Tool` または `Tool(specifier)` の形式に従います。ルールは順序で評価されます：最初に拒否ルール、次に ask、次に allow。最初に一致するルールが優先されます。

クイック例：

| ルール | 効果 |
| :- | :- |
| `Bash` | すべての Bash コマンドに一致 |
| `Bash(npm run *)` | `npm run` で始まるコマンドに一致 |
| `Read(./.env)` | `.env` ファイルの読み取りに一致 |
| `WebFetch(domain:example.com)` | example.com へのフェッチリクエストに一致 |

ワイルドカード動作、Read、Edit、WebFetch、MCP、および Agent ルール用のツール固有パターン、および Bash パターンのセキュリティ制限を含む完全なルール構文リファレンスについては、[権限ルール構文](/ja/permissions#permission-rule-syntax)を参照してください。

### サンドボックス設定

高度なサンドボックス動作を構成します。サンドボックスは bash コマンドをファイルシステムとネットワークから分離します。詳細については [サンドボックス](/ja/sandboxing)を参照してください。

| キー | 説明 | 例 |
| :- | :- | :- |
| `enabled` | bash サンドボックスを有効にします（macOS、Linux、WSL2）。デフォルト：false | `true` |
| `failIfUnavailable` | `sandbox.enabled` が true だがサンドボックスが起動できない場合（依存関係の欠落、サポートされていないプラットフォーム）、起動時にエラーで終了します。false（デフォルト）の場合、警告が表示され、コマンドはサンドボックス化されずに実行されます。managed 設定デプロイメント用で、サンドボックスをハードゲートとして必要とします | `true` |
| `autoAllowBashIfSandboxed` | サンドボックス化されている場合、bash コマンドを自動承認します。デフォルト：true | `true` |
| `excludedCommands` | サンドボックスの外で実行する必要があるコマンド | `["docker *"]` |
| `allowUnsandboxedCommands` | `dangerouslyDisableSandbox` パラメータを通じてコマンドをサンドボックスの外で実行することを許可します。`false` に設定すると、`dangerouslyDisableSandbox` エスケープハッチが完全に無効になり、すべてのコマンドはサンドボックス化されるか `excludedCommands` に含まれる必要があります。厳密なサンドボックスを必要とするエンタープライズポリシーに役立ちます。デフォルト：true | `false` |
| `filesystem.allowWrite` | サンドボックス化されたコマンドが書き込みできる追加パス。配列はすべての設定スコープ全体でマージされます：ユーザー、プロジェクト、および managed パスが結合され、置き換えられません。`Edit(...)` allow 権限ルールからのパスともマージされます。以下の[パスプレフィックス](#sandbox-path-prefixes)を参照してください。 | `["/tmp/build", "~/.kube"]` |
| `filesystem.denyWrite` | サンドボックス化されたコマンドが書き込みできないパス。配列はすべての設定スコープ全体でマージされます。`Edit(...)` deny 権限ルールからのパスともマージされます。 | `["/etc", "/usr/local/bin"]` |
| `filesystem.denyRead` | サンドボックス化されたコマンドが読み取りできないパス。配列はすべての設定スコープ全体でマージされます。`Read(...)` deny 権限ルールからのパスともマージされます。 | `["~/.aws/credentials"]` |
| `filesystem.allowRead` | `denyRead` 領域内での読み取りを再度許可するパス。`denyRead` よりも優先されます。配列はすべての設定スコープ全体でマージされます。これを使用してワークスペースのみの読み取りアクセスパターンを作成します。 | `["."]` |
| `filesystem.allowManagedReadPathsOnly` | （Managed 設定のみ）managed 設定からの `filesystem.allowRead` パスのみが尊重されます。`denyRead` はすべてのソースからマージされます。デフォルト：false | `true` |
| `network.allowUnixSockets` | （macOS のみ）サンドボックスでアクセス可能な Unix ソケットパス。Linux と WSL2 では無視されます。seccomp フィルターは `socket(AF_UNIX, ...)` 呼び出しをブロックできないため、代わりに `allowAllUnixSockets` を使用します。 | `["~/.ssh/agent-socket"]` |
| `network.allowAllUnixSockets` | サンドボックス内のすべての Unix ソケット接続を許可します。Linux と WSL2 ではこれが Unix ソケットを許可する唯一の方法です。seccomp フィルターをスキップするため、`socket(AF_UNIX, ...)` 呼び出しをブロックします。デフォルト：false | `true` |
| `network.allowLocalBinding` | localhost ポートへのバインドを許可します（macOS のみ）。デフォルト：false | `true` |
| `network.allowMachLookup` | サンドボックスが検索できる追加の XPC/Mach サービス名（macOS のみ）。プレフィックスマッチング用に単一の末尾 `*` をサポートします。iOS Simulator または Playwright などの XPC を通じて通信するツールに必要です。 | `["com.apple.coresimulator.*"]` |
| `network.allowedDomains` | アウトバウンドネットワークトラフィックを許可するドメインの配列。ワイルドカード（例：`*.example.com`）をサポートします。 | `["github.com", "*.npmjs.org"]` |
| `network.deniedDomains` | アウトバウンドネットワークトラフィックをブロックするドメインの配列。`allowedDomains` と同じワイルドカード構文をサポートします。両方が一致する場合、拒否リストが優先されます。すべての設定ソースからマージされます。`allowManagedDomainsOnly` に関係なく | `["sensitive.cloud.example.com"]` |
| `network.allowManagedDomainsOnly` | （Managed 設定のみ）managed 設定からの `allowedDomains` および `WebFetch(domain:...)` allow ルールのみが尊重されます。ユーザー、プロジェクト、およびローカル設定からのドメインは無視されます。許可されていないドメインはユーザーにプロンプトを表示せずに自動的にブロックされます。拒否されたドメインはすべてのソースから引き続き尊重されます。デフォルト：false | `true` |
| `network.httpProxyPort` | 独自のプロキシを使用する場合に使用される HTTP プロキシポート。指定されていない場合、Claude は独自のプロキシを実行します。 | `8080` |
| `network.socksProxyPort` | 独自のプロキシを使用する場合に使用される SOCKS5 プロキシポート。指定されていない場合、Claude は独自のプロキシを実行します。 | `8081` |
| `enableWeakerNestedSandbox` | 非特権 Docker 環境用の弱いサンドボックスを有効にします（Linux と WSL2 のみ）。**セキュリティを低下させます。** デフォルト：false | `true` |
| `enableWeakerNetworkIsolation` | （macOS のみ）サンドボックス内のシステム TLS 信頼サービス（`com.apple.trustd.agent`）へのアクセスを許可します。`httpProxyPort` を MITM プロキシおよびカスタム CA と共に使用する場合、`gh`、`gcloud`、`terraform` などの Go ベースのツールが TLS 証明書を検証するために必要です。**セキュリティを低下させます**。データ流出の可能性のあるパスを開きます。デフォルト：false | `true` |
| `bwrapPath` | （Managed 設定のみ、Linux/WSL2）bubblewrap（`bwrap`）バイナリへの絶対パス。`PATH` を通じた自動検出をオーバーライドします。[managed 設定](/ja/settings#settings-precedence)からのみ尊重され、ユーザーまたはプロジェクト設定からは尊重されません。managed 環境で `bwrap` が非標準の場所にインストールされている場合に役立ちます。 | `/opt/admin/bwrap` |
| `socatPath` | （Managed 設定のみ、Linux/WSL2）サンドボックスネットワークプロキシに使用される `socat` バイナリへの絶対パス。`PATH` を通じた自動検出をオーバーライドします。managed 設定からのみ尊重されます。 | `/opt/admin/socat` |

#### サンドボックスパスプレフィックス

`filesystem.allowWrite`、`filesystem.denyWrite`、`filesystem.denyRead`、および `filesystem.allowRead` のパスは、これらのプレフィックスをサポートしています：

| プレフィックス | 意味 | 例 |
| :- | :- | :- |
| `/` | ファイルシステムルートからの絶対パス | `/tmp/build` は `/tmp/build` のままです |
| `~/` | ホームディレクトリに相対的 | `~/.kube` は `$HOME/.kube` になります |
| `./` またはプレフィックスなし | プロジェクト設定ではプロジェクトルートに相対的、またはユーザー設定では `~/.claude` に相対的 | `./output` は `.claude/settings.json` では `<project-root>/output` に解決されます |

古い `//path` プレフィックスは絶対パスに対して引き続き機能します。以前に単一スラッシュ `/path` を使用してプロジェクト相対解決を期待していた場合は、`./path` に切り替えてください。この構文は [Read および Edit 権限ルール](/ja/permissions#read-and-edit)と異なります。これは `//path` を絶対パスに、`/path` をプロジェクト相対に使用します。サンドボックスファイルシステムパスは標準的な規則を使用します：`/tmp/build` は絶対パスです。

**構成例：**

```json
{
  "sandbox": {
    "enabled": true,
    "autoAllowBashIfSandboxed": true,
    "excludedCommands": ["docker *"],
    "filesystem": {
      "allowWrite": ["/tmp/build", "~/.kube"],
      "denyRead": ["~/.aws/credentials"]
    },
    "network": {
      "allowedDomains": ["github.com", "*.npmjs.org", "registry.yarnpkg.com"],
      "deniedDomains": ["uploads.github.com"],
      "allowUnixSockets": [
        "/var/run/docker.sock"
      ],
      "allowLocalBinding": true
    }
  }
}
```

**ファイルシステムとネットワーク制限**は、一緒にマージされる 2 つの方法で構成できます：

- **`sandbox.filesystem` 設定**（上記）：OS レベルのサンドボックス境界でパスを制御します。これらの制限は、Claude のファイルツールだけでなく、すべてのサブプロセスコマンド（例：`kubectl`、`terraform`、`npm`）に適用されます。
- **権限ルール**：`Edit` allow/deny ルールを使用して Claude のファイルツールアクセスを制御し、`Read` deny ルールを使用して読み取りをブロックし、`WebFetch` allow/deny ルールを使用してネットワークドメインを制御します。これらのルールからのパスもサンドボックス構成にマージされます。

### 属性設定

Claude Code は git コミットとプルリクエストに属性を追加します。これらは個別に構成されます：

- コミットはデフォルトで[git トレーラー](https://git-scm.com/docs/git-interpret-trailers)（`Co-Authored-By` など）を使用し、カスタマイズまたは無効にできます
- プルリクエストの説明はプレーンテキストです

| キー | 説明 |
| :- | :- |
| `commit` | git コミットの属性（トレーラーを含む）。空の文字列はコミット属性を非表示にします |
| `pr` | プルリクエストの説明の属性。空の文字列はプルリクエスト属性を非表示にします |

**デフォルトコミット属性：**

```text
🤖 Generated with [Claude Code](https://claude.com/claude-code)

   Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

**デフォルトプルリクエスト属性：**

```text
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

**例：**

```json
{
  "attribution": {
    "commit": "Generated with AI\n\nCo-Authored-By: AI <ai@example.com>",
    "pr": ""
  }
}
```

`attribution` 設定は非推奨の `includeCoAuthoredBy` 設定よりも優先されます。すべての属性を非表示にするには、`commit` と `pr` を空の文字列に設定します。

### ファイル提案設定

`@` ファイルパスオートコンプリート用のカスタムコマンドを構成します。組み込みファイル提案は高速ファイルシステムトラバーサルを使用しますが、大規模なモノレポは事前構築されたファイルインデックスやカスタムツールなどのプロジェクト固有のインデックスから利益を得る可能性があります。

```json
{
  "fileSuggestion": {
    "type": "command",
    "command": "~/.claude/file-suggestion.sh"
  }
}
```

コマンドは [hooks](/ja/hooks)と同じ環境変数（`CLAUDE_PROJECT_DIR` を含む）で実行されます。`query` フィールドを含む JSON を stdin 経由で受け取ります：

```json
{"query": "src/comp"}
```

stdout にニューラインで区切られたファイルパスを出力します（現在 15 に制限）：

```text
src/components/Button.tsx
src/components/Modal.tsx
src/components/Form.tsx
```

**例：**

```bash
#!/bin/bash
query=$(cat | jq -r '.query')
your-repo-file-index --query "$query" | head -20
```

### Hook 構成

これらの設定は、どの hooks が実行を許可されるか、および HTTP hooks がアクセスできるものを制御します。`allowManagedHooksOnly` 設定は [managed 設定](#settings-files)でのみ構成できます。URL と環境変数ホワイトリストは任意の設定レベルで設定でき、ソース全体でマージされます。

**`allowManagedHooksOnly` が `true` の場合の動作：**

- Managed hooks と SDK hooks が読み込まれます
- managed 設定 `enabledPlugins` で強制的に有効にされたプラグインからの Hooks が読み込まれます。これにより、管理者は組織マーケットプレイスを通じて検証済みの hooks を配布しながら、他のすべてをブロックできます。信頼は完全な `plugin@marketplace` ID によって付与されるため、別のマーケットプレイスからの同じ名前のプラグインはブロックされたままです
- ユーザー hooks、プロジェクト hooks、およびその他すべてのプラグイン hooks はブロックされます

**HTTP hook URL を制限：**

HTTP hooks がターゲットにできる URL を制限します。マッチングのワイルドカードとして `*` をサポートします。配列が定義されている場合、一致しない URL をターゲットにする HTTP hooks はサイレントにブロックされます。ホスト名マッチングは大文字と小文字を区別せず、末尾の FQDN ドットを無視し、DNS セマンティクスに一致します。

```json
{
  "allowedHttpHookUrls": ["https://hooks.example.com/*", "http://localhost:*"]
}
```

**HTTP hook 環境変数を制限：**

HTTP hooks がヘッダー値に補間できる環境変数名を制限します。各 hook の有効な `allowedEnvVars` はこの設定との交差です。

```json
{
  "httpHookAllowedEnvVars": ["MY_TOKEN", "HOOK_SECRET"]
}
```

### ポリシーヘルパーで managed 設定を計算

`policyHelper` 設定は、起動時に managed 設定を動的に計算する実行可能ファイルを指しています。管理者は、静的ファイルの代わりに、デバイスの状態、ID、またはリモートサービスからポリシーを導出できます。MDM またはシステム `managed-settings.json` ファイルから構成します。Claude Code は、ユーザー設定、プロジェクト設定、HKCU レジストリハイブ、および [サーバー管理設定](/ja/server-managed-settings)を含む他のスコープに表示される `policyHelper` を無視します。

設定は以下のキーを受け入れます：

| キー | タイプ | 説明 |
| - | - | - |
| `path` | string | ヘルパー実行可能ファイルへの絶対パス |
| `timeoutMs` | number | ヘルパーが失敗として扱われるまでの待機時間 |
| `refreshIntervalMs` | number | バックグラウンドでヘルパーを再実行する頻度。`0` に設定して更新を無効にするか、少なくとも `60000` に設定します |

ヘルパーは JSON エンベロープを stdout に書き込みます。設定をトップレベルではなく `managedSettings` キーの下に配置します。ベアの設定オブジェクトは `managedSettings` が未定義で解析され、何も適用されないためです：

```json
{
  "managedSettings": {
    "permissions": { "deny": ["Read(//etc/secrets/**)"] }
  },
  "claudeMd": "# Organization context\n...",
  "appendSystemPrompt": "Always cite the internal style guide."
}
```

ヘルパーが `managedSettings` を出力すると、そのオブジェクトは実行のためにファイルベースの managed 設定を置き換えます。ヘルパーが起動時にゼロ以外で終了すると、Claude Code はエラーを出力し、起動を拒否します。そのため、停止復旧が必要なヘルパーは独自のキャッシュから提供し、`0` で終了する必要があります。

### 設定の優先度

設定は優先度の順に適用されます。最高から最低：

1. **Managed 設定**（[サーバー管理](/ja/server-managed-settings)、[MDM/OS レベルのポリシー](#configuration-scopes)、または [managed 設定](/ja/settings#settings-files)）
   - IT がサーバー配信、MDM 構成プロファイル、レジストリポリシー、または managed 設定ファイルを通じて展開するポリシー
   - コマンドラインの引数を含む他のレベルでオーバーライドできません
   - managed ティア内では、優先度は：サーバー管理 > MDM/OS レベルのポリシー > ファイルベース（`managed-settings.d/*.json` + `managed-settings.json`）> HKCU レジストリ（Windows のみ）です。1 つの managed ソースのみが使用されます。ソースはマージされません。ファイルベースティア内では、ドロップインファイルとベースファイルがマージされます。

2. **コマンドラインの引数**
   - 特定のセッションの一時的なオーバーライド。JSON は `--settings <file-or-json>` を通じて渡され、ファイルベース設定と同じルールを使用して他のレイヤーとマージされます：ここで設定されたキーはローカル、プロジェクト、またはユーザー設定の同じキーをオーバーライドし、キーを省略すると下位レイヤーの値が保持されます

3. **ローカルプロジェクト設定**（`.claude/settings.local.json`）
   - 個人的なプロジェクト固有の設定

4. **共有プロジェクト設定**（`.claude/settings.json`）
   - ソース管理内のチーム共有プロジェクト設定

5. **ユーザー設定**（`~/.claude/settings.json`）
   - 個人的なグローバル設定

この階層は、組織のポリシーが常に強制されながら、チームと個人がエクスペリエンスをカスタマイズできることを保証します。同じ優先度は、CLI から Claude Code を実行する場合、[VS Code 拡張機能](/ja/vs-code)から実行する場合、または [JetBrains IDE](/ja/jetbrains)から実行する場合に適用されます。

たとえば、ユーザー設定が `permissions.defaultMode` を `acceptEdits` に設定しているが、プロジェクトの共有設定がそれを `default` に設定している場合、プロジェクト値が適用されます。以下の例は、配列値の設定（権限ルールなど）がどのように結合されるかについて説明しています。

**配列設定はスコープ全体でマージされます。** 同じ配列値の設定（`sandbox.filesystem.allowWrite` や `permissions.allow` など）が複数のスコープに表示される場合、配列は**連結および重複排除**され、置き換えられません。これは、低優先度のスコープが高優先度のスコープで設定されたエントリをオーバーライドすることなくエントリを追加でき、その逆も同様です。たとえば、managed 設定が `allowWrite` を `["/opt/company-tools"]` に設定し、ユーザーが `["~/.kube"]` を追加する場合、両方のパスが最終構成に含まれます。

### アクティブな設定を確認

Claude Code 内で `/status` を実行して、どの設定ソースがアクティブで、どこから来ているかを確認します。Status タブには、`Setting sources` 行が含まれており、Claude Code が現在のセッション用に読み込んだ各レイヤーをリストします。たとえば、`User settings` または `Project local settings` などです。[managed 設定](/ja/managed-settings)が有効な場合、エントリは配信チャネルを括弧内に表示します。たとえば、`Enterprise managed settings (remote)`、`(plist)`、`(HKLM)`、`(HKCU)`、または `(file)` などです。レイヤーは、そのソースが少なくとも 1 つのキーで読み込まれた場合にのみリストに表示されるため、空のリストは設定ソースが見つからなかったことを意味します。

`Setting sources` 行は、どのソースが読み込まれているかを確認します。各個別キーがどのレイヤーから供給されたかは表示されません。同じダイアログの Config タブは、テーマや詳細出力などの固定されたトグルセットのエディターであり、`settings.json` コンテンツのビューではありません。設定ファイルに無効な JSON や検証に失敗した値などのエラーが含まれている場合、`/status` は問題を報告して修正できるようにします。

### 構成システムの重要なポイント

- **メモリファイル（`CLAUDE.md`）**：Claude が起動時に読み込む命令とコンテキストを含みます
- **設定ファイル（JSON）**：権限、環境変数、およびツール動作を構成します
- **Skills**：`/skill-name` で呼び出すか、Claude によって自動的に読み込むことができるカスタムプロンプト
- **MCP サーバー**：追加のツールと統合で Claude Code を拡張します
- **優先度**：高レベルの構成（Managed）が低レベルの構成（User/Project）をオーバーライドします
- **継承**：設定はマージされ、より具体的な設定がより広い設定に追加またはオーバーライドされます

### システムプロンプト

Claude Code の内部システムプロンプトは公開されていません。カスタム命令を追加するには、`CLAUDE.md` ファイルまたは `--append-system-prompt` フラグを使用します。

### 機密ファイルを除外

API キー、シークレット、環境ファイルなどの機密情報を含むファイルへの Claude Code アクセスを防ぐには、`.claude/settings.json` ファイルの `permissions.deny` 設定を使用します：

```json
{
  "permissions": {
    "deny": [
      "Read(./.env)",
      "Read(./.env.*)",
      "Read(./secrets/**)",
      "Read(./config/credentials.json)",
      "Read(./build)"
    ]
  }
}
```

これは非推奨の `ignorePatterns` 構成に置き換わります。これらのパターンに一致するファイルはファイル検出と検索結果から除外され、これらのファイルの読み取り操作は拒否されます。

## Subagent 構成

Claude Code は、ユーザーレベルとプロジェクトレベルの両方で構成できるカスタム AI subagents をサポートしています。これらの subagents は YAML frontmatter を含む Markdown ファイルとして保存されます：

- **ユーザー subagents**：`~/.claude/agents/` - すべてのプロジェクト全体で利用可能
- **プロジェクト subagents**：`.claude/agents/` - プロジェクト固有で、チームと共有できます

Subagent ファイルは、カスタムプロンプトとツール権限を持つ特殊な AI アシスタントを定義します。[subagents ドキュメント](/ja/sub-agents)で subagents の作成と使用について詳しく学びます。

## プラグイン構成

Claude Code は、skills、agents、hooks、および MCP サーバーで機能を拡張できるプラグインシステムをサポートしています。プラグインはマーケットプレイスを通じて配布され、ユーザーレベルとリポジトリレベルの両方で構成できます。

### プラグイン設定

`settings.json` のプラグイン関連設定：

```json
{
  "enabledPlugins": {
    "formatter@acme-tools": true,
    "deployer@acme-tools": true,
    "analyzer@security-plugins": false
  },
  "extraKnownMarketplaces": {
    "acme-tools": {
      "source": {
        "source": "github",
        "repo": "acme-corp/claude-plugins"
      }
    }
  }
}
```

#### `enabledPlugins`

どのプラグインが有効かを制御します。形式：`"plugin-name@marketplace-name": true/false`

**スコープ**：

- **ユーザー設定**（`~/.claude/settings.json`）：個人的なプラグイン設定
- **プロジェクト設定**（`.claude/settings.json`）：チームと共有されるプロジェクト固有のプラグイン
- **ローカル設定**（`.claude/settings.local.json`）：マシンごとのオーバーライド（コミットされない）
- **Managed 設定**（`managed-settings.json`）：すべてのスコープでのインストールをブロックし、マーケットプレイスからプラグインを非表示にする組織全体のポリシーオーバーライド

プロジェクト設定はユーザー設定よりも優先されるため、`~/.claude/settings.json` でプラグインを `false` に設定しても、プロジェクトの `.claude/settings.json` が有効にするプラグインは無効になりません。プロジェクトで有効になっているプラグインをマシンでオプトアウトするには、代わりに `.claude/settings.local.json` で `false` に設定してください。

Managed 設定で強制的に有効にされたプラグインは、Managed 設定がローカル設定をオーバーライドするため、この方法では無効にできません。

**例**：

```json
{
  "enabledPlugins": {
    "code-formatter@team-tools": true,
    "deployment-tools@team-tools": true,
    "experimental-features@personal": false
  }
}
```

#### `extraKnownMarketplaces`

リポジトリで利用可能にする必要がある追加のマーケットプレイスを定義します。通常、リポジトリレベルの設定で使用され、チームメンバーが必要なプラグインソースにアクセスできることを確認します。

**リポジトリが `extraKnownMarketplaces` を含む場合**：

1. チームメンバーはフォルダを信頼するときにマーケットプレイスをインストールするよう求められます
2. チームメンバーはそのマーケットプレイスからプラグインをインストールするよう求められます
3. ユーザーは不要なマーケットプレイスまたはプラグインをスキップできます（ユーザー設定に保存）
4. インストールは信頼境界を尊重し、明示的な同意が必要です

**例**：

```json
{
  "extraKnownMarketplaces": {
    "acme-tools": {
      "source": {
        "source": "github",
        "repo": "acme-corp/claude-plugins"
      }
    },
    "security-plugins": {
      "source": {
        "source": "git",
        "url": "https://git.example.com/security/plugins.git"
      }
    }
  }
}
```

**マーケットプレイスソースタイプ**：

- `github`：GitHub リポジトリ（`repo` を使用）
- `git`：任意の git URL（`url` を使用）
- `directory`：ローカルファイルシステムパス（開発のみ、`path` を使用）
- `hostPattern`：マーケットプレイスホストに一致する正規表現パターン（`hostPattern` を使用）
- `settings`：ホストされたリポジトリなしで settings.json に直接宣言されたインラインマーケットプレイス（`name` と `plugins` を使用）

各マーケットプレイスエントリは、オプションの `autoUpdate` ブール値も受け入れます。`source` と並行して `"autoUpdate": true` を設定して、Claude Code がそのマーケットプレイスをリフレッシュし、起動時にインストール済みプラグインを更新するようにします。省略した場合、公式 Anthropic マーケットプレイスはデフォルトで `true` に設定され、その他すべてのマーケットプレイスはデフォルトで `false` に設定されます。[自動更新の構成](/ja/discover-plugins#configure-auto-updates)を参照してください。

`source: 'settings'` を使用して、ホストされたマーケットプレイスリポジトリをセットアップせずに、小規模なプラグインセットをインラインで宣言します。ここにリストされているプラグインは、GitHub または npm などの外部ソースを参照する必要があります。各プラグインを `enabledPlugins` で個別に有効にする必要があります。

```json
{
  "extraKnownMarketplaces": {
    "team-tools": {
      "source": {
        "source": "settings",
        "name": "team-tools",
        "plugins": [
          {
            "name": "code-formatter",
            "source": {
              "source": "github",
              "repo": "acme-corp/code-formatter"
            }
          }
        ]
      }
    }
  }
}
```

#### `strictKnownMarketplaces`

**Managed 設定のみ**：ユーザーが追加できるプラグインマーケットプレイスを制御します。この設定は [managed 設定](/ja/settings#settings-files)でのみ構成でき、管理者にマーケットプレイスソースに対する厳密な制御を提供します。

**Managed 設定ファイルの場所**：

- **macOS**：`/Library/Application Support/ClaudeCode/managed-settings.json`
- **Linux と WSL**：`/etc/claude-code/managed-settings.json`
- **Windows**：`C:\Program Files\ClaudeCode\managed-settings.json`

**主な特性**：

- managed 設定（`managed-settings.json`）でのみ利用可能
- ユーザーまたはプロジェクト設定でオーバーライドできません（最高優先度）
- ネットワーク/ファイルシステム操作の前に強制されます（ブロックされたソースは実行されません）
- `hostPattern` と `pathPattern` を除き、ソース仕様に対して完全一致を使用します。`hostPattern` と `pathPattern` は正規表現マッチングを使用します

**ホワイトリスト動作**：

- `undefined`（デフォルト）：制限なし - ユーザーは任意のマーケットプレイスを追加できます
- 空配列 `[]`：完全ロックダウン - ユーザーは新しいマーケットプレイスを追加できません
- ソースのリスト：ユーザーは正確に一致するマーケットプレイスのみを追加できます

**サポートされているすべてのソースタイプ**：

ホワイトリストは複数のマーケットプレイスソースタイプをサポートしています。ほとんどのソースは完全一致を使用しますが、`hostPattern` と `pathPattern` はそれぞれマーケットプレイスホストとファイルシステムパスに対して正規表現マッチングを使用します。

1. **GitHub リポジトリ**：

```json
{ "source": "github", "repo": "acme-corp/approved-plugins" }
{ "source": "github", "repo": "acme-corp/security-tools", "ref": "v2.0" }
{ "source": "github", "repo": "acme-corp/plugins", "ref": "main", "path": "marketplace" }
```

フィールド：`repo`（必須）、`ref`（オプション：ブランチ/タグ/SHA）、`path`（オプション：サブディレクトリ）

2. **Git リポジトリ**：

```json
{ "source": "git", "url": "https://gitlab.example.com/tools/plugins.git" }
{ "source": "git", "url": "https://bitbucket.org/acme-corp/plugins.git", "ref": "production" }
{ "source": "git", "url": "ssh://git@git.example.com/plugins.git", "ref": "v3.1", "path": "approved" }
```

フィールド：`url`（必須）、`ref`（オプション：ブランチ/タグ/SHA）、`path`（オプション：サブディレクトリ）

3. **URL ベースのマーケットプレイス**：

```json
{ "source": "url", "url": "https://plugins.example.com/marketplace.json" }
{ "source": "url", "url": "https://cdn.example.com/marketplace.json", "headers": { "Authorization": "Bearer ${TOKEN}" } }
```

フィールド：`url`（必須）、`headers`（オプション：認証アクセス用の HTTP ヘッダー）

URL ベースのマーケットプレイスは `marketplace.json` ファイルのみをダウンロードします。サーバーからプラグインファイルをダウンロードしません。URL ベースのマーケットプレイス内のプラグインは、相対パスではなく外部ソース（GitHub、npm、または git URL）を使用する必要があります。相対パスを持つプラグインの場合は、代わりに Git ベースのマーケットプレイスを使用します。詳細については [トラブルシューティング](/ja/plugin-marketplaces#plugins-with-relative-paths-fail-in-url-based-marketplaces)を参照してください。

4. **NPM パッケージ**：

```json
{ "source": "npm", "package": "@acme-corp/claude-plugins" }
{ "source": "npm", "package": "@acme-corp/approved-marketplace" }
```

フィールド：`package`（必須、スコープ付きパッケージをサポート）

5. **ファイルパス**：

```json
{ "source": "file", "path": "/usr/local/share/claude/acme-marketplace.json" }
{ "source": "file", "path": "/opt/acme-corp/plugins/marketplace.json" }
```

フィールド：`path`（必須：marketplace.json ファイルへの絶対パス）

6. **ディレクトリパス**：

```json
{ "source": "directory", "path": "/usr/local/share/claude/acme-plugins" }
{ "source": "directory", "path": "/opt/acme-corp/approved-marketplaces" }
```

フィールド：`path`（必須：`.claude-plugin/marketplace.json` を含むディレクトリへの絶対パス）

7. **ホストパターンマッチング**：

```json
{ "source": "hostPattern", "hostPattern": "^github\\.example\\.com$" }
{ "source": "hostPattern", "hostPattern": "^gitlab\\.internal\\.example\\.com$" }
```

フィールド：`hostPattern`（必須：マーケットプレイスホストに対してマッチする正規表現パターン）

各リポジトリを列挙することなく、特定のホストからすべてのマーケットプレイスを許可する場合は、ホストパターンマッチングを使用します。これは、開発者が独自のマーケットプレイスを作成する内部 GitHub Enterprise または GitLab サーバーを持つ組織に役立ちます。

ソースタイプ別のホスト抽出：

- `github`：常に `github.com` に対してマッチ
- `git`：URL からホスト名を抽出（HTTPS と SSH 形式の両方をサポート）
- `url`：URL からホスト名を抽出
- `npm`、`file`、`directory`：ホストパターンマッチングではサポートされていません

8. **パスパターンマッチング**：

```json
{ "source": "pathPattern", "pathPattern": "^/opt/approved/" }
{ "source": "pathPattern", "pathPattern": ".*" }
```

フィールド：`pathPattern`（必須：`file` および `directory` ソースの `path` フィールドに対してマッチする正規表現パターン）

ネットワークソースの `hostPattern` 制限と並行して、ファイルシステムベースのマーケットプレイスを許可するには、パスパターンマッチングを使用します。すべてのローカルパスを許可するには `".*"` を設定するか、特定のディレクトリに制限するにはより狭いパターンを設定します。

**構成例**：

例：特定のマーケットプレイスのみを許可：

```json
{
  "strictKnownMarketplaces": [
    {
      "source": "github",
      "repo": "acme-corp/approved-plugins"
    },
    {
      "source": "github",
      "repo": "acme-corp/security-tools",
      "ref": "v2.0"
    },
    {
      "source": "url",
      "url": "https://plugins.example.com/marketplace.json"
    },
    {
      "source": "npm",
      "package": "@acme-corp/compliance-plugins"
    }
  ]
}
```

例 - すべてのマーケットプレイス追加を無効にする：

```json
{
  "strictKnownMarketplaces": []
}
```

例：内部 git サーバーからすべてのマーケットプレイスを許可：

```json
{
  "strictKnownMarketplaces": [
    {
      "source": "hostPattern",
      "hostPattern": "^github\\.example\\.com$"
    }
  ]
}
```

**完全一致要件**：

マーケットプレイスソースはユーザーの追加を許可するために**正確に**一致する必要があります。git ベースのソース（`github` と `git`）の場合、これはすべてのオプションフィールドを含みます：

- `repo` または `url` は正確に一致する必要があります
- `ref` フィールドは正確に一致する必要があります（または両方が未定義）
- `path` フィールドは正確に一致する必要があります（または両方が未定義）

一致**しない**ソースの例：

```json
// これらは異なるソースです：
{ "source": "github", "repo": "acme-corp/plugins" }
{ "source": "github", "repo": "acme-corp/plugins", "ref": "main" }

// これらも異なります：
{ "source": "github", "repo": "acme-corp/plugins", "path": "marketplace" }
{ "source": "github", "repo": "acme-corp/plugins" }
```

**`extraKnownMarketplaces` との比較**：

| 側面 | `strictKnownMarketplaces` | `extraKnownMarketplaces` |
| - | - | - |
| **目的** | 組織ポリシーの強制 | チームの利便性 |
| **設定ファイル** | `managed-settings.json` のみ | 任意の設定ファイル |
| **動作** | 許可されていない追加をブロック | 不足しているマーケットプレイスを自動インストール |
| **強制時期** | ネットワーク/ファイルシステム操作の前 | ユーザー信頼プロンプト後 |
| **オーバーライド可能** | いいえ（最高優先度） | はい（高優先度設定による） |
| **ソース形式** | 直接ソースオブジェクト | ネストされたソースを持つ名前付きマーケットプレイス |
| **ユースケース** | コンプライアンス、セキュリティ制限 | オンボーディング、標準化 |

**形式の違い**：

`strictKnownMarketplaces` は直接ソースオブジェクトを使用します：

```json
{
  "strictKnownMarketplaces": [
    { "source": "github", "repo": "acme-corp/plugins" }
  ]
}
```

`extraKnownMarketplaces` は名前付きマーケットプレイスが必要です：

```json
{
  "extraKnownMarketplaces": {
    "acme-tools": {
      "source": { "source": "github", "repo": "acme-corp/plugins" }
    }
  }
}
```

**両方を一緒に使用**：

`strictKnownMarketplaces` はポリシーゲートです：ユーザーが追加できるものを制御しますが、マーケットプレイスを登録しません。マーケットプレイスを制限して事前登録するには、`managed-settings.json` で両方を設定します：

```json
{
  "strictKnownMarketplaces": [
    { "source": "github", "repo": "acme-corp/plugins" }
  ],
  "extraKnownMarketplaces": {
    "acme-tools": {
      "source": { "source": "github", "repo": "acme-corp/plugins" }
    }
  }
}
```

`strictKnownMarketplaces` のみが設定されている場合、ユーザーは `/plugin marketplace add` を通じて許可されたマーケットプレイスを手動で追加できますが、自動的には利用できません。

**重要な注意**：

- 制限はネットワークリクエストまたはファイルシステム操作の前にチェックされます
- ブロックされた場合、ユーザーはソースが managed ポリシーでブロックされていることを示す明確なエラーメッセージを表示します
- 制限はマーケットプレイスの追加およびプラグインのインストール、更新、リフレッシュ、および自動更新に対して強制されます。ポリシーが設定される前に追加されたマーケットプレイスは、そのソースがホワイトリストと一致しなくなると、プラグインのインストールまたは更新に使用できません
- Managed 設定は最高優先度を持ち、オーバーライドできません

ユーザー向けドキュメントについては、[Managed マーケットプレイス制限](/ja/plugin-marketplaces#managed-marketplace-restrictions)を参照してください。

### プラグインの管理

`/plugin` コマンドを使用してプラグインを対話的に管理します：

- マーケットプレイスから利用可能なプラグインを参照
- プラグインをインストール/アンインストール
- プラグインを有効/無効にする
- プラグインの詳細を表示（提供される skills、agents、hooks）
- マーケットプレイスを追加/削除

[プラグインドキュメント](/ja/plugins)でプラグインシステムについて詳しく学びます。

## 環境変数

環境変数を使用すると、設定ファイルを編集することなく Claude Code の動作を制御できます。任意の変数は、すべてのセッションに適用するか、チームにロールアウトするために [`settings.json`](#available-settings) の `env` キーで構成することもできます。

完全なリストについては、[環境変数リファレンス](/ja/env-vars)を参照してください。

## Claude が利用できるツール

Claude Code は、ファイルの読み取り、編集、検索、コマンド実行、および subagents のオーケストレーション用のツールセットにアクセスできます。ツール名は、権限ルールと hook マッチャーで使用する正確な文字列です。

完全なリストと Bash ツール動作の詳細については、[ツールリファレンス](/ja/tools-reference)を参照してください。

## 関連項目

- [権限](/ja/permissions)：権限システム、ルール構文、ツール固有パターン、および managed ポリシー
- [認証](/ja/authentication)：Claude Code へのユーザーアクセスをセットアップ
- [設定をデバッグする](/ja/debug-your-config)：設定、hook、または MCP サーバーが有効にならない理由を診断
- [インストールとログインのトラブルシューティング](/ja/troubleshoot-install)：インストール、認証、およびプラットフォームの問題
