---
title: amazon-bedrock
source: https://code.claude.com/docs/ja/amazon-bedrock.md
---

# Amazon Bedrock 上の Claude Code

> Amazon Bedrock を通じた Claude Code の設定方法（セットアップ、IAM 設定、トラブルシューティングを含む）について学習します。

.dark .cc-cs {
  --cs-slate: #f0eee6;
  --cs-gray-000: #262624;
  --cs-gray-700: #bfbdb4;
  --cs-border-default: rgba(240, 238, 230, 0.14);
}
.cc-cs-card {
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px; padding: 14px 16px; margin: 0;
  background: var(--cs-gray-000); border: 0.5px solid var(--cs-border-default);
  border-radius: 8px; flex-wrap: wrap;
}
.cc-cs-text { font-size: 13px; color: var(--cs-gray-700); line-height: 1.5; flex: 1; min-width: 240px; }
.cc-cs-text strong { font-weight: 550; color: var(--cs-slate); }
.cc-cs-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.cc-cs-btn-clay {
  display: inline-flex; align-items: center; gap: 8px;
  background: var(--cs-clay-deep); color: #fff; border: none;
  border-radius: 8px; padding: 8px 14px;
  font-size: 13px; font-weight: 500;
  transition: background-color 0.15s; white-space: nowrap;
}
.cc-cs-btn-clay:hover { background: var(--cs-clay); }
.cc-cs-btn-ghost {
  display: inline-flex; align-items: center; gap: 8px;
  background: transparent; color: var(--cs-gray-700);
  border: 0.5px solid var(--cs-border-default);
  border-radius: 8px; padding: 8px 14px;
  font-size: 13px; font-weight: 500;
}
.cc-cs-btn-ghost:hover { background: rgba(0, 0, 0, 0.04); }
.dark .cc-cs-btn-ghost:hover { background: rgba(255, 255, 255, 0.04); }
@media (max-width: 720px) {
  .cc-cs-actions { width: 100%; }
}
`;
  return <div className="cc-cs not-prose">
      <style>{STYLES}</style>
      <div className="cc-cs-card">
        <div className="cc-cs-text">
          <strong>Deploying Claude Code across your organization?</strong> Talk to sales about enterprise plans, SSO, and centralized billing.
        </div>
        <div className="cc-cs-actions">
          <a href={`https://claude.com/pricing?${utm('view_plans')}#plans-business`} className="cc-cs-btn-ghost">
            View plans
          </a>
          <a href={`https://claude.com/contact-sales?${utm('contact_sales')}`} className="cc-cs-btn-clay">
            Contact sales {iconArrowRight()}
          </a>
        </div>
      </div>
    </div>;
};

<ContactSalesCard surface="bedrock" />

<h2 id="prerequisites">
  前提条件
</h2>

Claude Code を Bedrock で設定する前に、以下を確認してください。

* Bedrock アクセスが有効になっている AWS アカウント
* Bedrock で目的の Claude モデル（例：Claude Sonnet 4.6）へのアクセス
* AWS CLI がインストールされ、設定されていること（オプション - 認証情報を取得する別のメカニズムがない場合のみ必要）
* 適切な IAM 権限

