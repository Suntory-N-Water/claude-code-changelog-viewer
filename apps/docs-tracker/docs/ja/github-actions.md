---
title: github-actions
source: https://code.claude.com/docs/ja/github-actions.md
---

# Claude Code GitHub Actions

> Claude Code を開発ワークフローに統合する Claude Code GitHub Actions について学びます

Claude Code GitHub Actions は、GitHub ワークフローに AI を活用した自動化をもたらします。任意の PR またはイシューで `@claude` とメンションするだけで、Claude はコードを分析し、プルリクエストを作成し、機能を実装し、バグを修正できます。すべてプロジェクトの標準に従いながら実行されます。すべての PR に自動的に投稿されるレビューについては、[GitHub Code Review](/ja/code-review) を参照してください。

Claude Code GitHub Actions は [Claude Agent SDK](/ja/agent-sdk/overview) の上に構築されており、Claude Code をアプリケーションにプログラム的に統合できます。SDK を使用して、GitHub Actions を超えたカスタム自動化ワークフローを構築できます。

Claude Code GitHub Actions を使用する理由

- **即座の PR 作成**: 必要なことを説明すると、Claude は必要なすべての変更を含む完全な PR を作成します
- **自動コード実装**: イシューを 1 つのコマンドで動作するコードに変換します
- **標準に従う**: Claude は `CLAUDE.md` ガイドラインと既存のコードパターンを尊重します
- **シンプルなセットアップ**: インストーラーと API キーで数分で開始できます
- **デフォルトで安全**: コードは Github のランナーに留まります

Claude は何ができますか？

Claude Code は、コードの操作方法を変える強力な GitHub Action を提供します。

Claude Code Action

この GitHub Action により、GitHub Actions ワークフロー内で Claude Code を実行できます。Claude Code の上に任意のカスタムワークフローを構築するために使用できます。

