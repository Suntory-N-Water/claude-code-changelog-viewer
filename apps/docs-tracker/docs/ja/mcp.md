---
title: mcp
source: https://code.claude.com/docs/ja/mcp.md
---

# MCP を使用して Claude Code をツールに接続する

> Model Context Protocol を使用して Claude Code をツールに接続する方法を学びます。

Claude Code は、AI ツール統合のためのオープンソース標準である [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) を通じて、数百の外部ツールとデータソースに接続できます。MCP サーバーは Claude Code にツール、データベース、API へのアクセスを提供します。

## MCP でできること

MCP サーバーが接続されている場合、Claude Code に以下のことを依頼できます：

- **課題追跡ツールから機能を実装する**：「JIRA の課題 ENG-4521 に記載されている機能を追加し、GitHub に PR を作成してください。」
- **監視データを分析する**：「Sentry と Statsig をチェックして、ENG-4521 に記載されている機能の使用状況を確認してください。」
- **データベースをクエリする**：「PostgreSQL データベースに基づいて、ENG-4521 機能を使用した 10 人のランダムなユーザーのメールアドレスを検索してください。」
- **デザインを統合する**：「Slack に投稿された新しい Figma デザインに基づいて、標準メールテンプレートを更新してください。」
- **ワークフローを自動化する**：「新機能に関するフィードバックセッションに招待する 10 人のユーザーに Gmail ドラフトを作成してください。」
- **外部イベントに対応する**：MCP サーバーは [チャネル](/ja/channels) として機能することもでき、セッションにメッセージをプッシュするため、Claude は離席中に Telegram メッセージ、Discord チャット、または webhook イベントに対応できます。

## 人気のある MCP サーバー

Claude Code に接続できる一般的に使用される MCP サーバーをいくつか紹介します：

サードパーティの MCP サーバーは自己責任で使用してください。Anthropic はこれらすべてのサーバーの正確性またはセキュリティを検証していません。
インストールする MCP サーバーを信頼していることを確認してください。
信頼できないコンテンツを取得する可能性のある MCP サーバーを使用する場合は特に注意してください。これらはプロンプトインジェクションのリスクにさらされる可能性があります。

