---
title: mcp
source: https://code.claude.com/docs/ja/mcp.md
---

# MCP を使用して Claude Code をツールに接続する

> Model Context Protocol を使用して Claude Code をツールに接続する方法を学びます。

Claude Code は、AI ツール統合のためのオープンソース標準である [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) を通じて、数百の外部ツールとデータソースに接続できます。MCP サーバーは Claude Code にツール、データベース、API へのアクセスを提供します。

別のツール（課題追跡ツールや監視ダッシュボードなど）からチャットにデータをコピーしている場合は、サーバーを接続してください。接続すると、Claude は貼り付けたものから作業する代わりに、そのシステムを直接読み取り、操作できます。

初めてサーバーを接続する場合は、ステップバイステップのウォークスルーについて [MCP クイックスタート](/ja/mcp-quickstart) から始めてください。このページは完全なリファレンスです。

MCP でできること

MCP サーバーが接続されている場合、Claude Code に以下のことを依頼できます：

- **課題追跡ツールから機能を実装する**：「JIRA の課題 ENG-4521 に記載されている機能を追加し、GitHub に PR を作成してください。」
- **監視データを分析する**：「Sentry と Statsig をチェックして、ENG-4521 に記載されている機能の使用状況を確認してください。」
- **データベースをクエリする**：「PostgreSQL データベースに基づいて、ENG-4521 機能を使用した 10 人のランダムなユーザーのメールアドレスを検索してください。」
- **デザインを統合する**：「Slack に投稿された新しい Figma デザインに基づいて、標準メールテンプレートを更新してください。」
- **ワークフローを自動化する**：「新機能に関するフィードバックセッションに招待する 10 人のユーザーに Gmail ドラフトを作成してください。」
- **外部イベントに対応する**：MCP サーバーは [チャネル](/ja/channels) として機能することもでき、セッションにメッセージをプッシュするため、Claude は離席中に Telegram メッセージ、Discord チャット、または webhook イベントに対応できます。

MCP サーバーを検索してビルドする

