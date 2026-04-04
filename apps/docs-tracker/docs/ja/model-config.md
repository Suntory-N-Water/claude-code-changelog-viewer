---
title: model-config
source: https://code.claude.com/docs/ja/model-config.md
---

# モデル設定

> Claude Code のモデル設定について学習します。`opusplan` などのモデルエイリアスを含みます

## 利用可能なモデル

Claude Code の `model` 設定では、以下のいずれかを設定できます。

- **モデルエイリアス**
- **モデル名**
  - Anthropic API：完全な **[モデル名](https://platform.claude.com/docs/ja/about-claude/models/overview)**
  - Bedrock：推論プロファイル ARN
  - Foundry：デプロイメント名
  - Vertex：バージョン名

### モデルエイリアス

モデルエイリアスは、正確なバージョン番号を覚えることなくモデル設定を選択するための便利な方法を提供します。

| モデルエイリアス | 動作 |
| - | - |
| **`default`** | 特別な値で、モデルオーバーライドをクリアし、アカウントタイプに応じた推奨モデルに戻します。それ自体はモデルエイリアスではありません |
| **`best`** | 最も高性能な利用可能なモデルを使用します。現在は `opus` と同等です |
| **`sonnet`** | 日常的なコーディングタスク用に最新の Sonnet モデル（現在は Sonnet 4.6）を使用 |
| **`opus`** | 複雑な推論タスク用に最新の Opus モデル（現在は Opus 4.6）を使用 |
| **`haiku`** | シンプルなタスク用に高速で効率的な Haiku モデルを使用 |
| **`sonnet[1m]`** | 長いセッション用に [100 万トークンのコンテキストウィンドウ](https://platform.claude.com/docs/ja/build-with-claude/context-windows#1m-token-context-window) を備えた Sonnet を使用 |
| **`opus[1m]`** | 長いセッション用に [100 万トークンのコンテキストウィンドウ](https://platform.claude.com/docs/ja/build-with-claude/context-windows#1m-token-context-window) を備えた Opus を使用 |
| **`opusplan`** | Plan Mode 中は `opus` を使用し、実行中は `sonnet` に自動的に切り替わる特別なモード |

エイリアスは常に最新バージョンを指します。特定のバージョンに固定するには、完全なモデル名（例：`claude-opus-4-6`）を使用するか、`ANTHROPIC_DEFAULT_OPUS_MODEL` などの対応する環境変数を設定します。

### モデルの設定

モデルは、優先度順に複数の方法で設定できます。

1. **セッション中** - `/model <alias|name>` を使用してセッション中にモデルを切り替える
2. **起動時** - `claude --model <alias|name>` で起動
3. **環境変数** - `ANTHROPIC_MODEL=<alias|name>` を設定
4. **設定** - 設定ファイルで `model` フィールドを使用して永続的に設定

使用例：

```bash
# Opus で開始
claude --model opus

# セッション中に Sonnet に切り替え
/model sonnet
```

設定ファイルの例：

```json
{
    "permissions": {
        ...
    },
    "model": "opus"
}
```

## モデル選択の制限

エンタープライズ管理者は、[管理設定またはポリシー設定](/ja/settings#settings-files) で `availableModels` を使用して、ユーザーが選択できるモデルを制限できます。

`availableModels` が設定されている場合、ユーザーは `/model`、`--model` フラグ、Config ツール、または `ANTHROPIC_MODEL` 環境変数を使用してリスト内にないモデルに切り替えることはできません。

```json
{
  "availableModels": ["sonnet", "haiku"]
}
```

### デフォルトモデルの動作

モデルピッカーの Default オプションは `availableModels` の影響を受けません。常に利用可能であり、[ユーザーのサブスクリプション層に基づいた](#default-model-setting) システムのランタイムデフォルトを表します。

`availableModels: []` の場合でも、ユーザーはそのティアの Default モデルで Claude Code を使用できます。

### ユーザーが実行するモデルの制御

`model` 設定は初期選択であり、強制ではありません。セッション開始時にアクティブなモデルを設定しますが、ユーザーは `/model` を開いて Default を選択することができ、これはそのティアのシステムデフォルトに解決されます。`model` が何に設定されているかに関係なく。

モデル体験を完全に制御するには、3 つの設定を組み合わせます。

- **`availableModels`**：ユーザーが切り替えられるという名前のモデルを制限
- **`model`**：セッション開始時にアクティブなモデルを設定
- **`ANTHROPIC_DEFAULT_SONNET_MODEL`** / **`ANTHROPIC_DEFAULT_OPUS_MODEL`** / **`ANTHROPIC_DEFAULT_HAIKU_MODEL`**：Default オプションと `sonnet`、`opus`、`haiku` エイリアスが解決するものを制御

この例では、ユーザーを Sonnet 4.5 で開始し、ピッカーを Sonnet と Haiku に制限し、Default を最新リリースではなく Sonnet 4.5 に解決するようにピン留めします。

```json
{
  "model": "claude-sonnet-4-5",
  "availableModels": ["claude-sonnet-4-5", "haiku"],
  "env": {
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "claude-sonnet-4-5"
  }
}
```

`env` ブロックがない場合、ユーザーがピッカーで Default を選択すると、最新の Sonnet リリースが取得され、`model` と `availableModels` のバージョンピンがバイパスされます。

### マージ動作

`availableModels` がユーザー設定とプロジェクト設定など複数のレベルで設定されている場合、配列はマージされ、重複排除されます。厳密なアローリストを適用するには、最優先度を持つ管理設定またはポリシー設定で `availableModels` を設定します。

## 特別なモデルの動作

### `default` モデル設定

`default` の動作はアカウントタイプによって異なります。

- **Max と Team Premium**：Opus 4.6 がデフォルト
- **Pro と Team Standard**：Sonnet 4.6 がデフォルト
- **Enterprise**：Opus 4.6 は利用可能ですがデフォルトではありません

Claude Code は、Opus の使用量閾値に達した場合、自動的に Sonnet にフォールバックする可能性があります。

### `opusplan` モデル設定

`opusplan` モデルエイリアスは、自動化されたハイブリッドアプローチを提供します。

- **Plan Mode 中** - 複雑な推論とアーキテクチャの決定用に `opus` を使用
- **実行モード中** - コード生成と実装用に自動的に `sonnet` に切り替わり

これにより、両方の長所が得られます。計画用の Opus の優れた推論と、実行用の Sonnet の効率性です。

### 努力レベルの調整

[努力レベル](https://platform.claude.com/docs/ja/build-with-claude/effort) は適応的推論を制御し、タスクの複雑さに基づいて思考を動的に割り当てます。低い努力はシンプルなタスクではより高速で安価ですが、高い努力は複雑な問題に対してより深い推論を提供します。

3 つのレベルがセッション全体で保持されます。**low**、**medium**、**high**。4 番目のレベルである **max** は、トークン支出に制約がない最も深い推論を提供するため、応答はより遅く、`high` より多くのコストがかかります。`max` は Opus 4.6 でのみ利用可能で、`CLAUDE_CODE_EFFORT_LEVEL` 環境変数を通じた場合を除き、セッション全体で保持されません。

Opus 4.6 と Sonnet 4.6 はデフォルトで medium 努力です。これはすべてのプロバイダー（Bedrock、Vertex AI、直接 API アクセスを含む）に適用されます。

Medium は、ほとんどのコーディングタスクに推奨されるレベルです。速度と推論の深さのバランスが取れており、より高いレベルはモデルが日常的な作業を過度に考えさせる可能性があります。`high` または `max` は、難しいデバッグ問題や複雑なアーキテクチャの決定など、より深い推論から本当に利益を得るタスク用に予約してください。

セッション設定を変更せずに 1 回限りの深い推論を行うには、プロンプトに「ultrathink」を含めて、そのターンで high 努力をトリガーします。

**努力の設定：**

- **`/effort`**：`/effort low`、`/effort medium`、`/effort high`、または `/effort max` を実行してレベルを変更するか、`/effort auto` を実行してモデルのデフォルトにリセット
- **`/model` 内**：モデルを選択する際に左右矢印キーを使用して努力スライダーを調整
- **`--effort` フラグ**：Claude Code を起動する際に `low`、`medium`、`high`、または `max` を渡して、単一セッションのレベルを設定
- **環境変数**：`CLAUDE_CODE_EFFORT_LEVEL` を `low`、`medium`、`high`、`max`、または `auto` に設定
- **設定**：設定ファイルで `effortLevel` を `"low"`、`"medium"`、または `"high"` に設定
- **Skill と subagent frontmatter**：[skill](/ja/skills#frontmatter-reference) または [subagent](/ja/sub-agents#supported-frontmatter-fields) markdown ファイルで `effort` を設定して、その skill または subagent が実行される際の努力レベルをオーバーライド

環境変数がすべての他の方法より優先され、次に設定されたレベル、次にモデルのデフォルトが優先されます。Frontmatter 努力は、その skill または subagent がアクティブな場合に適用され、セッションレベルをオーバーライドしますが、環境変数はオーバーライドしません。

努力は Opus 4.6 と Sonnet 4.6 でサポートされています。サポートされているモデルが選択されている場合、努力スライダーが `/model` に表示されます。現在の努力レベルはロゴとスピナーの横にも表示されます（例：「with low effort」）。`/model` を開かなくても、どの設定がアクティブかを確認できます。

Opus 4.6 と Sonnet 4.6 で適応的推論を無効にし、以前の固定思考予算に戻すには、`CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1` を設定します。無効にされた場合、これらのモデルは `MAX_THINKING_TOKENS` で制御される固定予算を使用します。[環境変数](/ja/env-vars) を参照してください。

### 拡張コンテキスト

Opus 4.6 と Sonnet 4.6 は、大規模なコードベースを持つ長いセッション用に [100 万トークンのコンテキストウィンドウ](https://platform.claude.com/docs/ja/build-with-claude/context-windows#1m-token-context-window) をサポートしています。

利用可能性はモデルとプランによって異なります。Max、Team、Enterprise プランでは、Opus は追加設定なしで自動的に 1M コンテキストにアップグレードされます。これは Team Standard と Team Premium の両方のシートに適用されます。

| プラン | Opus 4.6 with 1M context | Sonnet 4.6 with 1M context |
| - | - | - |
| Max、Team、Enterprise | サブスクリプションに含まれる | [追加使用](https://support.claude.com/en/articles/12429409-extra-usage-for-paid-claude-plans) が必要 |
| Pro | [追加使用](https://support.claude.com/en/articles/12429409-extra-usage-for-paid-claude-plans) が必要 | [追加使用](https://support.claude.com/en/articles/12429409-extra-usage-for-paid-claude-plans) が必要 |
| API と従量課金 | フルアクセス | フルアクセス |

1M コンテキストを完全に無効にするには、`CLAUDE_CODE_DISABLE_1M_CONTEXT=1` を設定します。これにより、1M モデルバリアントがモデルピッカーから削除されます。[環境変数](/ja/env-vars) を参照してください。

1M コンテキストウィンドウは標準モデル価格を使用し、200K を超えるトークンに対するプレミアムはありません。拡張コンテキストがサブスクリプションに含まれているプランでは、使用量はサブスクリプションでカバーされたままです。拡張コンテキストに追加使用でアクセスするプランでは、トークンは追加使用に請求されます。

アカウントが 1M コンテキストをサポートしている場合、オプションは Claude Code の最新バージョンのモデルピッカー（`/model`）に表示されます。表示されない場合は、セッションを再起動してみてください。

モデルエイリアスまたは完全なモデル名で `[1m]` サフィックスを使用することもできます。

```bash
# opus[1m] または sonnet[1m] エイリアスを使用
/model opus[1m]
/model sonnet[1m]

# または完全なモデル名に [1m] を追加
/model claude-opus-4-6[1m]
```

## 現在のモデルの確認

現在使用しているモデルは、複数の方法で確認できます。

1. [ステータスライン](/ja/statusline) 内（設定されている場合）
2. `/status` 内。アカウント情報も表示されます。

## カスタムモデルオプションの追加

`ANTHROPIC_CUSTOM_MODEL_OPTION` を使用して、組み込みエイリアスを置き換えることなく、単一のカスタムエントリを `/model` ピッカーに追加します。これは LLM ゲートウェイデプロイメントや、Claude Code がデフォルトでリストしないモデル ID のテストに役立ちます。

この例では、3 つの変数をすべて設定して、ゲートウェイルーティングされた Opus デプロイメントを選択可能にします。

```bash
export ANTHROPIC_CUSTOM_MODEL_OPTION="my-gateway/claude-opus-4-6"
export ANTHROPIC_CUSTOM_MODEL_OPTION_NAME="Opus via Gateway"
export ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION="Custom deployment routed through the internal LLM gateway"
```

カスタムエントリは `/model` ピッカーの下部に表示されます。`ANTHROPIC_CUSTOM_MODEL_OPTION_NAME` と `ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION` はオプションです。省略された場合、モデル ID は名前として使用され、説明はデフォルトで `Custom model (<model-id>)` になります。

Claude Code は `ANTHROPIC_CUSTOM_MODEL_OPTION` で設定されたモデル ID の検証をスキップするため、API エンドポイントが受け入れる任意の文字列を使用できます。

## 環境変数

以下の環境変数を使用できます。これらは完全な **モデル名**（または API プロバイダーの同等のもの）である必要があり、エイリアスがマップするモデル名を制御します。

| 環境変数 | 説明 |
| - | - |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | `opus` に使用するモデル、または Plan Mode がアクティブな場合の `opusplan` に使用するモデル。 |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | `sonnet` に使用するモデル、または Plan Mode がアクティブでない場合の `opusplan` に使用するモデル。 |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | `haiku` に使用するモデル、または [バックグラウンド機能](/ja/costs#background-token-usage) に使用するモデル |
| `CLAUDE_CODE_SUBAGENT_MODEL` | [subagents](/ja/sub-agents) に使用するモデル |

注：`ANTHROPIC_SMALL_FAST_MODEL` は `ANTHROPIC_DEFAULT_HAIKU_MODEL` の代わりに非推奨です。

### サードパーティデプロイメント用のモデルのピン留め

[Bedrock](/ja/amazon-bedrock)、[Vertex AI](/ja/google-vertex-ai)、または [Foundry](/ja/microsoft-foundry) を通じて Claude Code をデプロイする場合、ユーザーへのロールアウト前にモデルバージョンをピン留めします。

ピン留めなしでは、Claude Code はモデルエイリアス（`sonnet`、`opus`、`haiku`）を使用し、最新バージョンに解決されます。Anthropic が新しいモデルをリリースすると、新しいバージョンが有効になっていないアカウントを持つユーザーは静かに破損します。

初期セットアップの一部として、3 つのモデル環境変数すべてを特定のバージョン ID に設定します。このステップをスキップすると、Claude Code の更新がユーザーを破損させる可能性があります。

プロバイダーのバージョン固有のモデル ID を使用して、以下の環境変数を使用します。

| プロバイダー | 例 |
| :- | :- |
| Bedrock | `export ANTHROPIC_DEFAULT_OPUS_MODEL='us.anthropic.claude-opus-4-6-v1'` |
| Vertex AI | `export ANTHROPIC_DEFAULT_OPUS_MODEL='claude-opus-4-6'` |
| Foundry | `export ANTHROPIC_DEFAULT_OPUS_MODEL='claude-opus-4-6'` |

`ANTHROPIC_DEFAULT_SONNET_MODEL` と `ANTHROPIC_DEFAULT_HAIKU_MODEL` に同じパターンを適用します。すべてのプロバイダー全体の現在および従来のモデル ID については、[モデル概要](https://platform.claude.com/docs/ja/about-claude/models/overview) を参照してください。ユーザーを新しいモデルバージョンにアップグレードするには、これらの環境変数を更新して再デプロイします。

ピン留めされたモデルの [拡張コンテキスト](#extended-context) を有効にするには、`ANTHROPIC_DEFAULT_OPUS_MODEL` または `ANTHROPIC_DEFAULT_SONNET_MODEL` のモデル ID に `[1m]` を追加します。

```bash
export ANTHROPIC_DEFAULT_OPUS_MODEL='claude-opus-4-6[1m]'
```

`[1m]` サフィックスは、`opusplan` を含むそのエイリアスのすべての使用に 1M コンテキストウィンドウを適用します。Claude Code は、モデル ID をプロバイダーに送信する前にサフィックスを削除します。Opus 4.6 や Sonnet 4.6 など、基盤となるモデルが 1M コンテキストをサポートする場合にのみ `[1m]` を追加します。

`settings.availableModels` アローリストは、サードパーティプロバイダーを使用する場合でも適用されます。フィルタリングはプロバイダー固有のモデル ID ではなく、モデルエイリアス（`opus`、`sonnet`、`haiku`）で一致します。

### ピン留めされたモデルの表示と機能のカスタマイズ

サードパーティプロバイダーでモデルをピン留めする場合、プロバイダー固有の ID は `/model` ピッカーにそのまま表示され、Claude Code はモデルがサポートする機能を認識しない可能性があります。ピン留めされた各モデルの表示名と機能を宣言するコンパニオン環境変数でオーバーライドできます。

これらの変数は、Bedrock、Vertex AI、Foundry などのサードパーティプロバイダーでのみ有効です。Anthropic API を直接使用する場合は効果がありません。

| 環境変数 | 説明 |
| - | - |
| `ANTHROPIC_DEFAULT_OPUS_MODEL_NAME` | `/model` ピッカーでピン留めされた Opus モデルの表示名。設定されていない場合はモデル ID がデフォルト |
| `ANTHROPIC_DEFAULT_OPUS_MODEL_DESCRIPTION` | `/model` ピッカーでピン留めされた Opus モデルの表示説明。設定されていない場合は `Custom Opus model` がデフォルト |
| `ANTHROPIC_DEFAULT_OPUS_MODEL_SUPPORTED_CAPABILITIES` | ピン留めされた Opus モデルがサポートする機能のカンマ区切りリスト |

同じ `_NAME`、`_DESCRIPTION`、`_SUPPORTED_CAPABILITIES` サフィックスは `ANTHROPIC_DEFAULT_SONNET_MODEL` と `ANTHROPIC_DEFAULT_HAIKU_MODEL` で利用可能です。

Claude Code は、モデル ID を既知のパターンと照合することで、[努力レベル](#adjust-effort-level) や [拡張思考](/ja/common-workflows#use-extended-thinking-thinking-mode) などの機能を有効にします。Bedrock ARN やカスタムデプロイメント名などのプロバイダー固有の ID は、これらのパターンと一致しないことが多く、サポートされている機能が無効のままになります。`_SUPPORTED_CAPABILITIES` を設定して、Claude Code にモデルが実際にサポートする機能を伝えます。

| 機能値 | 有効にするもの |
| - | - |
| `effort` | [努力レベル](#adjust-effort-level) と `/effort` コマンド |
| `max_effort` | `max` 努力レベル |
| `thinking` | [拡張思考](/ja/common-workflows#use-extended-thinking-thinking-mode) |
| `adaptive_thinking` | タスクの複雑さに基づいて思考を動的に割り当てる適応的推論 |
| `interleaved_thinking` | ツール呼び出し間の思考 |

`_SUPPORTED_CAPABILITIES` が設定されている場合、リストされた機能は有効になり、リストされていない機能はマッチングされたピン留めされたモデルに対して無効になります。変数が設定されていない場合、Claude Code はモデル ID に基づいた組み込み検出にフォールバックします。

この例では、Bedrock カスタムモデル ARN に Opus をピン留めし、フレンドリーな名前を設定し、その機能を宣言します。

```bash
export ANTHROPIC_DEFAULT_OPUS_MODEL='arn:aws:bedrock:us-east-1:123456789012:custom-model/abc'
export ANTHROPIC_DEFAULT_OPUS_MODEL_NAME='Opus via Bedrock'
export ANTHROPIC_DEFAULT_OPUS_MODEL_DESCRIPTION='Opus 4.6 routed through a Bedrock custom endpoint'
export ANTHROPIC_DEFAULT_OPUS_MODEL_SUPPORTED_CAPABILITIES='effort,max_effort,thinking,adaptive_thinking,interleaved_thinking'
```

### バージョンごとのモデル ID のオーバーライド

上記のファミリーレベルの環境変数は、ファミリーエイリアスごとに 1 つのモデル ID を設定します。同じファミリー内の複数のバージョンを異なるプロバイダー ID にマップする必要がある場合は、代わりに `modelOverrides` 設定を使用します。

`modelOverrides` は個別の Anthropic モデル ID をプロバイダー固有の文字列にマップし、Claude Code がプロバイダーの API に送信します。ユーザーが `/model` ピッカーでマップされたモデルを選択すると、Claude Code は組み込みのデフォルトの代わりに設定された値を使用します。

これにより、エンタープライズ管理者は、ガバナンス、コスト配分、または地域的なルーティングのために、各モデルバージョンを特定の Bedrock 推論プロファイル ARN、Vertex AI バージョン名、または Foundry デプロイメント名にルーティングできます。

[設定ファイル](/ja/settings#settings-files) で `modelOverrides` を設定します。

```json
{
  "modelOverrides": {
    "claude-opus-4-6": "arn:aws:bedrock:us-east-2:123456789012:application-inference-profile/opus-prod",
    "claude-opus-4-5-20251101": "arn:aws:bedrock:us-east-2:123456789012:application-inference-profile/opus-45-prod",
    "claude-sonnet-4-6": "arn:aws:bedrock:us-east-2:123456789012:application-inference-profile/sonnet-prod"
  }
}
```

キーは [モデル概要](https://platform.claude.com/docs/ja/about-claude/models/overview) にリストされている Anthropic モデル ID である必要があります。日付付きモデル ID の場合、そこに表示されるとおりに日付サフィックスを含めます。不明なキーは無視されます。

オーバーライドは、`/model` ピッカーの各エントリをサポートする組み込みモデル ID を置き換えます。Bedrock では、オーバーライドは Claude Code が起動時に自動的に検出する推論プロファイルより優先されます。`ANTHROPIC_MODEL`、`--model`、または `ANTHROPIC_DEFAULT_*_MODEL` 環境変数を通じて直接提供される値は、プロバイダーにそのまま渡され、`modelOverrides` によって変換されません。

`modelOverrides` は `availableModels` と一緒に機能します。アローリストは Anthropic モデル ID に対して評価され、オーバーライド値に対してではないため、`availableModels` の `"opus"` などのエントリは、Opus バージョンが ARN にマップされている場合でも一致し続けます。

### プロンプトキャッシング設定

Claude Code は [プロンプトキャッシング](https://platform.claude.com/docs/ja/build-with-claude/prompt-caching) を自動的に使用してパフォーマンスを最適化し、コストを削減します。プロンプトキャッシングをグローバルに、または特定のモデルティアに対して無効にできます。

| 環境変数 | 説明 |
| - | - |
| `DISABLE_PROMPT_CACHING` | `1` に設定して、すべてのモデルのプロンプトキャッシングを無効にします（モデル固有の設定より優先） |
| `DISABLE_PROMPT_CACHING_HAIKU` | `1` に設定して、Haiku モデルのみのプロンプトキャッシングを無効にします |
| `DISABLE_PROMPT_CACHING_SONNET` | `1` に設定して、Sonnet モデルのみのプロンプトキャッシングを無効にします |
| `DISABLE_PROMPT_CACHING_OPUS` | `1` に設定して、Opus モデルのみのプロンプトキャッシングを無効にします |

これらの環境変数は、プロンプトキャッシング動作に対する細かい制御を提供します。グローバル `DISABLE_PROMPT_CACHING` 設定はモデル固有の設定より優先され、必要に応じてすべてのキャッシングをすばやく無効にできます。モデル固有の設定は、特定のモデルをデバッグする場合や、異なるキャッシング実装を持つ可能性があるクラウドプロバイダーと連携する場合など、選択的な制御に役立ちます。
