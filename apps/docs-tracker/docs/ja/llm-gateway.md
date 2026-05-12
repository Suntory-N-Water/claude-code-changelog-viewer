---
title: llm-gateway
source: https://code.claude.com/docs/ja/llm-gateway.md
---

# LLM gateway設定

> Claude CodeをLLM gatewayソリューションと連携するための設定方法を学びます。gateway要件、認証設定、モデル選択、プロバイダー固有のエンドポイント設定をカバーしています。

LLM gatewayは、Claude Codeとモデルプロバイダー間の集中型プロキシレイヤーを提供し、以下のような機能をしばしば提供します：

- **集中型認証** - API キー管理の単一ポイント
- **使用状況追跡** - チームとプロジェクト全体での使用状況の監視
- **コスト管理** - 予算とレート制限の実装
- **監査ログ** - コンプライアンスのためのすべてのモデル相互作用の追跡
- **モデルルーティング** - コード変更なしでプロバイダー間の切り替え

## Gateway要件

LLM gatewayがClaude Codeと連携するには、以下の要件を満たす必要があります：

**API形式**

gatewayは、クライアントに対して以下のAPI形式の少なくとも1つを公開する必要があります：

1. **Anthropic Messages**: `/v1/messages`、`/v1/messages/count_tokens`
   - リクエストヘッダーを転送する必要があります：`anthropic-beta`、`anthropic-version`

2. **Bedrock InvokeModel**: `/invoke`、`/invoke-with-response-stream`
   - リクエストボディフィールドを保持する必要があります：`anthropic_beta`、`anthropic_version`

3. **Vertex rawPredict**: `:rawPredict`、`:streamRawPredict`、`/count-tokens:rawPredict`
   - リクエストヘッダーを転送する必要があります：`anthropic-beta`、`anthropic-version`

ヘッダーの転送またはボディフィールドの保持に失敗すると、機能が低下したり、Claude Code機能を使用できなくなる可能性があります。

Claude Codeは、API形式に基づいて有効にする機能を決定します。Anthropic Messages形式をBedrocまたはVertexで使用する場合、環境変数 `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1` を設定する必要があります。

**リクエストヘッダー**

Claude Codeは、すべてのAPI リクエストに以下のヘッダーを含めます：

| ヘッダー | 説明 |
| :- | :- |
| `X-Claude-Code-Session-Id` | 現在のClaude Codeセッションの一意の識別子。プロキシはこれを使用して、リクエストボディを解析することなく、単一セッションからのすべてのAPI リクエストを集約できます。 |
| `X-Claude-Code-Agent-Id` | リクエストを発行したサブエージェントまたはチームメイトの識別子。プロキシはこれを使用して、リクエストボディを解析することなく、セッション内の個別の並列サブエージェントにAPI コストを属性付けできます。インプロセスサブエージェントまたはチームメイトによって発行されたリクエストの場合のみ存在します。 |
| `X-Claude-Code-Parent-Agent-Id` | リクエストを行うエージェントを生成したエージェントの識別子。これを `X-Claude-Code-Agent-Id` と共に使用して、プロキシ内のネストされたエージェント全体にAPI コストを属性付けします。リクエストするエージェント自体が別のエージェントによって生成された場合のみ存在します。 |

両方のエージェントIDヘッダーは、永続的なユーザーまたはデバイスIDではなく、スポーン単位の一時的な識別子です。

Claude Codeはまた、クライアントバージョンと会話から派生したフィンガープリントを含む短い帰属ブロックをシステムプロンプトの前に付加します。Anthropic APIはこのブロックを処理前に削除するため、ファーストパーティプロンプトキャッシングには影響しません。gatewayが完全なリクエストボディをキーとしたプロンプトキャッシュを実装している場合は、[`CLAUDE_CODE_ATTRIBUTION_HEADER=0`](/ja/env-vars)を設定して、それを省略してください。

## 設定

### モデル選択

デフォルトでは、Claude Code は選択した API 形式の標準モデル名を使用します。

`ANTHROPIC_BASE_URL` が Anthropic Messages 形式を公開するゲートウェイを指している場合、Claude Code はスタートアップ時にゲートウェイの `/v1/models` エンドポイントをクエリし、返されたモデルを `/model` ピッカーに追加できます。`CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1` を設定して、この機能を有効にしてください。検出はデフォルトでオフになっており、共有 API キーでバックアップされたゲートウェイが、キーがアクセスできるすべてのモデルをすべてのユーザーに表示しないようにします。検出された各エントリは「From gateway」というラベルが付けられ、レスポンスから提供されている場合は `display_name` フィールドを使用します。これには Claude Code v2.1.129 以降が必要です。

検出は Anthropic Messages 形式にのみ適用されます。Bedrock または Vertex パススルーエンドポイントでは実行されず、`ANTHROPIC_BASE_URL` が設定されていない場合または `api.anthropic.com` を指している場合にも実行されません。

検出リクエストは推論リクエストと同じ方法で認証されます。認証トークンが設定されていない場合は、`ANTHROPIC_AUTH_TOKEN` をベアラートークンとして、または `ANTHROPIC_API_KEY` を `x-api-key` ヘッダーとして送信し、`ANTHROPIC_CUSTOM_HEADERS` からのヘッダーと共に送信されます。ID が `claude` または `anthropic` で始まるモデルのみがピッカーに追加されます。結果は `~/.claude/cache/gateway-models.json` にキャッシュされ、スタートアップのたびに更新されます。リクエストが失敗するか、ゲートウェイが `/v1/models` を実装していない場合、ピッカーは前回のスタートアップからのキャッシュリストまたは組み込みモデルリストにフォールバックします。

