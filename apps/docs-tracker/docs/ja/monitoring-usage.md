---
title: monitoring-usage
source: https://code.claude.com/docs/ja/monitoring-usage.md
---

# 監視

> Claude Code の OpenTelemetry を有効にして設定する方法を学びます。

OpenTelemetry (OTel) を通じてテレメトリデータをエクスポートすることで、組織全体で Claude Code の使用状況、コスト、ツールアクティビティを追跡します。Claude Code はメトリクスを標準メトリクスプロトコル経由で時系列データとしてエクスポートし、イベントをログ/イベントプロトコル経由でエクスポートし、オプションで [トレースプロトコル](#traces-beta)経由で分散トレースをエクスポートします。メトリクス、ログ、トレースのバックエンドを設定して、監視要件に合わせます。

## クイックスタート

環境変数を使用して OpenTelemetry を設定します:

```bash
# 1. テレメトリを有効にする
export CLAUDE_CODE_ENABLE_TELEMETRY=1

# 2. エクスポーターを選択する (両方はオプション - 必要なものだけを設定してください)
export OTEL_METRICS_EXPORTER=otlp       # オプション: otlp、prometheus、console、none
export OTEL_LOGS_EXPORTER=otlp          # オプション: otlp、console、none

# 3. OTLP エンドポイントを設定する (OTLP エクスポーター用)
export OTEL_EXPORTER_OTLP_PROTOCOL=grpc
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317

# 4. 認証を設定する (必要な場合)
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer your-token"

# 5. デバッグ用: エクスポート間隔を短縮する
export OTEL_METRIC_EXPORT_INTERVAL=10000  # 10 秒 (デフォルト: 60000ms)
export OTEL_LOGS_EXPORT_INTERVAL=5000     # 5 秒 (デフォルト: 5000ms)

# 6. Claude Code を実行する
claude
```

デフォルトのエクスポート間隔は、メトリクスが 60 秒、ログが 5 秒です。セットアップ中は、デバッグ目的で短い間隔を使用することをお勧めします。本番環境での使用に向けてこれらをリセットすることを忘れないでください。

完全な設定オプションについては、[OpenTelemetry 仕様](https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/protocol/exporter.md#configuration-options)を参照してください。

## 管理者設定

管理者は、[管理設定ファイル](/ja/settings#settings-files)を通じてすべてのユーザーの OpenTelemetry 設定を設定できます。これにより、組織全体のテレメトリ設定を一元管理できます。設定がどのように適用されるかについては、[設定の優先順位](/ja/settings#settings-precedence)を参照してください。

管理設定の設定例:

```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_METRICS_EXPORTER": "otlp",
    "OTEL_LOGS_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_PROTOCOL": "grpc",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "http://collector.example.com:4317",
    "OTEL_EXPORTER_OTLP_HEADERS": "Authorization=Bearer example-token"
  }
}
```

管理設定は MDM (Mobile Device Management) または他のデバイス管理ソリューションを通じて配布できます。管理設定ファイルで定義された環境変数は優先度が高く、ユーザーによってオーバーライドすることはできません。

## 設定の詳細

### 一般的な設定変数

| 環境変数 | 説明 | 例の値 |
| - | - | - |
| `CLAUDE_CODE_ENABLE_TELEMETRY` | テレメトリ収集を有効にする (必須) | `1` |
| `OTEL_METRICS_EXPORTER` | メトリクスエクスポーターのタイプ (カンマ区切り)。`none` を使用して無効化 | `console`、`otlp`、`prometheus`、`none` |
| `OTEL_LOGS_EXPORTER` | ログ/イベントエクスポーターのタイプ (カンマ区切り)。`none` を使用して無効化 | `console`、`otlp`、`none` |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | OTLP エクスポーターのプロトコル (すべてのシグナル) | `grpc`、`http/json`、`http/protobuf` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP コレクターエンドポイント (すべてのシグナル) | `http://localhost:4317` |
| `OTEL_EXPORTER_OTLP_METRICS_PROTOCOL` | メトリクスのプロトコル (一般的な設定をオーバーライド) | `grpc`、`http/json`、`http/protobuf` |
| `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` | OTLP メトリクスエンドポイント (一般的な設定をオーバーライド) | `http://localhost:4318/v1/metrics` |
| `OTEL_EXPORTER_OTLP_LOGS_PROTOCOL` | ログのプロトコル (一般的な設定をオーバーライド) | `grpc`、`http/json`、`http/protobuf` |
| `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` | OTLP ログエンドポイント (一般的な設定をオーバーライド) | `http://localhost:4318/v1/logs` |
| `OTEL_EXPORTER_OTLP_HEADERS` | OTLP の認証ヘッダー | `Authorization=Bearer token` |
| `OTEL_EXPORTER_OTLP_METRICS_CLIENT_KEY` | mTLS 認証用のクライアントキー | クライアントキーファイルへのパス |
| `OTEL_EXPORTER_OTLP_METRICS_CLIENT_CERTIFICATE` | mTLS 認証用のクライアント証明書 | クライアント証明書ファイルへのパス |
| `OTEL_METRIC_EXPORT_INTERVAL` | エクスポート間隔 (ミリ秒単位、デフォルト: 60000) | `5000`、`60000` |
| `OTEL_LOGS_EXPORT_INTERVAL` | ログエクスポート間隔 (ミリ秒単位、デフォルト: 5000) | `1000`、`10000` |
| `OTEL_LOG_USER_PROMPTS` | ユーザープロンプトコンテンツのログを有効にする (デフォルト: 無効) | `1` で有効化 |
| `OTEL_LOG_TOOL_DETAILS` | ツールイベントでツールパラメーターと入力引数のログを有効にする: Bash コマンド、MCP サーバーとツール名、スキル名、ツール入力。また、`user_prompt` イベントでカスタム、プラグイン、MCP コマンド名を有効にします (デフォルト: 無効) | `1` で有効化 |
| `OTEL_LOG_TOOL_CONTENT` | スパンイベントでツール入力と出力コンテンツのログを有効にする (デフォルト: 無効)。[トレース](#traces-beta)が必要です。コンテンツは 60 KB で切り詰められます | `1` で有効化 |
| `OTEL_LOG_RAW_API_BODIES` | Anthropic Messages API リクエストとレスポンス JSON 全体を `api_request_body` / `api_response_body` ログイベントとして出力します (デフォルト: 無効)。ボディには会話履歴全体が含まれます。これを有効にすることは、`OTEL_LOG_USER_PROMPTS`、`OTEL_LOG_TOOL_DETAILS`、および `OTEL_LOG_TOOL_CONTENT` が明かすすべてのものに同意することを意味します | `1` で 60 KB で切り詰められたインラインボディ、または `file:<dir>` でディスク上の切り詰められていないボディと、イベント内の `body_ref` ポインター |
| `OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE` | メトリクスの時間性設定 (デフォルト: `delta`)。バックエンドが累積時間性を期待する場合は `cumulative` に設定 | `delta`、`cumulative` |
| `CLAUDE_CODE_OTEL_HEADERS_HELPER_DEBOUNCE_MS` | 動的ヘッダーを更新するための間隔 (デフォルト: 1740000ms / 29 分) | `900000` |

### メトリクスカーディナリティ制御

以下の環境変数は、カーディナリティを管理するためにメトリクスに含まれる属性を制御します:

| 環境変数 | 説明 | デフォルト値 | 無効化する例 |
| - | - | - | - |
| `OTEL_METRICS_INCLUDE_SESSION_ID` | メトリクスに session.id 属性を含める | `true` | `false` |
| `OTEL_METRICS_INCLUDE_VERSION` | メトリクスに app.version 属性を含める | `false` | `true` |
| `OTEL_METRICS_INCLUDE_ACCOUNT_UUID` | メトリクスに user.account\_uuid および user.account\_id 属性を含める | `true` | `false` |

これらの変数は、メトリクスのカーディナリティを制御するのに役立ちます。これはメトリクスバックエンドのストレージ要件とクエリパフォーマンスに影響します。カーディナリティが低いほど、一般的にパフォーマンスが向上し、ストレージコストが低くなりますが、分析用のより詳細なデータは少なくなります。

### トレース (ベータ)

分散トレースは、各ユーザープロンプトをそれがトリガーする API リクエストとツール実行にリンクするスパンをエクスポートします。これにより、トレーシングバックエンドで完全なリクエストを単一のトレースとして表示できます。

トレースはデフォルトでオフです。有効にするには、`CLAUDE_CODE_ENABLE_TELEMETRY=1` と `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1` の両方を設定してから、`OTEL_TRACES_EXPORTER` を設定してスパンの送信先を選択します。トレースは、エンドポイント、プロトコル、ヘッダーについて [一般的な OTLP 設定](#common-configuration-variables)を再利用します。

| 環境変数 | 説明 | 例の値 |
| - | - | - |
| `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA` | スパントレースを有効にする (必須)。`ENABLE_ENHANCED_TELEMETRY_BETA` も受け入れられます | `1` |
| `OTEL_TRACES_EXPORTER` | トレースエクスポーターのタイプ (カンマ区切り)。`none` を使用して無効化 | `console`、`otlp`、`none` |
| `OTEL_EXPORTER_OTLP_TRACES_PROTOCOL` | トレースのプロトコル (`OTEL_EXPORTER_OTLP_PROTOCOL` をオーバーライド) | `grpc`、`http/json`、`http/protobuf` |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | OTLP トレースエンドポイント (`OTEL_EXPORTER_OTLP_ENDPOINT` をオーバーライド) | `http://localhost:4318/v1/traces` |
| `OTEL_TRACES_EXPORT_INTERVAL` | スパンバッチエクスポート間隔 (ミリ秒単位、デフォルト: 5000) | `1000`、`10000` |

スパンはデフォルトでユーザープロンプトテキスト、ツール入力詳細、ツールコンテンツをマスクします。これらを含めるには、`OTEL_LOG_USER_PROMPTS=1`、`OTEL_LOG_TOOL_DETAILS=1`、および `OTEL_LOG_TOOL_CONTENT=1` を設定します。

トレースがアクティブな場合、Bash および PowerShell サブプロセスは、アクティブなツール実行スパンの W3C トレースコンテキストを含む `TRACEPARENT` 環境変数を自動的に継承します。これにより、`TRACEPARENT` を読み取るサブプロセスは、同じトレースの下に独自のスパンを親にすることができ、Claude が実行するスクリプトとコマンドを通じたエンドツーエンドの分散トレースが可能になります。

Agent SDK および `-p` で開始された非対話型セッションでは、Claude Code は各インタラクションスパンを開始するときに独自の環境から `TRACEPARENT` と `TRACESTATE` も読み取ります。これにより、埋め込みプロセスがアクティブな W3C トレースコンテキストをサブプロセスに渡すことができるため、Claude Code のスパンは呼び出し元の分散トレースの子として表示されます。対話型セッションは、CI またはコンテナ環境からの環境値を誤って継承するのを避けるため、インバウンド `TRACEPARENT` を無視します。

#### スパン階層

各ユーザープロンプトは `claude_code.interaction` ルートスパンを開始します。API 呼び出し、ツール呼び出し、フック実行はその子として記録されます。ツールスパンには 2 つの子スパンがあります: 1 つは権限決定の待機に費やされた時間用、もう 1 つは実行自体用です。Task ツールがサブエージェントを生成する場合、サブエージェントの API とツールスパンは親の `claude_code.tool` スパンの下にネストされます。

```text
claude_code.interaction
├── claude_code.llm_request
├── claude_code.hook                    (詳細なベータトレースが必要)
└── claude_code.tool
    ├── claude_code.tool.blocked_on_user
    ├── claude_code.tool.execution
    └── (Task ツール) サブエージェント claude_code.llm_request / claude_code.tool スパン
```

Agent SDK および `claude -p` セッションでは、`TRACEPARENT` が環境に設定されている場合、`claude_code.interaction` 自体が呼び出し元のスパンの子になります。

#### スパン属性

すべてのスパンは [標準属性](#standard-attributes)と、その名前に一致する `span.type` 属性を持ちます。以下の表は、各スパンに設定される追加属性をリストしています。`llm_request`、`tool.execution`、および `hook` スパンは、失敗を記録するときに OpenTelemetry ステータス `ERROR` を設定します。他のスパンは常にステータス `UNSET` で終了します。

**`claude_code.interaction`**

| 属性 | 説明 | ゲート |
| - | - | - |
| `user_prompt` | プロンプトテキスト。ゲートが設定されていない限り、値は `<REDACTED>` です | `OTEL_LOG_USER_PROMPTS` |
| `user_prompt_length` | プロンプト長 (文字数) | |
| `interaction.sequence` | このセッション内のインタラクションの 1 ベースカウンター | |
| `interaction.duration_ms` | ターンの実時間 | |

**`claude_code.llm_request`**

| 属性 | 説明 | ゲート |
| - | - | - |
| `model` | モデル識別子 | |
| `gen_ai.system` | 常に `anthropic`。OpenTelemetry GenAI セマンティック規約 | |
| `gen_ai.request.model` | `model` と同じ値。OpenTelemetry GenAI セマンティック規約 | |
| `query_source` | リクエストを発行したサブシステム。例: `repl_main_thread` またはサブエージェント名 | |
| `speed` | `fast` または `normal` | |
| `llm_request.context` | 親スパンに応じて `interaction`、`tool`、または `standalone` | |
| `duration_ms` | 再試行を含む実時間 | |
| `ttft_ms` | 最初のトークンまでの時間 (ミリ秒単位) | |
| `input_tokens` | API 使用ブロックからの入力トークン数 | |
| `output_tokens` | 出力トークン数 | |
| `cache_read_tokens` | プロンプトキャッシュから読み取られたトークン | |
| `cache_creation_tokens` | プロンプトキャッシュに書き込まれたトークン | |
| `request_id` | レスポンスヘッダーの `request-id` からの Anthropic API リクエスト ID | |
| `gen_ai.response.id` | `request_id` と同じ値。OpenTelemetry GenAI セマンティック規約 | |
| `client_request_id` | 最終試行のクライアント生成 `x-client-request-id` | |
| `attempt` | このリクエストに対して行われた総試行回数 | |
| `success` | `true` または `false` | |
| `status_code` | リクエストが失敗した場合の HTTP ステータスコード | |
| `error` | リクエストが失敗した場合のエラーメッセージ | |
| `response.has_tool_call` | レスポンスにツール使用ブロックが含まれている場合は `true` | |
| `stop_reason` | API レスポンス `stop_reason`。例: `end_turn`、`tool_use`、`max_tokens`、`stop_sequence`、`pause_turn`、または `refusal` | |
| `gen_ai.response.finish_reasons` | `stop_reason` と同じ値。文字列配列でラップされています。OpenTelemetry GenAI セマンティック規約 | |

各再試行試行は、`attempt` および `client_request_id` 属性を持つ `gen_ai.request.attempt` スパンイベントとしても記録されます。

**`claude_code.tool`**

| 属性 | 説明 | ゲート |
| - | - | - |
| `tool_name` | ツール名 | |
| `duration_ms` | 権限待機と実行を含む実時間 | |
| `result_tokens` | ツール結果のおおよそのトークンサイズ | |
| `file_path` | Read、Edit、Write ツールのターゲットファイルパス | `OTEL_LOG_TOOL_DETAILS` |
| `full_command` | Bash ツールのコマンド文字列 | `OTEL_LOG_TOOL_DETAILS` |
| `skill_name` | Skill ツールのスキル名 | `OTEL_LOG_TOOL_DETAILS` |
| `subagent_type` | Task ツールのサブエージェントタイプ | `OTEL_LOG_TOOL_DETAILS` |

`OTEL_LOG_TOOL_CONTENT=1` の場合、このスパンは、属性にツールの入力と出力ボディを含む `tool.output` スパンイベントも記録します。属性ごとに 60 KB で切り詰められます。

**`claude_code.tool.blocked_on_user`**

| 属性 | 説明 | ゲート |
| - | - | - |
| `duration_ms` | 権限決定の待機に費やされた時間 | |
| `decision` | `accept` または `reject` | |
| `source` | 決定ソース。`tool_decision` イベントと一致 | |

**`claude_code.tool.execution`**

| 属性 | 説明 | ゲート |
| - | - | - |
| `duration_ms` | ツール本体の実行に費やされた時間 | |
| `success` | `true` または `false` | |
| `error` | 実行が失敗した場合のエラーカテゴリ文字列。例: `Error:ENOENT` または `ShellError`。ゲートが設定されている場合は完全なエラーメッセージを含む | `OTEL_LOG_TOOL_DETAILS` |

**`claude_code.hook`**

このスパンは、詳細なベータトレースがアクティブな場合にのみ出力されます。これには、上記のトレースエクスポーター設定に加えて `ENABLE_BETA_TRACING_DETAILED=1` と `BETA_TRACING_ENDPOINT` が必要です。対話型 CLI セッションでは、これは組織がこの機能のホワイトリストに登録されていることも必要です。Agent SDK および非対話型 `-p` セッションはゲートされていません。`CLAUDE_CODE_ENHANCED_TELEMETRY_BETA` のみが設定されている場合は出力されません。

| 属性 | 説明 | ゲート |
| - | - | - |
| `hook_event` | フックイベントタイプ。例: `PreToolUse` | |
| `hook_name` | 完全なフック名。例: `PreToolUse:Write` | |
| `num_hooks` | 実行された一致するフックコマンドの数 | |
| `hook_definitions` | JSON シリアル化されたフック設定 | `OTEL_LOG_TOOL_DETAILS` |
| `duration_ms` | すべての一致するフックの実時間 | |
| `num_success` | 正常に完了したフックの数 | |
| `num_blocking` | ブロッキング決定を返したフックの数 | |
| `num_non_blocking_error` | ブロックなしで失敗したフックの数 | |
| `num_cancelled` | 完了前にキャンセルされたフックの数 | |

`new_context`、`system_prompt_preview`、`user_system_prompt`、`tool_input`、`response.model_output` などの追加のコンテンツを含む属性は、詳細なベータトレースがアクティブな場合にのみ出力されます。これらは安定したスパンスキーマの一部ではありません。`user_system_prompt` はさらに `OTEL_LOG_USER_PROMPTS=1` が必要です。これは `systemPrompt` SDK オプションまたは `--system-prompt` および `--append-system-prompt` フラグを通じて提供するシステムプロンプトテキストのみを含み、60 KB で切り詰められ、リクエストごとではなくセッションごとに 1 回出力されます。

### 動的ヘッダー

動的認証が必要なエンタープライズ環境では、ヘッダーを動的に生成するスクリプトを設定できます:

#### 設定ファイルの設定

`.claude/settings.json` に追加します:

```json
{
  "otelHeadersHelper": "/bin/generate_opentelemetry_headers.sh"
}
```

#### スクリプト要件

スクリプトは HTTP ヘッダーを表す文字列キーと値のペアを持つ有効な JSON を出力する必要があります:

```bash
#!/bin/bash
# 例: 複数のヘッダー
echo "{\"Authorization\": \"Bearer $(get-token.sh)\", \"X-API-Key\": \"$(get-api-key.sh)\"}"
```

#### リフレッシュ動作

ヘッダーヘルパースクリプトはスタートアップ時に実行され、その後定期的に実行されてトークンリフレッシュをサポートします。デフォルトでは、スクリプトは 29 分ごとに実行されます。`CLAUDE_CODE_OTEL_HEADERS_HELPER_DEBOUNCE_MS` 環境変数で間隔をカスタマイズします。

### マルチチーム組織サポート

複数のチームまたは部門を持つ組織は、`OTEL_RESOURCE_ATTRIBUTES` 環境変数を使用してカスタム属性を追加し、異なるグループを区別できます:

```bash
# チーム識別用のカスタム属性を追加する
export OTEL_RESOURCE_ATTRIBUTES="department=engineering,team.id=platform,cost_center=eng-123"
```

これらのカスタム属性はすべてのメトリクスとイベントに含まれ、以下のことが可能になります:

- チームまたは部門別にメトリクスをフィルタリングする
- コストセンターごとのコストを追跡する
- チーム固有のダッシュボードを作成する
- 特定のチームのアラートを設定する

**OTEL\_RESOURCE\_ATTRIBUTES の重要なフォーマット要件:**

`OTEL_RESOURCE_ATTRIBUTES` 環境変数はカンマ区切りのキー=値ペアを使用し、厳密なフォーマット要件があります:

- **スペースは許可されません**: 値にスペースを含めることはできません。例えば、`user.organizationName=My Company` は無効です
- **フォーマット**: カンマ区切りのキー=値ペアである必要があります: `key1=value1,key2=value2`
- **許可される文字**: 制御文字、空白、ダブルクォート、カンマ、セミコロン、バックスラッシュを除く US-ASCII 文字のみ
- **特殊文字**: 許可された範囲外の文字はパーセントエンコードする必要があります

**例:**

```bash theme={null}
# ❌ 無効 - スペースを含む
export OTEL_RESOURCE_ATTRIBUTES="org.name=John's Organization"

# ✅ 有効 - アンダースコアまたはキャメルケースを代わりに使用する
export OTEL_RESOURCE_ATTRIBUTES="org.name=Johns_Organization"
export OTEL_RESOURCE_ATTRIBUTES="org.name=JohnsOrganization"

# ✅ 有効 - 必要に応じて特殊文字をパーセントエンコードする
export OTEL_RESOURCE_ATTRIBUTES="org.name=John%27s%20Organization"
```

注: 値をクォートで囲むことはスペースをエスケープしません。例えば、`org.name="My Company"` は `My Company` ではなく、リテラル値 `"My Company"` (クォート付き) になります。

### 設定例

`claude` を実行する前にこれらの環境変数を設定します。各ブロックは、異なるエクスポーターまたはデプロイメントシナリオの完全な設定を示しています:

```bash
# コンソールデバッグ (1 秒間隔)
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=console
export OTEL_METRIC_EXPORT_INTERVAL=1000

# OTLP/gRPC
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=grpc
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317

# Prometheus
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=prometheus

# 複数のエクスポーター
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=console,otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=http/json

# メトリクスとログの異なるエンドポイント/バックエンド
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=otlp
export OTEL_LOGS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_METRICS_PROTOCOL=http/protobuf
export OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://metrics.example.com:4318
export OTEL_EXPORTER_OTLP_LOGS_PROTOCOL=grpc
export OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=http://logs.example.com:4317

# メトリクスのみ (イベント/ログなし)
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=grpc
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317

# イベント/ログのみ (メトリクスなし)
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_LOGS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=grpc
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
```

## 利用可能なメトリクスとイベント

### 標準属性

すべてのメトリクスとイベントは、これらの標準属性を共有します:

| 属性 | 説明 | 制御者 |
| - | - | - |
| `session.id` | 一意のセッション識別子 | `OTEL_METRICS_INCLUDE_SESSION_ID` (デフォルト: true) |
| `app.version` | 現在の Claude Code バージョン | `OTEL_METRICS_INCLUDE_VERSION` (デフォルト: false) |
| `organization.id` | 組織 UUID (認証時) | 利用可能な場合は常に含まれます |
| `user.account_uuid` | アカウント UUID (認証時) | `OTEL_METRICS_INCLUDE_ACCOUNT_UUID` (デフォルト: true) |
| `user.account_id` | Anthropic 管理 API と一致するタグ付き形式のアカウント ID (認証時)。例: `user_01BWBeN28...` | `OTEL_METRICS_INCLUDE_ACCOUNT_UUID` (デフォルト: true) |
| `user.id` | Claude Code インストールごとに生成される匿名デバイス/インストール識別子 | 常に含まれます |
| `user.email` | ユーザーメールアドレス (OAuth 経由で認証時) | 利用可能な場合は常に含まれます |
| `terminal.type` | ターミナルタイプ。例: `iTerm.app`、`vscode`、`cursor`、`tmux` | 検出された場合は常に含まれます |

イベントには、以下の追加属性が含まれます。これらはメトリクスに添付されることはありません。これらはバウンドされていないカーディナリティを引き起こすためです:

- `prompt.id`: ユーザープロンプトを次のプロンプトまでのすべての後続イベントと相関させる UUID。[イベント相関属性](#event-correlation-attributes)を参照してください。
- `workspace.host_paths`: デスクトップアプリで選択されたホストワークスペースディレクトリ (文字列配列として)

### メトリクス

Claude Code は以下のメトリクスをエクスポートします:

| メトリクス名 | 説明 | 単位 |
| - | - | - |
| `claude_code.session.count` | 開始された CLI セッションの数 | count |
| `claude_code.lines_of_code.count` | 変更されたコード行の数 | count |
| `claude_code.pull_request.count` | 作成されたプルリクエストの数 | count |
| `claude_code.commit.count` | 作成された git コミットの数 | count |
| `claude_code.cost.usage` | Claude Code セッションのコスト | USD |
| `claude_code.token.usage` | 使用されたトークンの数 | tokens |
| `claude_code.code_edit_tool.decision` | コード編集ツールの権限決定の数 | count |
| `claude_code.active_time.total` | 合計アクティブ時間 (秒単位) | s |

### メトリクスの詳細

各メトリクスには、上記の標準属性が含まれます。追加のコンテキスト固有の属性を持つメトリクスは以下に記載されています。

#### セッションカウンター

各セッションの開始時にインクリメントされます。

**属性**:

- すべての[標準属性](#standard-attributes)
- `start_type`: セッションがどのように開始されたか。`"fresh"`、`"resume"`、または `"continue"` のいずれか

#### コード行カウンター

コードが追加または削除されたときにインクリメントされます。

**属性**:

- すべての[標準属性](#standard-attributes)
- `type`: (`"added"`、`"removed"`)

#### プルリクエストカウンター

Claude Code を介してプルリクエストを作成するときにインクリメントされます。

**属性**:

- すべての[標準属性](#standard-attributes)

#### コミットカウンター

Claude Code を介して git コミットを作成するときにインクリメントされます。

**属性**:

- すべての[標準属性](#standard-attributes)

#### コストカウンター

各 API リクエスト後にインクリメントされます。

**属性**:

- すべての[標準属性](#standard-attributes)
- `model`: モデル識別子 (例: "claude-sonnet-4-6")
- `query_source`: リクエストを発行したサブシステムのカテゴリ。`"main"`、`"subagent"`、または `"auxiliary"` のいずれか
- `speed`: 高速モードを使用した場合は `"fast"`。それ以外の場合は存在しません
- `effort`: リクエストに適用された[努力レベル](/ja/model-config#adjust-effort-level): `"low"`、`"medium"`、`"high"`、`"xhigh"`、または `"max"`。モデルが努力をサポートしない場合は存在しません。

#### トークンカウンター

各 API リクエスト後にインクリメントされます。

**属性**:

- すべての[標準属性](#standard-attributes)
- `type`: (`"input"`、`"output"`、`"cacheRead"`、`"cacheCreation"`)
- `model`: モデル識別子 (例: "claude-sonnet-4-6")
- `query_source`: リクエストを発行したサブシステムのカテゴリ。`"main"`、`"subagent"`、または `"auxiliary"` のいずれか
- `speed`: 高速モードを使用した場合は `"fast"`。それ以外の場合は存在しません
- `effort`: リクエストに適用された[努力レベル](/ja/model-config#adjust-effort-level)。詳細は [コストカウンター](#cost-counter)を参照してください。

#### コード編集ツール決定カウンター

ユーザーが Edit、Write、または NotebookEdit ツールの使用を受け入れるか拒否するときにインクリメントされます。

**属性**:

- すべての[標準属性](#standard-attributes)
- `tool_name`: ツール名 (`"Edit"`、`"Write"`、`"NotebookEdit"`)
- `decision`: ユーザーの決定 (`"accept"`、`"reject"`)
- `source`: 決定ソース - `"config"`、`"hook"`、`"user_permanent"`、`"user_temporary"`、`"user_abort"`、または `"user_reject"`
- `language`: 編集されたファイルのプログラミング言語。例: `"TypeScript"`、`"Python"`、`"JavaScript"`、`"Markdown"`。認識されないファイル拡張子の場合は `"unknown"` を返します。

#### アクティブ時間カウンター

Claude Code を積極的に使用している実際の時間を追跡します (アイドル時間ではありません)。このメトリクスは、ユーザーインタラクション (入力、応答の読み取り) 中および CLI 処理 (ツール実行、AI 応答生成) 中にインクリメントされます。

**属性**:

- すべての[標準属性](#standard-attributes)
- `type`: キーボードインタラクションの場合は `"user"`、ツール実行と AI 応答の場合は `"cli"`

### イベント

Claude Code は、OpenTelemetry ログ/イベント経由で以下のイベントをエクスポートします (`OTEL_LOGS_EXPORTER` が設定されている場合):

#### イベント相関属性

ユーザーがプロンプトを送信すると、Claude Code は複数の API 呼び出しを行い、複数のツールを実行する場合があります。`prompt.id` 属性を使用すると、それらのすべてのイベントを、それらをトリガーした単一のプロンプトに結び付けることができます。

| 属性 | 説明 |
| - | - |
| `prompt.id` | 単一のユーザープロンプトの処理中に生成されたすべてのイベントをリンクする UUID v4 識別子 |

単一のプロンプトによってトリガーされたすべてのアクティビティをトレースするには、特定の `prompt.id` 値でイベントをフィルタリングします。これにより、user\_prompt イベント、api\_request イベント、およびそのプロンプトの処理中に発生した tool\_result イベントが返されます。

`prompt.id` は、各プロンプトが一意の ID を生成し、時系列が増え続けるため、メトリクスから意図的に除外されています。イベントレベルの分析と監査証跡にのみ使用してください。

#### ユーザープロンプトイベント

ユーザーがプロンプトを送信するときにログされます。

**イベント名**: `claude_code.user_prompt`

**属性**:

- すべての[標準属性](#standard-attributes)
- `event.name`: `"user_prompt"`
- `event.timestamp`: ISO 8601 タイムスタンプ
- `event.sequence`: セッション内のイベントを順序付けするための単調増加カウンター
- `prompt_length`: プロンプトの長さ
- `prompt`: プロンプトコンテンツ (デフォルトではマスク、`OTEL_LOG_USER_PROMPTS=1` で有効化)
- `command_name`: プロンプトがコマンドを呼び出す場合のコマンド名。`compact` または `debug` などの組み込みおよびバンドルされたコマンド名はそのまま出力されます。`reset` などのエイリアスは、正規名ではなく入力されたとおりに出力されます。カスタム、プラグイン、MCP コマンド名は、`OTEL_LOG_TOOL_DETAILS=1` が設定されていない限り `custom` または `mcp` に折りたたまれます
- `command_source`: コマンドが存在する場合のコマンドの起源: `builtin`、`custom`、または `mcp`。プラグイン提供のコマンドは `custom` として報告されます

#### ツール結果イベント

ツールが実行を完了するときにログされます。

**イベント名**: `claude_code.tool_result`

**属性**:

- すべての[標準属性](#standard-attributes)
- `event.name`: `"tool_result"`
- `event.timestamp`: ISO 8601 タイムスタンプ
- `event.sequence`: セッション内のイベントを順序付けするための単調増加カウンター
- `tool_name`: ツールの名前
- `tool_use_id`: このツール呼び出しの一意の識別子。フックに渡される `tool_use_id` と一致し、OTel イベントとフック取得データ間の相関を可能にします。
- `success`: `"true"` または `"false"`
- `duration_ms`: 実行時間 (ミリ秒単位)
- `error_type`: ツールが失敗した場合のエラーカテゴリ文字列。例: `"Error:ENOENT"` または `"ShellError"`
- `error` (`OTEL_LOG_TOOL_DETAILS=1` の場合): ツールが失敗した場合の完全なエラーメッセージ
- `decision_type`: `"accept"` または `"reject"`
- `decision_source`: 決定ソース - `"config"`、`"hook"`、`"user_permanent"`、`"user_temporary"`、`"user_abort"`、または `"user_reject"`
- `tool_input_size_bytes`: JSON シリアル化されたツール入力のサイズ (バイト単位)
- `tool_result_size_bytes`: ツール結果のサイズ (バイト単位)
- `mcp_server_scope`: MCP サーバースコープ識別子 (MCP ツール用)
- `tool_parameters` (`OTEL_LOG_TOOL_DETAILS=1` の場合): ツール固有のパラメーターを含む JSON 文字列:
  - Bash ツールの場合: `bash_command`、`full_command`、`timeout`、`description`、`dangerouslyDisableSandbox`、および `git_commit_id` (git commit コマンドが成功した場合のコミット SHA) を含む
  - MCP ツール: `mcp_server_name`、`mcp_tool_name` を含む
  - Skill ツール: `skill_name` を含む
  - Task ツール: `subagent_type` を含む
- `tool_input` (`OTEL_LOG_TOOL_DETAILS=1` の場合): JSON シリアル化されたツール引数。512 文字を超える個別の値は切り詰められ、全体のペイロードは約 4 K 文字に制限されます。すべてのツール (MCP ツールを含む) に適用されます。

#### API リクエストイベント

Claude への各 API リクエストについてログされます。

**イベント名**: `claude_code.api_request`

**属性**:

- すべての[標準属性](#standard-attributes)
- `event.name`: `"api_request"`
- `event.timestamp`: ISO 8601 タイムスタンプ
- `event.sequence`: セッション内のイベントを順序付けするための単調増加カウンター
- `model`: 使用されたモデル (例: "claude-sonnet-4-6")
- `cost_usd`: 推定コスト (USD)
- `duration_ms`: リクエスト期間 (ミリ秒単位)
- `input_tokens`: 入力トークンの数
- `output_tokens`: 出力トークンの数
- `cache_read_tokens`: キャッシュから読み取られたトークンの数
- `cache_creation_tokens`: キャッシュ作成に使用されたトークンの数
- `request_id`: レスポンスの `request-id` ヘッダーからの Anthropic API リクエスト ID。例: `"req_011..."`。API が返す場合のみ存在します。
- `speed`: `"fast"` または `"normal"`、高速モードがアクティブであったかどうかを示します
- `query_source`: リクエストを発行したサブシステム。例: `"repl_main_thread"`、`"compact"`、またはサブエージェント名
- `effort`: リクエストに適用された[努力レベル](/ja/model-config#adjust-effort-level): `"low"`、`"medium"`、`"high"`、`"xhigh"`、または `"max"`。モデルが努力をサポートしない場合は存在しません。

#### API エラーイベント

Claude への API リクエストが失敗するときにログされます。

**イベント名**: `claude_code.api_error`

**属性**:

- すべての[標準属性](#standard-attributes)
- `event.name`: `"api_error"`
- `event.timestamp`: ISO 8601 タイムスタンプ
- `event.sequence`: セッション内のイベントを順序付けするための単調増加カウンター
- `model`: 使用されたモデル (例: "claude-sonnet-4-6")
- `error`: エラーメッセージ
- `status_code`: HTTP ステータスコード (数値)。接続失敗などの非 HTTP エラーの場合は存在しません。
- `duration_ms`: リクエスト期間 (ミリ秒単位)
- `attempt`: 試行の総数 (初期リクエストを含む。`1` は再試行が発生しなかったことを意味します)
- `request_id`: レスポンスの `request-id` ヘッダーからの Anthropic API リクエスト ID。例: `"req_011..."`。API が返す場合のみ存在します。
- `speed`: `"fast"` または `"normal"`、高速モードがアクティブであったかどうかを示します
- `query_source`: リクエストを発行したサブシステム。例: `"repl_main_thread"`、`"compact"`、またはサブエージェント名
- `effort`: リクエストに適用された[努力レベル](/ja/model-config#adjust-effort-level)。モデルが努力をサポートしない場合は存在しません。

#### API リクエストボディイベント

`OTEL_LOG_RAW_API_BODIES` が設定されている場合、各 API リクエスト試行についてログされます。調整されたパラメーターでの再試行ごとに 1 つのイベントが出力されます。

**イベント名**: `claude_code.api_request_body`

**属性**:

- すべての[標準属性](#standard-attributes)
- `event.name`: `"api_request_body"`
- `event.timestamp`: ISO 8601 タイムスタンプ
- `event.sequence`: セッション内のイベントを順序付けするための単調増加カウンター
- `body`: JSON シリアル化された Messages API リクエストパラメーター (システムプロンプト、メッセージ、ツールなど)。60 KB で切り詰められます。前のアシスタントターンの拡張思考コンテンツはマスクされます。インラインモード (`OTEL_LOG_RAW_API_BODIES=1`) でのみ出力されます。
- `body_ref`: 切り詰められていないボディを含む `<dir>/<uuid>.request.json` ファイルへの絶対パス。ファイルモード (`OTEL_LOG_RAW_API_BODIES=file:<dir>`) でのみ出力されます。
- `body_length`: 切り詰められていないボディの長さ。`OTEL_LOG_RAW_API_BODIES=file:<dir>` の場合は UTF-8 バイト、`=1` の場合は UTF-16 コードユニット
- `body_truncated`: インライン切り詰めが発生した場合は `"true"`。ファイルモードおよび切り詰めが発生しなかった場合は存在しません。
- `model`: リクエストパラメーターからのモデル識別子
- `query_source`: リクエストを発行したサブシステム (例: `"compact"`)

#### API レスポンスボディイベント

`OTEL_LOG_RAW_API_BODIES` が設定されている場合、各成功した API レスポンスについてログされます。

**イベント名**: `claude_code.api_response_body`

**属性**:

- すべての[標準属性](#standard-attributes)
- `event.name`: `"api_response_body"`
- `event.timestamp`: ISO 8601 タイムスタンプ
- `event.sequence`: セッション内のイベントを順序付けするための単調増加カウンター
- `body`: JSON シリアル化された Messages API レスポンス (id、コンテンツブロック、使用状況、停止理由)。60 KB で切り詰められます。拡張思考コンテンツはマスクされます。インラインモード (`OTEL_LOG_RAW_API_BODIES=1`) でのみ出力されます。
- `body_ref`: 切り詰められていないボディを含む `<dir>/<request_id>.response.json` ファイルへの絶対パス。ファイルモード (`OTEL_LOG_RAW_API_BODIES=file:<dir>`) でのみ出力されます。
- `body_length`: 切り詰められていないボディの長さ。`OTEL_LOG_RAW_API_BODIES=file:<dir>` の場合は UTF-8 バイト、`=1` の場合は UTF-16 コードユニット
- `body_truncated`: インライン切り詰めが発生した場合は `"true"`。ファイルモードおよび切り詰めが発生しなかった場合は存在しません。
- `model`: モデル識別子
- `query_source`: リクエストを発行したサブシステム
- `request_id`: レスポンスの `request-id` ヘッダーからの Anthropic API リクエスト ID。例: `"req_011..."`。API が返す場合のみ存在します。

#### ツール決定イベント

ツール権限決定 (受け入れ/拒否) が行われるときにログされます。

**イベント名**: `claude_code.tool_decision`

**属性**:

- すべての[標準属性](#standard-attributes)
- `event.name`: `"tool_decision"`
- `event.timestamp`: ISO 8601 タイムスタンプ
- `event.sequence`: セッション内のイベントを順序付けするための単調増加カウンター
- `tool_name`: ツールの名前 (例: "Read"、"Edit"、"Write"、"NotebookEdit")
- `tool_use_id`: このツール呼び出しの一意の識別子。フックに渡される `tool_use_id` と一致し、OTel イベントとフック取得データ間の相関を可能にします。
- `decision`: `"accept"` または `"reject"`
- `source`: 決定ソース - `"config"`、`"hook"`、`"user_permanent"`、`"user_temporary"`、`"user_abort"`、または `"user_reject"`

#### 権限モード変更イベント

権限モードが変更されるときにログされます。例えば、`Shift+Tab` サイクリング、プランモード終了、または自動モードゲートチェックから。

**イベント名**: `claude_code.permission_mode_changed`

**属性**:

- すべての[標準属性](#standard-attributes)
- `event.name`: `"permission_mode_changed"`
- `event.timestamp`: ISO 8601 タイムスタンプ
- `event.sequence`: セッション内のイベントを順序付けするための単調増加カウンター
- `from_mode`: 前の権限モード。例: `"default"`、`"plan"`、`"acceptEdits"`、`"auto"`、または `"bypassPermissions"`
- `to_mode`: 新しい権限モード
- `trigger`: 変更の原因。`"shift_tab"`、`"exit_plan_mode"`、`"auto_gate_denied"`、または `"auto_opt_in"` のいずれか。SDK またはブリッジから発生する場合は存在しません

#### 認証イベント

`/login` または `/logout` が完了するときにログされます。

**イベント名**: `claude_code.auth`

**属性**:

- すべての[標準属性](#standard-attributes)
- `event.name`: `"auth"`
- `event.timestamp`: ISO 8601 タイムスタンプ
- `event.sequence`: セッション内のイベントを順序付けするための単調増加カウンター
- `action`: `"login"` または `"logout"`
- `success`: `"true"` または `"false"`
- `auth_method`: 認証方法。例: `"oauth"`
- `error_category`: アクションが失敗した場合のカテゴリエラー種別。生のエラーメッセージは含まれません
- `status_code`: アクションが HTTP エラーで失敗した場合の HTTP ステータスコード (文字列)

#### MCP サーバー接続イベント

MCP サーバーが接続、切断、または接続に失敗するときにログされます。

**イベント名**: `claude_code.mcp_server_connection`

**属性**:

- すべての[標準属性](#standard-attributes)
- `event.name`: `"mcp_server_connection"`
- `event.timestamp`: ISO 8601 タイムスタンプ
- `event.sequence`: セッション内のイベントを順序付けするための単調増加カウンター
- `status`: `"connected"`、`"failed"`、または `"disconnected"`
- `transport_type`: サーバートランスポート。例: `"stdio"`、`"sse"`、または `"http"`
- `server_scope`: サーバーが設定されているスコープ。例: `"user"`、`"project"`、または `"local"`
- `duration_ms`: 接続試行期間 (ミリ秒単位)
- `error_code`: 接続が失敗した場合のエラーコード
- `server_name` (`OTEL_LOG_TOOL_DETAILS=1` の場合): 設定されたサーバー名
- `error` (`OTEL_LOG_TOOL_DETAILS=1` の場合): 接続が失敗した場合の完全なエラーメッセージ

#### 内部エラーイベント

Claude Code が予期しない内部エラーをキャッチするときにログされます。エラークラス名と errno スタイルコードのみが記録されます。エラーメッセージとスタックトレースは含まれません。このイベントは、Bedrock、Vertex、Foundry に対して実行している場合、または `DISABLE_ERROR_REPORTING` が設定されている場合は出力されません。

**イベント名**: `claude_code.internal_error`

**属性**:

- すべての[標準属性](#standard-attributes)
- `event.name`: `"internal_error"`
- `event.timestamp`: ISO 8601 タイムスタンプ
- `event.sequence`: セッション内のイベントを順序付けするための単調増加カウンター
- `error_name`: エラークラス名。例: `"TypeError"` または `"SyntaxError"`
- `error_code`: エラーに存在する場合の Node.js errno コード。例: `"ENOENT"`

#### プラグインインストールイベント

プラグインがインストール完了するときにログされます。`claude plugin install` CLI コマンドと対話型 `/plugin` UI の両方から。

**イベント名**: `claude_code.plugin_installed`

**属性**:

- すべての[標準属性](#standard-attributes)
- `event.name`: `"plugin_installed"`
- `event.timestamp`: ISO 8601 タイムスタンプ
- `event.sequence`: セッション内のイベントを順序付けするための単調増加カウンター
- `marketplace.is_official`: マーケットプレイスが公式 Anthropic マーケットプレイスの場合は `"true"`、そうでない場合は `"false"`
- `install.trigger`: `"cli"` または `"ui"`
- `plugin.name`: インストールされたプラグインの名前。サードパーティマーケットプレイスの場合、`OTEL_LOG_TOOL_DETAILS=1` の場合のみ含まれます
- `plugin.version`: マーケットプレイスエントリで宣言されている場合のプラグインバージョン。サードパーティマーケットプレイスの場合、`OTEL_LOG_TOOL_DETAILS=1` の場合のみ含まれます
- `marketplace.name`: プラグインがインストールされたマーケットプレイス。サードパーティマーケットプレイスの場合、`OTEL_LOG_TOOL_DETAILS=1` の場合のみ含まれます

#### スキル有効化イベント

スキルが呼び出されるときにログされます。Claude が Skill ツールを通じてそれを呼び出すか、`/` コマンドとして実行するかどうかにかかわらず。

**イベント名**: `claude_code.skill_activated`

**属性**:

- すべての[標準属性](#standard-attributes)
- `event.name`: `"skill_activated"`
- `event.timestamp`: ISO 8601 タイムスタンプ
- `event.sequence`: セッション内のイベントを順序付けするための単調増加カウンター
- `skill.name`: スキルの名前。ユーザー定義およびサードパーティプラグインスキルの場合、`OTEL_LOG_TOOL_DETAILS=1` が設定されていない限り値はプレースホルダー `"custom_skill"` です
- `invocation_trigger`: スキルがどのようにトリガーされたか (`"user-slash"`、`"claude-proactive"`、または `"nested-skill"`)
- `skill.source`: スキルが読み込まれた場所 (例: `"bundled"`、`"userSettings"`、`"projectSettings"`、`"plugin"`)
- `plugin.name` (`OTEL_LOG_TOOL_DETAILS=1` またはプラグインが公式マーケットプレイスからの場合): スキルがプラグインによって提供される場合の所有プラグインの名前
- `marketplace.name` (`OTEL_LOG_TOOL_DETAILS=1` またはプラグインが公式マーケットプレイスからの場合): スキルがプラグインによって提供される場合、所有プラグインがインストールされたマーケットプレイス

#### @ メンションイベント

Claude Code がプロンプト内の `@` メンションを解決するときにログされます。すべてのメンションがイベントを出力するわけではありません。権限拒否、ファイルサイズ超過、PDF 参照添付、ディレクトリリスト失敗などの早期終了パスはログなしで返されます。

**イベント名**: `claude_code.at_mention`

**属性**:

- すべての[標準属性](#standard-attributes)
- `event.name`: `"at_mention"`
- `event.timestamp`: ISO 8601 タイムスタンプ
- `event.sequence`: セッション内のイベントを順序付けするための単調増加カウンター
- `mention_type`: メンションのタイプ (`"file"`、`"directory"`、`"agent"`、`"mcp_resource"`)
- `success`: メンションが正常に解決されたかどうか (`"true"` または `"false"`)

#### API 再試行枯渇イベント

API リクエストが複数回の試行後に失敗した場合に 1 回ログされます。最終的な `api_error` イベントと一緒に出力されます。

**イベント名**: `claude_code.api_retries_exhausted`

**属性**:

- すべての[標準属性](#standard-attributes)
- `event.name`: `"api_retries_exhausted"`
- `event.timestamp`: ISO 8601 タイムスタンプ
- `event.sequence`: セッション内のイベントを順序付けするための単調増加カウンター
- `model`: 使用されたモデル
- `error`: 最終エラーメッセージ
- `status_code`: HTTP ステータスコード (数値)。非 HTTP エラーの場合は存在しません。
- `total_attempts`: 試行の総数
- `total_retry_duration_ms`: すべての試行にわたる実時間
- `speed`: `"fast"` または `"normal"`

#### フック実行開始イベント

1 つ以上のフックがフックイベントの実行を開始するときにログされます。

**イベント名**: `claude_code.hook_execution_start`

**属性**:

- すべての[標準属性](#standard-attributes)
- `event.name`: `"hook_execution_start"`
- `event.timestamp`: ISO 8601 タイムスタンプ
- `event.sequence`: セッション内のイベントを順序付けするための単調増加カウンター
- `hook_event`: フックイベントタイプ。例: `"PreToolUse"` または `"PostToolUse"`
- `hook_name`: マッチャーを含む完全なフック名。例: `"PreToolUse:Write"`
- `num_hooks`: 一致するフックコマンドの数
- `managed_only`: 管理ポリシーフックのみが許可されている場合は `"true"`
- `hook_source`: `"policySettings"` または `"merged"`
- `hook_definitions`: JSON シリアル化されたフック設定。詳細なベータトレースと `OTEL_LOG_TOOL_DETAILS=1` の両方が有効な場合にのみ含まれます

#### フック実行完了イベント

フックイベントのすべてのフックが完了するときにログされます。

**イベント名**: `claude_code.hook_execution_complete`

**属性**:

- すべての[標準属性](#standard-attributes)
- `event.name`: `"hook_execution_complete"`
- `event.timestamp`: ISO 8601 タイムスタンプ
- `event.sequence`: セッション内のイベントを順序付けするための単調増加カウンター
- `hook_event`: フックイベントタイプ
- `hook_name`: マッチャーを含む完全なフック名
- `num_hooks`: 一致するフックコマンドの数
- `num_success`: 正常に完了した数
- `num_blocking`: ブロッキング決定を返した数
- `num_non_blocking_error`: ブロックなしで失敗した数
- `num_cancelled`: 完了前にキャンセルされた数
- `total_duration_ms`: すべての一致するフックの実時間
- `managed_only`: 管理ポリシーフックのみが許可されている場合は `"true"`
- `hook_source`: `"policySettings"` または `"merged"`
- `hook_definitions`: JSON シリアル化されたフック設定。詳細なベータトレースと `OTEL_LOG_TOOL_DETAILS=1` の両方が有効な場合にのみ含まれます

#### 圧縮イベント

会話圧縮が完了するときにログされます。

**イベント名**: `claude_code.compaction`

**属性**:

- すべての[標準属性](#standard-attributes)
- `event.name`: `"compaction"`
- `event.timestamp`: ISO 8601 タイムスタンプ
- `event.sequence`: セッション内のイベントを順序付けするための単調増加カウンター
- `trigger`: `"auto"` または `"manual"`
- `success`: `"true"` または `"false"`
- `duration_ms`: 圧縮期間
- `pre_tokens`: 圧縮前のおおよそのトークン数
- `post_tokens`: 圧縮後のおおよそのトークン数
- `error`: 圧縮が失敗した場合のエラーメッセージ

## メトリクスとイベントデータの解釈

エクスポートされたメトリクスとイベントは、さまざまな分析をサポートします:

### 使用状況監視

| メトリクス | 分析の機会 |
| - | - |
| `claude_code.token.usage` | `type` (入力/出力)、ユーザー、チーム、またはモデル別に分類 |
| `claude_code.session.count` | 時間経過に伴う採用と関与を追跡 |
| `claude_code.lines_of_code.count` | コード追加/削除を追跡して生産性を測定 |
| `claude_code.commit.count` & `claude_code.pull_request.count` | 開発ワークフローへの影響を理解 |

### コスト監視

`claude_code.cost.usage` メトリクスは以下に役立ちます:

- チームまたは個人全体の使用トレンドを追跡する
- 最適化のための高使用セッションを特定する

コストメトリクスは概算です。公式な請求データについては、API プロバイダー (Claude Console、AWS Bedrock、または Google Cloud Vertex) を参照してください。

### アラートとセグメンテーション

検討すべき一般的なアラート:

- コストスパイク
- 異常なトークン消費
- 特定のユーザーからの高いセッションボリューム

すべてのメトリクスは、`user.account_uuid`、`user.account_id`、`organization.id`、`session.id`、`model`、および `app.version` でセグメント化できます。

### 再試行枯渇の検出

Claude Code は失敗した API リクエストを内部的に再試行し、あきらめた後にのみ単一の `claude_code.api_error` イベントを出力するため、イベント自体がそのリクエストの終端信号です。中間再試行試行は個別のイベントとしてログされません。

イベントの `attempt` 属性は、試行の総数を記録します。`CLAUDE_CODE_MAX_RETRIES` (デフォルト `10`) より大きい値は、リクエストが一時的なエラーのすべての再試行を枯渇させたことを示します。より低い値は、`400` レスポンスなどの再試行不可能なエラーを示します。

セッションが回復したものと停止したものを区別するには、イベントを `session.id` でグループ化し、エラーの後に後続の `api_request` イベントが存在するかどうかを確認します。

### イベント分析

イベントデータは Claude Code インタラクションに関する詳細な洞察を提供します:

**ツール使用パターン**: ツール結果イベントを分析して以下を特定します:

- 最も頻繁に使用されるツール
- ツール成功率
- 平均ツール実行時間
- ツールタイプ別のエラーパターン

**パフォーマンス監視**: API リクエスト期間とツール実行時間を追跡して、パフォーマンスボトルネックを特定します。

## バックエンドに関する考慮事項

メトリクス、ログ、トレースバックエンドの選択により、実行できる分析のタイプが決まります:

### メトリクスの場合

- **時系列データベース (例: Prometheus)**: レート計算、集約メトリクス
- **カラムナーストア (例: ClickHouse)**: 複雑なクエリ、一意のユーザー分析
- **フル機能の可観測性プラットフォーム (例: Honeycomb、Datadog)**: 高度なクエリ、可視化、アラート

### イベント/ログの場合

- **ログ集約システム (例: Elasticsearch、Loki)**: 全文検索、ログ分析
- **カラムナーストア (例: ClickHouse)**: 構造化イベント分析
- **フル機能の可観測性プラットフォーム (例: Honeycomb、Datadog)**: メトリクスとイベント間の相関

### トレースの場合

分散トレースストレージとスパン相関をサポートするバックエンドを選択します:

- **分散トレースシステム (例: Jaeger、Zipkin、Grafana Tempo)**: スパン可視化、リクエストウォーターフォール、レイテンシー分析
- **フル機能の可観測性プラットフォーム (例: Honeycomb、Datadog)**: トレース検索とメトリクスおよびログとの相関

日次/週次/月次アクティブユーザー (DAU/WAU/MAU) メトリクスが必要な組織の場合は、効率的な一意値クエリをサポートするバックエンドを検討してください。

## サービス情報

すべてのメトリクスとイベントは、以下のリソース属性でエクスポートされます:

- `service.name`: `claude-code`
- `service.version`: 現在の Claude Code バージョン
- `os.type`: オペレーティングシステムタイプ (例: `linux`、`darwin`、`windows`)
- `os.version`: オペレーティングシステムバージョン文字列
- `host.arch`: ホストアーキテクチャ (例: `amd64`、`arm64`)
- `wsl.version`: WSL バージョン番号 (Windows Subsystem for Linux で実行している場合のみ存在)
- メーター名: `com.anthropic.claude_code`

## ROI 測定リソース

テレメトリセットアップ、コスト分析、生産性メトリクス、自動レポート生成を含む Claude Code の投資収益率 (ROI) 測定に関する包括的なガイドについては、[Claude Code ROI 測定ガイド](https://github.com/anthropics/claude-code-monitoring-guide)を参照してください。このリポジトリは、すぐに使用できる Docker Compose 設定、Prometheus と OpenTelemetry セットアップ、Linear などのツールと統合された生産性レポート生成テンプレートを提供します。

## セキュリティとプライバシー

- OpenTelemetry エクスポートはオプトインであり、明示的な設定が必要です。Anthropic の個別の運用テレメトリと無効化方法については、[データ使用](/ja/data-usage#telemetry-services)を参照してください
- 生のファイルコンテンツとコードスニペットはメトリクスやイベントに含まれません。トレーススパンは別のデータパスです: 以下の `OTEL_LOG_TOOL_CONTENT` の項目を参照してください
- OAuth 経由で認証された場合、`user.email` はテレメトリ属性に含まれます。これが組織にとって懸念事項である場合は、テレメトリバックエンドと協力してこのフィールドをフィルタリングまたはマスクしてください
- ユーザープロンプトコンテンツはデフォルトでは収集されません。プロンプト長のみが記録されます。プロンプトコンテンツを含めるには、`OTEL_LOG_USER_PROMPTS=1` を設定します
- ツール入力引数とパラメーターはデフォルトではログされません。これらを含めるには、`OTEL_LOG_TOOL_DETAILS=1` を設定します。有効にすると、`tool_result` イベントには Bash コマンド、MCP サーバーとツール名、スキル名を含む `tool_parameters` 属性、およびファイルパス、URL、検索パターン、その他の引数を含む `tool_input` 属性が含まれます。`user_prompt` イベントには、カスタム、プラグイン、MCP コマンドの逐語的な `command_name` が含まれます。トレーススパンには同じ `tool_input` 属性と `file_path` などの入力派生属性が含まれます。512 文字を超える個別の値は切り詰められ、合計は約 4 K 文字に制限されますが、引数には機密値が含まれる可能性があります。必要に応じてこれらの属性をフィルタリングまたはマスクするようにテレメトリバックエンドを設定してください
- ツール入力と出力コンテンツはデフォルトではトレーススパンでログされません。これを含めるには、`OTEL_LOG_TOOL_CONTENT=1` を設定します。有効にすると、スパンイベントには 60 KB で切り詰められたツール入力と出力コンテンツが含まれます。これには Read ツール結果からの生のファイルコンテンツと Bash コマンド出力が含まれる可能性があります。必要に応じてこれらの属性をフィルタリングまたはマスクするようにテレメトリバックエンドを設定してください
- 生の Anthropic Messages API リクエストとレスポンスボディはデフォルトではログされません。これらを含めるには、`OTEL_LOG_RAW_API_BODIES` を設定します。`=1` の場合、各 API 呼び出しは `api_request_body` および `api_response_body` ログイベントを出力し、その `body` 属性は JSON シリアル化されたペイロードで、60 KB で切り詰められます。`=file:<dir>` の場合、切り詰められていないボディはそのディレクトリの下の `.request.json` および `.response.json` ファイルに書き込まれ、イベントはテレメトリストリームではなくログコレクターまたはサイドカーで配信されるディレクトリを含む `body_ref` パスを持ちます。両方のモードで、ボディには完全な会話履歴（システムプロンプト、すべての前のユーザーとアシスタントターン、ツール結果）が含まれるため、これを有効にすることは他の `OTEL_LOG_*` コンテンツフラグが明かすすべてのものに同意することを意味します。Claude の拡張思考コンテンツは、他の設定に関係なく、これらのボディから常にマスクされます

## Amazon Bedrock での Claude Code の監視

Amazon Bedrock での Claude Code 使用状況監視ガイダンスの詳細については、[Claude Code 監視実装 (Bedrock)](https://github.com/aws-solutions-library-samples/guidance-for-claude-code-with-amazon-bedrock/blob/main/assets/docs/MONITORING.md)を参照してください。
