---
title: gitlab-ci-cd
source: https://code.claude.com/docs/ja/gitlab-ci-cd.md
---

# Claude Code GitLab CI/CD

> Claude Code を GitLab CI/CD で開発ワークフローに統合する方法を学びます

Claude Code for GitLab CI/CD は現在ベータ版です。機能と機能性は、エクスペリエンスを改善する際に進化する可能性があります。

この統合は GitLab によって保守されています。サポートについては、以下の [GitLab issue](https://gitlab.com/gitlab-org/gitlab/-/issues/573776) を参照してください。

この統合は [Claude Code CLI and Agent SDK](/ja/agent-sdk/overview) の上に構築されており、CI/CD ジョブとカスタム自動化ワークフローで Claude をプログラム的に使用できます。

## GitLab で Claude Code を使用する理由

- **インスタント MR 作成**: 必要なことを説明すると、Claude は変更と説明を含む完全な MR を提案します
- **自動実装**: 単一のコマンドまたはメンションで issue を実行可能なコードに変換します
- **プロジェクト対応**: Claude は `CLAUDE.md` ガイドラインと既存のコードパターンに従います
- **シンプルなセットアップ**: `.gitlab-ci.yml` に 1 つのジョブとマスクされた CI/CD 変数を追加します
- **エンタープライズ対応**: Claude API、Amazon Bedrock、または Google Vertex AI を選択して、データレジデンシーと調達のニーズを満たします
- **デフォルトでセキュア**: GitLab ランナーで実行され、ブランチ保護と承認が適用されます

## 仕組み

Claude Code は GitLab CI/CD を使用して AI タスクを分離されたジョブで実行し、MR 経由で結果をコミットバックします。

1. **イベント駆動型オーケストレーション**: GitLab は選択したトリガー（例えば、issue、MR、またはレビュースレッドで `@claude` をメンションするコメント）をリッスンします。ジョブはスレッドとリポジトリからコンテキストを収集し、その入力からプロンプトを構築し、Claude Code を実行します。

2. **プロバイダー抽象化**: 環境に適したプロバイダーを使用します。
   - Claude API（SaaS）
   - Amazon Bedrock（IAM ベースのアクセス、クロスリージョンオプション）
   - Google Vertex AI（GCP ネイティブ、Workload Identity Federation）

3. **サンドボックス実行**: 各インタラクションは厳密なネットワークとファイルシステムルールを持つコンテナで実行されます。Claude Code はワークスペーススコープの権限を適用して書き込みを制限します。すべての変更は MR を通じてフローするため、レビュアーは diff を確認でき、承認が引き続き適用されます。

地域エンドポイントを選択して、既存のクラウド契約を使用しながらレイテンシーを削減し、データソブリンティ要件を満たします。

## Claude は何ができますか？

Claude Code は、コードの操作方法を変える強力な CI/CD ワークフローを実現します。

- issue の説明またはコメントから MR を作成および更新します
- パフォーマンス低下を分析し、最適化を提案します
- ブランチに直接機能を実装し、MR を開きます
- テストまたはコメントで特定されたバグと低下を修正します
- フォローアップコメントに応答して、リクエストされた変更を反復処理します

## セットアップ

### クイックセットアップ

最速で開始する方法は、`.gitlab-ci.yml` に最小限のジョブを追加し、API キーをマスクされた変数として設定することです。

1. **マスクされた CI/CD 変数を追加します**
   - **Settings** → **CI/CD** → **Variables** に移動します
   - `ANTHROPIC_API_KEY` を追加します（マスク、必要に応じて保護）

2. **Claude ジョブを `.gitlab-ci.yml` に追加します**

```yaml
stages:
  - ai

claude:
  stage: ai
  image: node:24-alpine3.21
  # ジョブをトリガーする方法に合わせてルールを調整します。
  # - 手動実行
  # - マージリクエストイベント
  # - '@claude' を含むコメント時の web/API トリガー
  rules:
    - if: '$CI_PIPELINE_SOURCE == "web"'
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
  variables:
    GIT_STRATEGY: fetch
  before_script:
    - apk update
    - apk add --no-cache git curl bash
    - curl -fsSL https://claude.ai/install.sh | bash
  script:
    # オプション: セットアップが提供する場合は GitLab MCP サーバーを開始します
    - /bin/gitlab-mcp-server || true
    # web/API トリガーでコンテキストペイロードを使用して呼び出す場合は AI_FLOW_* 変数を使用します
    - echo "$AI_FLOW_INPUT for $AI_FLOW_CONTEXT on $AI_FLOW_EVENT"
    - >
      claude
      -p "${AI_FLOW_INPUT:-'Review this MR and implement the requested changes'}"
      --permission-mode acceptEdits
      --allowedTools "Bash Read Edit Write mcp__gitlab"
      --debug
```

ジョブと `ANTHROPIC_API_KEY` 変数を追加した後、**CI/CD** → **Pipelines** からジョブを手動で実行してテストするか、MR からトリガーして Claude が変更を提案し、必要に応じて MR を開くようにします。

Claude API の代わりに Amazon Bedrock または Google Vertex AI で実行するには、以下の [Using with Amazon Bedrock & Google Vertex AI](#using-with-amazon-bedrock--google-vertex-ai) セクションを参照して、認証と環境セットアップを確認してください。

### 手動セットアップ（本番環境に推奨）

より制御されたセットアップが必要な場合、またはエンタープライズプロバイダーが必要な場合：

1. **プロバイダーアクセスを構成します**。
   - **Claude API**: `ANTHROPIC_API_KEY` を作成してマスクされた CI/CD 変数として保存します
   - **Amazon Bedrock**: **Configure GitLab** → **AWS OIDC** を実行し、Bedrock 用の IAM ロールを作成します
   - **Google Vertex AI**: **Configure Workload Identity Federation for GitLab** → **GCP** を実行します

2. **GitLab API 操作用のプロジェクト認証情報を追加します**。
   - デフォルトで `CI_JOB_TOKEN` を使用するか、`api` スコープを持つ Project Access Token を作成します
   - PAT を使用する場合は `GITLAB_ACCESS_TOKEN`（マスク）として保存します

3. **Claude ジョブを `.gitlab-ci.yml` に追加します**（以下の例を参照）

4. **（オプション）メンション駆動型トリガーを有効にします**。
   - プロジェクト webhook を「Comments（notes）」に追加して、イベントリスナーに追加します（使用する場合）
   - コメントに `@claude` が含まれている場合、リスナーがパイプライントリガー API を `AI_FLOW_INPUT` や `AI_FLOW_CONTEXT` などの変数で呼び出すようにします

## 使用例

### issue を MR に変換する

issue コメント内：

```text
@claude implement this feature based on the issue description
```

Claude は issue とコードベースを分析し、ブランチに変更を書き込み、レビュー用に MR を開きます。

### 実装ヘルプを取得する

MR ディスカッション内：

```text
@claude suggest a concrete approach to cache the results of this API call
```

Claude は変更を提案し、適切なキャッシングを使用してコードを追加し、MR を更新します。

### バグを素早く修正する

issue または MR コメント内：

```text
@claude fix the TypeError in the user dashboard component
```

Claude はバグを特定し、修正を実装し、ブランチを更新するか新しい MR を開きます。

## Amazon Bedrock & Google Vertex AI での使用

エンタープライズ環境では、同じ開発者エクスペリエンスで Claude Code をクラウドインフラストラクチャ全体で実行できます。

### 前提条件

Amazon Bedrock で Claude Code をセットアップする前に、以下が必要です。

1. 目的の Claude モデルへのアクセス権を持つ Amazon Bedrock を備えた AWS アカウント
2. AWS IAM で OIDC ID プロバイダーとして構成された GitLab
3. Bedrock 権限と GitLab プロジェクト/refs に制限された信頼ポリシーを持つ IAM ロール
4. ロール仮定用の GitLab CI/CD 変数：
   - `AWS_ROLE_TO_ASSUME`（ロール ARN）
   - `AWS_REGION`（Bedrock リージョン）

### セットアップ手順

GitLab CI ジョブが OIDC 経由で IAM ロールを仮定できるように AWS を構成します（静的キーなし）。

**必須セットアップ：**

1. Amazon Bedrock を有効にし、ターゲット Claude モデルへのアクセスをリクエストします
2. GitLab 用の IAM OIDC プロバイダーを作成します（まだ存在しない場合）
3. GitLab OIDC プロバイダーによって信頼され、プロジェクトと保護された refs に制限された IAM ロールを作成します
4. Bedrock invoke API に対する最小権限権限を付与します

**CI/CD 変数に保存する必須値：**

- `AWS_ROLE_TO_ASSUME`
- `AWS_REGION`

Settings → CI/CD → Variables で変数を追加します。

```yaml theme={null}
# Amazon Bedrock の場合：
- AWS_ROLE_TO_ASSUME
- AWS_REGION
```

上記の Amazon Bedrock ジョブの例を使用して、GitLab ジョブトークンを実行時に一時的な AWS 認証情報と交換します。

### 前提条件

Google Vertex AI で Claude Code をセットアップする前に、以下が必要です。

1. 以下を備えた Google Cloud プロジェクト：
   - Vertex AI API が有効
   - GitLab OIDC を信頼するように構成された Workload Identity Federation
2. 必要な Vertex AI ロールのみを持つ専用サービスアカウント
3. WIF 用の GitLab CI/CD 変数：
   - `GCP_WORKLOAD_IDENTITY_PROVIDER`（完全なリソース名）
   - `GCP_SERVICE_ACCOUNT`（サービスアカウントメール）

### セットアップ手順

GitLab CI ジョブが Workload Identity Federation 経由でサービスアカウントを偽装できるように Google Cloud を構成します。

**必須セットアップ：**

1. IAM Credentials API、STS API、および Vertex AI API を有効にします
2. GitLab OIDC 用の Workload Identity Pool とプロバイダーを作成します
3. Vertex AI ロールを持つ専用サービスアカウントを作成します
4. WIF プリンシパルにサービスアカウントを偽装する権限を付与します

**CI/CD 変数に保存する必須値：**

- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT`

Settings → CI/CD → Variables で変数を追加します。

```yaml theme={null}
# Google Vertex AI の場合：
- GCP_WORKLOAD_IDENTITY_PROVIDER
- GCP_SERVICE_ACCOUNT
- CLOUD_ML_REGION（例：us-east5）
```

上記の Google Vertex AI ジョブの例を使用して、キーを保存せずに認証します。

## 構成例

以下は、パイプラインに適応させることができる使用可能なスニペットです。

### 基本的な .gitlab-ci.yml（Claude API）

```yaml
stages:
  - ai

claude:
  stage: ai
  image: node:24-alpine3.21
  rules:
    - if: '$CI_PIPELINE_SOURCE == "web"'
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
  variables:
    GIT_STRATEGY: fetch
  before_script:
    - apk update
    - apk add --no-cache git curl bash
    - curl -fsSL https://claude.ai/install.sh | bash
  script:
    - /bin/gitlab-mcp-server || true
    - >
      claude
      -p "${AI_FLOW_INPUT:-'Summarize recent changes and suggest improvements'}"
      --permission-mode acceptEdits
      --allowedTools "Bash Read Edit Write mcp__gitlab"
      --debug
  # Claude Code は CI/CD 変数から ANTHROPIC_API_KEY を使用します
```

### Amazon Bedrock ジョブの例（OIDC）

**前提条件：**

- Amazon Bedrock が有効で、選択した Claude モデルへのアクセス権がある
- GitLab OIDC が AWS で構成され、GitLab プロジェクトと refs を信頼するロールがある
- Bedrock 権限を持つ IAM ロール（最小権限を推奨）

**必須 CI/CD 変数：**

- `AWS_ROLE_TO_ASSUME`: Bedrock アクセス用の IAM ロールの ARN
- `AWS_REGION`: Bedrock リージョン（例：`us-west-2`）

```yaml
claude-bedrock:
  stage: ai
  image: node:24-alpine3.21
  rules:
    - if: '$CI_PIPELINE_SOURCE == "web"'
  before_script:
    - apk add --no-cache bash curl jq git python3 py3-pip
    - pip install --no-cache-dir awscli
    - curl -fsSL https://claude.ai/install.sh | bash
    # GitLab OIDC トークンを AWS 認証情報と交換します
    - export AWS_WEB_IDENTITY_TOKEN_FILE="${CI_JOB_JWT_FILE:-/tmp/oidc_token}"
    - if [ -n "${CI_JOB_JWT_V2}" ]; then printf "%s" "$CI_JOB_JWT_V2" > "$AWS_WEB_IDENTITY_TOKEN_FILE"; fi
    - >
      aws sts assume-role-with-web-identity
      --role-arn "$AWS_ROLE_TO_ASSUME"
      --role-session-name "gitlab-claude-$(date +%s)"
      --web-identity-token "file://$AWS_WEB_IDENTITY_TOKEN_FILE"
      --duration-seconds 3600 > /tmp/aws_creds.json
    - export AWS_ACCESS_KEY_ID="$(jq -r .Credentials.AccessKeyId /tmp/aws_creds.json)"
    - export AWS_SECRET_ACCESS_KEY="$(jq -r .Credentials.SecretAccessKey /tmp/aws_creds.json)"
    - export AWS_SESSION_TOKEN="$(jq -r .Credentials.SessionToken /tmp/aws_creds.json)"
  script:
    - /bin/gitlab-mcp-server || true
    - >
      claude
      -p "${AI_FLOW_INPUT:-'Implement the requested changes and open an MR'}"
      --permission-mode acceptEdits
      --allowedTools "Bash Read Edit Write mcp__gitlab"
      --debug
  variables:
    AWS_REGION: "us-west-2"
```

Bedrock のモデル ID にはリージョン固有のプレフィックスが含まれます（例：`us.anthropic.claude-sonnet-4-6`）。ワークフローがサポートしている場合は、ジョブ構成またはプロンプト経由で目的のモデルを渡します。

### Google Vertex AI ジョブの例（Workload Identity Federation）

**前提条件：**

- GCP プロジェクトで Vertex AI API が有効
- GitLab OIDC を信頼するように構成された Workload Identity Federation
- Vertex AI 権限を持つサービスアカウント

**必須 CI/CD 変数：**

- `GCP_WORKLOAD_IDENTITY_PROVIDER`: 完全なプロバイダーリソース名
- `GCP_SERVICE_ACCOUNT`: サービスアカウントメール
- `CLOUD_ML_REGION`: Vertex リージョン（例：`us-east5`）

```yaml
claude-vertex:
  stage: ai
  image: gcr.io/google.com/cloudsdktool/google-cloud-cli:slim
  rules:
    - if: '$CI_PIPELINE_SOURCE == "web"'
  before_script:
    - apt-get update && apt-get install -y git && apt-get clean
    - curl -fsSL https://claude.ai/install.sh | bash
    # WIF 経由で Google Cloud に認証します（ダウンロードされたキーなし）
    - >
      gcloud auth login --cred-file=<(cat <<EOF
      {
        "type": "external_account",
        "audience": "${GCP_WORKLOAD_IDENTITY_PROVIDER}",
        "subject_token_type": "urn:ietf:params:oauth:token-type:jwt",
        "service_account_impersonation_url": "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${GCP_SERVICE_ACCOUNT}:generateAccessToken",
        "token_url": "https://sts.googleapis.com/v1/token"
      }
      EOF
      )
    - gcloud config set project "$(gcloud projects list --format='value(projectId)' --filter="name:${CI_PROJECT_NAMESPACE}" | head -n1)" || true
  script:
    - /bin/gitlab-mcp-server || true
    - >
      CLOUD_ML_REGION="${CLOUD_ML_REGION:-us-east5}"
      claude
      -p "${AI_FLOW_INPUT:-'Review and update code as requested'}"
      --permission-mode acceptEdits
      --allowedTools "Bash Read Edit Write mcp__gitlab"
      --debug
  variables:
    CLOUD_ML_REGION: "us-east5"
```

Workload Identity Federation では、サービスアカウントキーを保存する必要はありません。リポジトリ固有の信頼条件と最小権限サービスアカウントを使用します。

## ベストプラクティス

### CLAUDE.md 構成

リポジトリルートに `CLAUDE.md` ファイルを作成して、コーディング標準、レビュー基準、およびプロジェクト固有のルールを定義します。Claude は実行中にこのファイルを読み取り、変更を提案する際にあなたの規約に従います。

### セキュリティに関する考慮事項

**API キーやクラウド認証情報をリポジトリにコミットしないでください**。常に GitLab CI/CD 変数を使用します。

- `ANTHROPIC_API_KEY` をマスクされた変数として追加します（必要に応じて保護）
- 可能な限りプロバイダー固有の OIDC を使用します（長期キーなし）
- ジョブ権限とネットワーク出力を制限します
- 他の貢献者と同じように Claude の MR をレビューします

### パフォーマンスの最適化

- `CLAUDE.md` を焦点を絞った簡潔なものに保ちます
- issue/MR の説明を明確にして、反復を減らします
- 実行不可能な実行を避けるために、適切なジョブタイムアウトを構成します
- ランナーで npm とパッケージのインストールをキャッシュします（可能な場合）

### CI コスト

GitLab CI/CD で Claude Code を使用する場合、関連するコストに注意してください。

- **GitLab Runner 時間**：
  - Claude は GitLab ランナーで実行され、コンピュート分を消費します
  - GitLab プランのランナー請求の詳細については、プランを参照してください

- **API コスト**：
  - 各 Claude インタラクションは、プロンプトと応答サイズに基づいてトークンを消費します
  - トークン使用量はタスクの複雑さとコードベースのサイズによって異なります
  - 詳細については [Anthropic pricing](https://platform.claude.com/docs/ja/about-claude/pricing) を参照してください

- **コスト最適化のヒント**：
  - 特定の `@claude` コマンドを使用して、不要なターンを減らします
  - 適切な `max_turns` とジョブタイムアウト値を設定します
  - 並列実行を制限して、並行実行を制御します

## セキュリティとガバナンス

- 各ジョブは、ネットワークアクセスが制限された分離されたコンテナで実行されます
- Claude の変更は MR を通じてフローするため、レビュアーはすべての diff を確認できます
- ブランチ保護と承認ルールが AI 生成コードに適用されます
- Claude Code はワークスペーススコープの権限を使用して書き込みを制限します
- 独自のプロバイダー認証情報を持ち込むため、コストは制御下に置かれます

## トラブルシューティング

### Claude が @claude コマンドに応答しない

- パイプラインがトリガーされていることを確認します（手動、MR イベント、またはメモイベントリスナー/webhook 経由）
- CI/CD 変数（`ANTHROPIC_API_KEY` またはクラウドプロバイダー設定）が存在し、マスク解除されていることを確認します
- コメントに `@claude`（`/claude` ではなく）が含まれており、メンショントリガーが構成されていることを確認します

### ジョブがコメントを書き込めない、または MR を開けない

- `CI_JOB_TOKEN` がプロジェクトに対して十分な権限を持っていることを確認するか、`api` スコープを持つ Project Access Token を使用します
- `mcp__gitlab` ツールが `--allowedTools` で有効になっていることを確認します
- ジョブが MR のコンテキストで実行されているか、`AI_FLOW_*` 変数経由で十分なコンテキストを持っていることを確認します

### 認証エラー

- **Claude API の場合**: `ANTHROPIC_API_KEY` が有効で期限切れでないことを確認します
- **Bedrock/Vertex の場合**: OIDC/WIF 構成、ロール偽装、シークレット名を確認します。リージョンとモデルの可用性を確認します

## 高度な構成

### 一般的なパラメータと変数

Claude Code は以下の一般的に使用される入力をサポートしています。

- `prompt` / `prompt_file`: インライン（`-p`）またはファイル経由で指示を提供します
- `max_turns`: バックアンドフォース反復の数を制限します
- `timeout_minutes`: 総実行時間を制限します
- `ANTHROPIC_API_KEY`: Claude API に必須（Bedrock/Vertex では使用されません）
- プロバイダー固有の環境: `AWS_REGION`、Vertex のプロジェクト/リージョン変数

正確なフラグとパラメータは `@anthropic-ai/claude-code` のバージョンによって異なる場合があります。ジョブで `claude --help` を実行して、サポートされているオプションを確認してください。

### Claude の動作をカスタマイズする

Claude をガイドするには、主に 2 つの方法があります。

1. **CLAUDE.md**: コーディング標準、セキュリティ要件、およびプロジェクト規約を定義します。Claude は実行中にこれを読み取り、ルールに従います。
2. **カスタムプロンプト**: ジョブで `prompt`/`prompt_file` 経由してタスク固有の指示を渡します。異なるジョブに異なるプロンプトを使用します（例：レビュー、実装、リファクタリング）。
