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
  - Amazon Bedrock：推論プロファイル ARN
  - Microsoft Foundry：デプロイメント名
  - Google Cloud の Agent Platform：バージョン名

どのモデルと努力レベルがさまざまな種類の作業に適しているかについてのガイダンスについては、ブログの [Claude Code での Claude モデルと努力レベルの選択](https://claude.com/blog/claude-model-and-effort-level-in-claude-code) を参照してください。

`ANTHROPIC_BASE_URL` は、リクエストの送信先を変更しますが、どのモデルが応答するかは変更しません。Claude を LLM ゲートウェイ経由でルーティングするには、[LLM ゲートウェイ](/ja/llm-gateway)を参照してください。

モデルエイリアス

モデルエイリアスは、正確なバージョン番号を覚えることなくモデル設定を選択するための便利な方法を提供します。

| モデルエイリアス | 動作 |
| - | - |
| **`default`** | 特別な値で、モデルオーバーライドをクリアし、アカウントタイプに応じた推奨モデルに戻すか、管理者が設定した場合は[組織デフォルトモデル](#organization-default-model)に戻します。それ自体はモデルエイリアスではありません |
| **`best`** | 組織がアクセスできる場合は Fable 5 を使用し、そうでない場合は最新の Opus モデルを使用 |
| **`fable`** | 最も難しく、実行時間が長いタスク用に Claude Fable 5 を使用 |
| **`sonnet`** | 日常的なコーディングタスク用に最新の Sonnet モデルを使用 |
| **`opus`** | 複雑な推論タスク用に最新の Opus モデルを使用 |
| **`haiku`** | シンプルなタスク用に高速で効率的な Haiku モデルを使用 |
| **`sonnet[1m]`** | 長いセッション用に [100 万トークンのコンテキストウィンドウ](https://platform.claude.com/docs/ja/build-with-claude/context-windows#context-window-sizes-by-model) を備えた Sonnet を使用。`sonnet` がすでにネイティブの 1M ウィンドウを持つ Sonnet 5 に解決される場合は効果がありません。[LLM ゲートウェイ](/ja/llm-gateway)経由の場合は、Sonnet 5 の 1M ウィンドウを選択します |
| **`opus[1m]`** | 長いセッション用に [100 万トークンのコンテキストウィンドウ](https://platform.claude.com/docs/ja/build-with-claude/context-windows#context-window-sizes-by-model) を備えた Opus を使用 |
| **`opusplan`** | Plan Mode 中は `opus` を使用し、実行中は `sonnet` に自動的に切り替わる特別なモード |

`opus` と `sonnet` エイリアスが解決するバージョンは、プロバイダーによって異なります。

| プロバイダー | `opus` | `sonnet` |
| :- | :- | :- |
| Anthropic API | Opus 4.8 | Sonnet 5 |
| [Claude Platform on AWS](/ja/claude-platform-on-aws) | Opus 4.8 | Sonnet 4.6 |
| Amazon Bedrock、Google Cloud の Agent Platform | Opus 4.8 | Sonnet 4.5 |
| Microsoft Foundry | Opus 4.6 | Sonnet 4.5 |

エイリアスが古いモデルに解決される場合、より新しいモデルは完全なモデル名を明示的に選択するか、`ANTHROPIC_DEFAULT_OPUS_MODEL` または `ANTHROPIC_DEFAULT_SONNET_MODEL` を設定することで利用可能です。

v2.1.207 より前では、`opus` は Claude Platform on AWS では Opus 4.7 に解決され、Amazon Bedrock および Google Cloud の Agent Platform では Opus 4.6 に解決されました。

エイリアスはプロバイダーの推奨バージョンを指し、時間とともに更新されます。特定のバージョンに固定するには、完全なモデル名（例：`claude-opus-4-8`）を使用するか、`ANTHROPIC_DEFAULT_OPUS_MODEL` などの対応する環境変数を設定します。

Sonnet 5 には Claude Code v2.1.197 以降が必要です。Opus 4.8 には v2.1.154 以降が必要です。`claude update` を実行してアップグレードしてください。

Fable 5 を使用する

[Claude Fable 5](https://platform.claude.com/docs/ja/about-claude/models/introducing-claude-fable-5-and-claude-mythos-5) は Claude Code で最も高性能なモデルで、1 回のセッションより大きなタスクに適しています。長い自律的なセッションを維持し、行動する前に調査し、より小さなモデルよりも頻繁に作業を検証します。

Fable 5 はデフォルトモデルではありません。`/model fable` で選択してください。安全性分類器がフラグを立てるリクエスト（最も多くの場合、サイバーセキュリティと生物学の領域）は、[自動モデルフォールバック](#automatic-model-fallback)をトリガーします。

Fable 5 を最大限に活用するには：

- **結果を説明し、ステップではなく**：望む結果を渡し、パスを計画させます。その結果が成立するまで作業を続けさせるには、[目標を設定](/ja/goal)してください。
- **曖昧な問題を渡す**：根本原因の調査、障害のデバッグ、アーキテクチャの決定は、追加の調査と検証が役に立つ場所です。
- **検証リマインダーをスキップ**：独自の作業を検証するため、テストまたはチェックのリマインダーは通常不要です。
- **より大きなタスクをサイズアップ**：通常は複数の部分に分割する作業を与えます。長いセッションを保持し、スレッドを失いません。

Fable 5 には Claude Code v2.1.170 以降が必要です。古いバージョンではモデルピッカーに Fable 5 が表示されず、選択できません。`claude update` を実行してアップグレードしてください。Fable 5 は [ゼロデータ保持](/ja/zero-data-retention) では利用できません。ここで `/model` ピッカーはそれを省略するか、無効として表示します。

モデルの設定

モデルは、優先度順に複数の方法で設定できます。

1. **セッション中**：`/model <alias|name>` を使用してセッション中にモデルを切り替えるか、引数なしで `/model` を実行してピッカーを開きます。ピッカーは、会話に以前の出力がある場合に確認を求めます。次の応答がキャッシュされたコンテキストなしで完全な履歴を再読み込みするためです
2. **起動時**：`claude --model <alias|name>` で起動
3. **環境変数**：`ANTHROPIC_MODEL=<alias|name>` を設定
4. **設定**：設定ファイルで `model` フィールドを使用して永続的に設定

v2.1.153 以降では、`/model` はあなたの選択をデフォルトとして新しいセッションに保存し、ユーザー設定の `model` フィールドに書き込みます。ピッカーでは以下のようになります。

- `Enter`：モデルを切り替えてデフォルトとして保存
- `s`：このセッションのみモデルを切り替え

`/model <name>` を直接入力すると、`Enter` のように動作します。[非インタラクティブモード](/ja/headless)で `/model` を使用して設定されたモデルは、`-p` フラグで現在のセッションにのみ適用され、デフォルトとして保存されません。プロジェクトおよび管理設定は引き続き優先され、次の起動時に再度適用されます。管理者が設定した[組織デフォルトモデル](#organization-default-model)も次の起動時に再度適用されます。

v2.1.144 から v2.1.152 では、`/model` は現在のセッションにのみ適用され、ピッカーで `d` を押すとデフォルトが保存されました。

`--model` フラグと `ANTHROPIC_MODEL` 環境変数は、それらで起動したセッションにのみ適用されます。異なるターミナルで異なるモデルを同時に実行するには、`/model` で切り替えるのではなく、各ターミナルを独自の `--model` フラグで起動します。

`/model` ピッカーの価格は、Claude Code が Anthropic API と通信する場合、直接または [LLM ゲートウェイ](/ja/llm-gateway) を通じてそれをプロキシする場合に表示され、行の価格はその行が選択するモデルの価格です。Amazon Bedrock などの [サードパーティプロバイダー](/ja/third-party-integrations) および [Claude アプリゲートウェイ](/ja/claude-apps-gateway) では、プロバイダーまたはゲートウェイが支払う金額を決定するため、ピッカー行に価格は表示されません。価格は表示ラベルのみです。どのモデルを行が選択するか、またはプロバイダーが請求する内容には影響しません。v2.1.206 より前では、[Claude Platform on AWS](/ja/claude-platform-on-aws) およびゲートウェイセッションは Anthropic リスト価格を表示し、行は選択したモデルとは異なるモデルの価格を表示できました。

`claude --resume`、`--continue`、または `/resume` ピッカーで開始された再開セッションは、現在の `model` 設定に関係なく、トランスクリプトが保存されたときに使用していたモデルを保持します。そのモデルが廃止されている場合、または [`availableModels`](#restrict-model-selection) によって除外されている場合、セッションは通常の優先度順序にフォールスルーします。これにより、別のセッションの `/model` 選択が再開時のモデルを変更するのを防ぎます。

新しい起動で `--model` または `ANTHROPIC_MODEL` で選択したモデルは、復元されたモデルよりも優先されます。v2.1.195 以降では、[`ANTHROPIC_DEFAULT_OPUS_MODEL`](#environment-variables) ファミリー変数も同様です。

起動時のアクティブなモデルがあなた自身の選択ではなく、プロジェクトまたは管理設定から来ている場合、起動ヘッダーはどの設定ファイルがそれを設定したかを表示します。`/model` を実行してオーバーライドします。プロジェクトまたは管理設定は次の起動時に再度適用されます。

モデル切り替えが [Agent SDK](/ja/agent-sdk/overview) の `setModel()` メソッドを通じて、または Claude Code CLI を実行する [Desktop app](/ja/desktop) などのアプリケーションによって要求される場合、Claude Code はその文字列が認識できるものであることを確認してから保存します。このチェックには Claude Code v2.1.200 以降が必要です。Anthropic API では、Claude Code は以下を認識します。

- モデルエイリアス
- `/model` ピッカーからのエントリ
- `claude-` で始まる任意の名前
- [カスタムモデルオプション](#add-a-custom-model-option)として自分で設定した値、または [`modelOverrides`](#override-model-ids-per-version) で設定した値

Claude Code は認識されない文字列を `Model "<name>" is not a recognized model id.` で拒否し、セッションは現在のモデルを保持します。文字列を保存して次のリクエストで失敗する代わりに。回復手順については [エラーリファレンス](/ja/errors#model-is-not-a-recognized-model-id) を参照してください。

チェックは Anthropic API でのみ実行されます。Amazon Bedrock、Google Cloud の Agent Platform、Microsoft Foundry、[Claude Platform on AWS](/ja/claude-platform-on-aws)、および [LLM ゲートウェイ](/ja/llm-gateway) またはカスタム `ANTHROPIC_BASE_URL` の背後では、プロバイダーまたはゲートウェイがモデル名を定義するため、Claude Code はチェックなしで任意の文字列を通します。チェックは `--model` フラグ、`ANTHROPIC_MODEL` 環境変数、または `model` 設定もカバーしません。そこでの入力ミスは、最初のリクエストで代わりに [There's an issue with the selected model](/ja/errors#theres-an-issue-with-the-selected-model) を生成します。

要求されたモデルにスケジュール済みの廃止日がある場合、または自動的に新しいバージョンに再マップされる場合、Claude Code は要求されたモデルに名前を付ける警告を表示します。インタラクティブセッションはそれをスタートアップ通知として表示します。v2.1.182 以降では、デフォルトのテキスト出力形式を使用して [非インタラクティブモード](/ja/headless) で stderr に同じ警告が書き込まれます。チェックは [サブエージェントフロントマター](/ja/sub-agents) に設定された `model` もカバーします。stderr 警告は `--output-format json` および `stream-json` に対して抑制されます。代わりに [結果メッセージ](/ja/headless#get-structured-output) の `modelUsage` フィールドから実際のモデルを読み取ります。

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

エンタープライズ管理者は、[管理設定またはポリシー設定](/ja/settings#settings-files) で `availableModels` を使用して、ユーザーが選択できるモデルを制限できます。エントリは `sonnet` などのモデルファミリー、`claude-sonnet-4-5` などのバージョンプレフィックス、または `claude-sonnet-4-5-20250929` などの完全なモデル ID に一致します。

`availableModels` が設定されている場合、アローリストはユーザーがモデルを指定できるすべての場所に適用されます。

- **メインセッションモデル**：`/model`、`--model` フラグ、`ANTHROPIC_MODEL` 環境変数、`model` 設定、および [セッションを再開する](#setting-your-model) ときに復元されるモデル
- **エイリアス解決**：`ANTHROPIC_DEFAULT_OPUS_MODEL`、`ANTHROPIC_DEFAULT_SONNET_MODEL`、`ANTHROPIC_DEFAULT_HAIKU_MODEL`、および `ANTHROPIC_DEFAULT_FABLE_MODEL` 環境変数は、許可されたエイリアスをリスト外のモデルにリダイレクトすることはできません
- **高速モード**：`/fast` は、リスト外の Opus モデルに暗黙的に切り替わる場合、「is not in your organization's allowed models」というメッセージで切り替えを拒否します
- **サブエージェントモデル**：[サブエージェント](/ja/sub-agents#choose-a-model) frontmatter の `model` フィールド、Agent ツールの `model` パラメータ、`CLAUDE_CODE_SUBAGENT_MODEL`、および v2.1.197 以前では `/agents` ウィザードのモデルピッカー&#x20;
- **スキルおよびコマンドモデル**：[スキルおよびコマンド](/ja/skills) の `model` frontmatter
- **アドバイザーモデル**：設定された [`advisorModel`](/ja/advisor) 設定および `--advisor` フラグ
- **バックグラウンドエージェントモデル**：[ディスパッチピッカー](/ja/agent-view) で選択されたモデル

Anthropic API および [Claude Platform on AWS](/ja/claude-platform-on-aws) では、モデルファミリーエイリアス `opus`、`sonnet`、`haiku`、または `fable` は、アローリストが許可する最新バージョンに解決されます。アローリストが特定のバージョンをピン留めする場合（例：`["sonnet", "claude-opus-4-6"]`）、`/model opus` と `--model opus` の両方が Claude Opus 4.6（許可される最新の Opus）を選択し、要求されたモデルと置き換えられたモデルの両方を名前で示す通知を表示します。v2.1.205 より前では、最新リリースバージョンがリスト外のエイリアスは、リストが古いバージョンを許可している場合でも、他のブロックされた選択と同様に拒否または置き換えられていました。

Amazon Bedrock、Google Cloud の Agent Platform、Microsoft Foundry、および [Mantle](/ja/amazon-bedrock#use-the-mantle-endpoint) は、Anthropic モデル ID ではなくプロバイダー固有のデプロイメント ID を使用するため、ブロックされたエイリアスはそこで以下の拒否および置き換え動作に従います。

Claude Code は、モデルが設定された場所に応じて、他のブロックされた選択を処理します。

- **`/model`**：切り替えはエラーで拒否されます
- **`--model` フラグ、`ANTHROPIC_MODEL`、または `model` 設定**：値は起動時に警告とともに置き換えられ、要求されたモデルと置き換えられたモデルの両方を名前で示し、セッションはデフォルトモデルで開始されます
- **サブエージェント、スキル、またはコマンドのオーバーライド**：オーバーライドはリクエストを失敗させるのではなく、継承またはデフォルトモデルにフォールバックします
- **`advisorModel` 設定**：アドバイザーはセッションで無効になります
- **`--advisor` フラグ**：Claude Code は起動時にエラーで終了します

除外されたモデルは `/model` ピッカーから非表示になります。リストに組み込みピッカー行がない完全なモデル ID（リストがピン留めする古いバージョンなど）は、`/model` ピッカーに独自のラベル付き行として表示されます。v2.1.199 より前では、そのような ID は `/model <id>` を入力することでのみ選択可能でした。

Claude Code があなたに代わって行うモデル変更は、同じ方法でチェックされます。

- **[フォールバックモデルチェーン](#fallback-model-chains)**：アローリスト外の要素は削除されます
- **Plan モードアップグレード**：Anthropic API および Claude Platform on AWS では、[`opusplan`](#opusplan-model-setting) などのアップグレードが除外されたモデルに対して実行される場合、アップグレードファミリーの最新許可バージョンを使用します。プロバイダー固有のモデル ID を持つプロバイダーで、バージョンが許可されていない場合、アップグレードはスキップされ、計画はセッションのモデルで続行されます
- **[自動モデルフォールバック](#automatic-model-fallback)**：ターゲットが除外されているフォールバックは実行されないため、フラグが付けられたリクエストは拒否で終了します
- **[高速モード](/ja/fast-mode)**：セッションが実行されるモデルがアローリスト外にある場合、高速モードを有効にすることは拒否されます

```json
{
  "availableModels": ["sonnet", "haiku"]
}
```

サーフェスカバレッジ

すべてのサーフェスは受け取るアローリストを適用します。どの配信メカニズムが各サーフェスに到達するかは異なります。

| 配信メカニズム | CLI および IDE | デスクトップローカルセッション | Web、モバイル、およびクラウドセッション | Agent SDK および非対話型 | Cowork |
| :- | :- | :- | :- | :- | :- |
| 管理コンソールからの [サーバー管理設定](/ja/server-managed-settings) | 適用 | 適用 | 適用 | 適用 | 配信されない |
| [MDM または管理設定ファイル](/ja/settings#settings-files) | 適用 | 適用 | 配信されない | 適用 | デプロイされた場所で適用 |

- クラウドセッション（[Claude Code on the web](/ja/claude-code-on-the-web) または Desktop アプリ内）は Anthropic 管理 VM で実行されます。デバイスにデプロイされた設定はそれらに到達しないため、サーバー管理設定を通じてアローリストを配信してください。クラウドセッション内の中途のモデル切り替えは、要求されたモデルがアローリストで除外されている場合に拒否されます。セッション作成時のサーバー側拒否は、`availableModels` 設定キーではなく、[組織モデル制限](#organization-model-restrictions) に適用されます。
- Cowork（Claude Desktop アプリの agentic-work タブ）は Claude Code サーフェスではなく、設計上サーバー管理設定を受け取りません。管理設定ファイルは、セッションが実行される場所に存在する場合、Cowork セッションに適用されます。リモート Cowork セッションは Anthropic 管理 VM で実行され、デバイスにデプロイされたファイルは存在しません。
- [Amazon Bedrock、Google Cloud の Agent Platform、Microsoft Foundry、および Claude Platform on AWS](/ja/claude-platform-on-aws) などの [サードパーティプロバイダー](/ja/server-managed-settings#platform-availability) 上のセッションはサーバー管理設定を受け取らないため、MDM または管理設定ファイルを通じてアローリストを配信してください。
- サーバー管理配信には、セッションが組織ログインまたは直接設定された API キーで認証することも必要です。[`apiKeyHelper`](/ja/settings#available-settings) スクリプトを通じてのみキーを生成するフリートは、MDM または管理設定ファイルを通じてアローリストを配信する必要があります。
- Desktop Code タブは、実行するリモートホストから管理設定ファイルを読み取る [SSH セッション](/ja/desktop#ssh-sessions) もホストします。[Desktop 管理設定](/ja/desktop#managed-settings) を参照してください。
- claude.ai および Desktop アプリのモデルピッカーは、組織のアローリストで除外されたモデルを非表示にするか、グレーアウトします。ピッカーの状態はユーザーの利便性です。強制はセッション内で発生します。

デフォルトモデルの動作

モデルピッカーの Default オプションは、[`enforceAvailableModels`](#enforce-the-allowlist-for-the-default-model) も設定されていない限り、`availableModels` の影響を受けません。単独では、`availableModels` は Default を利用可能なままにし、アカウントのシステムの [ランタイムデフォルト](#default-model-setting) に解決されます。ティアのデフォルトが制限する予定のモデルである場合、`enforceAvailableModels` も設定してください。

空の `availableModels` 配列は Default モデル強制を実行しません。`availableModels: []` の場合、名前付きモデル選択はブロックされますが、アカウントタイプの Default モデルは `enforceAvailableModels` に関係なく使用可能なままです。

Default モデルのアローリストを強制する

管理設定で空でない `availableModels` と一緒に `enforceAvailableModels: true` を設定して、アローリストを Default オプションに拡張します。これには Claude Code v2.1.175 以降が必要です。

```json
{
  "availableModels": ["sonnet", "haiku"],
  "enforceAvailableModels": true
}
```

Default オプションはアカウントタイプのデフォルト、または管理者が設定した場合は [組織デフォルトモデル](#organization-default-model) に解決されます。そのモデルがアローリストにない場合、Default オプションは代わりに、許可され利用可能なモデルを名前で指定する最初の `availableModels` エントリに解決され、`/model` ピッカーの Default 行はそのモデルを表示します。これはデフォルトに到達するすべての場所に適用されます。セッション起動、`/model` で Default を選択、[フォールバックモデルチェーン](#fallback-model-chains) の `"default"` キーワード、および除外された選択がドロップされたときに使用されるフォールバック。

`enforceAvailableModels` は `availableModels` が設定されていないか空の場合、効果がありません。`availableModels: []` の場合、アカウントタイプの Default モデルは使用可能なままなので、設定はユーザーをすべてのモデルからロックアウトすることはできません。`availableModels` が空でないが、許可され利用可能なモデルに解決するエントリがない場合、強制はスキップされ、Default はアカウントタイプのデフォルトに解決され、`--debug` の下でのみ表示される警告が表示されます。これを避けるために、リストに少なくとも 1 つの保証された利用可能なエントリを保持してください。

両方のキーを [最高優先度の管理ソース](/ja/settings#settings-precedence) にデプロイします。管理デプロイされたソースはマージされないため、管理設定ファイルに配置されたペアは、管理コンソールが任意の設定を配信する場合に無視されます。

ユーザーが実行するモデルの制御

`model` 設定は初期選択であり、強制ではありません。セッション開始時にアクティブなモデルを設定しますが、ユーザーは `/model` を開いて Default を選択することができ、これは [`enforceAvailableModels`](#enforce-the-allowlist-for-the-default-model) がそれをリダイレクトしない限り、`model` が何に設定されているかに関係なく、システムの [ランタイムデフォルト](#default-model-setting) に解決されます。

モデル体験を完全に制御するには、これらの設定を組み合わせます。

- **`availableModels`**：ユーザーが切り替えられる名前付きモデルを制限
- **`enforceAvailableModels`**：`availableModels` アローリストを Default オプションに拡張し、Default がリスト外のモデルに解決されないようにします
- **`model`**：セッション開始時の初期モデル選択を設定
- **`ANTHROPIC_DEFAULT_SONNET_MODEL`** / **`ANTHROPIC_DEFAULT_OPUS_MODEL`** / **`ANTHROPIC_DEFAULT_HAIKU_MODEL`** / **`ANTHROPIC_DEFAULT_FABLE_MODEL`**：Default オプションと `sonnet`、`opus`、`haiku`、`fable` エイリアスが解決するものを制御

この例では、ユーザーを Sonnet 4.5 で開始し、ピッカーを Sonnet と Haiku に制限し、Default がティアのデフォルトではなくアローリスト上のモデルに解決されるようにします。

```json
{
  "model": "claude-sonnet-4-5",
  "availableModels": ["claude-sonnet-4-5", "haiku"],
  "enforceAvailableModels": true,
  "env": {
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "claude-sonnet-4-5"
  }
}
```

`enforceAvailableModels` または `env` ブロックがない場合、ユーザーがピッカーで Default を選択すると、そのティアの最新リリースが取得され、`model` と `availableModels` のバージョンピンがバイパスされます。2 つの設定は異なるスコープをカバーします。`enforceAvailableModels` は Default がアローリストに従うようにし、`env` ブロックは `sonnet` などの許可されたエイリアスが解決する特定のバージョンをピン留めします。モデルファミリーの制限で十分な場合は `enforceAvailableModels` のみを使用し、特定のバージョンをピン留めする必要がある場合は `env` ブロックを追加します。

マージ動作

[最高優先度の管理設定ソース](/ja/server-managed-settings#settings-precedence) が `availableModels` を定義する場合、そのリストのみが適用されます。ユーザー、プロジェクト、またはローカル設定のエントリはそれを拡張することはできず、管理デプロイされたソースは相互にマージされないため、管理設定ファイルにデプロイされたリストは、サーバー管理設定が任意のキーを配信する場合に無視されます。それ以外の場合、ユーザー、プロジェクト、およびローカル設定からのリストは、他の配列設定と同様に [連結および重複排除](/ja/settings#settings-precedence) されます。Claude Code v2.1.175 以降では、管理リストは下位優先度のエントリを置き換えます。以前のバージョンではそれらをマージします。

有効なリスト内で、ファミリー内の特定のモデルを名前で指定するエントリ（バージョンプレフィックスまたは完全なモデル ID のいずれか）は、そのファミリーのワイルドカードエントリを無効にします。`["sonnet", "claude-sonnet-4-5"]` は、すべての Sonnet モデルではなく、Sonnet 4.5 バージョンのみを許可します。

Mantle モデル ID

[Amazon Bedrock Mantle エンドポイント](/ja/amazon-bedrock#use-the-mantle-endpoint) が有効な場合、`availableModels` の `anthropic.` で始まるエントリは、カスタムオプションとして `/model` ピッカーに追加され、Mantle エンドポイントにルーティングされます。これは、[サードパーティデプロイメント用のモデルをピン留めする](#pin-models-for-third-party-deployments) で説明されているエイリアスマッチングの例外です。設定はピッカーをリストされたエントリに制限し、Mantle ID はファミリー名を埋め込むため、特定のエントリとしてカウントされ、そのファミリーのワイルドカードを無効にします。任意の Mantle ID と一緒に、保持したいバージョンプレフィックスまたは完全な ID をリストします。[マージ動作](#merge-behavior) を参照してください。

組織モデル制限

Claude Enterprise プランの組織管理者は、claude.ai 管理コンソールで個別のモデルを無効にすることで、メンバーが実行できるモデルを制限します。この制限は、Claude Code が認証するときにアカウントの権利と共に配信され、設定内の `availableModels` リストとは別であり、セッションが作成されるときにサーバーが同じ制限を独立して適用します。Claude Code v2.1.187 以降が必要です。

制限はメンバーがサインインするか、自分の API キーを使用する場合に適用されます。組織サービスキーなどの組織スコープの認証情報はユーザーに関連付けられていないため、制限は適用されません。

Claude Console にはモデル制限制御がありません。Claude Enterprise プランを持たない組織（Anthropic API を通じて認証するメンバーを持つ組織を含む）は、[管理設定](/ja/settings#settings-files) で [`availableModels`](#restrict-model-selection) を使用してモデルを制限し、Default オプションをカバーするために [`enforceAvailableModels`](#enforce-the-allowlist-for-the-default-model) を追加します。これらの設定は、サーバーではなく Claude Code 自体によって適用されます。

制限されたモデルは `/model` ピッカーから非表示になります。`--model`、`ANTHROPIC_MODEL` 環境変数、または `model` 設定で名前で選択すると、`Model "<name>" is restricted by your organization's settings. Using <model> instead.` という通知が表示され、セッションは許可されたモデルで開始されます。制限されたモデルに対して `/model <name>` と入力すると、`Model '<name>' is restricted by your organization's settings. Run /model to choose a different model.` で拒否され、セッションは現在のモデルを保持します。

`opus`、`sonnet`、`haiku`、`fable` などの [モデルファミリーエイリアス](#restrict-model-selection) は、組織が許可するそのファミリーの最新バージョンに解決され、同じ置き換え通知が表示されます。`/model <alias>` は、そのファミリーのすべてのバージョンが制限されている場合にのみ拒否されます。`--model`、`ANTHROPIC_MODEL`、または `model` 設定で設定されたエイリアスは、その場合でも起動時に置き換えられます。v2.1.205 より前では、ファミリーエイリアスは最新リリースバージョンのみに基づいて置き換えられたか拒否されていました。古いバージョンが許可されている場合でも同様です。

制限は組織全体またはロールごとに適用されます。

- 組織レベルでモデルを無効にすると、すべてのメンバーから削除されます。
- ロールレベルのアクセスは異なるカスタムロールに異なるモデルを付与し、複数のロールを保持するメンバーは、そのロールの 1 つが付与するモデルを使用できます。
- Haiku モデルは常に利用可能であり、無効にすることはできないため、すべてのメンバーは少なくとも 1 つの使用可能なモデルを保持します。
- アクセス変更は約 1 分以内に新しいリクエストに有効になります。`/model` ピッカーはセッションが次に開始するときにそれを反映します。

両方の制限が一緒に適用されます。モデルは `availableModels` で許可され、組織によって制限されていない場合にのみ選択可能です。組織制限は Anthropic API および [LLM ゲートウェイ](/ja/llm-gateway) デプロイメント上のセッションに配信されます。Amazon Bedrock、Google Cloud の Agent Platform、Microsoft Foundry、および Claude Platform on AWS 上のセッションはそれらを受け取らないため、代わりにそれらのプロバイダーで `availableModels` を使用してください。

組織デフォルトモデル

Claude Enterprise プランの組織管理者は、claude.ai 管理コンソールから Claude Code メンバーのデフォルトモデルを、組織全体またはカスタムロール単位で設定できます。設定されている場合、Default オプションは [アカウントタイプのデフォルト](#default-model-setting) ではなく、そのモデルに解決されます。Claude Code v2.1.196 以降が必要です。

`/model` ピッカーの Default 行は、組織デフォルトの名前を「Org default」というラベルで表示します。ラベルは、管理者が組織全体のデフォルトを設定したか、ロール用に設定したかに関係なく「Org default」と表示されます。ロールデフォルトはそのカスタムロールのメンバーをカバーし、組織全体のデフォルトより優先されます。複数のロールが異なるデフォルトを設定する場合、最も高性能なモデルが適用されます。

組織デフォルトは開始点であり、制限ではなく、他のモデル選択はそれより優先されます。

- `--model` フラグと `ANTHROPIC_MODEL` 環境変数
- [管理設定](/ja/settings#settings-files) または `--settings` で提供される `model` 値
- ユーザー、プロジェクト、またはローカル設定の `model` 値（`/model` で保存したモデルを含む）

管理者は、組織デフォルトをユーザー選択をオーバーライドするように設定することもできます。オーバーライドがオンの場合、ユーザー、プロジェクト、およびローカル設定の `model` 値より優先されるため、`/model` で保存したモデルは現在のセッションに適用され、組織デフォルトは次の起動時に戻ります。選択が異なる場合、`/model` は `Your organization's default (<model>) applies on restart` を表示します。`--model` フラグ、`ANTHROPIC_MODEL`、管理設定、および `--settings` はオーバーライドがオンの場合でも優先されます。オーバーライドは限定的な組織セットで利用可能です。利用可能性については Anthropic アカウントチームに問い合わせてください。

メンバーが選択できるモデルを制限するには、[組織モデル制限](#organization-model-restrictions) または [`availableModels`](#restrict-model-selection) を代わりに使用してください。

Claude Code は起動時に組織デフォルトを 1 回読み込むため、管理者が中途で変更したデフォルトは次の起動時に有効になります。

組織デフォルトがユーザー選択をオーバーライドしない場合、管理者がそれを変更した後の最初のインタラクティブ起動は、ユーザー設定から `model` キーを 1 回クリアするため、新しいデフォルトが適用されます。ファイル内の他の何も変更されず、その起動後に `/model` で保存したモデルは保持されます。

組織デフォルトは、採用される前に他の Default モデルと同じ制限チェックを通過します。

- [`availableModels`](#restrict-model-selection) 単独では Default オプションを制限しないため、アローリスト外の組織デフォルトは引き続き適用されます。[`enforceAvailableModels`](#enforce-the-allowlist-for-the-default-model) も設定されている場合、アローリスト外の組織デフォルトは、他の Default と同様に最初のアローリストエントリに再マップされます
- [組織モデル制限](#organization-model-restrictions) がアカウントに対して拒否する組織デフォルトは、そのファミリーの最新許可モデル、またはそのバージョンがすべて制限されている場合は低コストファミリーに置き換えられます
- [ゼロデータ保持](/ja/zero-data-retention) の下での Fable 5 など、アカウントで利用できない組織デフォルトはスキップされ、Default オプションはアカウントタイプのデフォルトに解決されます

v2.1.199 以降では、組織デフォルトがアカウントタイプの通常のデフォルトと異なるモデルファミリーである場合、`/model` ピッカーはそのファミリーの別の行を保持するため、セッション用にそれに切り替えることができます。v2.1.196 から v2.1.198 ではその行はピッカーから欠落しています。

組織デフォルトは Anthropic API で認証されたセッションに配信されます。[LLM ゲートウェイ](/ja/llm-gateway) デプロイメント、Amazon Bedrock、Google Cloud の Agent Platform、Microsoft Foundry、および Claude Platform on AWS 上のセッションはそれを受け取りません。これらのデプロイメントでデフォルトを設定するには、[管理設定](/ja/settings#settings-files) で `model` キーを代わりに使用してください。

組織努力制限

Claude Enterprise プランの組織管理者は、ロールレベルの [組織モデル制限](#organization-model-restrictions) と一緒に、各カスタムロール用のモデルごとに最大 [努力レベル](#adjust-effort-level) を設定できます。キャップ以上のレベルは `/effort` ピッカーで提供されず、`--effort` または `/effort` で高いレベルを名前で指定すると、キャップで実行されます。インタラクティブセッションおよびプレーンテキスト `--print` 実行では、警告は要求されたレベルと適用されたレベルを名前で示します。`json` または `stream-json` 出力またはバックグラウンドエージェントでは、クランプは静かに適用されます。キャップはモデルごとであるため、モデルを切り替えると利用可能なレベルが変わる可能性があります。複数のロールが同じモデルを付与する場合、最も制限の少ないキャップが適用されます。Claude Code v2.1.195 以降が必要です。

努力制限は [組織モデル制限](#organization-model-restrictions) と一緒に配信され、同じプロバイダー利用可能性に従います。Amazon Bedrock、Google Cloud の Agent Platform、Microsoft Foundry、および Claude Platform on AWS 上のセッションはそれらを受け取りません。

特別なモデルの動作

`default` モデル設定

`default` の動作はアカウントタイプによって異なります。

- **Max、Team Premium、Enterprise 従量課金、Anthropic API**：Opus 4.8 がデフォルト
- **AWS 上の Claude Platform、Amazon Bedrock、Google Cloud の Agent Platform**：Opus 4.8 がデフォルト
- **Pro、Team Standard、Enterprise サブスクリプションシート**：Sonnet 5 がデフォルト
- **Microsoft Foundry**：Sonnet 4.5 がデフォルト

Enterprise 従量課金とは、サブスクリプションシートではなく使用量で請求される Enterprise 組織を意味します。

v2.1.207 より前では、`default` は AWS 上の Claude Platform では Opus 4.7 に、Amazon Bedrock と Google Cloud の Agent Platform では Sonnet 4.5 に解決されていました。

管理者が [組織デフォルトモデル](#organization-default-model) を設定している場合、`default` は上記のアカウントタイプのデフォルトではなく、そのモデルに解決されます。Claude Code v2.1.196 以降が必要です。

管理設定が [Default モデルのアローリストを強制](#enforce-the-allowlist-for-the-default-model) し、アカウントタイプのデフォルトが `availableModels` にない場合、`default` は上記のアカウントタイプのデフォルトではなく、強制された Default に解決されます。両方が適用される場合、組織デフォルトはアカウントタイプのデフォルトを最初に置き換え、強制がそれに適用されます。許可リストに登録された組織デフォルトは保持され、リスト外のものは強制された Default に解決されます。

Fable 5 はどのアカウントタイプでもデフォルトモデルではありません。セッションは `/model fable`、`model` 設定、または Fable 5 が利用可能な `best` エイリアスで選択した後にのみ Fable 5 を使用します。`/model` で選択すると、ユーザー設定で選択されたモデルとして保存されるため、モデルを変更するまで後続のセッションは Fable 5 で開始されます。

`opusplan` モデル設定

`opusplan` モデルエイリアスは、自動化されたハイブリッドアプローチを提供します。

- **Plan Mode 中**：複雑な推論とアーキテクチャの決定用に `opus` を使用
- **実行モード中**：コード生成と実装用に自動的に `sonnet` に切り替わり

これにより、計画用の Opus の優れた推論と、実行用の Sonnet の効率性が組み合わされます。

Plan Mode の Opus フェーズは `opus` モデル設定と同じコンテキストウィンドウを使用します。[自動アップグレード](#extended-context) で Opus が 1M コンテキストに自動アップグレードされるサブスクリプション層では、`opusplan` も Plan Mode でアップグレードを受け取ります。自動アップグレード層にない場合に両方のフェーズで 1M コンテキストを強制するには、モデルを `opusplan[1m]` に設定します。

[`availableModels`](#restrict-model-selection) が最新の Opus を除外しますが、古いバージョン（例えば `["sonnet", "claude-opus-4-6"]`）を許可する場合、`opusplan` は計画用に許可された最新の Opus を使用し、すべての Opus が除外されている場合のみ Sonnet に留まります。通常は Plan Mode で Sonnet にアップグレードする Haiku セッションは同様に、許可された最新の Sonnet を使用し、すべての Sonnet が除外されている場合のみ Haiku に留まります。v2.1.205 より前では、許可リストが古いバージョンを許可していても、アップグレードファミリーの最新バージョンが除外されている場合、Plan Mode はセッションのモデルに留まっていました。

古いバージョンの置き換えは Anthropic API と [Claude Platform on AWS](/ja/claude-platform-on-aws) に適用されます。Amazon Bedrock、Google Cloud の Agent Platform、Microsoft Foundry、Mantle では、プロバイダー固有のモデル ID を使用するデプロイメントのため、アップグレードモデルが除外されている場合、Plan Mode はセッションのモデルに留まります。

Claude がタスク途中で 2 番目のモデルを参照するかどうかを決定するハイブリッドアプローチについては、[advisor tool](/ja/advisor) を参照してください。

フォールバックモデルチェーン

プライマリモデルが過負荷状態、利用不可、または別の再試行不可能なサーバーエラーを返す場合、Claude Code はリクエストを失敗させる代わりにフォールバックモデルに切り替えることができます。認証、請求、レート制限、リクエストサイズ、トランスポートエラーは切り替えをトリガーしません。これらは通常の再試行とエラー処理に従います。

1 つ以上のフォールバックモデルを設定し、Claude Code は順番に試行し、切り替え時に通知を表示します。切り替えは現在のターンのみ続くため、次のメッセージはプライマリモデルを最初に再度試行します。チェーンは重複排除後 3 つのモデルに制限され、余分なエントリは無視されます。

`--fallback-model` フラグを使用して 1 つのセッション用にチェーンを設定します。これはカンマ区切りリストを受け入れます。

```bash
claude --fallback-model sonnet,haiku
```

セッション全体でチェーンを保持するには、[settings](/ja/settings) で `fallbackModel` を配列として設定します。

```json
{
  "fallbackModel": ["claude-sonnet-5", "claude-haiku-4-5"]
}
```

`--fallback-model` フラグは `fallbackModel` 設定より優先されます。各要素はモデル名またはエイリアスを受け入れ、`"default"` はデフォルトモデルに展開されます。

要素がスキップされる 2 つのケース：

- **利用不可能なモデル**：設定にピン留めされた廃止されたモデルなど、到達できないモデルはスキップされ、Claude Code は次の要素に続きます。
- **許可リストの外**：[`availableModels`](#restrict-model-selection) で許可されていない要素は、チェーンが読み込まれるときにドロップされ、試行されません。

自動モデルフォールバック

このセクションは Fable 5 からのコンテンツベースのフォールバックをカバーしています。モデルが過負荷状態または利用不可の場合の可用性ベースのフォールバックについては、[フォールバックモデルチェーン](#fallback-model-chains) を参照してください。

Fable 5 はサイバーセキュリティと生物学コンテンツ用のセーフティ分類器で実行されます。分類器がリクエストにフラグを立てると、Claude Code はそのリクエストをプロバイダーのデフォルト Opus モデルで再実行し、トランスクリプトに通知を表示します。Anthropic API、[LLM gateway](/ja/llm-gateway) デプロイメント、[Claude Platform on AWS](/ja/claude-platform-on-aws) では、そのモデルは Opus 4.8 です。[Claude apps gateway](/ja/claude-apps-gateway) では、[`opus` エイリアス](#environment-variables) を別のモデルで指す場合を除き、Opus 4.7 です。

セッションはその Opus モデルで続行されます。Fable 5 に戻るには、`/model fable` を実行します。

フォールバックターゲットは [`availableModels`](#restrict-model-selection) に対してチェックされます。ブロックされている場合、フォールバックは発生しません。拒否は通常のエラーとして表示され、セッションのモデルは変更されません。

フォールバックをトリガーしたものを確認

フォールバックはセッションの最初のリクエストで、何か異常を送信する前にトリガーできます。最初のリクエストは CLAUDE.md コンテンツと git ステータスなどのワークスペースコンテキストを含むためです。セキュリティまたは生物学資料を含むリポジトリは、そのコンテキストだけで分類器をトリガーできます。

カスタマイズがトリガーかどうかを確認するには、`claude --safe-mode` でセッションを開始します。これは CLAUDE.md、skills、MCP サーバー、hooks などのカスタマイズを無効にします。Git ステータスとディレクトリ名はカスタマイズではなく、引き続き含まれます。

切り替え前に確認

リクエストにフラグが立てられるたびに何が起こるかを決定するには、自動的に切り替える代わりに `/config` を実行し、「メッセージにフラグが立てられたときにモデルを切り替える」をオフにします。フラグが立てられたリクエストはセッションを一時停止し、2 つのオプションがあります。Opus モデルに切り替えるか、プロンプトを編集して Fable 5 で再試行します。

いくつかのケースは異なる動作をします。

- 両方のモデルが同じリクエストにフラグを立てた場合、プロンプトを編集して再試行するか、新しいセッションを開始できます。
- モバイル [Claude Code on the web](/ja/claude-code-on-the-web) セッションでは、編集と再試行はサポートされていません。モデルを切り替えるか、デスクトップブラウザまたはデスクトップアプリからセッションを続行します。
- [非対話モード](/ja/cli-reference#cli-flags) と、プロンプトを表示できない SDK 統合では、フラグが立てられたリクエストは拒否で終了します。
- フォールバックターゲットが [`availableModels`](#restrict-model-selection) でブロックされている場合、プロンプトは表示されません。フラグが立てられたリクエストは拒否で終了し、ターゲットがブロックされている場合の自動フォールバックと同じです。

Bedrock、Agent Platform、Foundry でフォールバックを有効化

[Amazon Bedrock](/ja/amazon-bedrock)、[Google Cloud の Agent Platform](/ja/google-vertex-ai)、[Microsoft Foundry](/ja/microsoft-foundry) では、モデル ID はプロバイダー固有であるため、自動フォールバックは Claude Code が関連する両方のモデルを識別できる場合にのみ動作します。

- Claude Code は現在のモデルを Fable 5 として認識する必要があります。モデル ID に `claude-fable-5` が含まれるか、`ANTHROPIC_DEFAULT_FABLE_MODEL` の値と一致するか、[`modelOverrides`](#override-model-ids-per-version) でマップされています。
- フォールバックターゲットは Opus モデルに解決される必要があります。`ANTHROPIC_DEFAULT_OPUS_MODEL` が設定されている場合はその値、それ以外はプロバイダーのモデルリストの Opus 4.8 エントリ。

どちらかのモデルが識別できない場合、Claude Code は自動的に切り替わりません。フラグが立てられたリクエストは拒否メッセージで終了し、[`/model`](#setting-your-model) でモデルを切り替えて再試行できます。これらのプロバイダーで自動フォールバックを有効にするには、`ANTHROPIC_DEFAULT_FABLE_MODEL` を Fable 5 モデル ID に、`ANTHROPIC_DEFAULT_OPUS_MODEL` を Opus 4.8 モデル ID に設定します。

セキュリティ研究と生物学ワークロード

攻撃的なセキュリティまたは生物学のワークロード（ペネトレーションテスト、Capture the Flag（CTF）演習、生物学隣接コードベースを含む）は頻繁にフォールバックをトリガーし、多くの場合最初のリクエストで。実質的な生物学作業の場合、ほぼすべてのリクエストが再ルーティングされることを期待してください。

これはこれらのドメイン用の予想されるルーティングであり、アカウントフラグではありません。組織がこの作業に Fable クラスの機能を必要とする場合、信頼されたアクセスプログラムについて Anthropic アカウントチームに問い合わせてください。

努力レベルの調整

[努力レベル](https://platform.claude.com/docs/ja/build-with-claude/effort) は適応的推論を制御し、タスクの複雑さに基づいて各ステップで思考するかどうか、どの程度思考するかをモデルが決定できるようにします。低い努力はシンプルなタスクではより高速で安価ですが、高い努力は複雑な問題に対してより深い推論を提供します。

利用可能な努力レベルはモデルによって異なります。ここに記載されていないモデルは努力をサポートしていません。

| モデル | レベル |
| :- | :- |
| Fable 5 | `low`、`medium`、`high`、`xhigh`、`max` |
| Sonnet 5、Opus 4.8、Opus 4.7 | `low`、`medium`、`high`、`xhigh`、`max` |
| Opus 4.6 と Sonnet 4.6 | `low`、`medium`、`high`、`max` |

アクティブなモデルがサポートしないレベルを設定した場合、Claude Code は設定したレベル以下の最高サポートレベルにフォールバックします。例えば、`xhigh` は Opus 4.6 では `high` として実行されます。組織は、モデルに対して利用可能なレベルをキャップすることもできます。[組織努力制限](#organization-effort-limits) を参照してください。

デフォルト努力は Fable 5、Sonnet 5、Opus 4.8、Opus 4.6、Sonnet 4.6 では `high` で、Opus 4.7 では `xhigh` です。

Fable 5、Opus 4.8、または Opus 4.7 を初めて実行する場合、Claude Code は、別のモデルに対して以前に異なるレベルを設定していても、そのモデルのデフォルト努力を適用します。Fable 5 と Opus 4.8 では `high`、Opus 4.7 では `xhigh` です。切り替え後に `/effort` を再度実行して、別のレベルを選択します。そのデフォルトはセッション全体で保持され、明示的な努力選択（インタラクティブセッションで `/effort` を実行するか、`--effort` で起動するなど）を行うまで保持されます。

`low`、`medium`、`high`、`xhigh` はセッション全体で保持されます。[非対話モード](/ja/headless) で `/effort` を実行するか、`-p` フラグで設定されたレベルは現在のセッションのみに適用され、デフォルトとして保存されません。非対話 `/effort` は上記のモデルデフォルトホールドをリリースすることもできません。Fable 5、Opus 4.8、Opus 4.7 では `Not applied` を報告し、セッションはモデルのデフォルト努力に留まるため、代わりに起動時に `--effort` を渡します。`max` は制約なしで最も深い推論を提供し、現在のセッションのみに適用されます。ただし、`CLAUDE_CODE_EFFORT_LEVEL` 環境変数を通じて設定された場合を除きます。

`/effort` メニューは `ultracode` も提供します。Ultracode はモデル努力レベルではなく Claude Code 設定です。モデルに `xhigh` を送信し、さらに Claude が実質的なタスク用に [dynamic workflows](/ja/workflows) をオーケストレートします。現在のセッションのみに適用されます。

以下のいずれかを通じて ultracode をオンにできます。

- **`/effort`**：`/effort ultracode` を実行するか、メニューから選択
- **`--effort` フラグ**：`claude --effort ultracode` で起動します。これはセッションを `xhigh` 努力で開始し、ultracode をオンにします
- **`--settings` または Agent SDK 制御リクエスト**：`"ultracode": true` を渡します。[`applyFlagSettings()`](/ja/agent-sdk/typescript#applyflagsettings) リクエストは `effortLevel: "ultracode"` も受け入れます

`--effort` フラグまたは Agent SDK `effortLevel` 値に `ultracode` を渡すには、Claude Code v2.1.203 以降が必要です。v2.1.203 より前では、`--effort ultracode` は `Unknown --effort value 'ultracode'` を出力し、セッションはデフォルト努力で開始されました。

保持された `effortLevel` 設定と `CLAUDE_CODE_EFFORT_LEVEL` 環境変数は `ultracode` を受け入れません。

ultracode が利用不可の場合（例えば [workflows がオフ](/ja/workflows#turn-workflows-off) の場合）、`--effort ultracode` は `xhigh` 努力のみを設定します。

努力レベルの選択

各レベルはトークン支出と機能をトレードオフします。デフォルトはほとんどのコーディングタスクに適しています。別のバランスが必要な場合は調整します。

| レベル | 使用する場合 |
| :- | :- |
| `low` | インテリジェンスに敏感でない短くスコープされたレイテンシに敏感なタスク用に予約 |
| `medium` | インテリジェンスをトレードオフできるコスト敏感な作業のトークン使用量を削減 |
| `high` | トークン使用量とインテリジェンスのバランス。Fable 5、Sonnet 5、Opus 4.8、Opus 4.6、Sonnet 4.6 でのデフォルト |
| `xhigh` | より高いトークン支出での深い推論。Opus 4.7 でのデフォルト |
| `max` | 難しいタスクのパフォーマンスを改善できますが、収益逓減を示す可能性があり、過度な思考の傾向があります。広く採用する前にテスト |
| `ultracode` | 各実質的なタスク用に `xhigh` ごとのメッセージ推論で [dynamic workflow](/ja/workflows) を計画する Claude Code 設定。セッションのみ |

努力スケールはモデルごとに調整されるため、同じレベル名はモデル全体で同じ基盤値を表しません。

1 回限りの深い推論に ultrathink を使用

セッション設定を変更せずに 1 回限りの深い推論を行うには、プロンプトの任意の場所に `ultrathink` を含めます。Claude Code はキーワードを認識し、インコンテキスト命令を追加します。API に送信される努力レベルは変更されません。「think」、「think hard」、「think more」などの他のフレーズは通常のプロンプトテキストとして渡され、キーワードとして認識されません。

努力レベルの設定

努力は以下のいずれかを通じて変更できます。

- **`/effort`**：引数なしで `/effort` を実行してインタラクティブスライダーを開くか、`/effort` の後にレベル名を続けて直接設定するか、`/effort auto` を実行してモデルのデフォルトにリセット
- **`/model` 内**：モデルを選択する際に左右矢印キーを使用して努力スライダーを調整
- **`--effort` フラグ**：Claude Code を起動する際にレベル名を渡して、単一セッションのレベルを設定
- **環境変数**：`CLAUDE_CODE_EFFORT_LEVEL` をレベル名または `auto` に設定
- **設定**：設定ファイルで `effortLevel` を `low`、`medium`、`high`、`xhigh` に設定します。`max` と `ultracode` は [セッションのみ](#adjust-effort-level) であり、ここでは受け入れられません
- **Skill と subagent frontmatter**：[skill](/ja/skills#frontmatter-reference) または [subagent](/ja/sub-agents#supported-frontmatter-fields) markdown ファイルで `effort` を設定して、その skill または subagent が実行される際の努力レベルをオーバーライド

環境変数がすべての他の方法より優先され、次に設定されたレベル、次にモデルのデフォルトが優先されます。Frontmatter 努力は、その skill または subagent がアクティブな場合に適用され、セッションレベルをオーバーライドしますが、環境変数はオーバーライドしません。

努力スライダーは、サポートされているモデルが選択されている場合、`/model` に表示されます。現在の努力レベルはロゴとスピナーの横にも表示されます（例：「with low effort」）。`/model` を開かなくても、どの設定がアクティブかを確認できます。

適応的推論と固定思考予算

適応的推論は各ステップで思考をオプションにするため、Claude はルーチンプロンプトにより速く応答でき、より深い思考から利益を得るステップのために深い思考を予約できます。現在のレベルが生成するよりも Claude がより頻繁に、またはより少なく思考することを望む場合、プロンプトまたは `CLAUDE.md` で直接そう言うことができます。モデルはその努力設定内でそのガイダンスに応答します。

Fable 5、Sonnet 5、Opus 4.7 以降は常に適応的推論を使用します。固定思考予算モードと `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING` はそれらに適用されません。

Opus 4.6 と Sonnet 4.6 では、`CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1` を設定して、`MAX_THINKING_TOKENS` で制御される以前の固定思考予算に戻すことができます。[環境変数](/ja/env-vars) を参照してください。

拡張思考

拡張思考は、Claude が応答する前に発する推論です。[適応的推論](#adjust-effort-level) をサポートするモデルでは、努力レベルは思考がどの程度発生するかの主要な制御です。以下の設定は思考をオンまたはオフにし、それがどのように表示されるかを制御します。

| 制御 | 設定方法 |
| :- | :- |
| 現在のセッションのトグル | macOS では `Option+T`、Windows と Linux では `Alt+T` を押します |
| グローバルデフォルトを設定 | `/config` を実行して思考モードをトグルします。`~/.claude/settings.json` に `alwaysThinkingEnabled` として保存されます |
| 努力に関係なく無効化 | [`MAX_THINKING_TOKENS=0`](/ja/env-vars) を設定します。これは Anthropic API 上の Fable 5 を除いて思考をオフにします。[サードパーティプロバイダー](/ja/third-party-integrations) ではこれは `thinking` パラメータを省略し、適応的推論モデルは引き続き思考する可能性があります。他の値は [固定思考予算](#adaptive-reasoning-and-fixed-thinking-budgets) でのみ適用されます |

思考は Fable 5 でオフにすることはできません。セッショントグル、`alwaysThinkingEnabled`、`MAX_THINKING_TOKENS=0` はそこに効果がなく、Fable 5 は努力レベルに基づいて各ステップでどの程度思考するかを決定します。

思考出力はデフォルトで折りたたまれています。`Ctrl+O` を押して詳細モードをトグルし、推論をグレーのイタリック体テキストとして表示します。Anthropic API 上のインタラクティブセッションはデフォルトで編集された思考ブロックを受け取るため、展開時に完全な要約を利用可能にしたい場合は [設定](/ja/settings) で `showThinkingSummaries: true` を設定します。折りたたまれたまたは編集された場合でも、生成されたすべての思考トークンに対して課金されます。

拡張コンテキスト

Fable 5、Sonnet 5、Opus 4.6 以降、Sonnet 4.6 は、大規模なコードベースを持つ長いセッション用に [100 万トークンのコンテキストウィンドウ](https://platform.claude.com/docs/ja/build-with-claude/context-windows#context-window-sizes-by-model) をサポートしています。

利用可能性はモデルとプランによって異なります。Anthropic API では、Fable 5、Sonnet 5、Opus 4.8、Opus 4.7 は常に 1M ウィンドウで実行されます。Max、Team、Enterprise プランでは、Opus は追加設定なしで自動的に 1M コンテキストにアップグレードされます。これは Team Standard と Team Premium の両方のシートに適用されます。Sonnet 4.6 with 1M context は自動アップグレードの一部ではなく、Max を含むすべてのサブスクリプションプランで [使用クレジット](https://support.claude.com/ja/articles/12429409-extra-usage-for-paid-claude-plans) が必要です。

| プラン | Opus with 1M context | Sonnet 4.6 with 1M context |
| - | - | - |
| Max、Team、Enterprise | サブスクリプションに含まれる | [使用クレジット](https://support.claude.com/ja/articles/12429409-extra-usage-for-paid-claude-plans) が必要 |
| Pro | [使用クレジット](https://support.claude.com/ja/articles/12429409-extra-usage-for-paid-claude-plans) が必要 | [使用クレジット](https://support.claude.com/ja/articles/12429409-extra-usage-for-paid-claude-plans) が必要 |
| API と従量課金 | フルアクセス | フルアクセス |

1M コンテキストを完全に無効にするには、`CLAUDE_CODE_DISABLE_1M_CONTEXT=1` を設定します。これにより、1M モデルバリアントがモデルピッカーから削除されます。[環境変数](/ja/env-vars) を参照してください。

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

Sonnet 5 のコンテキストウィンドウ

Anthropic API では、Sonnet 5 は常に 1M コンテキストウィンドウで実行されます。200K バリアントはなく、選択する `[1m]` サフィックスもなく、どのプランでも使用クレジットは必要ありません。セッションはウィンドウがいっぱいになる前に、デフォルトでは約 967K トークンの時点で自動コンパクトされます。別のしきい値を選択するには、[`CLAUDE_CODE_AUTO_COMPACT_WINDOW`](/ja/env-vars) を設定します。

以下の 2 つの設定では、代わりにウィンドウが 200K として割り当てられ、その境界で自動コンパクトされます。

- **LLM ゲートウェイ**：`ANTHROPIC_BASE_URL` が [ゲートウェイ](/ja/llm-gateway) を指す場合、Claude Code は 1M サポートを検証できません。完全なウィンドウを使用するには、モデルピッカーで Sonnet 5 (1M context) を選択します。これは `sonnet[1m]` にマップされます。
- **`CLAUDE_CODE_DISABLE_1M_CONTEXT=1`**：コンテキストを制限する必要があるデプロイメント用に、Sonnet 5 セッションを 200K ウィンドウを持つものとして扱います。

現在のモデルの確認

現在使用しているモデルは、2 つの場所で確認できます。

- [ステータスライン](/ja/statusline)内（設定されている場合）
- `/status` 内。アカウント情報も表示されます。

カスタムモデルオプションの追加

`ANTHROPIC_CUSTOM_MODEL_OPTION` を使用して、組み込みエイリアスを置き換えることなく、単一のカスタムエントリを `/model` ピッカーに追加します。これは Claude Code がデフォルトでリストしないモデル ID のテストに役立ちます。LLM ゲートウェイデプロイメントの場合、Claude Code は `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1` が設定されているときにゲートウェイの `/v1/models` エンドポイントからピッカーを自動的に入力するため、この変数が必要なのはディスカバリーが無効になっているか、必要なモデルを返さない場合のみです。[ゲートウェイモデルディスカバリー](/ja/llm-gateway-protocol#model-discovery)を参照してください。

この例では、3 つの変数をすべて設定して、ゲートウェイルーティングされた Opus デプロイメントを選択可能にします。

```bash
export ANTHROPIC_CUSTOM_MODEL_OPTION="my-gateway/claude-opus-4-8"
export ANTHROPIC_CUSTOM_MODEL_OPTION_NAME="Opus via Gateway"
export ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION="Custom deployment routed through the internal LLM gateway"
```

カスタムエントリは `/model` ピッカーの下部に表示されます。`ANTHROPIC_CUSTOM_MODEL_OPTION_NAME` と `ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION` はオプションです。省略された場合、モデル ID は名前として使用され、説明はデフォルトで `Custom model (<model-id>)` になります。

Claude Code は `ANTHROPIC_CUSTOM_MODEL_OPTION` で設定されたモデル ID の検証をスキップするため、API エンドポイントが受け入れる任意の文字列を使用できます。[`availableModels`](#restrict-model-selection)が設定されている場合、カスタムモデル ID も許可リストに含める必要があります。カスタムエントリはピッカーからフィルタリングされ、その `--model` 選択は他の除外されたモデルと同様に拒否されます。`my-gateway/claude-opus-4-8` などのファミリー名を埋め込むカスタム ID は、そのファミリーの特定のエントリとしてカウントされ、そのワイルドカードを無効にするため、選択可能にしたいバージョンもリストします。[マージ動作](#merge-behavior)を参照してください。

環境変数

以下の環境変数を使用できます。これらは完全なモデル名、またはお客様の API プロバイダーの同等のものである必要があり、エイリアスがマップするモデル名を制御します。

| 環境変数 | 説明 |
| - | - |
| `ANTHROPIC_DEFAULT_FABLE_MODEL` | `fable` に使用するモデル、および Claude Code が [自動モデルフォールバック](#automatic-model-fallback) でサードパーティプロバイダーが Fable 5 として認識するモデル ID |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | `opus` に使用するモデル、または Plan Mode がアクティブな場合の `opusplan` に使用するモデル |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | `sonnet` に使用するモデル、または Plan Mode がアクティブでない場合の `opusplan` に使用するモデル |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | `haiku` に使用するモデル、または [バックグラウンド機能](/ja/costs#background-token-usage) に使用するモデル |
| `CLAUDE_CODE_SUBAGENT_MODEL` | すべての [subagents](/ja/sub-agents#choose-a-model)、[agent teams](/ja/agent-teams)、および [workflow](/ja/workflows) が実行するエージェントに使用するモデル。`haiku` などのエイリアスまたは完全なモデル名を受け入れ、呼び出しごとの `model` パラメータと subagent 定義の `model` frontmatter をオーバーライドします。通常のモデル解決を使用するには `inherit` に設定します |

注：`ANTHROPIC_SMALL_FAST_MODEL` は `ANTHROPIC_DEFAULT_HAIKU_MODEL` の代わりに非推奨です。

サードパーティデプロイメント用のモデルのピン留め

[Amazon Bedrock](/ja/amazon-bedrock)、[Google Cloud の Agent Platform](/ja/google-vertex-ai)、[Microsoft Foundry](/ja/microsoft-foundry)、または [Claude Platform on AWS](/ja/claude-platform-on-aws) を通じて Claude Code をデプロイする場合、ユーザーへのロールアウト前にモデルバージョンをピン留めします。

ピン留めなしでは、Claude Code は `fable`、`opus`、`sonnet`、`haiku` などのモデルエイリアスを使用し、各プロバイダーの組み込みデフォルトモデル ID に解決されます。そのデフォルトは最新の Anthropic リリースより遅れる可能性があり、それが指すモデルはまだユーザーのアカウントで有効になっていない可能性があります。デフォルトが利用できない場合、Amazon Bedrock と Google Cloud の Agent Platform ユーザーは通知を見て、そのセッションは以前のバージョンのデフォルトモデルにフォールバックするか、デフォルトが Opus モデルで利用可能な Opus バージョンがない場合はデフォルト Sonnet モデルにフォールバックします。Microsoft Foundry ユーザーはエラーを見ます。Microsoft Foundry には同等のスタートアップチェックがないためです。

初期セットアップの一部として、モデル環境変数を特定のバージョン ID に設定します。ピン留めにより、ユーザーが新しいモデルに移行するタイミングを制御できます。

プロバイダーのバージョン固有のモデル ID を使用して、以下の環境変数を使用します。

| プロバイダー | 例 |
| :- | :- |
| Amazon Bedrock | `export ANTHROPIC_DEFAULT_OPUS_MODEL='us.anthropic.claude-opus-4-8'` |
| Google Cloud の Agent Platform | `export ANTHROPIC_DEFAULT_OPUS_MODEL='claude-opus-4-8'` |
| Microsoft Foundry | `export ANTHROPIC_DEFAULT_OPUS_MODEL='claude-opus-4-8'` |

`ANTHROPIC_DEFAULT_FABLE_MODEL`、`ANTHROPIC_DEFAULT_SONNET_MODEL`、`ANTHROPIC_DEFAULT_HAIKU_MODEL` に同じパターンを適用します。すべてのプロバイダー全体の現在および従来のモデル ID については、[モデル概要](https://platform.claude.com/docs/ja/about-claude/models/overview) を参照してください。ユーザーを新しいモデルバージョンにアップグレードするには、これらの環境変数を更新して再デプロイします。

ピン留めされたモデルの [拡張コンテキスト](#extended-context) を有効にするには、`ANTHROPIC_DEFAULT_OPUS_MODEL` または `ANTHROPIC_DEFAULT_SONNET_MODEL` のモデル ID に `[1m]` を追加します。

```bash
export ANTHROPIC_DEFAULT_OPUS_MODEL='claude-opus-4-8[1m]'
```

`[1m]` サフィックスは、`opus` と `sonnet` エイリアスのすべての使用に 1M コンテキストウィンドウを適用します。これには [`opusplan`](#opusplan-model-setting) の plan-mode Opus フェーズが含まれます。

- Claude Code は、モデル ID をプロバイダーに送信する前にサフィックスを削除します。
- 基盤となるモデルが [1M コンテキストをサポート](https://platform.claude.com/docs/ja/build-with-claude/context-windows#context-window-sizes-by-model) する場合にのみ `[1m]` を追加します。
- サフィックスはモデルごとではなく、変数ごとに読み取られます。Amazon Bedrock、Google Cloud の Agent Platform、Microsoft Foundry では、1 つの変数で `[1m]` なしのモデル ID は、別の変数が同じモデルをサフィックス付きで設定している場合でも、200K コンテキストを使用します。Sonnet 5 は常にこれらのプロバイダーで 1M ウィンドウで実行され、サフィックスは必要ありません。

`availableModels` アローリストは、サードパーティプロバイダーを使用する場合でも適用されます。[サーバー管理設定はそこに配信されません](/ja/server-managed-settings#platform-availability)。フィルタリングは `opus` などのモデルエイリアス、`claude-opus-4-8` などのバージョンプレフィックス、または完全なプロバイダー形式のモデル ID で一致します。`us.anthropic.` などのプロバイダー固有のプレフィックスは削除されないため、特定のモデルを許可するには、ピッカーが表示する同じプロバイダー形式 ID をリストするか、[`modelOverrides`](#override-model-ids-per-version) を通じてマップします。任意の `[1m]` サフィックスはアローリストエントリと要求されたモデルの両方から削除されます。

ピン留めされたモデルの表示と機能のカスタマイズ

サードパーティプロバイダーでモデルをピン留めする場合、プロバイダー固有の ID は `/model` ピッカーにそのまま表示され、Claude Code はモデルがサポートする機能を認識しない可能性があります。ピン留めされた各モデルの表示名と機能を宣言するコンパニオン環境変数でオーバーライドできます。

これらの変数は、Amazon Bedrock、Google Cloud の Agent Platform、Microsoft Foundry などのサードパーティプロバイダーでのみ有効です。`ANTHROPIC_BASE_URL` が [LLM ゲートウェイ](/ja/llm-gateway) を指す場合、`_NAME` と `_DESCRIPTION` 変数も有効です。`api.anthropic.com` に直接接続する場合は効果がありません。

| 環境変数 | 説明 |
| - | - |
| `ANTHROPIC_DEFAULT_OPUS_MODEL_NAME` | `/model` ピッカーでピン留めされた Opus モデルの表示名。設定されていない場合はモデル ID がデフォルト |
| `ANTHROPIC_DEFAULT_OPUS_MODEL_DESCRIPTION` | `/model` ピッカーでピン留めされた Opus モデルの表示説明。設定されていない場合は `Custom Opus model` がデフォルト |
| `ANTHROPIC_DEFAULT_OPUS_MODEL_SUPPORTED_CAPABILITIES` | ピン留めされた Opus モデルがサポートする機能のカンマ区切りリスト |

同じ `_NAME`、`_DESCRIPTION`、`_SUPPORTED_CAPABILITIES` サフィックスは `ANTHROPIC_DEFAULT_SONNET_MODEL`、`ANTHROPIC_DEFAULT_HAIKU_MODEL`、`ANTHROPIC_DEFAULT_FABLE_MODEL`、`ANTHROPIC_CUSTOM_MODEL_OPTION` で利用可能です。

Claude Code は、モデル ID を既知のパターンと照合することで、[努力レベル](#adjust-effort-level) や [拡張思考](#extended-thinking) などの機能を有効にします。Amazon Bedrock ARN やカスタムデプロイメント名などのプロバイダー固有の ID は、これらのパターンと一致しないことが多く、サポートされている機能が無効のままになります。`_SUPPORTED_CAPABILITIES` を設定して、Claude Code にモデルが実際にサポートする機能を伝えます。

| 機能値 | 有効にするもの |
| - | - |
| `effort` | [努力レベル](#adjust-effort-level) と `/effort` コマンド |
| `xhigh_effort` | `xhigh` 努力レベル |
| `max_effort` | `max` 努力レベル |
| `thinking` | [拡張思考](#extended-thinking) |
| `adaptive_thinking` | タスクの複雑さに基づいて思考を動的に割り当てる適応的推論 |
| `interleaved_thinking` | ツール呼び出し間の思考 |

`_SUPPORTED_CAPABILITIES` が設定されている場合、リストされた機能は有効になり、リストされていない機能はマッチングされたピン留めされたモデルに対して無効になります。変数が設定されていない場合、Claude Code はモデル ID に基づいた組み込み検出にフォールバックします。

この例では、Amazon Bedrock カスタムモデル ARN に Opus をピン留めし、フレンドリーな名前を設定し、その機能を宣言します。

```bash
export ANTHROPIC_DEFAULT_OPUS_MODEL='arn:aws:bedrock:us-east-1:123456789012:custom-model/abc'
export ANTHROPIC_DEFAULT_OPUS_MODEL_NAME='Opus via Bedrock'
export ANTHROPIC_DEFAULT_OPUS_MODEL_DESCRIPTION='Opus 4.7 routed through a Bedrock custom endpoint'
export ANTHROPIC_DEFAULT_OPUS_MODEL_SUPPORTED_CAPABILITIES='effort,xhigh_effort,max_effort,thinking,adaptive_thinking,interleaved_thinking'
```

バージョンごとのモデル ID のオーバーライド

上記のファミリーレベルの環境変数は、ファミリーエイリアスごとに 1 つのモデル ID を設定します。同じファミリー内の複数のバージョンを異なるプロバイダー ID にマップする必要がある場合は、代わりに `modelOverrides` 設定を使用します。

`modelOverrides` は個別の Anthropic モデル ID をプロバイダー固有の文字列にマップし、Claude Code がプロバイダーの API に送信します。ユーザーが `/model` ピッカーでマップされたモデルを選択すると、Claude Code は組み込みのデフォルトの代わりに設定された値を使用します。

これにより、エンタープライズ管理者は、ガバナンス、コスト配分、または地域的なルーティングのために、各モデルバージョンを特定の Amazon Bedrock 推論プロファイル ARN、Google Cloud の Agent Platform バージョン名、または Microsoft Foundry デプロイメント名にルーティングできます。

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

オーバーライドは、`/model` ピッカーの各エントリをサポートする組み込みモデル ID を置き換えます。Amazon Bedrock では、`modelOverrides` エントリは Claude Code が起動時に自動的に検出する推論プロファイルより優先されます。Claude Code は、Amazon Bedrock 推論プロファイル ARN や Microsoft Foundry デプロイメント名などのプロバイダーネイティブである値をプロバイダーにそのまま渡します。

オーバーライドは、`--model`、`ANTHROPIC_MODEL` 環境変数、または `ANTHROPIC_DEFAULT_*_MODEL` 環境変数を通じて Anthropic モデル ID を直接渡す場合にも適用されます。Amazon Bedrock、Google Cloud の Agent Platform、[Mantle](/ja/amazon-bedrock#use-the-mantle-endpoint) では、`modelOverrides` エントリのない Anthropic モデル ID は、プロバイダーがそのバージョンをサポートしている場合、`/model` ピッカー行のそのバージョンと同じプロバイダー固有の ID に解決されます。Mantle はバージョンのサブセットをサポートしています。そのサブセット外の Anthropic モデル ID の場合、Claude Code は `modelOverrides` エントリでカバーされていない限り、生の ID を Mantle に送信します。v2.1.200 より前では、`--model` と環境変数の値はオーバーライドマップを通さずにプロバイダーに到達しました。

`modelOverrides` は `availableModels` と一緒に機能します。アローリストは Anthropic モデル ID に対して評価され、オーバーライド値に対してではないため、`availableModels` の `"opus"` などのエントリは、Opus バージョンが ARN にマップされている場合でも一致し続けます。`enforceAvailableModels` が管理設定で設定されている場合、強制されたデフォルトは [最も優先度の高い管理ソース](/ja/server-managed-settings#settings-precedence) からのみ `modelOverrides` を通じて解決されます。推論プロファイル ARN にピン留めされたバージョンなど、管理者のマッピングは強制されたデフォルトで尊重されます。ユーザーまたはプロジェクト設定からのオーバーライドはそれに影響しません。

`availableModels` が [管理設定](/ja/settings#settings-files) で設定されている場合、`--model` または上記の環境変数を通じて直接渡された Anthropic モデル ID には、その管理ソースからの `modelOverrides` のみが適用されます。Claude Code はユーザーまたはプロジェクト設定のオーバーライドをそれらの ID に対して無視し、管理リストが除外する ID を任意の設定ソースからの `modelOverrides` を通じて解決することはありません。この管理ソース制限には Claude Code v2.1.200 以降が必要です。ブロックされた ID がどのように処理されるかについては、[モデル選択の制限](#restrict-model-selection) を参照してください。

プロンプトキャッシング設定

Claude Code は [プロンプトキャッシング](/ja/prompt-caching) を自動的に使用してパフォーマンスを最適化し、コストを削減します。プロンプトキャッシングをグローバルに、または特定のモデルティアに対して無効にできます。

| 環境変数 | 説明 |
| - | - |
| `DISABLE_PROMPT_CACHING` | `1` に設定して、すべてのモデルのプロンプトキャッシングを無効にします。モデル固有の設定より優先されます |
| `DISABLE_PROMPT_CACHING_HAIKU` | `1` に設定して、Haiku モデルのみのプロンプトキャッシングを無効にします |
| `DISABLE_PROMPT_CACHING_SONNET` | `1` に設定して、Sonnet モデルのみのプロンプトキャッシングを無効にします |
| `DISABLE_PROMPT_CACHING_OPUS` | `1` に設定して、Opus モデルのみのプロンプトキャッシングを無効にします |
| `DISABLE_PROMPT_CACHING_FABLE` | `1` に設定して、Fable モデルのみのプロンプトキャッシングを無効にします |

キャッシュ TTL を変更する方法、またはキャッシュミスをトリガーするものについて詳しくは、[Claude Code がプロンプトキャッシングを使用する方法](/ja/prompt-caching) を参照してください。