Bedrock 認証情報を使用してサインインするには、以下の [Bedrock でサインイン](#sign-in-with-bedrock)に従ってください。チーム全体に Claude Code をデプロイするには、[手動でセットアップ](#set-up-manually)の手順を使用し、ロールアウト前に[モデルバージョンをピン留め](#4-pin-model-versions)してください。

<h2 id="sign-in-with-bedrock">
  Bedrock でサインイン
</h2>

AWS 認証情報を持っていて、Bedrock を通じて Claude Code の使用を開始したい場合、ログインウィザードがそれをガイドします。AWS 側の前提条件はアカウントごとに 1 回完了します。ウィザードは Claude Code 側を処理します。

<Steps>
  <Step title="AWS アカウントで Anthropic モデルを有効にする">
    [Amazon Bedrock コンソール](https://console.aws.amazon.com/bedrock/)で、モデルカタログを開き、Anthropic モデルを選択して、ユースケースフォームを送信します。送信直後にアクセスが付与されます。AWS Organizations については[ユースケースの詳細を送信](#1-submit-use-case-details)を、権限については [IAM 設定](#iam-configuration)を参照してください。
  </Step>

  <Step title="Claude Code を開始して Bedrock を選択する">
    `claude` を実行します。ログインプロンプトで、**3rd-party platform**、次に **Amazon Bedrock** を選択します。
  </Step>

  <Step title="ウィザードプロンプトに従う">
    AWS に認証する方法を選択します。`~/.aws` ディレクトリから検出された AWS プロファイル、Bedrock API キー、アクセスキーとシークレット、または環境内に既にある認証情報です。ウィザードはリージョンを取得し、アカウントが呼び出せる Claude モデルを確認し、それらをピン留めできます。結果は [user settings file](/ja/settings) の `env` ブロックに保存されるため、環境変数を自分でエクスポートする必要はありません。
  </Step>
</Steps>

サインイン後、いつでも `/setup-bedrock` を実行してウィザードを再度開き、認証情報、リージョン、またはモデルピンを変更できます。

<h2 id="set-up-manually">
  手動でセットアップ
</h2>

ウィザードの代わりに環境変数を通じて Bedrock を設定するには、例えば CI またはスクリプト化されたエンタープライズロールアウトで、以下の手順に従ってください。

<h3 id="1-submit-use-case-details">
  1. ユースケースの詳細を送信
</h3>

Anthropic モデルの初回ユーザーは、モデルを呼び出す前にユースケースの詳細を送信する必要があります。これは AWS アカウントごとに 1 回行われます。

1. 以下で説明する適切な IAM 権限があることを確認してください
2. [Amazon Bedrock コンソール](https://console.aws.amazon.com/bedrock/)に移動します
3. **モデルカタログ**から Anthropic モデルを選択します
4. ユースケースフォームを完成させます。送信直後にアクセスが付与されます。

AWS Organizations を使用する場合、[`PutUseCaseForModelAccess` API](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_PutUseCaseForModelAccess.html) を使用して管理アカウントからフォームを 1 回送信できます。この呼び出しには `bedrock:PutUseCaseForModelAccess` IAM 権限が必要です。承認は子アカウントに自動的に拡張されます。

<h3 id="2-configure-aws-credentials">
  2. AWS 認証情報を設定
</h3>

Claude Code は、デフォルトの AWS SDK 認証情報チェーンを使用します。以下のいずれかの方法を使用して認証情報を設定してください。

**オプション A：AWS CLI 設定**

```bash
aws configure
```

**オプション B：環境変数（アクセスキー）**

```bash
export AWS_ACCESS_KEY_ID=your-access-key-id
export AWS_SECRET_ACCESS_KEY=your-secret-access-key
export AWS_SESSION_TOKEN=your-session-token
```

**オプション C：環境変数（SSO プロファイル）**

```bash
aws sso login --profile=<your-profile-name>

export AWS_PROFILE=your-profile-name
```

**オプション D：AWS Management Console 認証情報**

```bash
aws login
```

`aws login` について[詳しく学習](https://docs.aws.amazon.com/signin/latest/userguide/command-line-sign-in.html)してください。

**オプション E：Bedrock API キー**

```bash
export AWS_BEARER_TOKEN_BEDROCK=your-bedrock-api-key
```

Bedrock API キーは、完全な AWS 認証情報を必要としない、より簡単な認証方法を提供します。[Bedrock API キーについて詳しく学習](https://aws.amazon.com/blogs/machine-learning/accelerate-ai-development-with-amazon-bedrock-api-keys/)してください。

<h4 id="advanced-credential-configuration">
  高度な認証情報設定
</h4>

Claude Code は、AWS SSO および企業 ID プロバイダーの自動認証情報更新をサポートしています。これらの設定を Claude Code 設定ファイルに追加してください（ファイルの場所については [Settings](/ja/settings) を参照）。

これら 2 つの設定には異なるトリガー条件があります。

* **`awsAuthRefresh`**：Claude Code がローカルのタイムスタンプに基づくか、API が認証情報エラーを返した場合に AWS 認証情報の有効期限が切れていることを検出した場合にのみ実行され、更新された認証情報でリクエストを再試行します。
* **`awsCredentialExport`**：セッション開始時および各認証情報リロード時に実行されます。AWS デフォルト認証情報プロバイダーチェーン内の認証情報がまだ有効な場合でも実行されます。Bedrock アカウントがデフォルトプロバイダーチェーンが解決するものと異なるクロスアカウント認証情報を必要とする場合に使用します。

<h5 id="example-configuration">
  設定例
</h5>

```json
{
  "awsAuthRefresh": "aws sso login --profile myprofile",
  "env": {
    "AWS_PROFILE": "myprofile"
  }
}
```

<h5 id="configuration-settings-explained">
  設定の説明
</h5>

**`awsAuthRefresh`**：`.aws` ディレクトリを変更するコマンド（認証情報、SSO キャッシュ、または設定ファイルの更新など）に使用します。コマンドの出力はユーザーに表示されますが、対話的な入力はサポートされていません。これは、CLI が URL またはコードを表示し、ブラウザで認証を完了するブラウザベースの SSO フローに適しています。

**`awsCredentialExport`**：`.aws` を変更できず、認証情報を直接返す必要がある場合にのみ使用します。このコマンドは、認証情報の有効期限が切れた場合だけでなく、認証情報をリフレッシュする必要があるたびに実行されます。出力はサイレントにキャプチャされ、ユーザーに表示されません。コマンドは次の形式で JSON を出力する必要があります。

```json
{
  "Credentials": {
    "AccessKeyId": "value",
    "SecretAccessKey": "value",
    "SessionToken": "value",
    "Expiration": "2026-01-01T00:00:00Z"
  }
}
```

{/* min-version: 2.1.181 */}`aws configure export-credentials --format process` からのフラット出力も受け入れられます。`Credentials` の下にネストされるのではなく、同じキーがトップレベルにあります。

`Expiration` はオプションです。{/* min-version: 2.1.176 */}Claude Code v2.1.176 以降では、コマンドが有効な ISO 8601 `Expiration` を返す場合、Claude Code はその時刻の 5 分前までの認証情報をキャッシュします。それがない場合、または以前のバージョンでは、認証情報は 1 時間キャッシュされます。

<h3 id="3-configure-claude-code">
  3. Claude Code を設定
</h3>

Bedrock を有効にするために、以下の環境変数を設定します。

```bash
# Bedrock 統合を有効にする
export CLAUDE_CODE_USE_BEDROCK=1
export AWS_REGION=us-east-1  # AWS プロファイルがすでにリージョンを設定している場合はオプション

# オプション：小型/高速モデル（Bedrock および Mantle）の AWS リージョンをオーバーライド
# Bedrock では、ANTHROPIC_DEFAULT_HAIKU_MODEL
# または非推奨の ANTHROPIC_SMALL_FAST_MODEL が設定されていない場合、効果がありません。
export ANTHROPIC_SMALL_FAST_MODEL_AWS_REGION=us-west-2

# オプション：カスタムエンドポイントまたはゲートウェイ用に Bedrock エンドポイント URL をオーバーライド
# export ANTHROPIC_BEDROCK_BASE_URL=https://bedrock-runtime.us-east-1.amazonaws.com
```

Claude Code で Bedrock を有効にする場合は、以下に注意してください。

* {/* min-version: 2.1.172 */}v2.1.172 以降では、AWS プロファイルのリージョンをオーバーライドする場合、またはプロファイルにリージョンがない場合にのみ `AWS_REGION` を設定する必要があります。Claude Code はこの順序でリージョンを解決します。

  * `AWS_REGION`
  * `AWS_DEFAULT_REGION`
  * AWS 共有認証情報ファイルから最初に読み込まれ、次に共有設定ファイルから読み込まれた、アクティブな AWS プロファイルに設定されたリージョン（AWS SDK の優先順位と一致）
  * `us-east-1`

  アクティブなプロファイルは、設定されている場合は `AWS_PROFILE`、そうでない場合は `default` です。`AWS_SHARED_CREDENTIALS_FILE` または `AWS_CONFIG_FILE` を設定して、デフォルト以外のファイルパスを指定します。`/status` を実行して、解決されたリージョンを確認します。リージョンが AWS 設定ファイルまたはデフォルトフォールバックから取得された場合、`/status` はソースも記載します。v2.1.171 以前では、Claude Code は AWS 設定ファイルを読み込まないため、`AWS_REGION` を明示的に設定してください。
* Bedrock を使用する場合、`/logout` コマンドは無効になります。認証は AWS 認証情報を通じて処理されるためです。
* WebSearch ツールは Bedrock では利用できません。[WebSearch ツールの動作](/ja/tools-reference#websearch-tool-behavior)を参照してください。
* 他のプロセスに漏らしたくない `AWS_PROFILE` などの環境変数に設定ファイルを使用できます。詳細については [Settings](/ja/settings) を参照してください。

<h3 id="4-pin-model-versions">
  4. モデルバージョンをピン留め
</h3>

<Warning>
  複数のユーザーにデプロイする場合は、特定のモデルバージョンをピン留めしてください。ピン留めなしでは、`sonnet` や `opus` などのモデルエイリアスは Claude Code の Bedrock 用の組み込みデフォルトに解決されます。これは最新リリースより遅れる可能性があり、アカウントでまだ利用できない場合があります。Claude Code は、デフォルトが利用できない場合、スタートアップで[前のバージョンにフォールバック](#startup-model-checks)しますが、ピン留めするとユーザーが新しいモデルに移行するタイミングを制御できます。
</Warning>

これらの環境変数を特定の Bedrock モデル ID に設定します。

`ANTHROPIC_DEFAULT_OPUS_MODEL` なしでは、Bedrock の `opus` エイリアスは Opus 4.6 に解決されます。最新モデルを使用するには、Opus 4.8 ID に設定します。

```bash
export ANTHROPIC_DEFAULT_OPUS_MODEL='us.anthropic.claude-opus-4-8'
export ANTHROPIC_DEFAULT_SONNET_MODEL='us.anthropic.claude-sonnet-4-6'
export ANTHROPIC_DEFAULT_HAIKU_MODEL='us.anthropic.claude-haiku-4-5-20251001-v1:0'
```

これらの変数は、クロスリージョン推論プロファイル ID（`us.` プレフィックス付き）を使用します。別のリージョンプレフィックスまたはアプリケーション推論プロファイルを使用する場合は、それに応じて調整してください。AWS GovCloud リージョンでは、`us-gov.` プレフィックスを使用します。現在および従来のモデル ID については、[Models overview](https://platform.claude.com/docs/en/about-claude/models/overview) を参照してください。環境変数の完全なリストについては、[Model configuration](/ja/model-config#pin-models-for-third-party-deployments) を参照してください。

ピン留め変数が設定されていない場合、Claude Code はこれらのデフォルトモデルを使用します。

| モデルタイプ   | デフォルト値                                         |
| :------- | :--------------------------------------------- |
| プライマリモデル | `us.anthropic.claude-sonnet-4-5-20250929-v1:0` |
| 小型/高速モデル | プライマリモデルと同じ                                    |

セッションタイトル生成などのバックグラウンドタスクは、小型/高速モデル（通常は Haiku クラスモデル）を使用します。Bedrock では、すべてのアカウントまたはリージョンで Haiku が有効になっていない可能性があるため、Claude Code はこれをプライマリモデルにデフォルト設定します。バックグラウンドタスクに Haiku を使用するには、`ANTHROPIC_DEFAULT_HAIKU_MODEL` をアカウントで利用可能なモデル ID に設定してください。

モデルをさらにカスタマイズするには、以下のいずれかの方法を使用します。

```bash
# 推論プロファイル ID を使用
export ANTHROPIC_MODEL='us.anthropic.claude-sonnet-4-6'
export ANTHROPIC_DEFAULT_HAIKU_MODEL='us.anthropic.claude-haiku-4-5-20251001-v1:0'

# アプリケーション推論プロファイル ARN を使用
export ANTHROPIC_MODEL='arn:aws:bedrock:us-east-2:your-account-id:application-inference-profile/your-model-id'

# オプション：必要に応じてプロンプトキャッシングを無効にする
export DISABLE_PROMPT_CACHING=1

# オプション：デフォルトの 5 分の代わりに 1 時間のプロンプトキャッシュ TTL をリクエスト
export ENABLE_PROMPT_CACHING_1H=1
```

1 時間のキャッシュ TTL は、5 分のデフォルトよりも高いレートで課金されます。[キャッシュライフタイム](/ja/prompt-caching#cache-lifetime)を参照してください。

<Note>プロンプトキャッシングは、すべての Bedrock リージョンで利用できない場合があります。キャッシュトークンカウントがゼロのままの場合は、Bedrock ドキュメントの[サポートされているモデル、リージョン、および制限](https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html#prompt-caching-models)を確認してください。</Note>

<h4 id="map-each-model-version-to-an-inference-profile">
  各モデルバージョンを推論プロファイルにマップ
</h4>

`ANTHROPIC_DEFAULT_*_MODEL` 環境変数は、モデルファミリーごとに 1 つの推論プロファイルを設定します。組織が同じファミリーの複数のバージョンを `/model` ピッカーで公開し、それぞれを独自のアプリケーション推論プロファイル ARN にルーティングする必要がある場合は、代わりに [settings file](/ja/settings#settings-files) の `modelOverrides` 設定を使用してください。

この例は、4 つの Opus バージョンを異なる ARN にマップするため、ユーザーは組織の推論プロファイルをバイパスすることなく、それらを切り替えることができます。

```json
{
  "modelOverrides": {
    "claude-opus-4-7": "arn:aws:bedrock:us-east-2:123456789012:application-inference-profile/opus-47-prod",
    "claude-opus-4-6": "arn:aws:bedrock:us-east-2:123456789012:application-inference-profile/opus-46-prod",
    "claude-opus-4-5-20251101": "arn:aws:bedrock:us-east-2:123456789012:application-inference-profile/opus-45-prod",
    "claude-opus-4-1-20250805": "arn:aws:bedrock:us-east-2:123456789012:application-inference-profile/opus-41-prod"
  }
}
```

ユーザーが `/model` でこれらのバージョンのいずれかを選択すると、Claude Code はマップされた ARN で Bedrock を呼び出します。オーバーライドのないバージョンは、組み込みの Bedrock モデル ID またはスタートアップで検出された一致する推論プロファイルにフォールバックします。オーバーライドが `availableModels` および他のモデル設定とどのように相互作用するかについては、[Override model IDs per version](/ja/model-config#override-model-ids-per-version) を参照してください。

<h2 id="startup-model-checks">
  スタートアップモデルチェック
</h2>

Claude Code が Bedrock で設定されて起動すると、使用するモデルがアカウントでアクセス可能であることを確認します。このチェックには Claude Code v2.1.94 以降が必要です。

現在の Claude Code デフォルトより古いモデルバージョンをピン留めしていて、アカウントが新しいバージョンを呼び出せる場合、Claude Code はピンを更新するよう促します。受け入れると、新しいモデル ID が [user settings file](/ja/settings) に書き込まれ、Claude Code が再起動されます。拒否すると、次のデフォルトバージョン変更まで記憶されます。[アプリケーション推論プロファイル ARN](#map-each-model-version-to-an-inference-profile)を指す PIN は、管理者によって管理されるため、スキップされます。

モデルをピン留めしていなくて、現在のデフォルトがアカウントで利用できない場合、Claude Code は現在のセッションで前のバージョンにフォールバックし、通知を表示します。フォールバックは永続化されません。Bedrock アカウントで新しいモデルを有効にするか、[バージョンをピン留め](#4-pin-model-versions)して選択を永続化してください。

<h2 id="iam-configuration">
  IAM 設定
</h2>

Claude Code に必要な権限を持つ IAM ポリシーを作成します。

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowModelAndInferenceProfileAccess",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream",
        "bedrock:ListInferenceProfiles",
        "bedrock:GetInferenceProfile"
      ],
      "Resource": [
        "arn:aws:bedrock:*:*:inference-profile/*",
        "arn:aws:bedrock:*:*:application-inference-profile/*",
        "arn:aws:bedrock:*:*:foundation-model/*"
      ]
    },
    {
      "Sid": "AllowMarketplaceSubscription",
      "Effect": "Allow",
      "Action": [
        "aws-marketplace:ViewSubscriptions",
        "aws-marketplace:Subscribe"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "aws:CalledViaLast": "bedrock.amazonaws.com"
        }
      }
    }
  ]
}
```

より制限的な権限の場合は、リソースを特定の推論プロファイル ARN に制限できます。

`bedrock:GetInferenceProfile` により、Claude Code は[アプリケーション推論プロファイル ARN](#map-each-model-version-to-an-inference-profile)をそのバッキング基盤モデルに解決でき、そのモデルに対して正しいリクエスト形状を選択するために使用されます。

トークンにこの権限がない場合、Claude Code は代替形状で 1 回再試行することで自動的に復旧するため、リクエストは成功しますが、新しいモデルが追加されるたびに追加のラウンドトリップが発生します。権限を付与することで再試行を回避できます。これは `AWS_BEARER_TOKEN_BEDROCK` デプロイメントに最も頻繁に適用され、トークンのポリシーは通常、完全な IAM ロールよりも狭くなります。

詳細については、[Bedrock IAM documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/security-iam.html)を参照してください。

<Note>
  コスト追跡とアクセス制御を簡素化するために、Claude Code 用の専用 AWS アカウントを作成してください。
</Note>

<h2 id="1m-token-context-window">
  1M トークンコンテキストウィンドウ
</h2>

Claude Sonnet 5、Opus 4.6 以降、および Sonnet 4.6 は、Amazon Bedrock で [1M トークンコンテキストウィンドウ](https://platform.claude.com/docs/ja/build-with-claude/context-windows#1m-token-context-window)をサポートしています。Sonnet 5 は [Mantle エンドポイント](#use-the-mantle-endpoint)を通じて提供され、常に 1M ウィンドウで実行されます。選択する `[1m]` バリアントはありません。その他のモデルについては、Claude Code は 1M モデルバリアントを選択すると、拡張コンテキストウィンドウを自動的に有効にします。

[セットアップウィザード](#sign-in-with-bedrock)は、モデルをピン留めするときに 1M コンテキストオプションを提供します。手動でピン留めされたモデルの代わりに有効にするには、モデル ID に `[1m]` を追加します。詳細については、[サードパーティデプロイメント用のモデルをピン留めする](/ja/model-config#pin-models-for-third-party-deployments)を参照してください。

<h2 id="service-tiers">
  サービスティア
</h2>

[Amazon Bedrock サービスティア](https://docs.aws.amazon.com/bedrock/latest/userguide/service-tiers-inference.html)を使用すると、コストとレイテンシーのトレードオフを行うことができます。`ANTHROPIC_BEDROCK_SERVICE_TIER` を `default`、`flex`、または `priority` に設定します。

```bash
export ANTHROPIC_BEDROCK_SERVICE_TIER=priority
```

Claude Code は、各リクエストで `X-Amzn-Bedrock-Service-Tier` ヘッダーとしてこれを送信します。ティアの可用性はモデルとリージョンによって異なります。予約容量は、この設定の代わりに[プロビジョニングされたスループット](https://docs.aws.amazon.com/bedrock/latest/userguide/prov-throughput.html) ARN をモデル ID として使用します。

<h2 id="aws-guardrails">
  AWS Guardrails
</h2>

[Amazon Bedrock Guardrails](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails.html)を使用すると、Claude Code のコンテンツフィルタリングを実装できます。[Amazon Bedrock コンソール](https://console.aws.amazon.com/bedrock/)で Guardrail を作成し、バージョンを公開してから、Guardrail ヘッダーを [settings file](/ja/settings) に追加します。クロスリージョン推論プロファイルを使用している場合は、Guardrail でクロスリージョン推論を有効にしてください。

設定例：

```json
{
  "env": {
    "ANTHROPIC_CUSTOM_HEADERS": "X-Amzn-Bedrock-GuardrailIdentifier: your-guardrail-id\nX-Amzn-Bedrock-GuardrailVersion: 1"
  }
}
```

<h2 id="use-the-mantle-endpoint">
  Mantle エンドポイントを使用する
</h2>

Mantle は、Bedrock Invoke API ではなく、ネイティブ Anthropic API シェイプを通じて Claude モデルを提供する Amazon Bedrock エンドポイントです。同じ AWS 認証情報、IAM 権限、および `awsAuthRefresh` 設定を使用します。このページで前述したものです。

<Note>
  Mantle には Claude Code v2.1.94 以降が必要です。確認するには `claude --version` を実行してください。
</Note>

<h3 id="enable-mantle">
  Mantle を有効にする
</h3>

AWS 認証情報が既に設定されている場合、`CLAUDE_CODE_USE_MANTLE` を設定して、リクエストを Mantle エンドポイントにルーティングします。

```bash
export CLAUDE_CODE_USE_MANTLE=1
export AWS_REGION=us-east-1
```

Claude Code は AWS リージョンからエンドポイント URL を構築します。{/* min-version: 2.1.172 */}v2.1.172 以降では、リージョンは [上記の Bedrock](#3-configure-claude-code) と同じ優先順位で解決されます。以前のバージョンは `AWS_REGION` のみを使用します。カスタムエンドポイントまたはゲートウェイの URL をオーバーライドするには、`ANTHROPIC_BEDROCK_MANTLE_BASE_URL` を設定します。

Claude Code 内で `/status` を実行して確認します。Mantle がアクティブな場合、プロバイダー行は `Amazon Bedrock (Mantle)` を表示します。

<h3 id="select-a-mantle-model">
  Mantle モデルを選択する
</h3>

Mantle は `anthropic.` で始まり、バージョンサフィックスのないモデル ID を使用します。例えば `anthropic.claude-sonnet-5` または `anthropic.claude-haiku-4-5` です。アカウントで利用可能なモデルは、組織に付与されたものに依存します。追加のモデル ID は AWS からのオンボーディング資料に記載されています。AWS アカウントチームに連絡して、許可リストされたモデルへのアクセスをリクエストしてください。

`--model` フラグまたは Claude Code 内の `/model` でモデルを設定します。

```bash
claude --model anthropic.claude-haiku-4-5
```

<h3 id="run-mantle-alongside-the-invoke-api">
  Mantle を Invoke API と並行して実行する
</h3>

Mantle で利用可能なモデルは、今日使用するすべてのモデルを含まない場合があります。`CLAUDE_CODE_USE_BEDROCK` と `CLAUDE_CODE_USE_MANTLE` の両方を設定すると、Claude Code は同じセッションから両方のエンドポイントを呼び出せます。Mantle 形式に一致するモデル ID は Mantle にルーティングされ、他のすべてのモデル ID は Bedrock Invoke API に移動します。

```bash
export CLAUDE_CODE_USE_BEDROCK=1
export CLAUDE_CODE_USE_MANTLE=1
```

Mantle モデルを `/model` ピッカーに表示するには、[settings file](/ja/settings) の `availableModels` にその ID をリストします。この設定はピッカーをリストされたエントリに制限するため、保持したいバージョンのバージョンプレフィックスまたは完全な ID もリストします。Mantle ID と `haiku` エイリアスは同じモデルファミリーに解決されるため、マージはより具体的なエントリのみを保持します。[Merge behavior](/ja/model-config#merge-behavior) を参照してください。

```json
{
  "availableModels": ["opus", "sonnet", "claude-haiku-4-5", "anthropic.claude-haiku-4-5"]
}
```

`anthropic.` プレフィックス付きのエントリはカスタムピッカーオプションとして追加され、Mantle にルーティングされます。`anthropic.claude-haiku-4-5` をアカウントに付与されたモデル ID に置き換えます。`availableModels` が他のモデル設定とどのように相互作用するかについては、[Restrict model selection](/ja/model-config#restrict-model-selection) を参照してください。

両方のプロバイダーがアクティブな場合、`/status` は `Amazon Bedrock + Amazon Bedrock (Mantle)` を表示します。

<h3 id="route-mantle-through-a-gateway">
  Mantle をゲートウェイ経由でルーティングする
</h3>

組織がモデルトラフィックを集中化された [LLM gateway](/ja/llm-gateway) を通じてルーティングし、AWS 認証情報をサーバー側に注入する場合、クライアント側認証を無効にして、Claude Code が SigV4 署名または `x-api-key` ヘッダーなしでリクエストを送信するようにします。

```bash
export CLAUDE_CODE_USE_MANTLE=1
export CLAUDE_CODE_SKIP_MANTLE_AUTH=1
export ANTHROPIC_BEDROCK_MANTLE_BASE_URL=https://your-gateway.example.com
```

<h3 id="mantle-environment-variables">
  Mantle 環境変数
</h3>

これらの変数は Mantle エンドポイントに固有です。完全なリストについては、[Environment variables](/ja/env-vars) を参照してください。

| 変数                                      | 目的                                           |
| :-------------------------------------- | :------------------------------------------- |
| `CLAUDE_CODE_USE_MANTLE`                | Mantle エンドポイントを有効にします。`1` または `true` に設定します。 |
| `ANTHROPIC_BEDROCK_MANTLE_BASE_URL`     | デフォルト Mantle エンドポイント URL をオーバーライド            |
| `CLAUDE_CODE_SKIP_MANTLE_AUTH`          | プロキシセットアップのクライアント側認証をスキップ                    |
| `ANTHROPIC_SMALL_FAST_MODEL_AWS_REGION` | Haiku クラスモデルの AWS リージョンをオーバーライド（Bedrock と共有） |

<h2 id="troubleshooting">
  トラブルシューティング
</h2>

<h3 id="authentication-loop-with-sso-and-corporate-proxies">
  SSO と企業プロキシでの認証ループ
</h3>

AWS SSO を使用する場合にブラウザタブが繰り返し生成される場合は、[settings file](/ja/settings) から `awsAuthRefresh` 設定を削除してください。これは、企業 VPN または TLS 検査プロキシが SSO ブラウザフローを中断した場合に発生する可能性があります。Claude Code は中断された接続を認証失敗として扱い、`awsAuthRefresh` を再実行し、無限ループします。

ネットワーク環境が自動ブラウザベースの SSO フローに干渉する場合は、`awsAuthRefresh` に依存する代わりに、Claude Code を開始する前に手動で `aws sso login` を使用してください。

<h3 id="region-issues">
  リージョンの問題
</h3>

リージョンの問題が発生した場合：

* モデルの可用性を確認：`aws bedrock list-inference-profiles --region your-region`
* サポートされているリージョンに切り替え：`export AWS_REGION=us-east-1`
* クロスリージョンアクセスに推論プロファイルの使用を検討

「on-demand throughput isn't supported」エラーが表示される場合：

* モデルを [inference profile](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-support.html) ID として指定します

Claude Code は Bedrock [Invoke API](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_InvokeModelWithResponseStream.html) を使用し、Converse API はサポートしていません。

<h3 id="zero-token-counts-in-/context">
  /context でのゼロトークンカウント
</h3>

`/context` コマンドは、ツールスキーマを Bedrock count-tokens API に送信することで、各ツールグループのトークンをカウントします。{/* min-version: 2.1.196 */}Claude Code v2.1.196 より前のバージョンでは、スキーマが count-tokens API が受け入れないフィールドを含んでいたため、Bedrock がそのリクエストを拒否し、すべてのツールグループが 0 トークンを表示していました。メッセージやメモリファイルなど、内訳の他の行は影響を受けません。

v2.1.196 以降に更新してください。

<h3 id="mantle-endpoint-errors">
  Mantle エンドポイントエラー
</h3>

`CLAUDE_CODE_USE_MANTLE` を設定した後、`/status` が `Amazon Bedrock (Mantle)` を表示しない場合、変数がプロセスに到達していません。Claude Code を起動したシェルでエクスポートされているか、[settings file](/ja/settings) の `env` ブロックで設定されていることを確認してください。

有効な認証情報を持つ Mantle エンドポイントからの `403` は、AWS アカウントがリクエストしたモデルへのアクセスを許可されていないことを意味します。AWS アカウントチームに連絡してアクセスをリクエストしてください。

モデル ID を名前付ける `400` は、そのモデルが Mantle で提供されていないことを意味します。Mantle は標準 Bedrock カタログとは別の独自のモデルラインアップを持っているため、`us.anthropic.claude-sonnet-4-6` などの推論プロファイル ID は機能しません。Mantle 形式の ID を使用するか、[両方のエンドポイントを有効にして](#run-mantle-alongside-the-invoke-api)、Claude Code が各リクエストをモデルが利用可能なエンドポイントにルーティングするようにしてください。

<h2 id="additional-resources">
  追加リソース
</h2>

* [Bedrock documentation](https://docs.aws.amazon.com/bedrock/)
* [Bedrock pricing](https://aws.amazon.com/bedrock/pricing/)
* [Bedrock inference profiles](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-support.html)
* [Bedrock token burndown and quotas](https://docs.aws.amazon.com/bedrock/latest/userguide/quotas-token-burndown.html)
* [Claude Code on Amazon Bedrock: Quick Setup Guide](https://community.aws/content/2tXkZKrZzlrlu0KfH8gST5Dkppq/claude-code-on-amazon-bedrock-quick-setup-guide)
* [Claude Code Monitoring Implementation (Bedrock)](https://github.com/aws-solutions-library-samples/guidance-for-claude-code-with-amazon-bedrock/blob/main/assets/docs/MONITORING.md)
