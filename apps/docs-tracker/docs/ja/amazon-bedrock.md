---
title: amazon-bedrock
source: https://code.claude.com/docs/ja/amazon-bedrock.md
---

# Amazon Bedrock 上の Claude Code

> Amazon Bedrock を通じた Claude Code の設定方法（セットアップ、IAM 設定、トラブルシューティングを含む）について学習します。

## 前提条件

Claude Code を Bedrock で設定する前に、以下を確認してください。

- Bedrock アクセスが有効になっている AWS アカウント
- Bedrock で目的の Claude モデル（例：Claude Sonnet 4.6）へのアクセス
- AWS CLI がインストールされ、設定されていること（オプション - 認証情報を取得する別のメカニズムがない場合のみ必要）
- 適切な IAM 権限

Claude Code を複数のユーザーにデプロイする場合は、[モデルバージョンをピン留めして](#4-pin-model-versions)、Anthropic が新しいモデルをリリースしたときの破損を防いでください。

## セットアップ

### 1. ユースケースの詳細を送信

Anthropic モデルの初回ユーザーは、モデルを呼び出す前にユースケースの詳細を送信する必要があります。これはアカウントごとに 1 回行われます。

1. 適切な IAM 権限があることを確認してください（以下を参照）
2. [Amazon Bedrock コンソール](https://console.aws.amazon.com/bedrock/)に移動します
3. **Chat/Text playground** を選択します
4. Anthropic モデルを選択すると、ユースケースフォームの入力を求められます

### 2. AWS 認証情報を設定

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

#### 高度な認証情報設定

Claude Code は、AWS SSO および企業 ID プロバイダーの自動認証情報更新をサポートしています。これらの設定を Claude Code 設定ファイルに追加してください（ファイルの場所については [Settings](/ja/settings) を参照）。

Claude Code が AWS 認証情報の有効期限が切れていることを検出した場合（ローカルのタイムスタンプに基づくか、Bedrock が認証情報エラーを返した場合）、設定された `awsAuthRefresh` および/または `awsCredentialExport` コマンドを自動的に実行して、リクエストを再試行する前に新しい認証情報を取得します。

##### 設定例

```json
{
  "awsAuthRefresh": "aws sso login --profile myprofile",
  "env": {
    "AWS_PROFILE": "myprofile"
  }
}
```

##### 設定の説明

**`awsAuthRefresh`**：`.aws` ディレクトリを変更するコマンド（認証情報、SSO キャッシュ、または設定ファイルの更新など）に使用します。コマンドの出力はユーザーに表示されますが、対話的な入力はサポートされていません。これは、CLI が URL またはコードを表示し、ブラウザで認証を完了するブラウザベースの SSO フローに適しています。

**`awsCredentialExport`**：`.aws` を変更できず、認証情報を直接返す必要がある場合にのみ使用します。出力はサイレントにキャプチャされ、ユーザーに表示されません。コマンドは次の形式で JSON を出力する必要があります。

```json
{
  "Credentials": {
    "AccessKeyId": "value",
    "SecretAccessKey": "value",
    "SessionToken": "value"
  }
}
```

### 3. Claude Code を設定

Bedrock を有効にするために、以下の環境変数を設定します。

```bash
# Bedrock 統合を有効にする
export CLAUDE_CODE_USE_BEDROCK=1
export AWS_REGION=us-east-1  # または希望するリージョン

# オプション：小型/高速モデル（Haiku）のリージョンをオーバーライド
export ANTHROPIC_SMALL_FAST_MODEL_AWS_REGION=us-west-2
```

Claude Code で Bedrock を有効にする場合は、以下に注意してください。

- `AWS_REGION` は必須の環境変数です。Claude Code はこの設定について `.aws` 設定ファイルから読み込みません。
- Bedrock を使用する場合、`/login` および `/logout` コマンドは無効になります。認証は AWS 認証情報を通じて処理されるためです。
- 他のプロセスに漏らしたくない `AWS_PROFILE` などの環境変数に設定ファイルを使用できます。詳細については [Settings](/ja/settings) を参照してください。

### 4. モデルバージョンをピン留め

すべてのデプロイメントに対して特定のモデルバージョンをピン留めしてください。モデルエイリアス（`sonnet`、`opus`、`haiku`）をピン留めなしで使用する場合、Claude Code は Bedrock アカウントで利用できない新しいモデルバージョンを使用しようとする可能性があり、Anthropic がアップデートをリリースしたときに既存のユーザーが破損します。

これらの環境変数を特定の Bedrock モデル ID に設定します。

```bash
export ANTHROPIC_DEFAULT_OPUS_MODEL='us.anthropic.claude-opus-4-6-v1'
export ANTHROPIC_DEFAULT_SONNET_MODEL='us.anthropic.claude-sonnet-4-6'
export ANTHROPIC_DEFAULT_HAIKU_MODEL='us.anthropic.claude-haiku-4-5-20251001-v1:0'
```

これらの変数は、クロスリージョン推論プロファイル ID（`us.` プレフィックス付き）を使用します。別のリージョンプレフィックスまたはアプリケーション推論プロファイルを使用する場合は、それに応じて調整してください。現在および従来のモデル ID については、[Models overview](https://platform.claude.com/docs/en/about-claude/models/overview) を参照してください。環境変数の完全なリストについては、[Model configuration](/ja/model-config#pin-models-for-third-party-deployments) を参照してください。

Claude Code は、ピン留め変数が設定されていない場合、これらのデフォルトモデルを使用します。

| モデルタイプ | デフォルト値 |
| :- | :- |
| プライマリモデル | `global.anthropic.claude-sonnet-4-6` |
| 小型/高速モデル | `us.anthropic.claude-haiku-4-5-20251001-v1:0` |

モデルをさらにカスタマイズするには、以下のいずれかの方法を使用します。

```bash
# 推論プロファイル ID を使用
export ANTHROPIC_MODEL='global.anthropic.claude-sonnet-4-6'
export ANTHROPIC_SMALL_FAST_MODEL='us.anthropic.claude-haiku-4-5-20251001-v1:0'

# アプリケーション推論プロファイル ARN を使用
export ANTHROPIC_MODEL='arn:aws:bedrock:us-east-2:your-account-id:application-inference-profile/your-model-id'

# オプション：必要に応じてプロンプトキャッシングを無効にする
export DISABLE_PROMPT_CACHING=1
```

[プロンプトキャッシング](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)は、すべてのリージョンで利用できない場合があります。

#### 各モデルバージョンを推論プロファイルにマップ

`ANTHROPIC_DEFAULT_*_MODEL` 環境変数は、モデルファミリーごとに 1 つの推論プロファイルを設定します。組織が同じファミリーの複数のバージョンを `/model` ピッカーで公開し、それぞれを独自のアプリケーション推論プロファイル ARN にルーティングする必要がある場合は、代わりに [settings file](/ja/settings#settings-files) の `modelOverrides` 設定を使用してください。

この例は、3 つの Opus バージョンを異なる ARN にマップするため、ユーザーは組織の推論プロファイルをバイパスすることなく、それらを切り替えることができます。

```json
{
  "modelOverrides": {
    "claude-opus-4-6": "arn:aws:bedrock:us-east-2:123456789012:application-inference-profile/opus-46-prod",
    "claude-opus-4-5-20251101": "arn:aws:bedrock:us-east-2:123456789012:application-inference-profile/opus-45-prod",
    "claude-opus-4-1-20250805": "arn:aws:bedrock:us-east-2:123456789012:application-inference-profile/opus-41-prod"
  }
}
```

ユーザーが `/model` でこれらのバージョンのいずれかを選択すると、Claude Code はマップされた ARN で Bedrock を呼び出します。オーバーライドのないバージョンは、組み込みの Bedrock モデル ID またはスタートアップで検出された一致する推論プロファイルにフォールバックします。オーバーライドが `availableModels` および他のモデル設定とどのように相互作用するかについては、[Override model IDs per version](/ja/model-config#override-model-ids-per-version) を参照してください。

## IAM 設定

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
        "bedrock:ListInferenceProfiles"
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

詳細については、[Bedrock IAM documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/security-iam.html) を参照してください。

コスト追跡とアクセス制御を簡素化するために、Claude Code 用の専用 AWS アカウントを作成してください。

## AWS Guardrails

[Amazon Bedrock Guardrails](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails.html) を使用すると、Claude Code のコンテンツフィルタリングを実装できます。[Amazon Bedrock コンソール](https://console.aws.amazon.com/bedrock/)で Guardrail を作成し、バージョンを公開してから、Guardrail ヘッダーを [settings file](/ja/settings) に追加します。クロスリージョン推論プロファイルを使用している場合は、Guardrail でクロスリージョン推論を有効にしてください。

設定例：

```json
{
  "env": {
    "ANTHROPIC_CUSTOM_HEADERS": "X-Amzn-Bedrock-GuardrailIdentifier: your-guardrail-id\nX-Amzn-Bedrock-GuardrailVersion: 1"
  }
}
```

## トラブルシューティング

リージョンの問題が発生した場合：

- モデルの可用性を確認：`aws bedrock list-inference-profiles --region your-region`
- サポートされているリージョンに切り替え：`export AWS_REGION=us-east-1`
- クロスリージョンアクセスに推論プロファイルの使用を検討

「on-demand throughput isn't supported」エラーが表示される場合：

- モデルを [inference profile](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-support.html) ID として指定します

Claude Code は Bedrock [Invoke API](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_InvokeModelWithResponseStream.html) を使用し、Converse API はサポートしていません。

## 追加リソース

- [Bedrock documentation](https://docs.aws.amazon.com/bedrock/)
- [Bedrock pricing](https://aws.amazon.com/bedrock/pricing/)
- [Bedrock inference profiles](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-support.html)
- [Claude Code on Amazon Bedrock: Quick Setup Guide](https://community.aws/content/2tXkZKrZzlrlu0KfH8gST5Dkppq/claude-code-on-amazon-bedrock-quick-setup-guide)
- [Claude Code Monitoring Implementation (Bedrock)](https://github.com/aws-solutions-library-samples/guidance-for-claude-code-with-amazon-bedrock/blob/main/assets/docs/MONITORING.md)