[Anthropic Directory](https://claude.ai/directory) でレビュー済みのコネクタを参照してください。Directory コネクタは Claude Code と同じ MCP インフラストラクチャを使用しているため、`claude mcp add` を使用して、そこにリストされているリモートサーバーを追加できます。

接続する前に、各サーバーを信頼していることを確認してください。外部コンテンツを取得するサーバーは、[プロンプトインジェクションリスク](/ja/security#protect-against-prompt-injection)にさらされる可能性があります。

独自のサーバーをビルドするには、プロトコルの基礎については [MCP サーバーガイド](https://modelcontextprotocol.io/docs/develop/build-server) を、認証、テスト、Directory への提出については [Claude コネクタビルディングドキュメント](https://claude.com/docs/connectors/building) を参照してください。

公式の [`mcp-server-dev` プラグイン](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/mcp-server-dev) を使用して、Claude にサーバーをスキャフォルドしてもらうこともできます。

Claude Code セッションで、以下を実行します：

```
/plugin install mcp-server-dev@claude-plugins-official
```

Claude Code がマーケットプレイスが見つからないと報告する場合は、まず `/plugin marketplace add anthropics/claude-plugins-official` を実行してから、インストールを再試行してください。インストール後、`/reload-plugins` を実行して、現在のセッションでアクティブにします。

```
/mcp-server-dev:build-mcp-server
```

Claude があなたのユースケースについて質問し、リモート HTTP またはローカル stdio サーバーをスキャフォルドします。

MCP サーバーのインストール

MCP サーバーは、ニーズに応じて複数の方法で設定できます：

オプション 1：リモート HTTP サーバーを追加する

HTTP サーバーはリモート MCP サーバーに接続するための推奨オプションです。これはクラウドベースのサービスに最も広くサポートされているトランスポートです。

```bash
# 基本的な構文
claude mcp add --transport http <name> <url>

# 実際の例：Notion に接続する
claude mcp add --transport http notion https://mcp.notion.com/mcp

# Bearer トークンを使用した例
claude mcp add --transport http secure-api https://api.example.com/mcp \
  --header "Authorization: Bearer your-token"
```

MCP サーバーを `.mcp.json`、`~/.claude.json`、または `claude mcp add-json` で JSON を使用して設定する場合、`type` フィールドは `http` のエイリアスとして `streamable-http` を受け入れます。MCP 仕様ではこのトランスポートに `streamable-http` という名前を使用しているため、サーバードキュメントからコピーされた設定は変更なしで機能します。

`url` を持つが `type` を持たない JSON エントリは設定エラーです。Claude Code は `type` を持たないエントリを stdio サーバーとして読み取るためです。Claude Code はそのサーバーをスキップし、`MCP server "<name>" has a "url" but no "type"; add "type": "http" (or "sse" / "ws") to this entry` と報告します。v2.1.202 より前は、Claude Code はこの設定ミスを `command: expected string, received undefined` と報告していました。

オプション 2：リモート SSE サーバーを追加する

SSE（Server-Sent Events）トランスポートは非推奨です。利用可能な場合は HTTP サーバーを使用してください。

```bash
# 基本的な構文
claude mcp add --transport sse <name> <url>

# 実際の例：Asana に接続する
claude mcp add --transport sse asana https://mcp.asana.com/sse

# 認証ヘッダーを使用した例
claude mcp add --transport sse private-api https://api.company.com/sse \
  --header "X-API-Key: your-key-here"
```

オプション 3：ローカル stdio サーバーを追加する

Stdio サーバーはマシン上でローカルプロセスとして実行されます。システムへの直接アクセスやカスタムスクリプトが必要なツールに最適です。

Claude Code は、生成されたサーバーの環境に `CLAUDE_PROJECT_DIR` を設定して、プロジェクトルートを指定するため、サーバーは作業ディレクトリに依存することなくプロジェクト相対パスを解決できます。これは hooks が `CLAUDE_PROJECT_DIR` 変数で受け取るのと同じディレクトリです。サーバープロセス内から読み取ります。例えば、Node では `process.env.CLAUDE_PROJECT_DIR`、Python では `os.environ["CLAUDE_PROJECT_DIR"]` です。

`CLAUDE_PROJECT_DIR` は安定したプロジェクトルートであり、セッション中に作業ディレクトリを追加または削除しても変わりません。ファイルシステムアクセスを許可されたディレクトリのセットに制限するサーバーは、代わりに MCP `roots/list` リクエストを実装する必要があります。Claude Code は `roots/list` に、セッションの起動ディレクトリと、`--add-dir`、`/add-dir`、または `additionalDirectories` 設定で付与した [追加の作業ディレクトリ](/ja/permissions#working-directories) をすべて返します。Claude Code は、そのセットが変わるときに `notifications/roots/list_changed` を送信します。v2.1.203 より前は、`roots/list` は起動ディレクトリのみを返し、Claude Code は `notifications/roots/list_changed` を送信していませんでした。

この変数はサーバーの環境に設定され、Claude Code 自体の環境には設定されないため、プロジェクトスコープまたはユーザースコープの `.mcp.json` `command` または `args` で `${VAR}` 展開を使用して参照するには、`${CLAUDE_PROJECT_DIR:-.}` などのデフォルトが必要です。プラグイン提供の MCP 設定は `${CLAUDE_PROJECT_DIR}` を直接置換し、デフォルトは必要ありません。

```bash
# 基本的な構文
claude mcp add [options] <name> -- <command> [args...]

# 実際の例：Airtable サーバーを追加する
claude mcp add --env AIRTABLE_API_KEY=YOUR_KEY --transport stdio airtable \
  -- npx -y airtable-mcp-server
```

**重要：サーバー引数を `--` で分離する**

Stdio サーバーの場合、`--`（ダブルダッシュ）は Claude 自体のオプション（`--transport`、`--env`、`--scope` など）をサーバーを実行するコマンドと引数から分離します。`--` の後のすべてはサーバーに変更されずに渡されます。

例：

- `claude mcp add --transport stdio myserver -- npx server` → `npx server` を実行します
- `claude mcp add --env KEY=value --transport stdio myserver -- python server.py --port 8080` → 環境に `KEY=value` を設定して `python server.py --port 8080` を実行します

`--` がない場合、Claude Code はサーバーのフラグ（上記の `--port` など）を独自のオプションとして解析しようとします。

`--env` は複数の `KEY=value` ペアを受け入れます。サーバー名が `--env` の直後に来る場合、CLI は名前を別のペアとして読み取り、それを拒否するため、上記の例のように `--env` とサーバー名の間に少なくとも 1 つの別のオプションを配置してください。

オプション 4：リモート WebSocket サーバーを追加する

WebSocket サーバーは永続的な双方向接続を保持し、Claude に予期しないイベントをプッシュするリモート MCP サーバーに適しています。サーバーがリクエストにのみ応答する場合は HTTP を使用してください。HTTP は OAuth と `claude mcp add --transport` フラグをサポートしていますが、WebSocket はどちらもサポートしていません。

WebSocket サーバーを `.mcp.json` または `claude mcp add-json` で設定します：

```bash
claude mcp add-json events-server \
  '{"type":"ws","url":"wss://mcp.example.com/socket","headers":{"Authorization":"Bearer YOUR_TOKEN"}}'
```

`type: "ws"` エントリは `http` と同じ `url`、`headers`、`headersHelper`、`timeout`、`alwaysLoad` フィールドを受け入れます。認証はヘッダーのみなので、`headers` に静的トークンを渡すか、[`headersHelper`](#use-dynamic-headers-for-custom-authentication) で接続時に生成してください。`claude mcp add --transport` フラグは `ws` を受け入れません。

サーバーの管理

設定後、これらのコマンドで MCP サーバーを管理できます：

```bash
# すべての設定済みサーバーをリストする
claude mcp list

# 特定のサーバーの詳細を取得する
claude mcp get github

# サーバーを削除する
claude mcp remove github

# （Claude Code 内）サーバーのステータスを確認する
/mcp
```

`.mcp.json` からのプロジェクトスコープサーバーで承認待ちのものは、`claude mcp list` に `⏸ Pending approval` として表示されます。`claude` をインタラクティブに実行して、それらを確認して承認してください。`claude mcp get <name>` は保留中のサーバーを `⏸ Pending approval` として表示し、拒否されたサーバーを `✗ Rejected` として表示します。

v2.1.196 以降、`claude mcp list` と `claude mcp get` は、リポジトリにチェックインされていない設定ファイルからのみ `.mcp.json` 承認を読み取ります。これは、`claude` を実行してワークスペーストラストダイアログを受け入れることでワークスペースを信頼するまでです。クローンされたリポジトリは独自のサーバーを承認できません：プロジェクトの `.claude/settings.json` にコミットされた [`enableAllProjectMcpServers` または `enabledMcpjsonServers`](/ja/settings#available-settings) は信頼されていないフォルダでは無視され、サーバーは接続されてヘルスチェックされる代わりに `⏸ Pending approval` のままです。

これらのソースからの承認は、信頼されていないフォルダでも適用されます：

- ユーザーの `~/.claude/settings.json`
- 管理設定
- `--settings` で渡された設定
- `.claude/settings.local.json`（git がそれを追跡していない限り）

任意の設定ファイル内の `disabledMcpjsonServers` エントリはサーバーを拒否します。

`/mcp` パネルは、接続されている各サーバーの横にツール数を表示し、ツール機能をアドバタイズしているが、ツールを公開していないサーバーにフラグを立てます。

リクエストがまだバックグラウンドで接続中のサーバーからのツールを必要とする場合、Claude はそのサーバーが接続されるまで待機してから続行します。デフォルトで有効になっている [ツール検索](#scale-with-mcp-tool-search) を使用すると、待機は `ToolSearch` 呼び出し内で発生します。Google Cloud の Agent Platform、カスタム `ANTHROPIC_BASE_URL`、または `ENABLE_TOOL_SEARCH=false` などのツール検索がない設定では、Claude は代わりに `WaitForMcpServers` ツールを使用します。

一部のサーバー名は Claude Code の組み込みサーバー用に予約されています：`workspace`、`claude-in-chrome`、`computer-use`、`Claude Preview`、`Claude Browser`。設定がこれらの予約名のいずれかでサーバーを定義している場合、Claude Code はロード時にそれをスキップし、名前を変更するよう求める警告を表示します。`claude mcp add` は予約名をエラーで拒否します。

`Claude Preview` と `Claude Browser` は両方とも、[Claude Code デスクトップアプリのプレビューペイン](/ja/desktop#preview-your-app) が使用する組み込みサーバーに名前を付けます。v2.1.205 より前は、`Claude Browser` は予約されていなかったため、ユーザーが設定したサーバーはその名前で登録できました。

動的ツール更新

Claude Code は MCP `list_changed` 通知をサポートしており、MCP サーバーが切断して再接続することなく、利用可能なツール、プロンプト、リソースを動的に更新できます。MCP サーバーが `list_changed` 通知を送信すると、Claude Code はそのサーバーから利用可能な機能を自動的に更新します。

自動再接続

HTTP または SSE サーバーがセッション中に切断された場合、Claude Code は指数バックオフで自動的に再接続します：最大 5 回の試行、1 秒の遅延から始まり、毎回 2 倍になります。サーバーは再接続が進行中の間、`/mcp` では保留中として表示されます。5 回の失敗した試行の後、サーバーは失敗としてマークされ、`/mcp` から手動で再試行できます。Stdio サーバーはローカルプロセスであり、自動的には再接続されません。

同じバックオフは、HTTP または SSE サーバーが起動時に初期接続に失敗した場合にも適用されます。v2.1.121 以降、Claude Code は 5xx レスポンス、接続拒否、タイムアウトなどの一時的なエラーで初期接続を最大 3 回再試行し、それでも接続できない場合はサーバーを失敗としてマークします。認証エラーと見つからないエラーは、解決するために設定変更が必要なため、再試行されません。

設定されたサーバーが接続に失敗した場合、Claude Code は Claude にどのサーバーが失敗したかとその接続エラーを伝えます。これは、マッチするツールが見つからない `ToolSearch` 結果を含みます。そのため、Claude は応答で接続失敗を報告します。[ツール検索](#scale-with-mcp-tool-search) が必要です。これはデフォルトで有効になっています。カスタム `ANTHROPIC_BASE_URL`、`ENABLE_TOOL_SEARCH=false`、または Haiku モデルなどのツール検索がない設定、および Amazon Bedrock、Google Cloud の Agent Platform、Microsoft Foundry では、Claude Code は失敗したサーバー接続を Claude に報告しません。v2.1.205 より前は、Claude Code は接続エラーを Claude に渡さず、Claude は失敗したサーバーのツールが設定されていないかのように応答できました。

v2.1.191 以降、接続成功後に実行される機能検出リクエスト（`tools/list`、`prompts/list`、`resources/list` など）も、一時的なネットワークおよびサーバーエラーを短いバックオフで最大 3 回再試行します。認証エラー、4xx レスポンス、リクエストタイムアウトは再試行されません。

チャネルでメッセージをプッシュする

MCP サーバーはセッションに直接メッセージをプッシュすることもでき、Claude が CI 結果、監視アラート、チャットメッセージなどの外部イベントに対応できます。これを有効にするには、サーバーが `claude/channel` 機能を宣言し、起動時に `--channels` フラグでオプトインします。公式にサポートされているチャネルを使用するには [チャネル](/ja/channels) を参照するか、独自に構築するには [チャネルリファレンス](/ja/channels-reference) を参照してください。

ヒント：

- `-s` または `--scope` フラグを使用して、設定が保存される場所を指定します：
  - `local`（デフォルト）：現在のプロジェクトでのみ利用可能。古いバージョンではこのスコープを `project` と呼んでいました
  - `project`：`.mcp.json` ファイルを通じてプロジェクト内のすべてのユーザーと共有
  - `user`：すべてのプロジェクト全体で利用可能。古いバージョンではこのスコープを `global` と呼んでいました
- `-e` または `--env` フラグで環境変数を設定します（例：`-e KEY=value`）
- `--transport` と `--header` フラグは `-t` と `-H` の短い形式も受け入れます
- `MCP_TIMEOUT` 環境変数を使用して MCP サーバーのスタートアップタイムアウトを設定します（例：`MCP_TIMEOUT=10000 claude` は 10 秒のタイムアウトを設定します）
- サーバーごとのツール実行タイムアウトを設定するには、そのサーバーの `.mcp.json` エントリにミリ秒単位で `timeout` フィールドを追加します。例えば、10 分の場合は `"timeout": 600000` です。これはそのサーバーのみの `MCP_TOOL_TIMEOUT` 環境変数をオーバーライドします
- Claude Code は MCP ツール出力が 10,000 トークンを超えると警告を表示します。この制限を増やすには、`MAX_MCP_OUTPUT_TOKENS` 環境変数を設定します（例：`MAX_MCP_OUTPUT_TOKENS=50000`）
- `/mcp` を使用して、OAuth 2.0 認証が必要なリモートサーバーで認証します

サーバーごとの `timeout` はツール呼び出しごとのハードウォールクロック制限であり、サーバーからの進捗通知はそれを延長しません。1000 未満の値は無視され、`MCP_TOOL_TIMEOUT` にフォールスルーするか、その変数が設定されていない場合は約 28 時間のデフォルトにフォールスルーします。v2.1.162 より前は、1000 未満の値は 1 秒に切り下げられていました。

サーバーごとの `timeout` が少なくとも 1000 の場合、以下で説明するアイドルタイムアウトのフロアとしても機能します：Claude Code はそのサーバーのツール呼び出しをアイドルのために、サーバーごとの `timeout` より早く中止することはありません。Claude Code v2.1.203 以降が必要です。

HTTP および SSE サーバーの場合、リクエストごとのフェッチ最初バイト予算には 60 秒の最小値があります。

MCP サーバーへのツール呼び出しで、アイドルウィンドウ中に応答も進捗通知も送信されない場合、ウォールクロック制限を待つ代わりにエラーで中止されます。アイドルタイムアウトには Claude Code v2.1.187 以降が必要です。IDE サーバーと SDK インプロセスサーバーを除く、すべてのサーバータイプに適用されます。アイドルウィンドウは HTTP、SSE、WebSocket、および [claude.ai コネクタ](#use-mcp-servers-from-claude-ai) サーバーの場合は 5 分、stdio サーバーの場合は 30 分がデフォルトです。v2.1.203 より前は、stdio サーバーはアイドルタイムアウトの対象外でした。

[`CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT`](/ja/env-vars) 環境変数をミリ秒単位で設定してアイドルウィンドウを変更するか、`0` に設定してチェックを無効にしてください。

プラグイン提供の MCP サーバー

[プラグイン](/ja/plugins) は MCP サーバーをバンドルでき、プラグインが有効になると自動的にツールと統合を提供します。プラグイン MCP サーバーはユーザーが設定したサーバーと同じように機能します。

**プラグイン MCP サーバーの仕組み**：

- プラグインはプラグインルートの `.mcp.json` または `plugin.json` 内でインラインで MCP サーバーを定義します
- プラグインが有効になると、その MCP サーバーが自動的に起動します
- プラグイン MCP ツールは手動で設定された MCP ツールと一緒に表示されます
- プラグインサーバーはプラグインのインストールを通じて管理されます（`/mcp` コマンドではありません）

**プラグイン MCP 設定の例**：

プラグインルートの `.mcp.json` 内：

```json
{
  "mcpServers": {
    "database-tools": {
      "command": "${CLAUDE_PLUGIN_ROOT}/servers/db-server",
      "args": ["--config", "${CLAUDE_PLUGIN_ROOT}/config.json"],
      "env": {
        "DB_URL": "${DB_URL}"
      }
    }
  }
}
```

または `plugin.json` 内でインライン：

```json
{
  "name": "my-plugin",
  "mcpServers": {
    "plugin-api": {
      "command": "${CLAUDE_PLUGIN_ROOT}/servers/api-server",
      "args": ["--port", "8080"]
    }
  }
}
```

**プラグイン MCP 機能**：

- **自動ライフサイクル**：セッション起動時に、有効なプラグインのサーバーが自動的に接続されます。セッション中にプラグインを有効または無効にする場合は、`/reload-plugins` を実行して MCP サーバーを接続または切断してください
- **環境変数**：バンドルされたプラグインファイルに `${CLAUDE_PLUGIN_ROOT}` を使用し、プラグイン更新を通じて保持される [永続的な状態](/ja/plugins-reference#persistent-data-directory) に `${CLAUDE_PLUGIN_DATA}` を使用し、安定したプロジェクトルートに `${CLAUDE_PROJECT_DIR}` を使用します
- **ユーザー環境アクセス**：手動で設定されたサーバーと同じ環境変数へのアクセス
- **複数のトランスポートタイプ**：stdio、SSE、HTTP、WebSocket トランスポートをサポート（トランスポートサポートはサーバーによって異なる場合があります）

**プラグイン MCP サーバーの表示**：

```bash
# Claude Code 内で、プラグインのものを含むすべての MCP サーバーを表示
/mcp
```

プラグインサーバーはプラグインから来ていることを示すインジケータ付きでリストに表示されます。

**プラグイン MCP ツール名**：

プラグインでバンドルされた MCP サーバーからのツールには、呼び出し可能な名前にプラグイン名とサーバーキーの両方が含まれます。完全な形式は `mcp__plugin_<plugin-name>_<server-name>__<tool-name>` です。ここで、`A-Z`、`a-z`、`0-9`、`_`、`-` の外の任意の文字は `_` に置き換えられます。`my-plugin` という名前のプラグインでバンドルされた `database-tools` サーバーの場合、`query` ツールは以下のように呼び出し可能です：

```
mcp__plugin_my-plugin_database-tools__query
```

[権限ルール](/ja/permissions)、スキルの `allowed-tools` リスト、[サブエージェントの `tools` フィールド](/ja/sub-agents#available-tools)、または [hook マッチャー](/ja/hooks#match-mcp-tools) でツールを参照する場合は、この完全な名前を使用してください。`mcp__database-tools__.*` などのベアサーバーキーに対して記述された hook マッチャーは、プラグインでバンドルされたサーバーに対しては発火しません。

サーバー自体は、`plugin:<plugin-name>:<server-name>`（例：`plugin:my-plugin:database-tools`）などのスコープ付き名前で登録されます。設定されたサーバー名が予想される場所（例：[`mcp_tool` hook の `server` フィールド](/ja/hooks#mcp-tool-hook-fields)）でその名前を使用してください。

**プラグイン MCP サーバーの利点**：

- **バンドル配布**：ツールとサーバーが一緒にパッケージ化されます
- **自動セットアップ**：手動の MCP 設定は不要です
- **チーム一貫性**：プラグインがインストールされると、すべてのユーザーが同じツールを取得します

プラグインで MCP サーバーをバンドルする詳細については、[プラグインコンポーネントリファレンス](/ja/plugins-reference#mcp-servers) を参照してください。

MCP インストールスコープ

MCP サーバーは 3 つのスコープで設定できます。選択するスコープは、サーバーがロードされるプロジェクトと、設定がチームと共有されるかどうかを制御します。管理者は、[マネージド設定](#managed-mcp-configuration)を通じてエンタープライズレベルでサーバーをデプロイすることもできます。

| スコープ | ロード対象 | チームと共有 | 保存場所 |
| - | - | - | - |
| [ローカル](#local-scope) | 現在のプロジェクトのみ | いいえ | `~/.claude.json` |
| [プロジェクト](#project-scope) | 現在のプロジェクトのみ | はい、バージョン管理経由 | プロジェクトルートの `.mcp.json` |
| [ユーザー](#user-scope) | すべてのプロジェクト | いいえ | `~/.claude.json` |

ローカルスコープ

ローカルスコープはデフォルトです。ローカルスコープのサーバーは、追加したプロジェクトでのみロードされ、あなたにプライベートなままです。Claude Code は `~/.claude.json` のそのプロジェクトのパスの下に保存するため、同じサーバーは他のプロジェクトに表示されません。個人開発サーバー、実験的な設定、またはバージョン管理に含めたくない認証情報を持つサーバーにはローカルスコープを使用してください。

MCP サーバーの「ローカルスコープ」という用語は、一般的なローカル設定とは異なります。MCP ローカルスコープのサーバーは `~/.claude.json`（ホームディレクトリ）に保存されますが、一般的なローカル設定は `.claude/settings.local.json`（プロジェクトディレクトリ内）を使用します。設定ファイルの場所の詳細については、[設定](/ja/settings#settings-files)を参照してください。

```bash
# ローカルスコープのサーバーを追加する（デフォルト）
claude mcp add --transport http stripe https://mcp.stripe.com

# ローカルスコープを明示的に指定する
claude mcp add --transport http stripe --scope local https://mcp.stripe.com
```

コマンドは現在のプロジェクトのエントリを `~/.claude.json` に書き込みます。以下の例は、`/path/to/your/project` から実行した場合の結果を示しています：

```json
{
  "projects": {
    "/path/to/your/project": {
      "mcpServers": {
        "stripe": {
          "type": "http",
          "url": "https://mcp.stripe.com"
        }
      }
    }
  }
}
```

プロジェクトスコープ

プロジェクトスコープのサーバーは、プロジェクトのルートディレクトリの `.mcp.json` ファイルに設定を保存することで、チーム間のコラボレーションを可能にします。このファイルはバージョン管理にチェックインするように設計されており、すべてのチームメンバーが同じ MCP ツールとサービスにアクセスできることを保証します。プロジェクトスコープのサーバーを追加すると、Claude Code は自動的にこのファイルを作成または更新して、適切な設定構造を使用します。

```bash
# プロジェクトスコープのサーバーを追加する
claude mcp add --transport http paypal --scope project https://mcp.paypal.com/mcp
```

結果の `.mcp.json` ファイルは標準化された形式に従います：

```json
{
  "mcpServers": {
    "shared-server": {
      "command": "/path/to/server",
      "args": [],
      "env": {}
    }
  }
}
```

セキュリティ上の理由から、Claude Code は `.mcp.json` ファイルからプロジェクトスコープのサーバーを使用する前に承認を求めます。これらの承認選択をリセットする必要がある場合は、`claude mcp reset-project-choices` コマンドを使用してください。

ユーザースコープ

ユーザースコープのサーバーは `~/.claude.json` に保存され、クロスプロジェクトのアクセス可能性を提供し、マシン上のすべてのプロジェクト全体で利用可能になりながら、ユーザーアカウントにプライベートなままです。このスコープは、個人的なユーティリティサーバー、開発ツール、または異なるプロジェクト全体で頻繁に使用するサービスに適しています。

```bash
# ユーザーサーバーを追加する
claude mcp add --transport http hubspot --scope user https://mcp.hubspot.com/anthropic
```

スコープの階層と優先順位

同じサーバーが複数の場所で定義されている場合、Claude Code はそれに 1 回接続し、最も優先度の高いソースからの定義を使用します。その定義全体が使用され、フィールドはスコープ全体でマージされません。

1. ローカルスコープ
2. プロジェクトスコープ
3. ユーザースコープ
4. [プラグイン提供サーバー](/ja/plugins)
5. [claude.ai コネクタ](#use-mcp-servers-from-claude-ai)

3 つのスコープは名前で重複を照合します。プラグインとコネクタはエンドポイントで照合するため、上記のサーバーと同じ URL またはコマンドを指すものは重複として扱われます。

`.mcp.json` での環境変数の展開

Claude Code は `.mcp.json` ファイルの環境変数の展開をサポートしており、チームが設定を共有しながら、マシン固有のパスと API キーなどの機密値の柔軟性を維持できます。

**サポートされている構文：**

- `${VAR}` - 環境変数 `VAR` の値に展開されます
- `${VAR:-default}` - `VAR` が設定されている場合は `VAR` に展開され、そうでない場合はデフォルトを使用します

**展開場所：**
環境変数は以下で展開できます：

- `command` - サーバー実行可能ファイルのパス
- `args` - コマンドライン引数
- `env` - サーバーに渡される環境変数
- `url` - HTTP サーバータイプの場合
- `headers` - HTTP サーバー認証の場合

**変数展開を使用した例：**

```json
{
  "mcpServers": {
    "api-server": {
      "type": "http",
      "url": "${API_BASE_URL:-https://api.example.com}/mcp",
      "headers": {
        "Authorization": "Bearer ${API_KEY}"
      }
    }
  }
}
```

必要な環境変数が設定されておらず、デフォルト値がない場合、Claude Code は設定の解析に失敗します。

実践的な例

例：Sentry でエラーを監視する

```bash
claude mcp add --transport http sentry https://mcp.sentry.dev/mcp
```

Sentry アカウントで認証します：

```text
/mcp
```

その後、本番環境の問題をデバッグします：

```text
過去 24 時間で最も一般的なエラーは何ですか？
```

```text
エラー ID abc123 のスタックトレースを表示してください
```

```text
どのデプロイメントがこれらの新しいエラーを導入しましたか？
```

例：コードレビューのために GitHub に接続する

GitHub のリモート MCP サーバーは、ヘッダーとして渡される GitHub 個人アクセストークンで認証します。取得するには、[GitHub トークン設定](https://github.com/settings/personal-access-tokens)を開き、Claude が操作したいリポジトリへのアクセス権を持つ新しいきめ細かいトークンを生成してから、サーバーを追加します：

```bash
claude mcp add --transport http github https://api.githubcopilot.com/mcp/ \
  --header "Authorization: Bearer YOUR_GITHUB_PAT"
```

その後、GitHub で作業します：

```text
PR #456 をレビューして改善を提案してください
```

```text
見つけたバグの新しい課題を作成してください
```

```text
自分に割り当てられているすべてのオープン PR を表示してください
```

例：PostgreSQL データベースをクエリする

```bash
claude mcp add --transport stdio db -- npx -y @bytebase/dbhub \
  --dsn "postgresql://readonly:pass@prod.db.com:5432/analytics"
```

その後、データベースを自然に照会します：

```text
今月の総収益はいくらですか？
```

```text
orders テーブルのスキーマを表示してください
```

```text
過去 90 日間に購入していない顧客を検索してください
```

リモート MCP サーバーで認証する

多くのクラウドベースの MCP サーバーは認証が必要です。Claude Code は安全な接続のために OAuth 2.0 をサポートしています。

Claude Code は、サーバーが `401 Unauthorized` または `403 Forbidden` で応答するときに、リモートサーバーが認証を必要とするとマークします。どちらのステータスコードでも、サーバーは `/mcp` でフラグが立てられ、OAuth フローを完了できます。

v2.1.195 以降、トークンの更新がサーバーが保存されたリフレッシュトークンを拒否したために失敗する場合、Claude Code は `/mcp` を指す通知をすぐに表示します。接続されたサーバーのメニューはそこで「Re-authenticate」を提供するため、次のツール呼び出しが失敗する前に再度サインインできます。

認可サーバーを指す `WWW-Authenticate` ヘッダーを返すカスタムサーバーは、他のリモートサーバーと同じ自動検出を取得します。

v2.1.193 以降、Claude Code は 1 つ以上の設定されたサーバーが認証を必要とする場合、スタートアップ通知も表示するため、どのサーバーがサインインを必要とするかを発見するために `/mcp` を開く必要がありません。

非対話型モードでは `/mcp` パネルがないため、Claude Code は OAuth フローを実行できません。v2.1.196 以降、設定されたサーバーが `claude -p` または [ツール検索](#scale-with-mcp-tool-search) が有効になっている Agent SDK 実行中に認証を必要とする場合（これはデフォルトです）、Claude Code は Claude にサーバーのツールが認可されるまで利用できないことを伝えます。Claude はサーバーが設定されていないかのように応答するのではなく、サインインが必要なサーバーに名前を付けることができます。対話型セッションから `/mcp` または `claude mcp login <name>` でサインインを完了してください。

`headers.Authorization` をサーバー用に設定し、サーバーがそのヘッダーを拒否する場合、Claude Code は OAuth にフォールバックするのではなく、接続が失敗したと報告します。トークンが MCP エンドポイント用に有効であることを確認するか、OAuth フローを使用するためにヘッダーを削除してください。

例：

```bash theme={null}
claude mcp add --transport http sentry https://mcp.sentry.dev/mcp
```

Claude Code で、コマンドを使用します：

```text theme={null}
/mcp
```

その後、ブラウザでログインするための手順に従ってください。

ヒント：

- 認証トークンは安全に保存され、自動的に更新されます
- `/mcp` メニューで「Clear authentication」を使用してアクセスを取り消します
- ブラウザが自動的に開かない場合は、提供された URL をコピーして手動で開いてください
- ブラウザのリダイレクトが認証後に接続エラーで失敗する場合は、ブラウザのアドレスバーから完全なコールバック URL を Claude Code に表示される URL プロンプトに貼り付けてください
- OAuth 認証は HTTP サーバーで機能します

コマンドラインから認証する

v2.1.186 以降、`claude mcp login <name>` はシェルから直接設定されたサーバーの OAuth フローを実行するため、セッション内で `/mcp` パネルを開く必要がありません。

```bash
claude mcp login sentry
```

後で保存された認証情報をクリアするには、`claude mcp logout <name>` を実行してください。

v2.1.191 以降、このコマンドは SSH セッション中やディスプレイサーバーのない Linux など、ローカルブラウザが利用できない場合を検出し、ブラウザを開こうとするのではなく認可 URL を出力します。ローカルマシンで URL を開き、ブラウザのアドレスバーから完全なリダイレクト URL をプロンプトに貼り付けます。コマンドは貼り付けステップのためにインタラクティブなターミナルが必要なため、`ssh -t` で接続してください。ローカルブラウザが検出された場合でも URL プロンプトを強制するには、`--no-browser` を渡してください。

```bash
claude mcp login sentry --no-browser
```

固定 OAuth コールバックポートを使用する

一部の MCP サーバーは、事前に登録された特定のリダイレクト URI が必要です。デフォルトでは、Claude Code は OAuth コールバック用にランダムに利用可能なポートを選択します。`--callback-port` を使用してポートを固定し、`http://localhost:PORT/callback` の形式の事前登録されたリダイレクト URI と一致させます。

`--callback-port` を単独で使用できます（動的クライアント登録を使用）、または `--client-id` と一緒に使用できます（事前設定された認証情報を使用）。

```bash
# 動的クライアント登録を使用した固定コールバックポート
claude mcp add --transport http \
  --callback-port 8080 \
  my-server https://mcp.example.com/mcp
```

事前設定された OAuth 認証情報を使用する

一部の MCP サーバーは、Dynamic Client Registration を通じた自動 OAuth セットアップをサポートしていません。「Incompatible auth server: does not support dynamic client registration」のようなエラーが表示される場合、サーバーは事前設定された認証情報が必要です。Claude Code は Client ID Metadata Document（CIMD）を使用するサーバーもサポートしており、これらを自動的に検出します。自動検出に失敗した場合は、まずサーバーの開発者ポータルを通じて OAuth アプリを登録し、サーバーを追加するときに認証情報を提供してください。

サーバーの開発者ポータルを通じてアプリを作成し、クライアント ID とクライアントシークレットをメモしてください。

多くのサーバーはリダイレクト URI も必要とします。その場合は、ポートを選択し、`http://localhost:PORT/callback` の形式でリダイレクト URI を登録してください。次のステップで `--callback-port` と同じポートを使用してください。

次のいずれかの方法を選択してください。`--callback-port` に使用されるポートは、利用可能な任意のポートにすることができます。前のステップで登録したリダイレクト URI と一致する必要があります。

`--client-id` を使用してアプリのクライアント ID を渡します。`--client-secret` フラグはマスクされた入力でシークレットを求めます：

```bash theme={null}
claude mcp add --transport http \
  --client-id your-client-id --client-secret --callback-port 8080 \
  my-server https://mcp.example.com/mcp
```

JSON 設定に `oauth` オブジェクトを含め、`--client-secret` を別のフラグとして渡します：

```bash theme={null}
claude mcp add-json my-server \
  '{"type":"http","url":"https://mcp.example.com/mcp","oauth":{"clientId":"your-client-id","callbackPort":8080}}' \
  --client-secret
```

動的クライアント登録を使用しながらポートを固定するには、クライアント ID なしで `--callback-port` を使用します：

```bash theme={null}
claude mcp add-json my-server \
  '{"type":"http","url":"https://mcp.example.com/mcp","oauth":{"callbackPort":8080}}'
```

環境変数を通じてシークレットを設定して、対話的なプロンプトをスキップします：

```bash theme={null}
MCP_CLIENT_SECRET=your-secret claude mcp add --transport http \
  --client-id your-client-id --client-secret --callback-port 8080 \
  my-server https://mcp.example.com/mcp
```

Claude Code で `/mcp` を実行し、ブラウザのログインフローに従ってください。

ヒント：

- クライアントシークレットはシステムキーチェーン（macOS）または認証情報ファイルに安全に保存され、設定には保存されません
- サーバーがシークレットなしのパブリック OAuth クライアントを使用する場合は、`--client-secret` なしで `--client-id` のみを使用してください
- `--callback-port` は `--client-id` の有無にかかわらず使用できます
- これらのフラグは HTTP および SSE トランスポートにのみ適用されます。stdio サーバーには影響しません
- `claude mcp get <name>` を使用して、OAuth 認証情報がサーバーに設定されていることを確認してください

OAuth メタデータ検出をオーバーライドする

Claude Code を特定の OAuth 認可サーバーメタデータ URL に指定して、デフォルトの検出チェーンをバイパスします。MCP サーバーの標準エンドポイントがエラーになる場合、または内部プロキシを通じて検出をルーティングしたい場合に設定します。デフォルトでは、Claude Code は最初に RFC 9728 保護リソースメタデータを `/.well-known/oauth-protected-resource` でチェックし、次に RFC 8414 認可サーバーメタデータを `/.well-known/oauth-authorization-server` でフォールバックします。

`.mcp.json` のサーバー設定の `oauth` オブジェクトに `authServerMetadataUrl` を設定します：

```json
{
  "mcpServers": {
    "my-server": {
      "type": "http",
      "url": "https://mcp.example.com/mcp",
      "oauth": {
        "authServerMetadataUrl": "https://auth.example.com/.well-known/openid-configuration"
      }
    }
  }
}
```

URL は `https://` を使用する必要があります。メタデータ URL の `scopes_supported` は、アップストリームサーバーがアドバタイズするスコープをオーバーライドします。

OAuth スコープを制限する

`oauth.scopes` を設定して、認可フロー中に Claude Code がリクエストするスコープをピン留めします。これは、アップストリーム認可サーバーがより多くのスコープをアドバタイズする場合に、MCP サーバーをセキュリティチームが承認したサブセットに制限するサポートされた方法です。値は RFC 6749 §3.3 の `scope` パラメータ形式と一致する単一のスペース区切り文字列です。

```json
{
  "mcpServers": {
    "slack": {
      "type": "http",
      "url": "https://mcp.slack.com/mcp",
      "oauth": {
        "scopes": "channels:read chat:write search:read"
      }
    }
  }
}
```

`oauth.scopes` は `authServerMetadataUrl` と `/.well-known` でサーバーが検出するスコープの両方に優先します。MCP サーバーがリクエストするスコープセットを決定するようにするには、設定を解除したままにしてください。

v2.1.196 以降、`oauth.scopes` が設定されていない場合、Claude Code はサーバーの `WWW-Authenticate` ヘッダーまたはその保護リソースメタデータによって提供されるスコープをリクエストし、どちらも提供しない場合は `scope` パラメータを送信しません。自動的に検出された認可サーバーメタデータから完全な `scopes_supported` カタログをリクエストしなくなりました。そのカタログをリクエストすると、管理者のみまたはテンプレートスコープをアドバタイズするアイデンティティプロバイダーが `invalid_scope` エラーで認可リクエストを拒否しました。設定された `authServerMetadataUrl` からフェッチされたメタデータは、その `scopes_supported` をリクエストされたスコープとして提供します。

認可サーバーが `scopes_supported` で `offline_access` をアドバタイズする場合、Claude Code はそれをピン留めされたスコープに追加して、新しいブラウザサインインなしでアクセストークンを更新できるようにします。

サーバーが後で `insufficient_scope` の 403 を返す場合、Claude Code は同じピン留めされたスコープで再認証します。必要なツールが pin の外側のスコープを必要とする場合は、`oauth.scopes` を拡張してください。

カスタム認証用の動的ヘッダーを使用する

MCP サーバーが OAuth 以外の認証スキーム（Kerberos、短期トークン、内部 SSO など）を使用する場合、`headersHelper` を使用して接続時にリクエストヘッダーを生成します。Claude Code はコマンドを実行し、その出力を接続ヘッダーにマージします。

```json
{
  "mcpServers": {
    "internal-api": {
      "type": "http",
      "url": "https://mcp.internal.example.com",
      "headersHelper": "/opt/bin/get-mcp-auth-headers.sh"
    }
  }
}
```

コマンドはインラインにすることもできます：

```json
{
  "mcpServers": {
    "internal-api": {
      "type": "http",
      "url": "https://mcp.internal.example.com",
      "headersHelper": "echo '{\"Authorization\": \"Bearer '\"$(get-token)\"'\"}'"
    }
  }
}
```

**要件：**

- コマンドは文字列キーと値のペアの JSON オブジェクトを stdout に書き込む必要があります
- コマンドは 10 秒のタイムアウト付きのシェルで実行されます
- 動的ヘッダーは同じ名前の静的 `headers` をオーバーライドします

ヘルパーは各接続時に実行されます（セッション開始時と再接続時）。キャッシングはないため、スクリプトはトークンの再利用を担当します。

v2.1.193 以降、ツール呼び出しが `401 Unauthorized` または `403 Forbidden` を返す場合、Claude Code は自動的にヘルパーを再実行し、新しいヘッダーで再接続し、呼び出しを 1 回再試行します。Claude Code は、その再試行も失敗した場合にのみ、サーバーが `/mcp` で認証を必要とするとマークします。

Claude Code は、ヘルパーを実行するときにこれらの環境変数を設定します：

| 変数 | 値 |
| :- | :- |
| `CLAUDE_CODE_MCP_SERVER_NAME` | MCP サーバーの名前 |
| `CLAUDE_CODE_MCP_SERVER_URL` | MCP サーバーの URL |
| `CLAUDE_PLUGIN_ROOT` | プラグインのルートディレクトリ。[プラグイン](/ja/plugins-reference#mcp-servers) がサーバーを提供する場合にのみ設定されます |

これらを使用して、複数の MCP サーバーに対応する単一のヘルパースクリプトを作成できます。

プラグイン提供のサーバーの場合、ヘルパーはそのワーキングディレクトリをプラグインルートに設定して実行されるため、相対 `headersHelper` パスはセッションのワーキングディレクトリに対してではなくプラグインディレクトリ内で解決されます。Claude Code v2.1.195 以降が必要です。

`headersHelper` は任意のシェルコマンドを実行します。プロジェクトまたはローカルスコープで定義されている場合、ワークスペース信頼ダイアログを受け入れた後にのみ実行されます。

JSON 設定から MCP サーバーを追加する

MCP サーバーの JSON 設定がある場合は、直接追加できます：

```bash theme={null}
# 基本的な構文
claude mcp add-json <name> '<json>'

# 例：JSON 設定を使用して HTTP サーバーを追加する
claude mcp add-json weather-api '{"type":"http","url":"https://api.weather.com/mcp","headers":{"Authorization":"Bearer token"}}'

# 例：JSON 設定を使用して stdio サーバーを追加する
claude mcp add-json local-weather '{"type":"stdio","command":"/path/to/weather-cli","args":["--api-key","abc123"],"env":{"CACHE_DIR":"/tmp"}}'

# 例：事前設定された OAuth 認証情報を使用して HTTP サーバーを追加する
claude mcp add-json my-server '{"type":"http","url":"https://mcp.example.com/mcp","oauth":{"clientId":"your-client-id","callbackPort":8080}}' --client-secret
```

```bash theme={null}
claude mcp get weather-api
```

ヒント：

- JSON がシェルで適切にエスケープされていることを確認してください
- JSON は MCP サーバー設定スキーマに準拠する必要があります
- `--scope user` を使用して、プロジェクト固有のサーバーの代わりにユーザー設定にサーバーを追加できます

Claude Desktop から MCP サーバーをインポートする

Claude Desktop で MCP サーバーを既に設定している場合は、それらをインポートできます：

```bash theme={null}
# 基本的な構文 
claude mcp add-from-claude-desktop 
```

コマンドを実行した後、インポートするサーバーを選択できる対話的なダイアログが表示されます。

```bash theme={null}
claude mcp list 
```

`claude mcp` コマンドで追加されたサーバー名には、文字、数字、ハイフン、アンダースコアのみを含めることができます。Claude Desktop はその制限を適用しないため、スペースなどの他の文字を含む名前を持つ Claude Desktop サーバーはインポートできません。インポートは拒否された各名前を報告し、選択した他のサーバーはインポートします。v2.1.205 より前では、最初の無効な名前がインポートを停止し、選択されたサーバーは追加されませんでした。

ヒント：

- この機能は macOS と Windows Subsystem for Linux（WSL）でのみ機能します
- これらのプラットフォームの標準的な場所から Claude Desktop 設定ファイルを読み取ります
- `--scope user` フラグを使用してサーバーをユーザー設定に追加します
- インポートされたサーバーは、名前に文字、数字、ハイフン、アンダースコアのみが含まれている場合、Claude Desktop と同じ名前を保持します。Claude Code は他の文字を含む名前を持つサーバーを報告し、スキップします
- 同じ名前のサーバーが既に存在する場合、数値サフィックスが付与されます（例：`server_1`）

Claude.ai から MCP サーバーを使用する

[Claude.ai](https://claude.ai) アカウントで Claude Code にログインしている場合、Claude.ai で追加した MCP サーバーは Claude Code で自動的に利用可能です：

[claude.ai/customize/connectors](https://claude.ai/customize/connectors) でサーバーを追加します。Team および Enterprise プランでは、管理者のみがサーバーを追加できます。

Claude.ai で必要な認証ステップを完了します。

Claude Code で、以下のコマンドを使用します：

```text theme={null}
/mcp
```

Claude.ai サーバーはリストに表示され、Claude.ai から来ていることを示すインジケータが付きます。

v2.1.161 以降、以前にサインインしたことのないコネクタは、claude.ai セクションの最後にある `Show unused connectors` 行の背後に折りたたまれているため、組織がプロビジョニングしたリストがパネルを埋めることはありません。その行を選択して展開します。以前にサインインしたコネクタは、現在再認証が必要な場合でも表示されたままです。

Claude.ai コネクタは、アクティブな [認証方法](/ja/authentication#authentication-precedence) が Claude.ai サブスクリプションである場合にのみ取得されます。`ANTHROPIC_API_KEY`、`ANTHROPIC_AUTH_TOKEN`、`apiKeyHelper`、または Amazon Bedrock や Google Cloud の Agent Platform などのサードパーティプロバイダーがアクティブな場合は読み込まれません。以前に `/login` を実行した場合でも同様です。`/mcp` で追加したコネクタがリストされない場合は、`/status` を実行してアクティブな認証方法を確認し、その環境変数を設定解除するか `apiKeyHelper` 設定を削除してから、`/login` を実行して Claude.ai アカウントを選択します。

Claude Code で追加したサーバーは、同じ URL を指す claude.ai コネクタより [優先](#scope-hierarchy-and-precedence) されます。この場合、`/mcp` はコネクタを非表示としてリストし、代わりにコネクタを使用する場合は重複を削除する方法を表示します。

Microsoft 365、Gmail、Google Calendar などの一部の Anthropic ホスト型コネクタは、アップストリーム ID プロバイダーが claude.ai が登録したリダイレクト URL のみを受け入れるため、Claude Code からのローカル OAuth をサポートしていません。v2.1.162 以降、これらのホストのいずれかを `/mcp` で認証すると、代わりに claude.ai の Settings → Connectors で接続するよう指示するメッセージが表示されます。そこで接続されると、コネクタは Claude Code に自動的に表示されます。

claude.ai コネクタを無効にする

Claude Code で claude.ai MCP サーバーを無効にするには、任意の設定スコープで [`disableClaudeAiConnectors`](/ja/settings#available-settings) を `true` に設定します：

```json
{
  "disableClaudeAiConnectors": true
}
```

この設定は任意のソース true セマンティクスを使用します：任意の設定ソースの `true` が優先されます。チェックインされたプロジェクト `.claude/settings.json` はリポジトリをクラウドコネクタから除外できますが、プロジェクトレベルの `false` はユーザーレベルまたはポリシーレベルの `true` が無効にしたコネクタを再度有効にすることはできません。`--mcp-config` を介して明示的に渡されたサーバーは影響を受けません。

`ENABLE_CLAUDEAI_MCP_SERVERS` 環境変数を `false` に設定することもできます。これは現在のシェルセッションに対して同じ効果があります：

```bash
ENABLE_CLAUDEAI_MCP_SERVERS=false claude
```

すべての claude.ai コネクタを無効にする代わりに個別の claude.ai コネクタをブロックするには、名前または URL パターンで [`deniedMcpServers`](/ja/managed-mcp) に追加します。たとえば、`serverName` エントリ `"claude.ai Slack"` は Slack コネクタをブロックします。現在のプロジェクトのみのコネクタのオン/オフを切り替えるには、`/mcp` パネルを使用します。

これらのクライアント側の設定は、ローカル Claude Code セッションを管理します。[Claude Code on the web](/ja/claude-code-on-the-web) セッションでは、claude.ai コネクタはリモートホストによってプロビジョニングされ、明示的な `--mcp-config` エントリとして到着するため、`disableClaudeAiConnectors` は適用されません。コネクタ URL はセッションプロキシを通じて書き直されるため、ベンダー URL をターゲットとする `deniedMcpServers` `serverUrl` パターンは一致しません。クラウドセッションが使用できるコネクタを管理するには、claude.ai 組織設定から行います。

Claude Code を MCP サーバーとして使用する

Claude Code 自体を MCP サーバーとして使用でき、他のアプリケーションが接続できます：

```bash
# Claude を stdio MCP サーバーとして起動する
claude mcp serve
```

これを Claude Desktop で使用するには、この設定を claude\_desktop\_config.json に追加します：

```json
{
  "mcpServers": {
    "claude-code": {
      "type": "stdio",
      "command": "claude",
      "args": ["mcp", "serve"],
      "env": {}
    }
  }
}
```

**実行可能ファイルパスの設定**：`command` フィールドは Claude Code 実行可能ファイルを参照する必要があります。`claude` コマンドがシステムの PATH にない場合は、実行可能ファイルへの完全なパスを指定する必要があります。

完全なパスを見つけるには：

```bash theme={null}
which claude
```

その後、設定で完全なパスを使用します：

```json theme={null}
{
  "mcpServers": {
    "claude-code": {
      "type": "stdio",
      "command": "/full/path/to/claude",
      "args": ["mcp", "serve"],
      "env": {}
    }
  }
}
```

正しい実行可能ファイルパスがないと、`spawn claude ENOENT` のようなエラーが発生します。

ヒント：

- サーバーは View、Edit、LS などの Claude のツールへのアクセスを提供します
- Claude Desktop で、Claude にディレクトリ内のファイルを読み取り、編集などを行うよう依頼してみてください。
- この MCP サーバーは Claude Code のツールのみを MCP クライアントに公開しているため、独自のクライアントは個々のツール呼び出しのユーザー確認を実装する責任があります。

MCP 出力制限と警告

MCP ツールが大きな出力を生成する場合、Claude Code はトークン使用量を管理して、会話コンテキストが圧倒されるのを防ぐのに役立ちます：

- **出力警告閾値**：Claude Code は MCP ツール出力が 10,000 トークンを超えると警告を表示します
- **設定可能な制限**：`MAX_MCP_OUTPUT_TOKENS` 環境変数を使用して、許可される最大 MCP 出力トークンを調整できます
- **デフォルト制限**：デフォルトの最大値は 25,000 トークンです
- **スコープ**：環境変数は独自の制限を宣言しないツールに適用されます。[`anthropic/maxResultSizeChars`](#raise-the-limit-for-a-specific-tool) を設定するツールは、`MAX_MCP_OUTPUT_TOKENS` が何に設定されているかに関わらず、テキストコンテンツにその値を使用します。画像データを返すツールは引き続き `MAX_MCP_OUTPUT_TOKENS` の対象です

大きな出力を生成するツールの制限を増やすには：

```bash
export MAX_MCP_OUTPUT_TOKENS=50000
claude
```

これは特に以下を行う MCP サーバーで役立ちます：

- 大規模なデータセットまたはデータベースをクエリする
- 詳細なレポートまたはドキュメントを生成する
- 広範なログファイルまたはデバッグ情報を処理する

特定のツールの制限を引き上げる

MCP サーバーを構築している場合、ツールの `tools/list` 応答エントリで `_meta["anthropic/maxResultSizeChars"]` を設定することで、個々のツールがデフォルトの永続化ディスク閾値より大きい結果を返すことを許可できます。Claude Code はそのツールの閾値を注釈付き値に引き上げます。最大 500,000 文字のハードシーリングまで。

これは、データベーススキーマまたは完全なファイルツリーなど、本質的に大きいが必要な出力を返すツールに役立ちます。注釈がない場合、デフォルト閾値を超える結果はディスクに永続化され、会話内のファイル参照に置き換えられます。

```json
{
  "name": "get_schema",
  "description": "Returns the full database schema",
  "_meta": {
    "anthropic/maxResultSizeChars": 200000
  }
}
```

注釈はテキストコンテンツの `MAX_MCP_OUTPUT_TOKENS` とは独立して適用されるため、ユーザーは注釈を宣言するツールのために環境変数を引き上げる必要はありません。画像データを返すツールは引き続きトークン制限の対象です。

特定の MCP サーバーで出力警告が頻繁に発生する場合は、`MAX_MCP_OUTPUT_TOKENS` 制限を増やすことを検討してください。制御していないサーバーの場合は、サーバー作成者に `anthropic/maxResultSizeChars` 注釈を追加するか、応答をページネーションするよう依頼することもできます。注釈は画像コンテンツを返すツールには影響しません。これらの場合、`MAX_MCP_OUTPUT_TOKENS` を引き上げることが唯一のオプションです。

ツール入力スキーマとルートレベルのコンビネータ

一部の MCP サーバーは、ツールの入力スキーマを JSON Schema ユニオンとして宣言し、スキーマの最上位に `anyOf`、`oneOf`、または `allOf` があります。Claude API はこれらのキーワードをスキーマルートで受け入れません。`properties` 内にネストされたコンビネータは受け入れます。これは Claude Code が変更されずに送信します。

Claude Code v2.1.195 以降、ルートレベルのコンビネータを持つツールは利用可能なままです。API にツールを送信する前に、Claude Code はスキーマを単一のオブジェクトにフラット化し、ツールの説明の先頭に、どのパラメータグループが一緒に属しているかを Claude に伝える文を追加します：

- `allOf`：すべてのブランチのプロパティがマージされ、各ブランチの `required` リストは引き続き適用されます
- `anyOf` と `oneOf`：すべてのブランチのプロパティがマージされ、各ブランチの `required` リストはスキーマによって強制されるのではなく、ツール説明で説明されます

サーバーは Claude が選択した引数を受け取るため、サーバー側で組み合わせの検証を続けてください。

Claude Code が API が受け入れるスキーマを生成できない場合、またはリモート設定を受け取らないデプロイメント（オフラインマシンなど）では、そのツールをスキップし、理由をサーバーのログに記録し、サーバーの他のツールを利用可能なままにします。v2.1.195 より前のバージョンでは、入力スキーマにルートレベルの `anyOf`、`oneOf`、または `allOf` があるすべてのツールをスキップします。

特定のツールの承認を要求する

MCP サーバーを構築している場合、ツールの `tools/list` 応答エントリで `_meta["anthropic/requiresUserInteraction"]` を `true` に設定することで、ツールがすべての呼び出しで明示的な承認を必要とするとマークできます。値は JSON ブール値 `true` である必要があります。他の値は無視されます。

Claude Code は、`acceptEdits`、`auto`、`bypassPermissions` [権限モード](/ja/permissions#permission-modes) でも、そのツールの権限プロンプトをすべての呼び出しで表示し、「今後は聞かない」オプションを提供しません。[許可ルール](/ja/permissions#permission-rule-syntax) がツールと一致しても、プロンプトをスキップしません。`dontAsk` モードでは、プロンプトを表示しないため、Claude Code は呼び出しを拒否します。

プロンプトは人に到達する必要があります。[`--permission-prompt-tool`](/ja/cli-reference#cli-flags) を使用した非対話型モードでは、フラグ付きツールのプロンプトツールからの `allow` 結果は、メッセージ `MCP tool requires user interaction; not supported via --permission-prompt-tool` を含む拒否に変換されます。Agent SDK の [`canUseTool` コールバック](/ja/agent-sdk/permissions) はこれらの呼び出しを受け取り、承認できます。SDK ホストはユーザーに表示することが期待されるためです。

これは、同意またはアクセス許可ステップなど、権限プロンプト自体がポイントであるツールに使用します。自動承認は人間が同意しないことを意味するため。同じサーバーの他のツールは通常の権限動作を保持します。

次の `tools/list` エントリは、1 つのツールを常に承認が必要とマークします。

```json
{
  "name": "grant_access",
  "description": "Requests access to a protected resource",
  "_meta": {
    "anthropic/requiresUserInteraction": true
  }
}
```

`anthropic/requiresUserInteraction` 注釈には Claude Code v2.1.199 以降が必要です。以前のバージョンはそれを無視し、標準的な権限フローを適用します。

セッションが [Remote Control](/ja/remote-control) または SDK ホストに接続されている場合、Claude Code は権限リクエストをユーザーインタラクションが必要とマークするため、クライアントはワンタップ承認アクションの代わりにツールの権限プロンプトを表示します。

MCP 応答要求に対応する

MCP サーバーはタスク中に構造化された入力をあなたに要求するための応答要求を使用できます。サーバーが独自に取得できない情報が必要な場合、Claude Code は対話的なダイアログを表示し、あなたの応答をサーバーに返します。設定は不要です。応答要求ダイアログはサーバーが要求したときに自動的に表示されます。

サーバーは 2 つの方法で入力を要求できます：

- **フォームモード**：Claude Code はサーバーで定義されたフォームフィールド（例：ユーザー名とパスワードプロンプト）を含むダイアログを表示します。フィールドに入力して送信します。
- **URL モード**：Claude Code はブラウザ URL を開いて認証または承認を行います。ブラウザでフローを完了し、CLI で確認します。

応答要求に自動応答するには、[`Elicitation` フック](/ja/hooks#elicitation)を使用してください。

MCP サーバーを構築していて応答要求を使用する場合は、[MCP 応答要求仕様](https://modelcontextprotocol.io/docs/learn/client-concepts#elicitation)を参照してプロトコルの詳細とスキーマの例を確認してください。

MCP リソースを使用する

MCP サーバーはリソースを公開でき、ファイルを参照する方法と同様に @ メンションを使用して参照できます。

MCP リソースを参照する

プロンプトで `@` を入力して、接続されているすべての MCP サーバーから利用可能なリソースを表示します。リソースはオートコンプリートメニューのファイルと一緒に表示されます。

`@server:protocol://resource/path` の形式を使用してリソースを参照します：

```text theme={null}
Can you analyze @github:issue://123 and suggest a fix?
```

```text theme={null}
Please review the API documentation at @docs:file://api/authentication
```

1 つのプロンプトで複数のリソースを参照できます：

```text theme={null}
Compare @postgres:schema://users with @docs:file://database/user-model
```

ヒント：

- リソースは参照されると自動的に取得され、添付ファイルとして含まれます
- リソースパスは @ メンションオートコンプリートでファジー検索可能です
- Claude Code はサーバーがサポートしている場合、MCP リソースをリストおよび読み取るツールを自動的に提供します
- リソースには、MCP サーバーが提供するあらゆるタイプのコンテンツ（テキスト、JSON、構造化データなど）を含めることができます

MCP ツール検索でスケーリングする

ツール検索は MCP コンテキスト使用量を低く保つことで、ツール定義をオンデマンドで遅延させます。セッション開始時にはツール名とサーバー命令のみがロードされるため、より多くの MCP サーバーを追加してもコンテキストウィンドウへの影響は最小限です。Claude Code は固定のサーバーごとのツール上限を課しません。実用的な制限はコンテキストウィンドウの予算です。

仕組み

ツール検索はデフォルトで有効です。MCP ツールは事前にコンテキストにロードされるのではなく、遅延されます。Claude はタスクが必要な場合、検索ツールを使用して関連する MCP ツールを検出します。Claude が実際に使用するツールのみがコンテキストに入ります。あなたの視点からは、MCP ツールは以前と同じように機能します。

しきい値ベースのロードを優先する場合は、`ENABLE_TOOL_SEARCH=auto` を設定して、コンテキストウィンドウの 10% 以内に収まる場合はスキーマを事前にロードし、オーバーフローのみを遅延させます。すべてのオプションについては、[ツール検索の設定](#configure-tool-search)を参照してください。

MCP サーバー作成者向け

MCP サーバーを構築している場合、ツール検索が有効になっているとサーバー命令フィールドがより有用になります。サーバー命令は、[スキル](/ja/skills)の仕組みと同様に、Claude がいつサーバーのツールを検索するかを理解するのに役立ちます。

明確で説明的なサーバー命令を追加して、以下を説明します：

- ツールが処理するタスクのカテゴリ
- Claude がツールを検索すべき場合
- サーバーが提供する主な機能

Claude Code はツール説明とサーバー命令を各 2KB で切り詰めます。切り詰めを避けるために簡潔に保ち、重要な詳細を最初に配置してください。

ツール検索を設定する

ツール検索はデフォルトで有効です：MCP ツールは遅延され、オンデマンドで検出されます。Claude Code は Google Cloud の Agent Platform ではデフォルトで無効にします。`ANTHROPIC_BASE_URL` が非ファーストパーティホストを指している場合も無効です。ほとんどのプロキシは `tool_reference` ブロックを転送しないためです。`ENABLE_TOOL_SEARCH` を明示的に設定して、いずれかのフォールバックをオーバーライドしてください。

ツール検索には、`tool_reference` ブロックをサポートするモデルが必要です。Haiku モデルはツール検索をサポートしていません。Google Cloud の Agent Platform では、Claude Sonnet 4.5 以降および Claude Opus 4.5 以降でツール検索がサポートされています。

`ENABLE_TOOL_SEARCH` 環境変数でツール検索の動作を制御します：

| 値 | 動作 |
| :- | :- |
| （未設定） | すべての MCP ツールが遅延され、オンデマンドでロードされます。Google Cloud の Agent Platform または `ANTHROPIC_BASE_URL` が非ファーストパーティホストの場合は事前ロードにフォールバック |
| `true` | すべての MCP ツールが遅延。Claude Code は Google Cloud の Agent Platform およびプロキシ経由でもベータヘッダーを送信します。Google Cloud の Agent Platform モデルが Sonnet 4.5 または Opus 4.5 より前の場合、または `tool_reference` ブロックをサポートしないプロキシの場合、リクエストは失敗します |
| `auto` | しきい値モード：ツールがコンテキストウィンドウの 10% 以内に収まる場合は事前ロード、そうでない場合は遅延 |
| `auto:N` | カスタムパーセンテージ付きしきい値モード。`N` は 0-100（例：5% の場合は `auto:5`） |
| `false` | すべての MCP ツールが事前ロード、遅延なし |

```bash
# カスタム 5% しきい値を使用する
ENABLE_TOOL_SEARCH=auto:5 claude

# ツール検索を完全に無効にする
ENABLE_TOOL_SEARCH=false claude
```

または、[settings.json `env` フィールド](/ja/settings#available-settings)で値を設定します。

`ToolSearch` ツールを特別に無効にすることもできます：

```json
{
  "permissions": {
    "deny": ["ToolSearch"]
  }
}
```

サーバーを遅延から除外する

サーバーのツールが検索ステップなしで常に Claude に表示される場合は、そのサーバーの設定で `alwaysLoad` を `true` に設定します。そのサーバーのすべてのツールは、`ENABLE_TOOL_SEARCH` 設定に関係なく、セッション開始時にコンテキストにロードされます。これは、Claude がすべてのターンで必要とする少数のツールに使用してください。各事前ロードツールはコンテキストを消費するため、会話に利用可能なコンテキストが減少します。

次の `.mcp.json` エントリは、1 つの HTTP サーバーを除外し、他のサーバーは遅延したままにします：

```json
{
  "mcpServers": {
    "core-tools": {
      "type": "http",
      "url": "https://mcp.example.com/mcp",
      "alwaysLoad": true
    }
  }
}
```

`alwaysLoad` フィールドはすべてのサーバータイプで利用可能で、Claude Code v2.1.121 以降が必要です。MCP サーバーは、ツールの `_meta` オブジェクトに `"anthropic/alwaysLoad": true` を含めることで、個別のツールを常にロードとしてマークすることもできます。これはそのツールのみに同じ効果があります。

`alwaysLoad: true` を設定すると、サーバーが接続されるまでスタートアップもブロックされます。これは標準的な 5 秒の接続タイムアウトでキャップされます。これは MCP スタートアップが[デフォルトではノンブロッキング](/ja/env-vars)である場合でも適用されます。ツールは最初のプロンプトが構築されるときに存在する必要があるためです。他のサーバーはバックグラウンドで接続し続けます。

MCP プロンプトをコマンドとして使用する

MCP サーバーはプロンプトを公開でき、Claude Code でコマンドとして利用可能になります。

MCP プロンプトを実行する

`/` を入力して、MCP サーバーからのプロンプトを含むすべての利用可能なコマンドを表示します。MCP プロンプトは `/mcp__servername__promptname` の形式で表示されます。

```text theme={null}
/mcp__github__list_prs
```

多くのプロンプトは引数を受け入れます。コマンドの後にスペース区切りで渡します：

```text theme={null}
/mcp__github__pr_review 456
```

```text theme={null}
/mcp__jira__create_issue "ログインフローのバグ" high
```

ヒント：

- MCP プロンプトは接続されているサーバーから動的に検出されます
- 引数はプロンプトの定義されたパラメータに基づいて解析されます
- プロンプト結果は会話に直接注入されます
- サーバーとプロンプト名は正規化されます（スペースはアンダースコアになります）

管理対象 MCP 設定

MCP サーバーへのアクセスを集中管理する必要がある組織の場合は、[管理対象 MCP 設定](/ja/managed-mcp)を参照してください。`managed-mcp.json` を使用した固定サーバーセットのデプロイ、`allowedMcpServers` と `deniedMcpServers` によるサーバーの制限、およびサーバーがブロックされた場合にユーザーに表示される内容について説明しています。