[リポジトリを表示 →](https://github.com/anthropics/claude-code-action)

セットアップ

クイックセットアップ

Claude Code ターミナルで `/install-github-app` を実行して、統合をインタラクティブにセットアップします。このコマンドは Claude GitHub App をリポジトリにインストールし、GitHub Actions ワークフローと API キーシークレットの追加をガイドします。

GitHub App がインストールされた後、コマンドは GitHub Actions セットアップを続行するかどうかを尋ねます。Claude Code v2.1.187 以降では、**Skip for now** を選択して App のインストールのみで停止し、後で `/install-github-app` を再度実行してワークフローとシークレットのステップに戻ることができます。以前のバージョンではワークフロー選択に直接進みます。

- GitHub アプリをインストールしてシークレットを追加するには、リポジトリ管理者である必要があります
- GitHub アプリは、Contents、Issues、Pull requests に対する読み取りと書き込みのアクセス許可をリクエストします
- このクイックスタート方法は、直接 Claude API ユーザーのみが利用できます。Amazon Bedrock または Google Cloud の Agent Platform を使用している場合は、[Amazon Bedrock と Google Cloud での使用](#using-with-amazon-bedrock-and-google-cloud) セクションを参照してください。

手動セットアップ

`/install-github-app` コマンドが失敗した場合、または手動セットアップを希望する場合は、以下の手動セットアップ手順に従ってください。

1. **Claude GitHub アプリをリポジトリにインストール**: [https://github.com/apps/claude](https://github.com/apps/claude)

   Claude GitHub アプリには、以下のリポジトリアクセス許可が必要です。

   - **Contents**: 読み取りと書き込み（リポジトリファイルを変更するため）
   - **Issues**: 読み取りと書き込み（イシューに応答するため）
   - **Pull requests**: 読み取りと書き込み（PR を作成して変更をプッシュするため）

   セキュリティとアクセス許可の詳細については、[セキュリティドキュメント](https://github.com/anthropics/claude-code-action/blob/main/docs/security.md) を参照してください。
2. **ANTHROPIC\_API\_KEY をリポジトリシークレットに追加** ([GitHub Actions でシークレットを使用する方法を学ぶ](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions))
3. **ワークフローファイルをコピー** [examples/claude.yml](https://github.com/anthropics/claude-code-action/blob/main/examples/claude.yml) からリポジトリの `.github/workflows/` にコピーします

クイックスタートまたは手動セットアップのいずれかを完了した後、イシューまたは PR コメントで `@claude` をタグ付けしてアクションをテストします。

ベータ版からのアップグレード

Claude Code GitHub Actions v1.0 は、ベータ版から v1.0 にアップグレードするためにワークフローファイルを更新する必要がある破壊的な変更を導入しています。

現在 Claude Code GitHub Actions のベータ版を使用している場合は、ワークフローを GA バージョンを使用するように更新することをお勧めします。新しいバージョンは、自動モード検出などの強力な新機能を追加しながら、設定を簡素化します。

重要な変更

すべてのベータユーザーは、アップグレードするためにワークフローファイルで以下の変更を行う必要があります。

1. **アクションバージョンを更新**: `@beta` を `@v1` に変更します
2. **モード設定を削除**: `mode: "tag"` または `mode: "agent"` を削除します（現在は自動検出）
3. **プロンプト入力を更新**: `direct_prompt` を `prompt` に置き換えます
4. **CLI オプションを移動**: `max_turns`、`model`、`custom_instructions` などを `claude_args` に変換します

破壊的な変更リファレンス

| 古いベータ入力 | 新しい v1.0 入力 |
| - | - |
| `mode` | *（削除 - 自動検出）* |
| `direct_prompt` | `prompt` |
| `override_prompt` | `prompt` with GitHub variables |
| `custom_instructions` | `claude_args: --append-system-prompt` |
| `max_turns` | `claude_args: --max-turns` |
| `model` | `claude_args: --model` |
| `allowed_tools` | `claude_args: --allowedTools` |
| `disallowed_tools` | `claude_args: --disallowedTools` |
| `claude_env` | `settings` JSON format |

前後の例

**ベータ版:**

```yaml
- uses: anthropics/claude-code-action@beta
  with:
    mode: "tag"
    direct_prompt: "Review this PR for security issues"
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    custom_instructions: "Follow our coding standards"
    max_turns: "10"
    model: "claude-sonnet-5"
```

**GA バージョン（v1.0）:**

```yaml
- uses: anthropics/claude-code-action@v1
  with:
    prompt: "Review this PR for security issues"
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    claude_args: |
      --append-system-prompt "Follow our coding standards"
      --max-turns 10
      --model claude-sonnet-5
```

アクションは、設定に基づいて、インタラクティブモード（`@claude` メンションに応答）または自動化モード（プロンプト付きで即座に実行）で実行するかどうかを自動的に検出します。

使用例

Claude Code GitHub Actions は、さまざまなタスクに役立ちます。[examples ディレクトリ](https://github.com/anthropics/claude-code-action/tree/main/examples) には、さまざまなシナリオ用の使用可能なワークフローが含まれています。

基本的なワークフロー

```yaml
name: Claude Code
on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]
jobs:
  claude:
    runs-on: ubuntu-latest
    steps:
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          # Responds to @claude mentions in comments
```

skills を使用する

`prompt` 入力は、[skill](/ja/skills) の呼び出しだけでなく、プレーンテキストも受け入れます。

- リポジトリの `.claude/skills/` ディレクトリ内のスキルの場合、アクションステップの前に `actions/checkout` を実行し、`/skill-name` を渡します。
- プラグインにパッケージされたスキルの場合、`plugin_marketplaces` および `plugins` 入力でプラグインをインストールし、名前空間付きの `/plugin-name:skill-name` を渡します。

次のワークフローは、`code-review` プラグインをインストールし、新規または更新されたプルリクエストごとにそのスキルを実行します。

```yaml
name: Code Review
on:
  pull_request:
    types: [opened, synchronize]
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          plugin_marketplaces: "https://github.com/anthropics/claude-code.git"
          plugins: "code-review@claude-code-plugins"
          prompt: "/code-review:code-review ${{ github.repository }}/pull/${{ github.event.pull_request.number }}"
```

プロンプトを使用したカスタム自動化

```yaml
name: Daily Report
on:
  schedule:
    - cron: "0 9 * * *"
jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          prompt: "Generate a summary of yesterday's commits and open issues"
          claude_args: "--model opus"
```

一般的な使用例

イシューまたは PR コメント内：

```text wrap
@claude implement this feature based on the issue description
@claude how should I implement user authentication for this endpoint?
@claude fix the TypeError in the user dashboard component
```

Claude は自動的にコンテキストを分析し、適切に応答します。

ベストプラクティス

CLAUDE.md 設定

リポジトリルートに `CLAUDE.md` ファイルを作成して、コードスタイルガイドライン、レビュー基準、プロジェクト固有のルール、および推奨パターンを定義します。このファイルは、Claude のプロジェクト標準の理解をガイドします。

セキュリティに関する考慮事項

API キーをリポジトリに直接コミットしないでください。

アクセス許可、認証、ベストプラクティスを含む包括的なセキュリティガイダンスについては、[Claude Code Action セキュリティドキュメント](https://github.com/anthropics/claude-code-action/blob/main/docs/security.md) を参照してください。

常に GitHub Secrets を API キーに使用します。

- API キーを `ANTHROPIC_API_KEY` という名前のリポジトリシークレットとして追加します
- ワークフローで参照します: `anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}`
- アクションのアクセス許可を必要なものだけに制限します
- マージする前に Claude の提案を確認します

常に GitHub Secrets（例えば、`${{ secrets.ANTHROPIC_API_KEY }}`）を使用し、API キーをワークフローファイルに直接ハードコードしないでください。

パフォーマンスの最適化

イシューテンプレートを使用してコンテキストを提供し、`CLAUDE.md` を簡潔で焦点を絞ったものに保ち、ワークフローに適切なタイムアウトを設定します。

CI コスト

Claude Code GitHub Actions を使用する場合、関連するコストに注意してください。

**GitHub Actions コスト:**

- Claude Code は GitHub ホストランナーで実行され、GitHub Actions の分を消費します
- 詳細な価格設定と分の制限については、[GitHub の請求ドキュメント](https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-actions/about-billing-for-github-actions) を参照してください

**API コスト:**

- 各 Claude インタラクションは、プロンプトと応答の長さに基づいて API トークンを消費します
- トークン使用量は、タスクの複雑さとコードベースのサイズによって異なります
- 現在のトークンレートについては、[Claude の価格ページ](https://claude.com/platform/api) を参照してください

**コスト最適化のヒント:**

- 特定の `@claude` コマンドを使用して、不要な API 呼び出しを減らします
- `claude_args` で適切な `--max-turns` を設定して、過度な反復を防ぎます
- ワークフローレベルのタイムアウトを設定して、暴走ジョブを回避します
- GitHub の並行制御を使用して、並列実行を制限することを検討します

設定例

Claude Code Action v1 は、統一されたパラメータで設定を簡素化します。

```yaml
- uses: anthropics/claude-code-action@v1
  with:
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    prompt: "Your instructions here" # Optional
    claude_args: "--max-turns 5" # Optional CLI arguments
```

主な機能：

- **統一されたプロンプトインターフェース** - すべての指示に `prompt` を使用します
- **Skills** - インストール済みの [skills](/ja/skills) をプロンプトから直接呼び出します
- **CLI パススルー** - `claude_args` 経由の任意の Claude Code CLI 引数
- **柔軟なトリガー** - 任意の GitHub イベントで動作します

完全なワークフローファイルについては、[examples ディレクトリ](https://github.com/anthropics/claude-code-action/tree/main/examples) を参照してください。

イシューまたは PR コメントに応答する場合、Claude は自動的に @claude メンションに応答します。その他のイベントについては、`prompt` パラメータを使用して指示を提供します。

Amazon Bedrock と Google Cloud での使用

エンタープライズ環境では、Claude Code GitHub Actions を独自のクラウドインフラストラクチャで使用できます。このアプローチにより、データレジデンシーと請求を制御しながら、同じ機能を維持できます。

前提条件

クラウドプロバイダーで Claude Code GitHub Actions をセットアップする前に、以下が必要です。

Google Cloud の Agent Platform の場合：

1. Google Cloud の Agent Platform が有効な Google Cloud プロジェクト
2. GitHub Actions 用に設定された Workload Identity Federation
3. 必要なアクセス許可を持つサービスアカウント
4. GitHub App（推奨）または デフォルトの GITHUB\_TOKEN を使用

Amazon Bedrock の場合：

1. Amazon Bedrock が有効な AWS アカウント
2. AWS で設定された GitHub OIDC Identity Provider
3. Amazon Bedrock アクセス許可を持つ IAM ロール
4. GitHub App（推奨）または デフォルトの GITHUB\_TOKEN を使用

Google Cloud の Agent Platform や Amazon Bedrock などの 3P プロバイダーを使用する場合、最適な制御とセキュリティのために、独自の GitHub App を作成することをお勧めします。

1. [https://github.com/settings/apps/new](https://github.com/settings/apps/new) にアクセスします
2. 基本情報を入力します。
   - **GitHub App name**: 一意の名前を選択します（例：'YourOrg Claude Assistant'）
   - **Homepage URL**: 組織の Web サイトまたはリポジトリ URL
3. アプリ設定を設定します。
   - **Webhooks**: 'Active'をオフにします（この統合には不要）
4. 必要なアクセス許可を設定します。
   - **Repository permissions**:
     - Contents: Read & Write
     - Issues: Read & Write
     - Pull requests: Read & Write
5. 'Create GitHub App'をクリックします
6. 作成後、'Generate a private key'をクリックしてダウンロードした `.pem` ファイルを保存します
7. アプリ設定ページからアプリ ID をメモします
8. アプリをリポジトリにインストールします。
   - アプリの設定ページから、左側のサイドバーの'Install App'をクリックします
   - アカウントまたは組織を選択します
   - 'Only select repositories'を選択して、特定のリポジトリを選択します
   - 'Install'をクリックします
9. プライベートキーをリポジトリシークレットとして追加します。
   - リポジトリの Settings → Secrets and variables → Actions に移動します
   - `.pem` ファイルの内容を含む `APP_PRIVATE_KEY` という名前の新しいシークレットを作成します
10. アプリ ID をシークレットとして追加します。

- GitHub App の ID を含む `APP_ID` という名前の新しいシークレットを作成します

このアプリは [actions/create-github-app-token](https://github.com/actions/create-github-app-token) アクションで使用され、ワークフロー内で認証トークンを生成します。

**Claude API の場合、または独自の Github アプリをセットアップしたくない場合の代替案**: 公式 Anthropic アプリを使用します。

1. [https://github.com/apps/claude](https://github.com/apps/claude) からインストールします
2. 認証に追加の設定は不要です

クラウドプロバイダーを選択し、安全な認証をセットアップします。

**GitHub Actions が認証情報を保存せずに安全に認証できるように AWS を設定します。**

> **セキュリティに関する注意**: リポジトリ固有の設定を使用し、最小限の必要なアクセス許可のみを付与します。

**必要なセットアップ**:

1. **Amazon Bedrock を有効にします**:
   - Amazon Bedrock で Claude モデルへのアクセスをリクエストします
   - クロスリージョンモデルの場合、すべての必要なリージョンでアクセスをリクエストします

2. **GitHub OIDC Identity Provider をセットアップします**:
   - Provider URL: `https://token.actions.githubusercontent.com`
   - Audience: `sts.amazonaws.com`

3. **GitHub Actions 用の IAM ロールを作成します**:
   - Trusted entity type: Web identity
   - Identity provider: `token.actions.githubusercontent.com`
   - Permissions: `AmazonBedrockFullAccess` ポリシー
   - 特定のリポジトリの信頼ポリシーを設定します

**必要な値**:

セットアップ後、以下が必要です。

- **AWS\_ROLE\_TO\_ASSUME**: 作成した IAM ロールの ARN

OIDC は、認証情報が一時的で自動的にローテーションされるため、静的な AWS アクセスキーを使用するよりも安全です。

詳細な OIDC セットアップ手順については、[AWS ドキュメント](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc.html) を参照してください。

**GitHub Actions が認証情報を保存せずに安全に認証できるように Google Cloud を設定します。**

> **セキュリティに関する注意**: リポジトリ固有の設定を使用し、最小限の必要なアクセス許可のみを付与します。

**必要なセットアップ**:

1. **Google Cloud プロジェクトで API を有効にします**:
   - IAM Credentials API
   - Security Token Service（STS）API
   - Google Cloud の Agent Platform API

2. **Workload Identity Federation リソースを作成します**:
   - Workload Identity Pool を作成します
   - GitHub OIDC プロバイダーを追加します。
     - Issuer: `https://token.actions.githubusercontent.com`
     - リポジトリと所有者の属性マッピング
     - **セキュリティ推奨**: リポジトリ固有の属性条件を使用します

3. **サービスアカウントを作成します**:
   - `Vertex AI User` ロールのみを付与します
   - **セキュリティ推奨**: リポジトリごとに専用のサービスアカウントを作成します

4. **IAM バインディングを設定します**:
   - Workload Identity Pool がサービスアカウントを偽装できるようにします
   - **セキュリティ推奨**: リポジトリ固有のプリンシパルセットを使用します

**必要な値**:

セットアップ後、以下が必要です。

- **GCP\_WORKLOAD\_IDENTITY\_PROVIDER**: 完全なプロバイダーリソース名
- **GCP\_SERVICE\_ACCOUNT**: サービスアカウントのメールアドレス

Workload Identity Federation により、ダウンロード可能なサービスアカウントキーが不要になり、セキュリティが向上します。

詳細なセットアップ手順については、[Google Cloud Workload Identity Federation ドキュメント](https://cloud.google.com/iam/docs/workload-identity-federation) を参照してください。

リポジトリに以下のシークレットを追加します（Settings → Secrets and variables → Actions）:

#### Claude API（直接）の場合：

1. **API 認証の場合**:
   - `ANTHROPIC_API_KEY`: [console.anthropic.com](https://console.anthropic.com) からの Claude API キー

2. **GitHub App を使用する場合（独自のアプリを使用している場合）**:
   - `APP_ID`: GitHub App の ID
   - `APP_PRIVATE_KEY`: プライベートキー（.pem）の内容

#### Google Cloud の Agent Platform の場合

1. **GCP 認証の場合**:
   - `GCP_WORKLOAD_IDENTITY_PROVIDER`
   - `GCP_SERVICE_ACCOUNT`

2. **GitHub App を使用する場合（独自のアプリを使用している場合）**:
   - `APP_ID`: GitHub App の ID
   - `APP_PRIVATE_KEY`: プライベートキー（.pem）の内容

#### Amazon Bedrock の場合

1. **AWS 認証の場合**:
   - `AWS_ROLE_TO_ASSUME`

2. **GitHub App を使用する場合（独自のアプリを使用している場合）**:
   - `APP_ID`: GitHub App の ID
   - `APP_PRIVATE_KEY`: プライベートキー（.pem）の内容

クラウドプロバイダーと統合する GitHub Actions ワークフローファイルを作成します。以下の例は、Amazon Bedrock と Google Cloud の Agent Platform の両方の完全な設定を示しています。

**前提条件:**

- Amazon Bedrock アクセスが有効で、Claude モデルのアクセス許可がある
- GitHub が AWS で OIDC ID プロバイダーとして設定されている
- Amazon Bedrock アクセス許可を持つ IAM ロールが GitHub Actions を信頼している

**必要な GitHub シークレット:**

| Secret Name | Description |
| - | - |
| `AWS_ROLE_TO_ASSUME` | Amazon Bedrock アクセス用の IAM ロールの ARN |
| `APP_ID` | GitHub App ID（アプリ設定から） |
| `APP_PRIVATE_KEY` | GitHub App 用に生成したプライベートキー |

```yaml theme={null}
name: Claude PR Action

permissions:
  contents: write
  pull-requests: write
  issues: write
  id-token: write

on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]
  issues:
    types: [opened, assigned]

jobs:
  claude-pr:
    if: |
      (github.event_name == 'issue_comment' && contains(github.event.comment.body, '@claude')) ||
      (github.event_name == 'pull_request_review_comment' && contains(github.event.comment.body, '@claude')) ||
      (github.event_name == 'issues' && contains(github.event.issue.body, '@claude'))
    runs-on: ubuntu-latest
    env:
      AWS_REGION: us-west-2
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Generate GitHub App token
        id: app-token
        uses: actions/create-github-app-token@v2
        with:
          app-id: ${{ secrets.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}

      - name: Configure AWS Credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_TO_ASSUME }}
          aws-region: us-west-2

      - uses: anthropics/claude-code-action@v1
        with:
          github_token: ${{ steps.app-token.outputs.token }}
          use_bedrock: "true"
          claude_args: '--model us.anthropic.claude-sonnet-4-6 --max-turns 10'
```

Amazon Bedrock のモデル ID 形式には、リージョンプレフィックスが含まれます（例：`us.anthropic.claude-sonnet-4-6`）。

**前提条件:**

- GCP プロジェクトで Google Cloud の Agent Platform API が有効
- GitHub 用に Workload Identity Federation が設定されている
- Google Cloud の Agent Platform アクセス許可を持つサービスアカウント

**必要な GitHub シークレット:**

| Secret Name | Description |
| - | - |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Workload identity provider リソース名 |
| `GCP_SERVICE_ACCOUNT` | Google Cloud の Agent Platform アクセス権を持つサービスアカウントメール |
| `APP_ID` | GitHub App ID（アプリ設定から） |
| `APP_PRIVATE_KEY` | GitHub App 用に生成したプライベートキー |

```yaml theme={null}
name: Claude PR Action

permissions:
  contents: write
  pull-requests: write
  issues: write
  id-token: write

on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]
  issues:
    types: [opened, assigned]

jobs:
  claude-pr:
    if: |
      (github.event_name == 'issue_comment' && contains(github.event.comment.body, '@claude')) ||
      (github.event_name == 'pull_request_review_comment' && contains(github.event.comment.body, '@claude')) ||
      (github.event_name == 'issues' && contains(github.event.issue.body, '@claude'))
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Generate GitHub App token
        id: app-token
        uses: actions/create-github-app-token@v2
        with:
          app-id: ${{ secrets.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}

      - name: Authenticate to Google Cloud
        id: auth
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}
          service_account: ${{ secrets.GCP_SERVICE_ACCOUNT }}

      - uses: anthropics/claude-code-action@v1
        with:
          github_token: ${{ steps.app-token.outputs.token }}
          trigger_phrase: "@claude"
          use_vertex: "true"
          claude_args: '--model claude-sonnet-4-5@20250929 --max-turns 10'
        env:
          ANTHROPIC_VERTEX_PROJECT_ID: ${{ steps.auth.outputs.project_id }}
          CLOUD_ML_REGION: us-east5
          VERTEX_REGION_CLAUDE_4_5_SONNET: us-east5
```

プロジェクト ID は Google Cloud 認証ステップから自動的に取得されるため、ハードコードする必要はありません。

トラブルシューティング

Claude が @claude コマンドに応答しない

GitHub App が正しくインストールされていることを確認し、ワークフローが有効になっていることを確認し、API キーがリポジトリシークレットに設定されていることを確認し、コメントに `@claude` が含まれていることを確認します（`/claude` ではなく）。

CI が Claude のコミットで実行されない

GitHub App またはカスタムアプリを使用していることを確認します（Actions ユーザーではなく）、ワークフロートリガーに必要なイベントが含まれていることを確認し、アプリのアクセス許可に CI トリガーが含まれていることを確認します。

認証エラー

API キーが有効で十分なアクセス許可があることを確認します。Amazon Bedrock または Google Cloud の Agent Platform の場合、認証情報の設定を確認し、シークレットがワークフロー内で正しく名前付けされていることを確認します。

高度な設定

アクションパラメータ

Claude Code Action v1 は、簡素化された設定を使用します。

| Parameter | Description | 必須 |
| - | - | - |
| `prompt` | Claude の指示（プレーンテキストまたは [skill](/ja/skills) 名） | いいえ\* |
| `claude_args` | Claude Code に渡される CLI 引数 | いいえ |
| `plugin_marketplaces` | プラグインマーケットプレイス Git URL の改行区切りリスト | いいえ |
| `plugins` | 実行前にインストールするプラグイン名の改行区切りリスト | いいえ |
| `anthropic_api_key` | Claude API キー | はい\*\* |
| `github_token` | API アクセス用の GitHub トークン | いいえ |
| `trigger_phrase` | カスタムトリガーフレーズ（デフォルト：「@claude」） | いいえ |
| `use_bedrock` | Claude API の代わりに Amazon Bedrock を使用 | いいえ |
| `use_vertex` | Claude API の代わりに Google Cloud の Agent Platform を使用 | いいえ |

\*プロンプトはオプションです。イシュー/PR コメントで省略された場合、Claude はトリガーフレーズに応答します\
\*\*直接 Claude API に必要です。Amazon Bedrock または Google Cloud の Agent Platform には不要です

CLI 引数を渡す

`claude_args` パラメータは、任意の Claude Code CLI 引数を受け入れます。

```yaml
claude_args: "--max-turns 5 --model claude-sonnet-5 --mcp-config /path/to/config.json"
```

一般的な引数：

- `--max-turns`: 最大会話ターン数（デフォルト：10）
- `--model`: 使用するモデル（例：`claude-sonnet-5`）
- `--mcp-config`: MCP 設定へのパス
- `--allowedTools`: 許可されたツールのカンマ区切りリスト。`--allowed-tools` エイリアスも機能します。
- `--debug`: デバッグ出力を有効にします

代替統合方法

`/install-github-app` コマンドは推奨されるアプローチですが、以下も実行できます。

- **カスタム GitHub App**: ブランド化されたユーザー名またはカスタム認証フローが必要な組織向け。必要なアクセス許可（contents、issues、pull requests）を持つ独自の GitHub App を作成し、actions/create-github-app-token アクションを使用してワークフロー内でトークンを生成します。
- **手動 GitHub Actions**: 最大の柔軟性のための直接ワークフロー設定
- **MCP 設定**: Model Context Protocol サーバーの動的読み込み

詳細なガイドについては、[Claude Code Action ドキュメント](https://github.com/anthropics/claude-code-action/blob/main/docs) を参照してください。認証、セキュリティ、高度な設定に関する詳細なガイドがあります。

Claude の動作をカスタマイズ

Claude の動作は 2 つの方法で設定できます。

1. **CLAUDE.md**: リポジトリのルートに `CLAUDE.md` ファイルを作成して、コーディング標準、レビュー基準、プロジェクト固有のルールを定義します。Claude は PR を作成し、リクエストに応答するときにこれらのガイドラインに従います。詳細については、[Memory ドキュメント](/ja/memory) を確認してください。
2. **カスタムプロンプト**: ワークフローファイルの `prompt` パラメータを使用して、ワークフロー固有の指示を提供します。これにより、異なるワークフローまたはタスク用に Claude の動作をカスタマイズできます。

Claude は PR を作成し、リクエストに応答するときにこれらのガイドラインに従います。
