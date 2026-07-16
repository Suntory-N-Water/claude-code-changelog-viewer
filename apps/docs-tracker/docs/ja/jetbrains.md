---
title: jetbrains
source: https://code.claude.com/docs/ja/jetbrains.md
---

# JetBrains IDEs

> Claude Code を IntelliJ、PyCharm、WebStorm など JetBrains IDEs で使用する

Claude Code は専用プラグインを通じて JetBrains IDEs と統合され、インタラクティブな diff ビューイング、選択コンテキスト共有など、様々な機能を提供します。

サポートされている IDE

Claude Code プラグインは、以下を含むほとんどの JetBrains IDEs で動作します。

- IntelliJ IDEA
- PyCharm
- Android Studio
- WebStorm
- PhpStorm
- GoLand

機能

- **クイック起動**: `Cmd+Esc`（Mac）または `Ctrl+Esc`（Windows/Linux）を使用してエディタから Claude Code を直接開くか、UI の Claude Code ボタンをクリックします
- **Diff ビューイング**: コードの変更をターミナルではなく IDE の diff ビューアに直接表示できます
- **選択コンテキスト**: IDE の現在の選択またはタブが Claude Code と自動的に共有されます。[`Read` 拒否ルール](/ja/permissions#read-and-edit)は、一致するファイルのこの共有をブロックします
- **ファイル参照ショートカット**: `Cmd+Option+K`（Mac）または `Alt+Ctrl+K`（Linux/Windows）を使用して `@src/auth.ts#L1-99` などのファイル参照を挿入します
- **診断共有**: IDE からの診断エラー（lint、構文エラーなど）が作業中に Claude と自動的に共有されます

インストール

プラグインは IDE の統合ターミナルで `claude` コマンドを実行し、それに接続します。独自の CLI コピーをバンドルしていないため、両方をインストールする必要があります。

まだインストールしていない場合は、[クイックスタート](/ja/quickstart) に従って CLI をインストールしてください。`claude` が PATH にない場合、プラグインは'Claude Code を起動できません'という通知を表示します。

JetBrains マーケットプレイスから [Claude Code プラグイン](https://plugins.jetbrains.com/plugin/27310-claude-code-beta-) をインストールし、IDE を再起動します。

`claude` が IDE が見つけられない場所にインストールされている場合は、プラグインの [Claude コマンド設定](#general-settings) でフルパスを設定してください。

Claude Code は、任意の有料 Claude サブスクリプション（Pro、Max、Team、または Enterprise）または Claude Console アカウントで動作し、API キーは不要です。`claude` を初めて実行するときに [ログイン](/ja/authentication#log-in-to-claude-code) するよう求められます。

プラグインをインストール後、IDE を完全に再起動する必要がある場合があります。

使用方法

IDE から

IDE の統合ターミナルから `claude` を実行すると、すべての統合機能がアクティブになります。

外部ターミナルから

任意の外部ターミナルで `/ide` コマンドを使用して Claude Code を JetBrains IDE に接続し、すべての機能をアクティブにします。

```bash
claude
```

```text
/ide
```

Claude が IDE と同じファイルにアクセスできるようにしたい場合は、IDE プロジェクトルートと同じディレクトリから Claude Code を起動してください。

設定

Claude Code 設定

Claude Code の設定を通じて IDE 統合を設定します。

1. `claude` を実行します
2. `/config` コマンドを入力します
3. diff ツールを `auto` に設定して IDE に diff を表示するか、`terminal` に設定してターミナルに表示したままにします

プラグイン設定

**Settings → Tools → Claude Code \[Beta]** に移動して Claude Code プラグインを設定します。

一般設定

- **Claude command**: Claude を実行するカスタムコマンドを指定します（例：`claude`、`/usr/local/bin/claude`、または `npx @anthropic-ai/claude-code`）
- **Suppress notification for Claude command not found**: Claude コマンドが見つからないことに関する通知をスキップします
- **Enable using Option+Enter for multi-line prompts**: macOS のみ。有効にすると、Option+Enter は Claude Code プロンプトに新しい行を挿入します。Option キーが予期せずキャプチャされる場合は無効にしてください。ターミナルの再起動が必要です。
- **Enable automatic updates**: プラグインの更新を自動的にチェックしてインストールします。再起動時に適用されます

WSL ユーザー向け: Claude コマンドとして `wsl -d Ubuntu -- bash -lic "claude"` を設定します（`Ubuntu` を WSL ディストリビューション名に置き換えてください）

ESC キー設定

ESC キーが JetBrains ターミナルで Claude Code 操作を中断しない場合：

1. **Settings → Tools → Terminal** に移動します
2. 以下のいずれかを実行します。
   - 「Move focus to the editor with Escape」をオフにするか、
   - 「Configure terminal keybindings」をクリックして「Switch focus to Editor」ショートカットを削除します
3. 変更を適用します

これにより、ESC キーが Claude Code 操作を適切に中断できるようになります。

特別な設定

リモート開発

JetBrains リモート開発を使用する場合、**Settings → Plugin (Host)** を通じてリモートホストにプラグインをインストールする必要があります。

プラグインはローカルクライアントマシンではなく、リモートホストにインストールする必要があります。

WSL 設定

Claude Code を WSL2 の JetBrains IDE で使用していて「No available IDEs detected」が表示される場合、原因は通常 WSL2 の NAT ネットワークまたは Windows ファイアウォールが WSL2 と Windows ホストで実行されている IDE 間の接続をブロックしていることです。WSL1 はホストのネットワークを直接使用するため、影響を受けません。

Windows ファイアウォール経由で WSL2 トラフィックを許可する

これは推奨される修正方法です。既存の WSL2 ネットワークモードを保持するためです。

WSL シェル内から以下を実行します。

```bash theme={null}
hostname -I
```

サブネットをメモします。例えば `172.21.123.45` は `172.21.0.0/16` に含まれます。

PowerShell を管理者として開き、以下を実行します。IP 範囲をサブネットに合わせて調整してください。

```powershell theme={null}
New-NetFirewallRule -DisplayName "Allow WSL2 Internal Traffic" -Direction Inbound -Protocol TCP -Action Allow -RemoteAddress 172.21.0.0/16 -LocalAddress 172.21.0.0/16
```

両方を閉じて再度開き、新しいルールが有効になるようにします。

WSL2 をミラーリングネットワークに切り替える

ミラーリングネットワークには Windows 11 22H2 以降が必要です。Windows 10 を使用している場合は、代わりに上記のファイアウォールルールを使用してください。

Windows ユーザーディレクトリの `.wslconfig` に以下を追加します。

```ini
[wsl2]
networkingMode=mirrored
```

その後、PowerShell から `wsl --shutdown` で WSL を再起動します。

トラブルシューティング

プラグインが動作しない

プラグインがインストールされているが Claude Code 機能が IDE に表示されない場合：

- Claude Code をプロジェクトルートディレクトリから実行していることを確認してください
- JetBrains プラグインが IDE 設定で有効になっていることを確認してください
- IDE を完全に再起動してください（複数回実行する必要がある場合があります）
- リモート開発の場合、プラグインがリモートホストにインストールされていることを確認してください

IDE が検出されない

`claude` を実行して「No available IDEs detected」が表示される場合：

- プラグインがインストールされて有効になっていることを確認してください
- IDE を完全に再起動してください
- 統合ターミナルから Claude Code を実行していることを確認してください
- WSL ユーザーの場合、上記の [WSL 設定](#wsl-configuration) を参照してください

コマンドが見つからない

Claude アイコンをクリックして「command not found」が表示される場合：

1. `claude --version` をターミナルで実行して Claude Code がインストールされていることを確認してください
2. プラグイン設定で Claude コマンドパスを設定してください
3. WSL ユーザーの場合、設定セクションで説明されている WSL コマンド形式を使用してください

セキュリティに関する考慮事項

Claude Code が [`acceptEdits` 権限モード](/ja/permission-modes#auto-approve-file-edits-with-acceptedits-mode)で JetBrains IDE で実行される場合、IDE によって自動的に実行される可能性のある IDE 設定ファイルを変更できる場合があります。これにより、`acceptEdits` モードで Claude Code を実行するリスクが増加し、bash 実行に対する Claude Code の権限プロンプトをバイパスできる可能性があります。

JetBrains IDEs で実行する場合は、以下を検討してください。

- 編集に対して手動承認モードを使用する
- Claude が信頼できるプロンプトでのみ使用されることを確認するために特に注意する
- Claude Code がアクセスして変更できるファイルを認識する

Claude Code のインストールまたはログインの問題については、[インストールとログインのトラブルシューティング](/ja/troubleshoot-install) を参照してください。

組み込み IDE MCP サーバー

プラグインがアクティブな場合、CLI が自動的に接続するローカル MCP サーバーが実行されます。これは、CLI が IDE のネイティブ diff ビューアーで diff を開き、`@` メンションの現在の選択を読み取り、検査診断を会話に取り込む方法です。

サーバーは `ide` という名前で、設定するものがないため `/mcp` から非表示になっています。ただし、組織が [`PreToolUse` フック](/ja/hooks#pretooluse) を使用して MCP ツールをホワイトリストに登録している場合は、それが存在することを知っておく必要があります。

**選択とオープンファイルコンテキスト。** 接続中、CLI は現在のエディター選択とアクティブファイルのパスを、送信する各プロンプトのコンテキストとして含めます。トランスクリプトには、これが発生したときに `⧉ Selected N lines from <file>` という行が表示されます。`.env` などの機密ファイルを除外するには、そのパスに対して [`Read` 拒否ルール](/ja/permissions#read-and-edit) を追加してください。一致する拒否ルールは、選択されたテキストとそのファイルのオープンファイル通知の両方が Claude に到達するのを防ぎます。

**トランスポートと認証。** サーバーは OS が割り当てた一時的なポートでリッスンし、ポートは設定できません。トランスポートは暗号化されていない `ws://` です。ループバック上では、トラフィックをキャプチャできるプロセスはロックファイルからトークンも読み取ることができるため、TLS はローカル攻撃者に対する保護を追加しません。IDE の起動ごとに新しいランダム認証トークンが生成され、`~/.claude/ide/<port>.lock` のロックファイルに書き込まれ、CLI は `X-Claude-Code-Ide-Authorization` ヘッダーとして提示して接続する必要があります。`CLAUDE_CONFIG_DIR` が設定されている場合、ロックファイルは代わりに `$CLAUDE_CONFIG_DIR/ide/` に書き込まれます。

**モデルに公開されるツール。** サーバーはいくつかのツールをホストしていますが、モデルに表示されるのは 1 つだけです。残りは、diff を開いたり選択を読み取ったりするなど、CLI が独自の UI に使用する内部 RPC であり、ツールリストが Claude に到達する前にフィルタリングされます。

| ツール名（フックで表示） | 機能 | 読み取り専用 |
| - | - | - |
| `mcp__ide__getDiagnostics` | IDE の検査診断（エディターに表示されるエラーと警告）を返します。オプションで 1 つのファイルにスコープできます。 | はい |

JetBrains プラグインは、モデルにコード実行ツールを公開しません。

**リッスンインターフェース。** サーバーがバインドするネットワークインターフェースは、**Settings → Tools → Claude Code \[Beta] → Networking (Advanced)** の下の **Accept connections from all network interfaces** によって制御されます。設定が無効な場合、サーバーは `127.0.0.1` のみでリッスンし、他のホストからはアクセスできません。有効な場合、ポートはローカルネットワークからアクセス可能です。この設定は、WSL2 のデフォルト NAT ネットワークやリモート IDE セットアップなど、CLI がループバック経由で IDE に到達できない場合のために存在します。[WSL 設定](#wsl-configuration) を参照してください。

**Accept connections from all network interfaces** を有効にすると、IDE MCP ポートがローカルネットワークからアクセス可能になります。接続にはロックファイルからの認証トークンが必要ですが、トランスポートが暗号化されていない `ws://` であるため、設定がオンの場合、セッショントラフィックとそのトークンの両方がネットワーク上をクリアテキストで通過します。ループバックが本当に機能しない場合にのみオンにしてください。WSL2 の場合は、[ミラーリングネットワークに切り替える](#switch-wsl2-to-mirrored-networking) ことをお勧めします。これにより、Windows ループバックインターフェースが Linux VM と共有され、ソケットはループバック上に留まります。
