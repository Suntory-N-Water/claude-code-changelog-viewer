---
title: model-config
source: https://code.claude.com/docs/ja/model-config.md
---

# モデル設定

> Claude Code のモデル設定について学習します。`opusplan` などのモデルエイリアスを含みます

利用可能なモデル

Claude Code の `model` 設定では、以下のいずれかを設定できます。

- **モデルエイリアス**
- **モデル名**
  - Anthropic API：完全な **[モデル名](https://platform.claude.com/docs/ja/about-claude/models/overview)**
  - Bedrock：推論プロファイル ARN
  - Foundry：デプロイメント名
  - Vertex：バージョン名

`ANTHROPIC_BASE_URL` は、リクエストの送信先を変更しますが、どのモデルが応答するかは変更しません。Claude を LLM ゲートウェイ経由でルーティングするには、[LLM ゲートウェイ設定](/ja/llm-gateway)を参照してください。

モデルエイリアス

モデルエイリアスは、正確なバージョン番号を覚えることなくモデル設定を選択するための便利な方法を提供します。

| モデルエイリアス | 動作 |
| - | - |
| **`default`** | 特別な値で、モデルオーバーライドをクリアし、アカウントタイプに応じた推奨モデルに戻します。それ自体はモデルエイリアスではありません |
| **`best`** | 最も高性能な利用可能なモデルを使用します。現在は `opus` と同等です |
| **`sonnet`** | 日常的なコーディングタスク用に最新の Sonnet モデルを使用 |
| **`opus`** | 複雑な推論タスク用に最新の Opus モデルを使用 |
| **`haiku`** | シンプルなタスク用に高速で効率的な Haiku モデルを使用 |
| **`sonnet[1m]`** | 長いセッション用に [100 万トークンのコンテキストウィンドウ](https://platform.claude.com/docs/ja/build-with-claude/context-windows#1m-token-context-window) を備えた Sonnet を使用 |
| **`opus[1m]`** | 長いセッション用に [100 万トークンのコンテキストウィンドウ](https://platform.claude.com/docs/ja/build-with-claude/context-windows#1m-token-context-window) を備えた Opus を使用 |
| **`opusplan`** | Plan Mode 中は `opus` を使用し、実行中は `sonnet` に自動的に切り替わる特別なモード |

Anthropic API では、`opus` は Opus 4.8 に解決され、`sonnet` は Sonnet 4.6 に解決されます。[Claude Platform on AWS](/ja/claude-platform-on-aws) では、`opus` は Opus 4.7 に解決され、`sonnet` は Sonnet 4.6 に解決されます。Bedrock、Vertex、Foundry では、`opus` は Opus 4.6 に解決され、`sonnet` は Sonnet 4.5 に解決されます。より新しいモデルは、完全なモデル名を明示的に選択するか、`ANTHROPIC_DEFAULT_OPUS_MODEL` または `ANTHROPIC_DEFAULT_SONNET_MODEL` を設定することで、これらのプロバイダーで利用可能です。

エイリアスはプロバイダーの推奨バージョンを指し、時間とともに更新されます。特定のバージョンに固定するには、完全なモデル名（例：`claude-opus-4-8`）を使用するか、`ANTHROPIC_DEFAULT_OPUS_MODEL` などの対応する環境変数を設定します。

Opus 4.8 には Claude Code v2.1.154 以降が必要です。`claude update` を実行してアップグレードしてください。

モデルの設定

モデルは、優先度順に複数の方法で設定できます。

1. **セッション中** - `/model <alias|name>` を使用してセッション中にモデルを切り替えるか、引数なしで `/model` を実行してピッカーを開きます。ピッカーは、会話に以前の出力がある場合に確認を求めます。次の応答がキャッシュされたコンテキストなしで完全な履歴を再読み込みするためです
2. **起動時** - `claude --model <alias|name>` で起動
3. **環境変数** - `ANTHROPIC_MODEL=<alias|name>` を設定
4. **設定** - 設定ファイルで `model` フィールドを使用して永続的に設定

v2.1.153 以降では、`/model` はあなたの選択をデフォルトとして新しいセッションに保存し、ユーザー設定の `model` フィールドに書き込みます。ピッカーでは以下のようになります。

- `Enter`：モデルを切り替えてデフォルトとして保存
- `s`：このセッションのみモデルを切り替え

`/model <name>` を直接入力すると、`Enter` のように動作します。プロジェクトおよび管理設定は引き続き優先され、次の起動時に再度適用されます。

v2.1.144 から v2.1.152 では、`/model` は現在のセッションにのみ適用され、ピッカーで `d` を押すとデフォルトが保存されました。

`--model` フラグと `ANTHROPIC_MODEL` 環境変数は、それらで起動したセッションにのみ適用されます。異なるターミナルで異なるモデルを同時に実行するには、`/model` で切り替えるのではなく、各ターミナルを独自の `--model` フラグで起動します。

`claude --resume`、`--continue`、または `/resume` ピッカーで開始された再開セッションは、現在の `model` 設定に関係なく、トランスクリプトが保存されたときに使用していたモデルを保持します。そのモデルが廃止されている場合、セッションは通常の優先度順序にフォールスルーします。これにより、別のセッションの `/model` 選択が再開時のモデルを変更するのを防ぎます。

起動時のアクティブなモデルがあなた自身の選択ではなく、プロジェクトまたは管理設定から来ている場合、起動ヘッダーはどの設定ファイルがそれを設定したかを表示します。`/model` を実行してオーバーライドします。プロジェクトまたは管理設定は次の起動時に再度適用されます。

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

モデル選択の制限

エンタープライズ管理者は、[管理設定またはポリシー設定](/ja/settings#settings-files) で `availableModels` を使用して、ユーザーが選択できるモデルを制限できます。

`availableModels` が設定されている場合、ユーザーは `/model`、`--model` フラグ、または `ANTHROPIC_MODEL` 環境変数を使用してリスト内にないモデルに切り替えることはできません。

```json
{
  "availableModels": ["sonnet", "haiku"]
}
```

デフォルトモデルの動作

モデルピッカーの Default オプションは `availableModels` の影響を受けません。常に利用可能であり、[ユーザーのサブスクリプション層に基づいた](#default-model-setting) システムのランタイムデフォルトを表します。

`availableModels: []` の場合でも、ユーザーはそのティアの Default モデルで Claude Code を使用できます。

ユーザーが実行するモデルの制御

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

マージ動作

`availableModels` がユーザー設定とプロジェクト設定など複数のレベルで設定されている場合、配列はマージされ、重複排除されます。厳密なアローリストを適用するには、最優先度を持つ管理設定またはポリシー設定で `availableModels` を設定します。

Mantle モデル ID

[Bedrock Mantle エンドポイント](/ja/amazon-bedrock#use-the-mantle-endpoint) が有効な場合、`availableModels` の `anthropic.` で始まるエントリは、カスタムオプションとして `/model` ピッカーに追加され、Mantle エンドポイントにルーティングされます。これは [サードパーティデプロイメント用のモデルのピン留め](#pin-models-for-third-party-deployments) で説明されているエイリアスのみマッチングの例外です。設定はピッカーをリストされたエントリに制限するため、標準エイリアスと一緒に Mantle ID を含めます。

特別なモデルの動作

`default` モデル設定

`default` の動作はアカウントタイプによって異なります。

- **Max、Team Premium、Enterprise 従量課金、Anthropic API**：Opus 4.8 がデフォルト
- **AWS 上の Claude Platform**：Opus 4.7 がデフォルト
- **Pro、Team Standard、Enterprise サブスクリプションシート**：Sonnet 4.6 がデフォルト
- **Bedrock、Vertex、Foundry**：Sonnet 4.5 がデフォルト

Enterprise 従量課金とは、サブスクリプションシートではなく使用量で請求される Enterprise 組織を意味します。

Claude Code は、Opus の使用量閾値に達した場合、自動的に Sonnet にフォールバックする可能性があります。

`opusplan` モデル設定

`opusplan` モデルエイリアスは、自動化されたハイブリッドアプローチを提供します。

- **Plan Mode 中** - 複雑な推論とアーキテクチャの決定用に `opus` を使用
- **実行モード中** - コード生成と実装用に自動的に `sonnet` に切り替わり

これにより、両方の長所が得られます。計画用の Opus の優れた推論と、実行用の Sonnet の効率性です。

Plan Mode の Opus フェーズは標準的な 200K コンテキストウィンドウで実行されます。[拡張コンテキスト](#extended-context)で説明されている自動 1M アップグレードは `opus` モデル設定に適用され、`opusplan` には拡張されません。

努力レベルの調整

[努力レベル](https://platform.claude.com/docs/ja/build-with-claude/effort)は適応的推論を制御し、タスクの複雑さに基づいて各ステップで思考するかどうか、どの程度思考するかをモデルが決定できるようにします。低い努力はシンプルなタスクではより高速で安価ですが、高い努力は複雑な問題に対してより深い推論を提供します。

利用可能な努力レベルはモデルによって異なります。ここに記載されていないモデルは努力をサポートしていません。

| モデル | レベル |
| :- | :- |
| Opus 4.8 と Opus 4.7 | `low`、`medium`、`high`、`xhigh`、`max` |
| Opus 4.6 と Sonnet 4.6 | `low`、`medium`、`high`、`max` |

アクティブなモデルがサポートしないレベルを設定した場合、Claude Code は設定したレベル以下の最高サポートレベルにフォールバックします。例えば、`xhigh` は Opus 4.6 では `high` として実行されます。

デフォルト努力は Opus 4.8、Opus 4.6、Sonnet 4.6 では `high` で、Opus 4.7 では `xhigh` です。

Opus 4.8 または Opus 4.7 を初めて実行する場合、Claude Code は、別のモデルに対して以前に異なるレベルを設定していても、そのモデルのデフォルト努力を適用します。Opus 4.8 では `high`、Opus 4.7 では `xhigh` です。切り替え後に `/effort` を再度実行して、別のレベルを選択します。

`low`、`medium`、`high`、`xhigh` はセッション全体で保持されます。`max` はトークン支出に制約がない最も深い推論を提供し、`CLAUDE_CODE_EFFORT_LEVEL` 環境変数を通じて設定された場合を除き、現在のセッションのみに適用されます。

`/effort` メニューは `ultracode` も提供します。Ultracode はモデル努力レベルではなく Claude Code 設定です。モデルに `xhigh` を送信し、さらに Claude が実質的なタスク用に[動的ワークフロー](/ja/workflows)をオーケストレートします。現在のセッションのみに適用されます。`/effort` を通じて設定するか、`--settings` または Agent SDK 制御リクエストを通じて `"ultracode": true` を渡します。これは `effortLevel` 設定、`--effort` フラグ、`CLAUDE_CODE_EFFORT_LEVEL` の一部ではありません。

努力レベルの選択

各レベルはトークン支出と機能をトレードオフします。デフォルトはほとんどのコーディングタスクに適しています。別のバランスが必要な場合は調整します。

| レベル | 使用する場合 |
| :- | :- |
| `low` | インテリジェンスに敏感でない短くスコープされたレイテンシに敏感なタスク用に予約 |
| `medium` | インテリジェンスをトレードオフできるコスト敏感な作業のトークン使用量を削減 |
| `high` | トークン使用量とインテリジェンスのバランス。Opus 4.8、Opus 4.6、Sonnet 4.6 でのデフォルト |
| `xhigh` | より高いトークン支出での深い推論。Opus 4.7 でのデフォルト |
| `max` | 難しいタスクのパフォーマンスを改善できますが、収益逓減を示す可能性があり、過度な思考の傾向があります。広く採用する前にテスト |
| `ultracode` | 各実質的なタスク用に `xhigh` ごとのメッセージ推論で[動的ワークフロー](/ja/workflows)を計画する Claude Code 設定。セッションのみ |

努力スケールはモデルごとに調整されるため、同じレベル名はモデル全体で同じ基盤値を表しません。

1 回限りの深い推論に ultrathink を使用

セッション設定を変更せずに 1 回限りの深い推論を行うには、プロンプトの任意の場所に `ultrathink` を含めます。Claude Code はキーワードを認識し、インコンテキスト命令を追加します。API に送信される努力レベルは変更されません。「think」、「think hard」、「think more」などの他のフレーズは通常のプロンプトテキストとして渡され、キーワードとして認識されません。

努力レベルの設定

努力は以下のいずれかを通じて変更できます。

- **`/effort`**：引数なしで `/effort` を実行してインタラクティブスライダーを開くか、`/effort` の後にレベル名を続けて直接設定するか、`/effort auto` を実行してモデルのデフォルトにリセット
- **`/model` 内**：モデルを選択する際に左右矢印キーを使用して努力スライダーを調整
- **`--effort` フラグ**：Claude Code を起動する際にレベル名を渡して、単一セッションのレベルを設定
- **環境変数**：`CLAUDE_CODE_EFFORT_LEVEL` をレベル名または `auto` に設定
- **設定**：設定ファイルで `effortLevel` を `low`、`medium`、`high`、`xhigh` に設定します。`max` と `ultracode` は[セッションのみ](#adjust-effort-level)であり、ここでは受け入れられません
- **Skill と subagent frontmatter**：[skill](/ja/skills#frontmatter-reference)または[subagent](/ja/sub-agents#supported-frontmatter-fields)markdown ファイルで `effort` を設定して、その skill または subagent が実行される際の努力レベルをオーバーライド

環境変数がすべての他の方法より優先され、次に設定されたレベル、次にモデルのデフォルトが優先されます。Frontmatter 努力は、その skill または subagent がアクティブな場合に適用され、セッションレベルをオーバーライドしますが、環境変数はオーバーライドしません。

努力スライダーは、サポートされているモデルが選択されている場合、`/model` に表示されます。現在の努力レベルはロゴとスピナーの横にも表示されます（例：「with low effort」）。`/model` を開かなくても、どの設定がアクティブかを確認できます。

適応的推論と固定思考予算

適応的推論は各ステップで思考をオプションにするため、Claude はルーチンプロンプトにより速く応答でき、より深い思考から利益を得るステップのために深い思考を予約できます。現在のレベルが生成するよりも Claude がより頻繁に、またはより少なく思考することを望む場合、プロンプトまたは `CLAUDE.md` で直接そう言うことができます。モデルはその努力設定内でそのガイダンスに応答します。

Opus 4.7 以降は常に適応的推論を使用します。固定思考予算モードと `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING` はそれに適用されません。

Opus 4.6 と Sonnet 4.6 では、`CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1` を設定して、`MAX_THINKING_TOKENS` で制御される以前の固定思考予算に戻すことができます。[環境変数](/ja/env-vars)を参照してください。

拡張思考

拡張思考は、Claude が応答する前に発する推論です。[適応的推論](#adjust-effort-level)をサポートするモデルでは、努力レベルは思考がどの程度発生するかの主要な制御です。以下の設定は思考をオンまたはオフにし、それがどのように表示されるかを制御します。

| 制御 | 設定方法 |
| :- | :- |
| 現在のセッションのトグル | macOS では `Option+T`、Windows と Linux では `Alt+T` を押します |
| グローバルデフォルトを設定 | `/config` を実行して思考モードをトグルします。`~/.claude/settings.json` に `alwaysThinkingEnabled` として保存されます |
| 努力に関係なく無効化 | [`MAX_THINKING_TOKENS=0`](/ja/env-vars)を設定します。他の値は[固定思考予算](#adaptive-reasoning-and-fixed-thinking-budgets)でのみ適用されます |

思考出力はデフォルトで折りたたまれています。`Ctrl+O` を押して詳細モードをトグルし、推論をグレーのイタリック体テキストとして表示します。Anthropic API 上のインタラクティブセッションはデフォルトで編集された思考ブロックを受け取るため、展開時に完全な要約を利用可能にしたい場合は[設定](/ja/settings)で `showThinkingSummaries: true` を設定します。折りたたまれたまたは編集された場合でも、生成されたすべての思考トークンに対して課金されます。

拡張コンテキスト

Opus 4.6 以降と Sonnet 4.6 は、大規模なコードベースを持つ長いセッション用に[100 万トークンのコンテキストウィンドウ](https://platform.claude.com/docs/ja/build-with-claude/context-windows#1m-token-context-window)をサポートしています。

利用可能性はモデルとプランによって異なります。Max、Team、Enterprise プランでは、Opus は追加設定なしで自動的に 1M コンテキストにアップグレードされます。これは Team Standard と Team Premium の両方のシートに適用されます。Sonnet with 1M context は自動アップグレードの一部ではなく、Max を含むすべてのサブスクリプションプランで[使用クレジット](https://support.claude.com/ja/articles/12429409-extra-usage-for-paid-claude-plans)が必要です。

| プラン | Opus with 1M context | Sonnet with 1M context |
| - | - | - |
| Max、Team、Enterprise | サブスクリプションに含まれる | [使用クレジット](https://support.claude.com/ja/articles/12429409-extra-usage-for-paid-claude-plans)が必要 |
| Pro | [使用クレジット](https://support.claude.com/ja/articles/12429409-extra-usage-for-paid-claude-plans)が必要 | [使用クレジット](https://support.claude.com/ja/articles/12429409-extra-usage-for-paid-claude-plans)が必要 |
| API と従量課金 | フルアクセス | フルアクセス |

1M コンテキストを完全に無効にするには、`CLAUDE_CODE_DISABLE_1M_CONTEXT=1` を設定します。これにより、1M モデルバリアントがモデルピッカーから削除されます。[環境変数](/ja/env-vars)を参照してください。

1M コンテキストウィンドウは標準モデル価格を使用し、200K を超えるトークンに対するプレミアムはありません。拡張コンテキストがサブスクリプションに含まれているプランでは、使用量はサブスクリプションでカバーされたままです。拡張コンテキストに使用クレジットでアクセスするプランでは、トークンは使用クレジットに請求されます。

アカウントが 1M コンテキストをサポートしている場合、オプションは Claude Code の最新バージョンのモデルピッカー（`/model`）に表示されます。表示されない場合は、セッションを再起動してみてください。

モデルエイリアスまたは完全なモデル名で `[1m]` サフィックスを使用することもできます。

```bash
# opus[1m] または sonnet[1m] エイリアスを使用
/model opus[1m]
/model sonnet[1m]

# または完全なモデル名に [1m] を追加
/model claude-opus-4-8[1m]
```

現在のモデルの確認

現在使用しているモデルは、複数の方法で確認できます。

1. [ステータスライン](/ja/statusline) 内（設定されている場合）
2. `/status` 内。アカウント情報も表示されます。

カスタムモデルオプションの追加

`ANTHROPIC_CUSTOM_MODEL_OPTION` を使用して、組み込みエイリアスを置き換えることなく、単一のカスタムエントリを `/model` ピッカーに追加します。これは Claude Code がデフォルトでリストしないモデル ID のテストに役立ちます。LLM ゲートウェイデプロイメントの場合、Claude Code は `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1` が設定されているときにゲートウェイの `/v1/models` エンドポイントからピッカーを自動的に入力するため、この変数が必要なのはディスカバリーが無効になっているか、必要なモデルを返さない場合のみです。[LLM ゲートウェイモデル選択](/ja/llm-gateway#model-selection)を参照してください。

この例では、3 つの変数をすべて設定して、ゲートウェイルーティングされた Opus デプロイメントを選択可能にします。

```bash
export ANTHROPIC_CUSTOM_MODEL_OPTION="my-gateway/claude-opus-4-7"
export ANTHROPIC_CUSTOM_MODEL_OPTION_NAME="Opus via Gateway"
export ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION="Custom deployment routed through the internal LLM gateway"
```

カスタムエントリは `/model` ピッカーの下部に表示されます。`ANTHROPIC_CUSTOM_MODEL_OPTION_NAME` と `ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION` はオプションです。省略された場合、モデル ID は名前として使用され、説明はデフォルトで `Custom model (<model-id>)` になります。

Claude Code は `ANTHROPIC_CUSTOM_MODEL_OPTION` で設定されたモデル ID の検証をスキップするため、API エンドポイントが受け入れる任意の文字列を使用できます。

環境変数

以下の環境変数を使用できます。これらは完全な **モデル名**（または API プロバイダーの同等のもの）である必要があり、エイリアスがマップするモデル名を制御します。

| 環境変数 | 説明 |
| - | - |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | `opus` に使用するモデル、または Plan Mode がアクティブな場合の `opusplan` に使用するモデル。 |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | `sonnet` に使用するモデル、または Plan Mode がアクティブでない場合の `opusplan` に使用するモデル。 |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | `haiku` に使用するモデル、または [バックグラウンド機能](/ja/costs#background-token-usage) に使用するモデル |
| `CLAUDE_CODE_SUBAGENT_MODEL` | すべての [subagents](/ja/sub-agents#choose-a-model) と [agent teams](/ja/agent-teams) に使用するモデル。呼び出しごとの `model` パラメータと subagent 定義の `model` frontmatter をオーバーライドします。`inherit` に設定して、代わりに通常のモデル解決を使用します |

注：`ANTHROPIC_SMALL_FAST_MODEL` は `ANTHROPIC_DEFAULT_HAIKU_MODEL` の代わりに非推奨です。

サードパーティデプロイメント用のモデルのピン留め

[Bedrock](/ja/amazon-bedrock)、[Vertex AI](/ja/google-vertex-ai)、[Foundry](/ja/microsoft-foundry)、または [Claude Platform on AWS](/ja/claude-platform-on-aws) を通じて Claude Code をデプロイする場合、ユーザーへのロールアウト前にモデルバージョンをピン留めします。

ピン留めなしでは、Claude Code はモデルエイリアス（`sonnet`、`opus`、`haiku`）を使用し、最新バージョンに解決されます。Anthropic が新しいモデルをリリースすると、新しいバージョンがまだユーザーのアカウントで有効になっていない場合、Bedrock と Vertex AI ユーザーは通知を見て、そのセッションの以前のバージョンにフォールバックしますが、Foundry ユーザーはエラーを見ます。Foundry には同等のスタートアップチェックがないためです。

初期セットアップの一部として、3 つのモデル環境変数すべてを特定のバージョン ID に設定します。ピン留めにより、ユーザーが新しいモデルに移行するタイミングを制御できます。

プロバイダーのバージョン固有のモデル ID を使用して、以下の環境変数を使用します。

| プロバイダー | 例 |
| :- | :- |
| Bedrock | `export ANTHROPIC_DEFAULT_OPUS_MODEL='us.anthropic.claude-opus-4-8'` |
| Vertex AI | `export ANTHROPIC_DEFAULT_OPUS_MODEL='claude-opus-4-8'` |
| Foundry | `export ANTHROPIC_DEFAULT_OPUS_MODEL='claude-opus-4-8'` |

`ANTHROPIC_DEFAULT_SONNET_MODEL` と `ANTHROPIC_DEFAULT_HAIKU_MODEL` に同じパターンを適用します。すべてのプロバイダー全体の現在および従来のモデル ID については、[モデル概要](https://platform.claude.com/docs/ja/about-claude/models/overview) を参照してください。ユーザーを新しいモデルバージョンにアップグレードするには、これらの環境変数を更新して再デプロイします。

ピン留めされたモデルの [拡張コンテキスト](#extended-context) を有効にするには、`ANTHROPIC_DEFAULT_OPUS_MODEL` または `ANTHROPIC_DEFAULT_SONNET_MODEL` のモデル ID に `[1m]` を追加します。

```bash
export ANTHROPIC_DEFAULT_OPUS_MODEL='claude-opus-4-8[1m]'
```

`[1m]` サフィックスは、`opus` と `sonnet` エイリアスのすべての使用に 1M コンテキストウィンドウを適用します。これは `opusplan` の plan-mode Opus フェーズを拡張しません。これは [200K で上限が設定されたままです](#opusplan-model-setting)。

- Claude Code は、モデル ID をプロバイダーに送信する前にサフィックスを削除します。
- 基盤となるモデルが [1M コンテキストをサポート](https://platform.claude.com/docs/ja/build-with-claude/context-windows#1m-token-context-window) する場合にのみ `[1m]` を追加します。
- サフィックスはモデルごとではなく、変数ごとに読み取られます。Bedrock、Vertex、Foundry では、1 つの変数で `[1m]` なしのモデル ID は、別の変数が同じモデルをサフィックス付きで設定している場合でも、200K コンテキストを使用します。

`settings.availableModels` アローリストは、サードパーティプロバイダーを使用する場合でも適用されます。フィルタリングはプロバイダー固有のモデル ID ではなく、モデルエイリアス（`opus`、`sonnet`、`haiku`）で一致します。

ピン留めされたモデルの表示と機能のカスタマイズ

サードパーティプロバイダーでモデルをピン留めする場合、プロバイダー固有の ID は `/model` ピッカーにそのまま表示され、Claude Code はモデルがサポートする機能を認識しない可能性があります。ピン留めされた各モデルの表示名と機能を宣言するコンパニオン環境変数でオーバーライドできます。

これらの変数は、Bedrock、Vertex AI、Foundry などのサードパーティプロバイダーでのみ有効です。`ANTHROPIC_BASE_URL` が [LLM ゲートウェイ](/ja/llm-gateway) を指す場合、`_NAME` と `_DESCRIPTION` 変数も有効です。`api.anthropic.com` に直接接続する場合は効果がありません。

| 環境変数 | 説明 |
| - | - |
| `ANTHROPIC_DEFAULT_OPUS_MODEL_NAME` | `/model` ピッカーでピン留めされた Opus モデルの表示名。設定されていない場合はモデル ID がデフォルト |
| `ANTHROPIC_DEFAULT_OPUS_MODEL_DESCRIPTION` | `/model` ピッカーでピン留めされた Opus モデルの表示説明。設定されていない場合は `Custom Opus model` がデフォルト |
| `ANTHROPIC_DEFAULT_OPUS_MODEL_SUPPORTED_CAPABILITIES` | ピン留めされた Opus モデルがサポートする機能のカンマ区切りリスト |

同じ `_NAME`、`_DESCRIPTION`、`_SUPPORTED_CAPABILITIES` サフィックスは `ANTHROPIC_DEFAULT_SONNET_MODEL`、`ANTHROPIC_DEFAULT_HAIKU_MODEL`、`ANTHROPIC_CUSTOM_MODEL_OPTION` で利用可能です。

Claude Code は、モデル ID を既知のパターンと照合することで、[努力レベル](#adjust-effort-level) や [拡張思考](#extended-thinking) などの機能を有効にします。Bedrock ARN やカスタムデプロイメント名などのプロバイダー固有の ID は、これらのパターンと一致しないことが多く、サポートされている機能が無効のままになります。`_SUPPORTED_CAPABILITIES` を設定して、Claude Code にモデルが実際にサポートする機能を伝えます。

| 機能値 | 有効にするもの |
| - | - |
| `effort` | [努力レベル](#adjust-effort-level) と `/effort` コマンド |
| `xhigh_effort` | `xhigh` 努力レベル |
| `max_effort` | `max` 努力レベル |
| `thinking` | [拡張思考](#extended-thinking) |
| `adaptive_thinking` | タスクの複雑さに基づいて思考を動的に割り当てる適応的推論 |
| `interleaved_thinking` | ツール呼び出し間の思考 |

`_SUPPORTED_CAPABILITIES` が設定されている場合、リストされた機能は有効になり、リストされていない機能はマッチングされたピン留めされたモデルに対して無効になります。変数が設定されていない場合、Claude Code はモデル ID に基づいた組み込み検出にフォールバックします。

この例では、Bedrock カスタムモデル ARN に Opus をピン留めし、フレンドリーな名前を設定し、その機能を宣言します。

```bash
export ANTHROPIC_DEFAULT_OPUS_MODEL='arn:aws:bedrock:us-east-1:123456789012:custom-model/abc'
export ANTHROPIC_DEFAULT_OPUS_MODEL_NAME='Opus via Bedrock'
export ANTHROPIC_DEFAULT_OPUS_MODEL_DESCRIPTION='Opus 4.7 routed through a Bedrock custom endpoint'
export ANTHROPIC_DEFAULT_OPUS_MODEL_SUPPORTED_CAPABILITIES='effort,xhigh_effort,max_effort,thinking,adaptive_thinking,interleaved_thinking'
```

バージョンごとのモデル ID のオーバーライド

上記のファミリーレベルの環境変数は、ファミリーエイリアスごとに 1 つのモデル ID を設定します。同じファミリー内の複数のバージョンを異なるプロバイダー ID にマップする必要がある場合は、代わりに `modelOverrides` 設定を使用します。

`modelOverrides` は個別の Anthropic モデル ID をプロバイダー固有の文字列にマップし、Claude Code がプロバイダーの API に送信します。ユーザーが `/model` ピッカーでマップされたモデルを選択すると、Claude Code は組み込みのデフォルトの代わりに設定された値を使用します。

これにより、エンタープライズ管理者は、ガバナンス、コスト配分、または地域的なルーティングのために、各モデルバージョンを特定の Bedrock 推論プロファイル ARN、Vertex AI バージョン名、または Foundry デプロイメント名にルーティングできます。

[設定ファイル](/ja/settings#settings-files) で `modelOverrides` を設定します。

```json
{
  "modelOverrides": {
    "claude-opus-4-7": "arn:aws:bedrock:us-east-2:123456789012:application-inference-profile/opus-prod",
    "claude-opus-4-6": "arn:aws:bedrock:us-east-2:123456789012:application-inference-profile/opus-46-prod",
    "claude-sonnet-4-6": "arn:aws:bedrock:us-east-2:123456789012:application-inference-profile/sonnet-prod"
  }
}
```

キーは [モデル概要](https://platform.claude.com/docs/ja/about-claude/models/overview) にリストされている Anthropic モデル ID である必要があります。日付付きモデル ID の場合、そこに表示されるとおりに日付サフィックスを含めます。不明なキーは無視されます。

オーバーライドは、`/model` ピッカーの各エントリをサポートする組み込みモデル ID を置き換えます。Bedrock では、オーバーライドは Claude Code が起動時に自動的に検出する推論プロファイルより優先されます。`ANTHROPIC_MODEL`、`--model`、または `ANTHROPIC_DEFAULT_*_MODEL` 環境変数を通じて直接提供される値は、プロバイダーにそのまま渡され、`modelOverrides` によって変換されません。

`modelOverrides` は `availableModels` と一緒に機能します。アローリストは Anthropic モデル ID に対して評価され、オーバーライド値に対してではないため、`availableModels` の `"opus"` などのエントリは、Opus バージョンが ARN にマップされている場合でも一致し続けます。

プロンプトキャッシング設定

Claude Code は [プロンプトキャッシング](/ja/prompt-caching) を自動的に使用してパフォーマンスを最適化し、コストを削減します。プロンプトキャッシングをグローバルに、または特定のモデルティアに対して無効にできます。

| 環境変数 | 説明 |
| - | - |
| `DISABLE_PROMPT_CACHING` | `1` に設定して、すべてのモデルのプロンプトキャッシングを無効にします。モデル固有の設定より優先されます |
| `DISABLE_PROMPT_CACHING_HAIKU` | `1` に設定して、Haiku モデルのみのプロンプトキャッシングを無効にします |
| `DISABLE_PROMPT_CACHING_SONNET` | `1` に設定して、Sonnet モデルのみのプロンプトキャッシングを無効にします |
| `DISABLE_PROMPT_CACHING_OPUS` | `1` に設定して、Opus モデルのみのプロンプトキャッシングを無効にします |

キャッシュ TTL を変更する方法、またはキャッシュミスをトリガーするものについて詳しくは、[Claude Code がプロンプトキャッシングを使用する方法](/ja/prompt-caching) を参照してください。