ゲートウェイが検出フィルターと一致しないモデル名を使用している場合は、[モデル設定](/ja/model-config)に記載されている環境変数を使用して、手動で追加してください。

## LiteLLM設定

LiteLLM PyPI バージョン 1.82.7 および 1.82.8 は、認証情報を盗むマルウェアで侵害されました。これらのバージョンをインストールしないでください。既にインストールしている場合：

- パッケージを削除してください
- 影響を受けたシステムのすべての認証情報をローテーションしてください
- [BerriAI/litellm#24518](https://github.com/BerriAI/litellm/issues/24518)の修復手順に従ってください

LiteLLM はサードパーティのプロキシサービスです。Anthropic は、LiteLLM のセキュリティまたは機能を推奨、保守、または監査していません。このガイドは情報提供目的で提供されており、古くなる可能性があります。自己判断で使用してください。

### 前提条件

- Claude Code が最新バージョンに更新されている
- LiteLLM Proxy Server がデプロイされてアクセス可能
- 選択したプロバイダーを通じて Claude モデルへのアクセス

### 基本的な LiteLLM セットアップ

**Claude Code を設定する**：

#### 認証方法

##### 静的 API キー

固定 API キーを使用した最も簡単な方法：

```bash
# 環境で設定
export ANTHROPIC_AUTH_TOKEN=sk-litellm-static-key

# または Claude Code 設定で
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "sk-litellm-static-key"
  }
}
```

この値は `Authorization` ヘッダーとして送信されます。

##### ヘルパーを使用した動的 API キー

キーのローテーションまたはユーザーごとの認証の場合：

1. API キーヘルパースクリプトを作成します：

```bash
#!/bin/bash
# ~/bin/get-litellm-key.sh

# 例：vault からキーを取得
vault kv get -field=api_key secret/litellm/claude-code

# 例：JWT トークンを生成
jwt encode \
  --secret="${JWT_SECRET}" \
  --exp="+1h" \
  '{"user":"'${USER}'","team":"engineering"}'
```

2. ヘルパーを使用するように Claude Code 設定を構成します：

```json
{
  "apiKeyHelper": "~/bin/get-litellm-key.sh"
}
```

3. トークンリフレッシュ間隔を設定します：

```bash
# 1 時間ごとにリフレッシュ（3600000 ms）
export CLAUDE_CODE_API_KEY_HELPER_TTL_MS=3600000
```

この値は `Authorization` および `X-Api-Key` ヘッダーとして送信されます。`apiKeyHelper` は `ANTHROPIC_AUTH_TOKEN` または `ANTHROPIC_API_KEY` より優先度が低くなります。

#### 統合エンドポイント（推奨）

LiteLLM の[Anthropic 形式エンドポイント](https://docs.litellm.ai/docs/anthropic_unified)を使用：

```bash
export ANTHROPIC_BASE_URL=https://litellm-server:4000
```

**統合エンドポイントのパススルーエンドポイント上での利点：**

- ロードバランシング
- フェイルオーバー
- コスト追跡とエンドユーザー追跡の一貫したサポート

#### プロバイダー固有のパススルーエンドポイント（代替）

##### LiteLLM を通じた Claude API

[パススルーエンドポイント](https://docs.litellm.ai/docs/pass_through/anthropic_completion)を使用：

```bash
export ANTHROPIC_BASE_URL=https://litellm-server:4000/anthropic
```

##### LiteLLM を通じた Amazon Bedrock

[パススルーエンドポイント](https://docs.litellm.ai/docs/pass_through/bedrock)を使用：

```bash
export ANTHROPIC_BEDROCK_BASE_URL=https://litellm-server:4000/bedrock
export CLAUDE_CODE_SKIP_BEDROCK_AUTH=1
export CLAUDE_CODE_USE_BEDROCK=1
```

##### LiteLLM を通じた Google Vertex AI

[パススルーエンドポイント](https://docs.litellm.ai/docs/pass_through/vertex_ai)を使用：

```bash
export ANTHROPIC_VERTEX_BASE_URL=https://litellm-server:4000/vertex_ai/v1
export ANTHROPIC_VERTEX_PROJECT_ID=your-gcp-project-id
export CLAUDE_CODE_SKIP_VERTEX_AUTH=1
export CLAUDE_CODE_USE_VERTEX=1
export CLOUD_ML_REGION=us-east5
```

##### AWS を通じた Claude Platform

[Claude Platform on AWS](/ja/claude-platform-on-aws) エンドポイントに転送するゲートウェイにルーティング：

```bash
export ANTHROPIC_AWS_BASE_URL=https://litellm-server:4000/anthropic-aws
export ANTHROPIC_AWS_WORKSPACE_ID=wrkspc_01ABCDEFGHIJKLMN
export CLAUDE_CODE_SKIP_ANTHROPIC_AWS_AUTH=1
export CLAUDE_CODE_USE_ANTHROPIC_AWS=1
```

詳細については、[LiteLLM ドキュメント](https://docs.litellm.ai/)を参照してください。

## 追加リソース

- [LiteLLMドキュメント](https://docs.litellm.ai/)
- [Claude Code設定](/ja/settings)
- [エンタープライズネットワーク設定](/ja/network-config)
- [サードパーティ統合の概要](/ja/third-party-integrations)
