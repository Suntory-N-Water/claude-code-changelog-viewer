---
title: google-vertex-ai
source: https://code.claude.com/docs/ja/google-vertex-ai.md
---

# Google Cloud の Agent Platform 上の Claude Code

> Google Cloud の Agent Platform（旧 Vertex AI）を通じた Claude Code の設定方法について学びます。セットアップ、IAM 設定、トラブルシューティングを含みます。

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

<ContactSalesCard surface="vertex" />

<h2 id="prerequisites">
  前提条件
</h2>

Claude Code を Google Cloud の Agent Platform（旧 Vertex AI）で設定する前に、以下を確認してください。

* 請求が有効になっている Google Cloud Platform（GCP）アカウント
* Google Cloud の Agent Platform API が有効になっている GCP プロジェクト
* 目的の Claude モデルへのアクセス（例：Claude Sonnet 4.6）
* Google Cloud SDK（`gcloud`）がインストールされ、設定されていること
* 目的の GCP リージョンに割り当てられたクォータ

Google Cloud の Agent Platform 認証情報でサインインするには、以下の[Agent Platform でサインイン](#sign-in-with-agent-platform)に従ってください。チーム全体に Claude Code をデプロイするには、[手動セットアップ](#set-up-manually)の手順を使用し、ロールアウト前に[モデルバージョンをピン留めして](#5-pin-model-versions)ください。

<h2 id="sign-in-with-agent-platform">
  Agent Platform でサインイン
</h2>

Google Cloud 認証情報を持っていて、Google Cloud の Agent Platform を通じて Claude Code の使用を開始したい場合、ログインウィザードがそれをガイドします。GCP 側の前提条件はプロジェクトごとに 1 回完了します。ウィザードが Claude Code 側を処理します。

<Steps>
  <Step title="GCP プロジェクトで Claude モデルを有効にする">
    プロジェクトの[Google Cloud の Agent Platform API を有効にして](#1-enable-agent-platform-api)、[Google Cloud の Agent Platform Model Garden](https://console.cloud.google.com/vertex-ai/model-garden)で必要な Claude モデルへのアクセスをリクエストしてください。アカウントに必要な権限については、[IAM 設定](#iam-configuration)を参照してください。
  </Step>

  <Step title="Claude Code を起動して Google Cloud の Agent Platform を選択する">
    `claude` を実行します。ログインプロンプトで、**3rd-party platform**、次に **Google Vertex AI** を選択します。これはログインプロンプトが Google Cloud の Agent Platform に対して使用しているラベルです。
  </Step>

  <Step title="ウィザードプロンプトに従う">
    Google Cloud への認証方法を選択します。`gcloud` からの Application Default Credentials、サービスアカウントキーファイル、または環境内に既にある認証情報です。ウィザードはプロジェクトとリージョンを検出し、プロジェクトが呼び出せる Claude モデルを確認し、それらをピン留めできます。結果は[ユーザー設定ファイル](/ja/settings)の `env` ブロックに保存されるため、環境変数を自分でエクスポートする必要はありません。
  </Step>
</Steps>

サインイン後、いつでも `/setup-vertex` を実行してウィザードを再度開き、認証情報、プロジェクト、リージョン、またはモデルピンを変更できます。

<h2 id="region-configuration">
  リージョン設定
</h2>

Claude Code は Google Cloud の Agent Platform の[グローバル](https://cloud.google.com/blog/products/ai-machine-learning/global-endpoint-for-claude-models-generally-available-on-vertex-ai)、マルチリージョン、および地域別エンドポイントをサポートしています。`CLOUD_ML_REGION` を `global`、`eu` または `us` などのマルチリージョンロケーション、または `us-east5` などの特定のリージョンに設定します。Claude Code は各フォームの正しい Google Cloud の Agent Platform ホスト名を選択します。これには、マルチリージョンロケーション用の `aiplatform.eu.rep.googleapis.com` および `aiplatform.us.rep.googleapis.com` ホストが含まれます。

<Note>
  Google Cloud の Agent Platform は、すべてのエンドポイントタイプで Claude Code デフォルトモデルをサポートしていない場合があります。モデルの可用性は、[特定のリージョン](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/locations#genai-partner-models)、マルチリージョンロケーション、および[グローバルエンドポイント](https://cloud.google.com/vertex-ai/generative-ai/docs/partner-models/use-partner-models#supported_models)によって異なります。サポートされているロケーションに切り替えるか、サポートされているモデルを指定する必要がある場合があります。
</Note>

<h2 id="set-up-manually">
  手動でセットアップする
</h2>

ウィザードの代わりに環境変数を通じて Google Cloud の Agent Platform を設定するには、例えば CI またはスクリプト化されたエンタープライズロールアウトで、以下の手順に従ってください。

<h3 id="1-enable-agent-platform-api">
  1. Agent Platform API を有効にする
</h3>

GCP プロジェクトで Google Cloud の Agent Platform API を有効にします。

```bash
# プロジェクト ID を設定
gcloud config set project YOUR-PROJECT-ID

# Agent Platform API を有効にする
gcloud services enable aiplatform.googleapis.com
```

<h3 id="2-request-model-access">
  2. モデルアクセスをリクエストする
</h3>

Google Cloud の Agent Platform で Claude モデルへのアクセスをリクエストします。

1. [Google Cloud の Agent Platform Model Garden](https://console.cloud.google.com/vertex-ai/model-garden)に移動します
2. 'Claude'モデルを検索します
3. 目的の Claude モデルへのアクセスをリクエストします（例：Claude Sonnet 4.6）
4. 承認を待ちます（24 ～ 48 時間かかる場合があります）

<h3 id="3-configure-gcp-credentials">
  3) GCP 認証情報を設定する
</h3>

Claude Code は標準的な Google Cloud 認証を使用します。

詳細については、[Google Cloud 認証ドキュメント](https://cloud.google.com/docs/authentication)を参照してください。

Claude Code v2.1.121 以降は、同じ Application Default Credentials チェーンを通じて [X.509 証明書ベースのワークロード ID フェデレーション](https://cloud.google.com/iam/docs/workload-identity-federation-with-x509-certificates)をサポートしています。`GOOGLE_APPLICATION_CREDENTIALS` を認証情報設定ファイルのパスに設定します。

<Note>
  Claude Code は Google Cloud の Agent Platform リクエストのプロジェクト ID として `ANTHROPIC_VERTEX_PROJECT_ID` を使用します。`GCLOUD_PROJECT` および `GOOGLE_CLOUD_PROJECT` 環境変数と `GOOGLE_APPLICATION_CREDENTIALS` で参照される認証情報ファイルがこれより優先されます。これらのいずれも設定されていない場合、プロジェクト ID は `gcloud` 設定またはアタッチされたサービスアカウントから解決されます。
</Note>

<h4 id="advanced-credential-configuration">
  高度な認証情報設定
</h4>

Claude Code は `gcpAuthRefresh` 設定を通じて GCP の自動認証情報更新をサポートしています。Claude Code が GCP 認証情報の有効期限が切れているか読み込めないことを検出すると、リクエストを再試行する前に新しい認証情報を取得するために設定されたコマンドを実行します。

```json
{
  "gcpAuthRefresh": "gcloud auth application-default login",
  "env": {
    "ANTHROPIC_VERTEX_PROJECT_ID": "your-project-id"
  }
}
```

コマンドの出力はユーザーに表示されますが、対話的な入力はサポートされていません。これは、CLI が URL を表示し、ブラウザで認証を完了するブラウザベースの認証フローに適しています。認証が完了しない場合、更新コマンドは 3 分後にタイムアウトします。`.claude/settings.json` などのプロジェクト設定で `gcpAuthRefresh` を設定した場合、コマンドはワークスペース信頼プロンプトを受け入れた後にのみ実行されます。

<h3 id="4-configure-claude-code">
  4. Claude Code を設定する
</h3>

次の環境変数を設定します。

```bash
# Agent Platform 統合を有効にする
export CLAUDE_CODE_USE_VERTEX=1
export CLOUD_ML_REGION=global
export ANTHROPIC_VERTEX_PROJECT_ID=YOUR-PROJECT-ID

# オプション：カスタムエンドポイントまたはゲートウェイ用に Agent Platform エンドポイント URL をオーバーライドする
# export ANTHROPIC_VERTEX_BASE_URL=https://aiplatform.googleapis.com

# オプション：必要に応じてプロンプトキャッシングを無効にする
export DISABLE_PROMPT_CACHING=1

# オプション：デフォルトの 5 分ではなく 1 時間のプロンプトキャッシュ TTL をリクエストする
export ENABLE_PROMPT_CACHING_1H=1

# CLOUD_ML_REGION=global の場合、グローバルエンドポイントをサポートしていないモデルのリージョンをオーバーライドする
export VERTEX_REGION_CLAUDE_HAIKU_4_5=us-east5
export VERTEX_REGION_CLAUDE_4_6_SONNET=europe-west1
```

ほとんどのモデルバージョンには、対応する `VERTEX_REGION_CLAUDE_*` 変数があります。完全なリストについては、[環境変数リファレンス](/ja/env-vars)を参照してください。どのモデルがグローバルエンドポイントをサポートしているか、または地域別のみをサポートしているかを確認するには、[Google Cloud の Agent Platform Model Garden](https://console.cloud.google.com/vertex-ai/model-garden)を確認してください。

[prompt caching](/ja/prompt-caching)は自動的に有効になります。これを無効にするには、`DISABLE_PROMPT_CACHING=1` を設定します。デフォルトの 5 分ではなく 1 時間のキャッシュ TTL をリクエストするには、`ENABLE_PROMPT_CACHING_1H=1` を設定します。1 時間の TTL でのキャッシュ書き込みはより高いレートで課金されます。レート制限を高くするには、Google Cloud サポートに連絡してください。Google Cloud の Agent Platform を使用する場合、Google Cloud 認証情報を通じて認証が処理されるため、`/logout` コマンドは無効になります。

Claude Code は Google Cloud の Agent Platform でデフォルトで [MCP tool search](/ja/mcp#scale-with-mcp-tool-search)を無効にしているため、MCP ツール定義は事前にロードされます。Google Cloud の Agent Platform は Claude Sonnet 4.5 以降および Claude Opus 4.5 以降のツール検索をサポートしています。`ENABLE_TOOL_SEARCH=true` を設定して、これらのモデルで有効にします。Google Cloud の Agent Platform の以前のモデルは必要なベータヘッダーを受け入れず、これらのモデルでツール検索を有効にするとリクエストが失敗します。

<h3 id="5-pin-model-versions">
  5. モデルバージョンをピン留めする
</h3>

<Warning>
  複数のユーザーにデプロイする場合は、特定のモデルバージョンをピン留めしてください。ピン留めなしでは、`sonnet` および `opus` などのモデルエイリアスは Claude Code の Google Cloud の Agent Platform 用の組み込みデフォルトに解決され、最新リリースより遅れる可能性があり、プロジェクトでまだ有効になっていない可能性があります。Claude Code は、デフォルトが利用できない場合、起動時に[前のバージョンにフォールバック](#startup-model-checks)しますが、ピン留めすることで、ユーザーが新しいモデルに移行するタイミングを制御できます。
</Warning>

これらの環境変数を特定の Google Cloud の Agent Platform モデル ID に設定します。

これらの変数がない場合、Google Cloud の Agent Platform 上の `opus` エイリアスは Opus 4.8 に解決され、`sonnet` エイリアスは Sonnet 4.5 に解決されます。各変数をエイリアスを特定のバージョンにピン留めするように設定します。

```bash
export ANTHROPIC_DEFAULT_OPUS_MODEL='claude-opus-4-8'
export ANTHROPIC_DEFAULT_SONNET_MODEL='claude-sonnet-5'
export ANTHROPIC_DEFAULT_HAIKU_MODEL='claude-haiku-4-5@20251001'
```

現在および従来のモデル ID については、[モデル概要](https://platform.claude.com/docs/en/about-claude/models/overview)を参照してください。環境変数の完全なリストについては、[モデル設定](/ja/model-config#pin-models-for-third-party-deployments)を参照してください。

Claude Code は、ピン留め変数が設定されていない場合、これらのデフォルトモデルを使用します。

| モデルタイプ   | デフォルト値            |
| :------- | :---------------- |
| プライマリモデル | `claude-opus-4-8` |
| 小型/高速モデル | プライマリモデルと同じ       |

セッションタイトル生成などのバックグラウンドタスクは、小型/高速モデル（通常は Haiku クラスモデル）を使用します。Google Cloud の Agent Platform では、Haiku がすべてのプロジェクトまたはリージョンで有効になっていない可能性があるため、Claude Code はこれをプライマリモデルにデフォルト設定します。バックグラウンドタスクに Haiku を使用するには、`ANTHROPIC_DEFAULT_HAIKU_MODEL` をプロジェクトで利用可能なモデル ID に設定します。

モデルをさらにカスタマイズするには、以下を実行します。

```bash
export ANTHROPIC_MODEL='claude-opus-4-8'
export ANTHROPIC_DEFAULT_HAIKU_MODEL='claude-haiku-4-5@20251001'
```

<h2 id="startup-model-checks">
  起動時のモデルチェック
</h2>

Claude Code が Google Cloud の Agent Platform で設定されて起動すると、使用するモデルがプロジェクトでアクセス可能であることを確認します。

Claude Code デフォルトより古いモデルバージョンをピン留めしていて、プロジェクトが新しいバージョンを呼び出せる場合、Claude Code はピンを更新するよう促します。受け入れると、新しいモデル ID が[ユーザー設定ファイル](/ja/settings)に書き込まれ、Claude Code が再起動されます。拒否すると、次のデフォルトバージョン変更まで記憶されます。

モデルをピン留めしていなくて、現在のデフォルトがプロジェクトで利用できない場合、Claude Code は現在のセッション用に前のバージョンにフォールバックし、通知を表示します。フォールバックは永続化されません。[Model Garden](https://console.cloud.google.com/vertex-ai/model-garden)で新しいモデルを有効にするか、[バージョンをピン留めして](#5-pin-model-versions)選択を永続化してください。

<h2 id="iam-configuration">
  IAM 設定
</h2>

必要な IAM 権限を割り当てます。

`roles/aiplatform.user` ロールには、必要な権限が含まれています。

* `aiplatform.endpoints.predict` - モデル呼び出しとトークンカウントに必要

より制限的な権限については、上記の権限のみを持つカスタムロールを作成してください。

詳細については、[Google Cloud の Agent Platform IAM ドキュメント](https://cloud.google.com/vertex-ai/docs/general/access-control)を参照してください。

<Note>
  Claude Code 用に専用の GCP プロジェクトを作成して、コスト追跡とアクセス制御を簡素化してください。
</Note>

<h2 id="1m-token-context-window">
  100 万トークンコンテキストウィンドウ
</h2>

Claude Sonnet 5、Opus 4.6 以降、および Sonnet 4.6 は、Google Cloud の Agent Platform で[100 万トークンコンテキストウィンドウ](https://platform.claude.com/docs/ja/build-with-claude/context-windows#1m-token-context-window)をサポートしています。Sonnet 5 は常に 100 万ウィンドウで実行され、選択する `[1m]` バリアントはありません。その他のモデルについては、Claude Code は 100 万トークンモデルバリアントを選択すると、拡張コンテキストウィンドウを自動的に有効にします。

[セットアップウィザード](#sign-in-with-agent-platform)は、モデルをピン留めするときに 100 万トークンコンテキストオプションを提供します。手動でピン留めされたモデルの代わりに有効にするには、モデル ID に `[1m]` を追加します。詳細については、[サードパーティデプロイメント用のモデルをピン留めする](/ja/model-config#pin-models-for-third-party-deployments)を参照してください。

<h2 id="troubleshooting">
  トラブルシューティング
</h2>

「デフォルト認証情報を読み込めません」エラーが発生した場合：

* `gcloud auth application-default login` を実行して Application Default Credentials をセットアップしてください
* `GOOGLE_APPLICATION_CREDENTIALS` をサービスアカウントキーファイルパスに設定してください
* すべてのオプションについては、[GCP 認証情報の設定](#3-configure-gcp-credentials)を参照してください

クォータの問題が発生した場合：

* [Cloud Console](https://cloud.google.com/docs/quotas/view-manage)を通じて現在のクォータを確認するか、クォータ増加をリクエストしてください

「モデルが見つかりません」404 エラーが発生した場合：

* [Model Garden](https://console.cloud.google.com/vertex-ai/model-garden)でモデルが有効になっていることを確認してください
* 指定したロケーションでモデルが利用可能であることを確認してください。一部のモデルは `global` またはマルチリージョンロケーション（`eu` および `us` など）でのみ提供され、特定のリージョンでは提供されていません
* `CLOUD_ML_REGION=global` を使用している場合、[Model Garden](https://console.cloud.google.com/vertex-ai/model-garden)の「サポートされている機能」でモデルがグローバルエンドポイントをサポートしていることを確認してください。グローバルエンドポイントをサポートしていないモデルの場合は、以下のいずれかを実行してください：
  * `ANTHROPIC_MODEL` または `ANTHROPIC_DEFAULT_HAIKU_MODEL` を通じてサポートされているモデルを指定するか、
  * `VERTEX_REGION_<MODEL_NAME>` 環境変数を使用してリージョンまたはマルチリージョンロケーションを設定してください

429 エラーが発生した場合：

* 地域別エンドポイントの場合、プライマリモデルと小型/高速モデルが選択したリージョンでサポートされていることを確認してください
* より良い可用性のために `CLOUD_ML_REGION=global` に切り替えることを検討してください

<h2 id="additional-resources">
  追加リソース
</h2>

* [Google Cloud の Agent Platform ドキュメント](https://cloud.google.com/vertex-ai/docs)
* [Google Cloud の Agent Platform 価格](https://cloud.google.com/vertex-ai/pricing)
* [Google Cloud の Agent Platform クォータと制限](https://cloud.google.com/vertex-ai/docs/quotas)