**特定の統合が必要ですか？** [GitHub で数百以上の MCP サーバーを検索](https://github.com/modelcontextprotocol/servers)するか、[MCP SDK](https://modelcontextprotocol.io/quickstart/server) を使用して独自のサーバーを構築してください。

## MCP サーバーのインストール

MCP サーバーは、ニーズに応じて 3 つの異なる方法で設定できます：

### オプション 1：リモート HTTP サーバーを追加する

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

### オプション 2：リモート SSE サーバーを追加する

SSE (Server-Sent Events) トランスポートは非推奨です。利用可能な場合は HTTP サーバーを使用してください。

```bash
# 基本的な構文
claude mcp add --transport sse <name> <url>

# 実際の例：Asana に接続する
claude mcp add --transport sse asana https://mcp.asana.com/sse

# 認証ヘッダーを使用した例
claude mcp add --transport sse private-api https://api.company.com/sse \
  --header "X-API-Key: your-key-here"
```

### オプション 3：ローカル stdio サーバーを追加する

Stdio サーバーはマシン上でローカルプロセスとして実行されます。システムへの直接アクセスやカスタムスクリプトが必要なツールに最適です。

```bash
# 基本的な構文
claude mcp add [options] <name> -- <command> [args...]

# 実際の例：Airtable サーバーを追加する
claude mcp add --transport stdio --env AIRTABLE_API_KEY=YOUR_KEY airtable \
  -- npx -y airtable-mcp-server
```

**重要：オプションの順序**

すべてのオプション（`--transport`、`--env`、`--scope`、`--header`）はサーバー名の**前に**来る必要があります。`--`（ダブルダッシュ）はサーバー名を MCP サーバーに渡されるコマンドと引数から分離します。

例：

- `claude mcp add --transport stdio myserver -- npx server` → `npx server` を実行します
- `claude mcp add --transport stdio --env KEY=value myserver -- python server.py --port 8080` → 環境に `KEY=value` を設定して `python server.py --port 8080` を実行します

これにより、Claude のフラグとサーバーのフラグの間の競合を防ぎます。

### サーバーの管理

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

### 動的ツール更新

Claude Code は MCP `list_changed` 通知をサポートしており、MCP サーバーが切断して再接続することなく、利用可能なツール、プロンプト、リソースを動的に更新できます。MCP サーバーが `list_changed` 通知を送信すると、Claude Code はそのサーバーから利用可能な機能を自動的に更新します。

### チャネルでメッセージをプッシュする

MCP サーバーはセッションに直接メッセージをプッシュすることもでき、Claude が CI 結果、監視アラート、チャットメッセージなどの外部イベントに対応できます。これを有効にするには、サーバーが `claude/channel` 機能を宣言し、起動時に `--channels` フラグでオプトインします。公式にサポートされているチャネルを使用するには [チャネル](/ja/channels) を参照するか、独自に構築するには [チャネルリファレンス](/ja/channels-reference) を参照してください。

ヒント：

- `--scope` フラグを使用して、設定が保存される場所を指定します：
  - `local`（デフォルト）：現在のプロジェクトでのみ利用可能（古いバージョンでは `project` と呼ばれていました）
  - `project`：`.mcp.json` ファイルを通じてプロジェクト内のすべてのユーザーと共有
  - `user`：すべてのプロジェクト全体で利用可能（古いバージョンでは `global` と呼ばれていました）
- `--env` フラグで環境変数を設定します（例：`--env KEY=value`）
- `MCP_TIMEOUT` 環境変数を使用して MCP サーバーのスタートアップタイムアウトを設定します（例：`MCP_TIMEOUT=10000 claude` は 10 秒のタイムアウトを設定します）
- Claude Code は MCP ツール出力が 10,000 トークンを超えると警告を表示します。この制限を増やすには、`MAX_MCP_OUTPUT_TOKENS` 環境変数を設定します（例：`MAX_MCP_OUTPUT_TOKENS=50000`）
- `/mcp` を使用して、OAuth 2.0 認証が必要なリモートサーバーで認証します

**Windows ユーザー向け**：ネイティブ Windows（WSL ではない）では、`npx` を使用するローカル MCP サーバーは適切な実行を確保するために `cmd /c` ラッパーが必要です。

```bash theme={null}
# これにより、Windows が実行できる command="cmd" が作成されます
claude mcp add --transport stdio my-server -- cmd /c npx -y @some/package
```

`cmd /c` ラッパーがないと、Windows は `npx` を直接実行できないため「Connection closed」エラーが発生します。（`--` パラメータの説明については上記のメモを参照してください。）

### プラグイン提供の MCP サーバー

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
- **環境変数**：バンドルされたプラグインファイルに `${CLAUDE_PLUGIN_ROOT}` を使用し、プラグイン更新を通じて保持される [永続的な状態](/ja/plugins-reference#persistent-data-directory) に `${CLAUDE_PLUGIN_DATA}` を使用します
- **ユーザー環境アクセス**：手動で設定されたサーバーと同じ環境変数へのアクセス
- **複数のトランスポートタイプ**：stdio、SSE、HTTP トランスポートをサポート（トランスポートサポートはサーバーによって異なる場合があります）

**プラグイン MCP サーバーの表示**：

```bash
# Claude Code 内で、プラグインのものを含むすべての MCP サーバーを表示
/mcp
```

プラグインサーバーはプラグインから来ていることを示すインジケータ付きでリストに表示されます。

**プラグイン MCP サーバーの利点**：

- **バンドル配布**：ツールとサーバーが一緒にパッケージ化されます
- **自動セットアップ**：手動の MCP 設定は不要です
- **チーム一貫性**：プラグインがインストールされると、すべてのユーザーが同じツールを取得します

プラグインで MCP サーバーをバンドルする詳細については、[プラグインコンポーネントリファレンス](/ja/plugins-reference#mcp-servers)を参照してください。

## MCP インストールスコープ

MCP サーバーは 3 つの異なるスコープレベルで設定でき、それぞれサーバーのアクセス可能性と共有を管理するための異なる目的を果たします。これらのスコープを理解することで、特定のニーズに合わせてサーバーを設定する最適な方法を決定するのに役立ちます。

### ローカルスコープ

ローカルスコープのサーバーはデフォルトの設定レベルを表し、プロジェクトのパスの下の `~/.claude.json` に保存されます。これらのサーバーはプライベートなままで、現在のプロジェクトディレクトリ内で作業する場合にのみアクセス可能です。このスコープは、個人開発サーバー、実験的な設定、または共有すべきでない機密認証情報を含むサーバーに最適です。

MCP サーバーの「ローカルスコープ」という用語は、一般的なローカル設定とは異なります。MCP ローカルスコープのサーバーは `~/.claude.json`（ホームディレクトリ）に保存されますが、一般的なローカル設定は `.claude/settings.local.json`（プロジェクトディレクトリ内）を使用します。設定ファイルの場所の詳細については、[設定](/ja/settings#settings-files)を参照してください。

```bash
# ローカルスコープのサーバーを追加する（デフォルト）
claude mcp add --transport http stripe https://mcp.stripe.com

# ローカルスコープを明示的に指定する
claude mcp add --transport http stripe --scope local https://mcp.stripe.com
```

### プロジェクトスコープ

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

### ユーザースコープ

ユーザースコープのサーバーは `~/.claude.json` に保存され、クロスプロジェクトのアクセス可能性を提供し、マシン上のすべてのプロジェクト全体で利用可能になりながら、ユーザーアカウントにプライベートなままです。このスコープは、個人的なユーティリティサーバー、開発ツール、または異なるプロジェクト全体で頻繁に使用するサービスに適しています。

```bash
# ユーザーサーバーを追加する
claude mcp add --transport http hubspot --scope user https://mcp.hubspot.com/anthropic
```

### 適切なスコープの選択

以下に基づいてスコープを選択してください：

- **ローカルスコープ**：個人サーバー、実験的な設定、または 1 つのプロジェクトに固有の機密認証情報
- **プロジェクトスコープ**：チーム共有サーバー、プロジェクト固有のツール、またはコラボレーションに必要なサービス
- **ユーザースコープ**：複数のプロジェクト全体で必要な個人的なユーティリティ、開発ツール、または頻繁に使用されるサービス

**MCP サーバーはどこに保存されていますか？**

- **ユーザーおよびローカルスコープ**：`~/.claude.json`（`mcpServers` フィールドまたはプロジェクトパスの下）
- **プロジェクトスコープ**：プロジェクトルートの `.mcp.json`（ソース管理にチェックイン）
- **管理対象**：システムディレクトリの `managed-mcp.json`（[管理対象 MCP 設定](#managed-mcp-configuration)を参照）

### スコープの階層と優先順位

MCP サーバー設定は明確な優先順位の階層に従います。同じ名前のサーバーが複数のスコープに存在する場合、システムはローカルスコープのサーバーを最初に優先し、次にプロジェクトスコープのサーバー、最後にユーザースコープのサーバーを優先することで競合を解決します。この設計により、必要に応じて個人設定が共有設定をオーバーライドできることが保証されます。

サーバーがローカルで設定されており、[claude.ai コネクタ](#use-mcp-servers-from-claude-ai)を通じても設定されている場合、ローカル設定が優先され、コネクタエントリはスキップされます。

### `.mcp.json` での環境変数の展開

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

## 実践的な例

### 例：Sentry でエラーを監視する

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

### 例：コードレビューのために GitHub に接続する

```bash
claude mcp add --transport http github https://api.githubcopilot.com/mcp/
```

必要に応じて GitHub を選択して認証します：

```text
/mcp
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

### 例：PostgreSQL データベースをクエリする

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

## リモート MCP サーバーで認証する

多くのクラウドベースの MCP サーバーは認証が必要です。Claude Code は安全な接続のために OAuth 2.0 をサポートしています。

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

### 固定 OAuth コールバックポートを使用する

一部の MCP サーバーは、事前に登録された特定のリダイレクト URI が必要です。デフォルトでは、Claude Code は OAuth コールバック用にランダムに利用可能なポートを選択します。`--callback-port` を使用してポートを固定し、`http://localhost:PORT/callback` の形式の事前登録されたリダイレクト URI と一致させます。

`--callback-port` を単独で使用できます（動的クライアント登録を使用）、または `--client-id` と一緒に使用できます（事前設定された認証情報を使用）。

```bash
# 動的クライアント登録を使用した固定コールバックポート
claude mcp add --transport http \
  --callback-port 8080 \
  my-server https://mcp.example.com/mcp
```

### 事前設定された OAuth 認証情報を使用する

一部の MCP サーバーは自動 OAuth セットアップをサポートしていません。「Incompatible auth server: does not support dynamic client registration」のようなエラーが表示される場合、サーバーは事前設定された認証情報が必要です。Claude Code は Client ID Metadata Document（CIMD）を使用するサーバーもサポートしており、これらを自動的に検出します。自動検出に失敗した場合は、まずサーバーの開発者ポータルを通じて OAuth アプリを登録し、サーバーを追加するときに認証情報を提供してください。

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

### OAuth メタデータ検出をオーバーライドする

MCP サーバーが標準 OAuth メタデータエンドポイント（`/.well-known/oauth-authorization-server`）でエラーを返すが、動作する OIDC エンドポイントを公開している場合、Claude Code に指定した URL から OAuth メタデータを直接取得するように指示でき、標準検出チェーンをバイパスできます。

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

URL は `https://` を使用する必要があります。このオプションには Claude Code v2.1.64 以降が必要です。

### カスタム認証用の動的ヘッダーを使用する

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

Claude Code は、ヘルパーを実行するときにこれらの環境変数を設定します：

| 変数 | 値 |
| :- | :- |
| `CLAUDE_CODE_MCP_SERVER_NAME` | MCP サーバーの名前 |
| `CLAUDE_CODE_MCP_SERVER_URL` | MCP サーバーの URL |

これらを使用して、複数の MCP サーバーに対応する単一のヘルパースクリプトを作成できます。

`headersHelper` は任意のシェルコマンドを実行します。プロジェクトまたはローカルスコープで定義されている場合、ワークスペース信頼ダイアログを受け入れた後にのみ実行されます。

## JSON 設定から MCP サーバーを追加する

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

## Claude Desktop から MCP サーバーをインポートする

Claude Desktop で MCP サーバーを既に設定している場合は、それらをインポートできます：

```bash theme={null}
# 基本的な構文 
claude mcp add-from-claude-desktop 
```

コマンドを実行した後、インポートするサーバーを選択できる対話的なダイアログが表示されます。

```bash theme={null}
claude mcp list 
```

ヒント：

- この機能は macOS と Windows Subsystem for Linux（WSL）でのみ機能します
- これらのプラットフォームの標準的な場所から Claude Desktop 設定ファイルを読み取ります
- `--scope user` フラグを使用してサーバーをユーザー設定に追加します
- インポートされたサーバーは Claude Desktop と同じ名前を持ちます
- 同じ名前のサーバーが既に存在する場合、数値サフィックスが付与されます（例：`server_1`）

## Claude.ai から MCP サーバーを使用する

[Claude.ai](https://claude.ai) アカウントで Claude Code にログインしている場合、Claude.ai で追加した MCP サーバーは Claude Code で自動的に利用可能です：

[claude.ai/settings/connectors](https://claude.ai/settings/connectors) でサーバーを追加します。Team および Enterprise プランでは、管理者のみがサーバーを追加できます。

Claude.ai で必要な認証ステップを完了します。

Claude Code で、コマンドを使用します：

```text theme={null}
/mcp
```

Claude.ai サーバーはリストに表示され、Claude.ai から来ていることを示すインジケータが付きます。

Claude Code で claude.ai MCP サーバーを無効にするには、`ENABLE_CLAUDEAI_MCP_SERVERS` 環境変数を `false` に設定します：

```bash
ENABLE_CLAUDEAI_MCP_SERVERS=false claude
```

## Claude Code を MCP サーバーとして使用する

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

## MCP 出力制限と警告

MCP ツールが大きな出力を生成する場合、Claude Code はトークン使用量を管理して、会話コンテキストが圧倒されるのを防ぐのに役立ちます：

- **出力警告閾値**：Claude Code は MCP ツール出力が 10,000 トークンを超えると警告を表示します
- **設定可能な制限**：`MAX_MCP_OUTPUT_TOKENS` 環境変数を使用して、許可される最大 MCP 出力トークンを調整できます
- **デフォルト制限**：デフォルトの最大値は 25,000 トークンです

大きな出力を生成するツールの制限を増やすには：

```bash
# MCP ツール出力の制限を高くする
export MAX_MCP_OUTPUT_TOKENS=50000
claude
```

これは特に以下を行う MCP サーバーで役立ちます：

- 大規模なデータセットまたはデータベースをクエリする
- 詳細なレポートまたはドキュメントを生成する
- 広範なログファイルまたはデバッグ情報を処理する

特定の MCP サーバーで出力警告が頻繁に発生する場合は、制限を増やすか、サーバーをページネーションまたはフィルタリング応答するように設定することを検討してください。

## MCP 応答要求に対応する

MCP サーバーはタスク中に構造化された入力をあなたに要求するための応答要求を使用できます。サーバーが独自に取得できない情報が必要な場合、Claude Code は対話的なダイアログを表示し、あなたの応答をサーバーに返します。設定は不要です。応答要求ダイアログはサーバーが要求したときに自動的に表示されます。

サーバーは 2 つの方法で入力を要求できます：

- **フォームモード**：Claude Code はサーバーで定義されたフォームフィールド（例：ユーザー名とパスワードプロンプト）を含むダイアログを表示します。フィールドに入力して送信します。
- **URL モード**：Claude Code はブラウザ URL を開いて認証または承認を行います。ブラウザでフローを完了し、CLI で確認します。

応答要求に自動応答するには、[`Elicitation` フック](/ja/hooks#Elicitation)を使用してください。

MCP サーバーを構築していて応答要求を使用する場合は、[MCP 応答要求仕様](https://modelcontextprotocol.io/docs/learn/client-concepts#elicitation)を参照してプロトコルの詳細とスキーマの例を確認してください。

## MCP リソースを使用する

MCP サーバーはリソースを公開でき、ファイルを参照する方法と同様に @ メンションを使用して参照できます。

### MCP リソースを参照する

プロンプトで `@` を入力して、接続されているすべての MCP サーバーから利用可能なリソースを表示します。リソースはオートコンプリートメニューのファイルと一緒に表示されます。

`@server:protocol://resource/path` の形式を使用してリソースを参照します：

```text theme={null}
@github:issue://123 を分析して修正を提案できますか？
```

```text theme={null}
@docs:file://api/authentication の API ドキュメントをレビューしてください
```

1 つのプロンプトで複数のリソースを参照できます：

```text theme={null}
@postgres:schema://users と @docs:file://database/user-model を比較してください
```

ヒント：

- リソースは参照されると自動的に取得され、添付ファイルとして含まれます
- リソースパスは @ メンションオートコンプリートでファジー検索可能です
- Claude Code はサーバーがサポートしている場合、MCP リソースをリストおよび読み取るツールを自動的に提供します
- リソースには、MCP サーバーが提供するあらゆるタイプのコンテンツ（テキスト、JSON、構造化データなど）を含めることができます

## MCP ツール検索でスケーリングする

ツール検索は MCP コンテキスト使用量を低く保つことで、ツール定義をオンデマンドで遅延させます。セッション開始時にはツール名のみがロードされるため、より多くの MCP サーバーを追加してもコンテキストウィンドウへの影響は最小限です。

### 仕組み

ツール検索はデフォルトで有効です。MCP ツールは事前にコンテキストにロードされるのではなく、遅延されます。Claude はタスクが必要な場合、検索ツールを使用して関連する MCP ツールを検出します。Claude が実際に使用するツールのみがコンテキストに入ります。あなたの視点からは、MCP ツールは以前と同じように機能します。

しきい値ベースのロードを優先する場合は、`ENABLE_TOOL_SEARCH=auto` を設定して、コンテキストウィンドウの 10% 以内に収まる場合はスキーマを事前にロードし、オーバーフローのみを遅延させます。すべてのオプションについては、[ツール検索の設定](#configure-tool-search)を参照してください。

### MCP サーバー作成者向け

MCP サーバーを構築している場合、ツール検索が有効になっているとサーバー命令フィールドがより有用になります。サーバー命令は、[スキル](/ja/skills)の仕組みと同様に、Claude がいつサーバーのツールを検索するかを理解するのに役立ちます。

明確で説明的なサーバー命令を追加して、以下を説明します：

- ツールが処理するタスクのカテゴリ
- Claude がツールを検索すべき場合
- サーバーが提供する主な機能

Claude Code はツール説明とサーバー命令を各 2KB で切り詰めます。切り詰めを避けるために簡潔に保ち、重要な詳細を最初に配置してください。

### ツール検索を設定する

ツール検索はデフォルトで有効です：MCP ツールは遅延され、オンデマンドで検出されます。`ANTHROPIC_BASE_URL` が非ファーストパーティホストを指している場合、ツール検索はデフォルトで無効です。ほとんどのプロキシは `tool_reference` ブロックを転送しないためです。プロキシが転送する場合は、`ENABLE_TOOL_SEARCH` を明示的に設定してください。この機能には、`tool_reference` ブロックをサポートするモデルが必要です：Sonnet 4 以降、または Opus 4 以降。Haiku モデルはツール検索をサポートしていません。

`ENABLE_TOOL_SEARCH` 環境変数でツール検索の動作を制御します：

| 値 | 動作 |
| :- | :- |
| （未設定） | すべての MCP ツールが遅延され、オンデマンドでロードされます。`ANTHROPIC_BASE_URL` が非ファーストパーティホストの場合はアップフロントロードにフォールバック |
| `true` | すべての MCP ツールが遅延。非ファーストパーティ `ANTHROPIC_BASE_URL` を含む |
| `auto` | しきい値モード：ツールがコンテキストウィンドウの 10% 以内に収まる場合はアップフロントロード、そうでない場合は遅延 |
| `auto:<N>` | カスタムパーセンテージ付きしきい値モード。`<N>` は 0-100（例：5% の場合は `auto:5`） |
| `false` | すべての MCP ツールがアップフロントロード、遅延なし |

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

## MCP プロンプトをコマンドとして使用する

MCP サーバーはプロンプトを公開でき、Claude Code でコマンドとして利用可能になります。

### MCP プロンプトを実行する

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

## 管理対象 MCP 設定

MCP サーバーの集中管理が必要な組織の場合、Claude Code は 2 つの設定オプションをサポートしています：

1. **`managed-mcp.json` による排他的制御**：ユーザーが変更または拡張できない固定の MCP サーバーセットをデプロイします
2. **許可リスト/拒否リストによるポリシーベースの制御**：ユーザーが独自のサーバーを追加できるようにしますが、許可されているサーバーを制限します

これらのオプションにより、IT 管理者は以下を実行できます：

- **従業員がアクセスできる MCP サーバーを制御する**：組織全体で承認された MCP サーバーの標準化されたセットをデプロイします
- **不正な MCP サーバーを防止する**：ユーザーが未承認の MCP サーバーを追加するのを制限します
- **MCP を完全に無効にする**：必要に応じて MCP 機能を完全に削除します

### オプション 1：`managed-mcp.json` による排他的制御

`managed-mcp.json` ファイルをデプロイすると、すべての MCP サーバーに対して**排他的な制御**が行われます。ユーザーはこのファイルで定義されているもの以外の MCP サーバーを追加、変更、または使用することはできません。これは、完全な制御を望む組織にとって最も単純なアプローチです。

システム管理者は、設定ファイルをシステム全体のディレクトリにデプロイします：

- macOS：`/Library/Application Support/ClaudeCode/managed-mcp.json`
- Linux および WSL：`/etc/claude-code/managed-mcp.json`
- Windows：`C:\Program Files\ClaudeCode\managed-mcp.json`

これらはシステム全体のパス（`~/Library/...` のようなユーザーホームディレクトリではない）であり、管理者権限が必要です。IT 管理者によってデプロイされるように設計されています。

`managed-mcp.json` ファイルは標準的な `.mcp.json` ファイルと同じ形式を使用します：

```json
{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/"
    },
    "sentry": {
      "type": "http",
      "url": "https://mcp.sentry.dev/mcp"
    },
    "company-internal": {
      "type": "stdio",
      "command": "/usr/local/bin/company-mcp-server",
      "args": ["--config", "/etc/company/mcp-config.json"],
      "env": {
        "COMPANY_API_URL": "https://internal.company.com"
      }
    }
  }
}
```

### オプション 2：許可リストと拒否リストによるポリシーベースの制御

排他的な制御を行う代わりに、管理者はユーザーが独自の MCP サーバーを設定できるようにしながら、許可されているサーバーに制限を適用できます。このアプローチは、[管理対象設定ファイル](/ja/settings#settings-files)の `allowedMcpServers` と `deniedMcpServers` を使用します。

**オプションの選択**：固定のサーバーセットをデプロイしてユーザーのカスタマイズを行わない場合はオプション 1（`managed-mcp.json`）を使用します。ユーザーがポリシー制約内で独自のサーバーを追加できるようにする場合はオプション 2（許可リスト/拒否リスト）を使用します。

#### 制限オプション

許可リストまたは拒否リストの各エントリは、3 つの方法でサーバーを制限できます：

1. **サーバー名による** (`serverName`)：設定されたサーバーの名前と一致します
2. **コマンドによる** (`serverCommand`)：stdio サーバーを起動するために使用される正確なコマンドと引数と一致します
3. **URL パターンによる** (`serverUrl`)：ワイルドカードサポート付きのリモートサーバー URL と一致します

**重要**：各エントリは `serverName`、`serverCommand`、または `serverUrl` のいずれか 1 つだけを持つ必要があります。

#### 設定例

```json
{
  "allowedMcpServers": [
    // サーバー名で許可
    { "serverName": "github" },
    { "serverName": "sentry" },

    // 正確なコマンドで許可（stdio サーバーの場合）
    { "serverCommand": ["npx", "-y", "@modelcontextprotocol/server-filesystem"] },
    { "serverCommand": ["python", "/usr/local/bin/approved-server.py"] },

    // URL パターンで許可（リモートサーバーの場合）
    { "serverUrl": "https://mcp.company.com/*" },
    { "serverUrl": "https://*.internal.corp/*" }
  ],
  "deniedMcpServers": [
    // サーバー名でブロック
    { "serverName": "dangerous-server" },

    // 正確なコマンドでブロック（stdio サーバーの場合）
    { "serverCommand": ["npx", "-y", "unapproved-package"] },

    // URL パターンでブロック（リモートサーバーの場合）
    { "serverUrl": "https://*.untrusted.com/*" }
  ]
}
```

#### コマンドベースの制限の仕組み

**完全一致**：

- コマンド配列は**完全に**一致する必要があります。コマンドと正しい順序のすべての引数
- 例：`["npx", "-y", "server"]` は `["npx", "server"]` または `["npx", "-y", "server", "--flag"]` と一致しません

**Stdio サーバーの動作**：

- 許可リストに**任意の** `serverCommand` エントリが含まれている場合、stdio サーバーはそれらのコマンドの 1 つと一致する必要があります
- Stdio サーバーはコマンド制限が存在する場合、名前だけでは通過できません
- これにより、管理者は実行が許可されているコマンドを強制できます

**非 stdio サーバーの動作**：

- リモートサーバー（HTTP、SSE、WebSocket）は、許可リストに `serverUrl` エントリが存在する場合、URL ベースのマッチングを使用します
- URL エントリが存在しない場合、リモートサーバーは名前ベースのマッチングにフォールバックします
- コマンド制限はリモートサーバーには適用されません

#### URL ベースの制限の仕組み

URL パターンは `*` を使用してワイルドカードをサポートし、任意の文字シーケンスと一致します。これはドメイン全体またはサブドメイン全体を許可するのに役立ちます。

**ワイルドカード例**：

- `https://mcp.company.com/*` - 特定のドメイン上のすべてのパスを許可
- `https://*.example.com/*` - example.com の任意のサブドメインを許可
- `http://localhost:*/*` - localhost 上の任意のポートを許可

**リモートサーバーの動作**：

- 許可リストに**任意の** `serverUrl` エントリが含まれている場合、リモートサーバーはそれらの URL パターンの 1 つと一致する必要があります
- リモートサーバーは URL 制限が存在する場合、名前だけでは通過できません
- これにより、管理者は許可されているリモートエンドポイントを強制できます

```json theme={null}
{
  "allowedMcpServers": [
    { "serverUrl": "https://mcp.company.com/*" },
    { "serverUrl": "https://*.internal.corp/*" }
  ]
}
```

**結果**：

- `https://mcp.company.com/api` の HTTP サーバー：✅ 許可（URL パターンと一致）
- `https://api.internal.corp/mcp` の HTTP サーバー：✅ 許可（ワイルドカードサブドメインと一致）
- `https://external.com/mcp` の HTTP サーバー：❌ ブロック（URL パターンと一致しない）
- 任意のコマンドの Stdio サーバー：❌ ブロック（一致する名前またはコマンドエントリがない）

```json theme={null}
{
  "allowedMcpServers": [
    { "serverCommand": ["npx", "-y", "approved-package"] }
  ]
}
```

**結果**：

- `["npx", "-y", "approved-package"]` の Stdio サーバー：✅ 許可（コマンドと一致）
- `["node", "server.js"]` の Stdio サーバー：❌ ブロック（コマンドと一致しない）
- 「my-api」という名前の HTTP サーバー：❌ ブロック（一致する名前エントリがない）

```json theme={null}
{
  "allowedMcpServers": [
    { "serverName": "github" },
    { "serverCommand": ["npx", "-y", "approved-package"] }
  ]
}
```

**結果**：

- 「local-tool」という名前で `["npx", "-y", "approved-package"]` の Stdio サーバー：✅ 許可（コマンドと一致）
- 「local-tool」という名前で `["node", "server.js"]` の Stdio サーバー：❌ ブロック（コマンドエントリが存在しますが一致しない）
- 「github」という名前で `["node", "server.js"]` の Stdio サーバー：❌ ブロック（stdio サーバーはコマンドエントリが存在する場合、コマンドと一致する必要があります）
- 「github」という名前の HTTP サーバー：✅ 許可（名前と一致）
- 「other-api」という名前の HTTP サーバー：❌ ブロック（名前と一致しない）

```json theme={null}
{
  "allowedMcpServers": [
    { "serverName": "github" },
    { "serverName": "internal-tool" }
  ]
}
```

**結果**：

- 任意のコマンドで「github」という名前の Stdio サーバー：✅ 許可（コマンド制限なし）
- 任意のコマンドで「internal-tool」という名前の Stdio サーバー：✅ 許可（コマンド制限なし）
- 「github」という名前の HTTP サーバー：✅ 許可（名前と一致）
- 「other」という名前のサーバー：❌ ブロック（名前と一致しない）

#### 許可リストの動作（`allowedMcpServers`）

- `undefined`（デフォルト）：制限なし。ユーザーは任意の MCP サーバーを設定できます
- 空の配列 `[]`：完全なロックダウン。ユーザーは MCP サーバーを設定できません
- エントリのリスト：ユーザーは名前、コマンド、または URL パターンで一致するサーバーのみを設定できます

#### 拒否リストの動作（`deniedMcpServers`）

- `undefined`（デフォルト）：サーバーはブロックされません
- 空の配列 `[]`：サーバーはブロックされません
- エントリのリスト：指定されたサーバーはすべてのスコープ全体で明示的にブロックされます

#### 重要な注意事項

- **オプション 1 とオプション 2 を組み合わせることができます**：`managed-mcp.json` が存在する場合、排他的な制御があり、ユーザーはサーバーを追加できません。許可リスト/拒否リストは管理対象サーバー自体に引き続き適用されます。
- **拒否リストは絶対的な優先順位を持ちます**：サーバーが拒否リストエントリ（名前、コマンド、または URL による）と一致する場合、許可リストに含まれていても、ブロックされます
- 名前ベース、コマンドベース、URL ベースの制限は一緒に機能します：サーバーは名前エントリ、コマンドエントリ、または URL パターンのいずれかと一致する場合に通過します（拒否リストでブロックされていない限り）

**`managed-mcp.json` を使用する場合**：ユーザーは `claude mcp add` または設定ファイルを通じて MCP サーバーを追加できません。`allowedMcpServers` と `deniedMcpServers` の設定は、実際にロードされる管理対象サーバーをフィルタリングするために引き続き適用されます。
