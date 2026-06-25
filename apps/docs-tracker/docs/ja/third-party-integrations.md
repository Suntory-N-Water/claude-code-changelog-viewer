---
title: third-party-integrations
source: https://code.claude.com/docs/ja/third-party-integrations.md
---

# エンタープライズデプロイメント概要

> Claude Code が様々なサードパーティサービスとインフラストラクチャと統合して、エンタープライズデプロイメント要件を満たす方法について学びます。

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

組織は Anthropic を通じて直接、またはクラウドプロバイダーを通じて Claude Code をデプロイできます。このページは、適切な構成を選択するのに役立ちます。

<ContactSalesCard surface="third_party_overview" />

<h2 id="compare-deployment-options">
  デプロイメントオプションの比較
</h2>

ほとんどの組織では、Claude for Teams または Claude for Enterprise が最適なエクスペリエンスを提供します。チームメンバーは、単一のサブスクリプション、一元化された請求、インフラストラクチャセットアップが不要で、Claude Code と Web 上の Claude の両方にアクセスできます。

**Claude for Teams** はセルフサービスで、コラボレーション機能、管理ツール、請求管理が含まれています。迅速に開始する必要がある小規模なチームに最適です。

**Claude for Enterprise** は SSO とドメインキャプチャ、ロールベースの権限、コンプライアンス API アクセス、および組織全体の Claude Code 構成をデプロイするための管理ポリシー設定を追加します。セキュリティとコンプライアンス要件がある大規模な組織に最適です。

[Team プラン](https://support.claude.com/en/articles/9266767-what-is-the-team-plan)と[Enterprise プラン](https://support.claude.com/en/articles/9797531-what-is-the-enterprise-plan)の詳細をご覧ください。

組織に特定のインフラストラクチャ要件がある場合は、以下のオプションを比較してください。

<table>
  <thead>
    <tr>
      <th>機能</th>
      <th>Claude for Teams/Enterprise</th>
      <th>Anthropic Console</th>
      <th>Amazon Bedrock</th>
      <th>Claude Platform on AWS</th>
      <th>Google Vertex AI</th>
      <th>Microsoft Foundry</th>
    </tr>
  </thead>

  <tbody>
    <tr>
      <td>最適な用途</td>
      <td>ほとんどの組織（推奨）</td>
      <td>個別開発者</td>
      <td>AWS ネイティブデプロイメント</td>
      <td>Claude API 機能を備えた AWS Marketplace 請求</td>
      <td>GCP ネイティブデプロイメント</td>
      <td>Azure ネイティブデプロイメント</td>
    </tr>

    <tr>
      <td>請求</td>
      <td><strong>Teams:</strong> \$150/シート（Premium）PAYG 利用可能<br /><strong>Enterprise:</strong> <a href="https://claude.com/contact-sales?utm_source=claude_code&utm_medium=docs&utm_content=third_party_enterprise">営業に連絡</a></td>
      <td>PAYG</td>
      <td>AWS 経由の PAYG</td>
      <td>AWS Marketplace 経由の PAYG</td>
      <td>GCP 経由の PAYG</td>
      <td>Azure 経由の PAYG</td>
    </tr>

    <tr>
      <td>リージョン</td>
      <td>サポート対象[国](https://www.anthropic.com/supported-countries)</td>
      <td>サポート対象[国](https://www.anthropic.com/supported-countries)</td>
      <td>複数の AWS [リージョン](https://docs.aws.amazon.com/bedrock/latest/userguide/models-regions.html)</td>
      <td>複数の AWS リージョン</td>
      <td>複数の GCP [リージョン](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/locations)</td>
      <td>複数の Azure [リージョン](https://azure.microsoft.com/en-us/explore/global-infrastructure/products-by-region/)</td>
    </tr>

    <tr>
      <td>Prompt caching</td>
      <td>デフォルトで有効</td>
      <td>デフォルトで有効</td>
      <td>デフォルトで有効</td>
      <td>デフォルトで有効</td>
      <td>デフォルトで有効</td>
      <td>デフォルトで有効</td>
    </tr>

    <tr>
      <td>認証</td>
      <td>Claude.ai SSO またはメール</td>
      <td>API キー</td>
      <td>API キーまたは AWS 認証情報</td>
      <td>API キーまたは AWS 認証情報</td>
      <td>GCP 認証情報</td>
      <td>API キーまたは Microsoft Entra ID</td>
    </tr>

    <tr>
      <td>コスト追跡</td>
      <td>使用状況ダッシュボード</td>
      <td>使用状況ダッシュボード</td>
      <td>AWS Cost Explorer</td>
      <td>AWS Cost Explorer</td>
      <td>GCP Billing</td>
      <td>Azure Cost Management</td>
    </tr>

    <tr>
      <td>Web 上の Claude を含む</td>
      <td>はい</td>
      <td>いいえ</td>
      <td>いいえ</td>
      <td>いいえ</td>
      <td>いいえ</td>
      <td>いいえ</td>
    </tr>

    <tr>
      <td>エンタープライズ機能</td>
      <td>チーム管理、SSO、使用状況監視</td>
      <td>なし</td>
      <td>IAM ポリシー、CloudTrail</td>
      <td>IAM ポリシー、CloudTrail</td>
      <td>IAM ロール、Cloud Audit Logs</td>
      <td>RBAC ポリシー、Azure Monitor</td>
    </tr>
  </tbody>
</table>

各オプションで利用可能な機能の詳細な比較については、[機能の可用性](/ja/feature-availability)を参照してください。

デプロイメントオプションを選択してセットアップ手順を表示します。

* [Claude for Teams または Enterprise](/ja/authentication#claude-for-teams-or-enterprise)
* [Anthropic Console](/ja/authentication#claude-console-authentication)
* [Amazon Bedrock](/ja/amazon-bedrock)
* [Claude Platform on AWS](/ja/claude-platform-on-aws)
* [Google Vertex AI](/ja/google-vertex-ai)
* [Microsoft Foundry](/ja/microsoft-foundry)

<h2 id="configure-proxies-and-gateways">
  プロキシとゲートウェイの構成
</h2>

ほとんどの組織は、追加の構成なしでクラウドプロバイダーを直接使用できます。ただし、組織に特定のネットワークまたは管理要件がある場合は、企業プロキシまたは LLM ゲートウェイを構成する必要がある場合があります。これらは一緒に使用できる異なる構成です。

* **企業プロキシ**: HTTP/HTTPS プロキシを通じてトラフィックをルーティングします。組織がセキュリティ監視、コンプライアンス、またはネットワークポリシー実装のためにすべての送信トラフィックをプロキシサーバーを通じて渡す必要がある場合に使用します。`HTTPS_PROXY` または `HTTP_PROXY` 環境変数で構成します。[エンタープライズネットワーク構成](/ja/network-config)で詳細をご覧ください。
* **LLM ゲートウェイ**: Claude Code とクラウドプロバイダーの間に位置して、認証とルーティングを処理するサービスです。チーム全体の一元化された使用状況追跡、カスタムレート制限または予算、または一元化された認証管理が必要な場合に使用します。`ANTHROPIC_BASE_URL`、`ANTHROPIC_BEDROCK_BASE_URL`、`ANTHROPIC_AWS_BASE_URL`、または `ANTHROPIC_VERTEX_BASE_URL` 環境変数で構成します。[LLM ゲートウェイ](/ja/llm-gateway)で詳細をご覧ください。

以下の例は、シェルまたはシェルプロファイル（`.bashrc`、`.zshrc`）で設定する環境変数を示しています。その他の構成方法については、[設定](/ja/settings)を参照してください。

<h3 id="amazon-bedrock">
  Amazon Bedrock
</h3>

<Tabs>
  <Tab title="企業プロキシ">
    以下の[環境変数](/ja/env-vars)を設定して、Bedrock トラフィックを企業プロキシを通じてルーティングします。

    ```bash theme={null}
    # Bedrock を有効化
    export CLAUDE_CODE_USE_BEDROCK=1
    export AWS_REGION=us-east-1

    # 企業プロキシを構成
    export HTTPS_PROXY='https://proxy.example.com:8080'
    ```
  </Tab>

  <Tab title="LLM ゲートウェイ">
    以下の[環境変数](/ja/env-vars)を設定して、Bedrock トラフィックを LLM ゲートウェイを通じてルーティングします。

    ```bash theme={null}
    # Bedrock を有効化
    export CLAUDE_CODE_USE_BEDROCK=1

    # LLM ゲートウェイを構成
    export ANTHROPIC_BEDROCK_BASE_URL='https://your-llm-gateway.com/bedrock'
    export CLAUDE_CODE_SKIP_BEDROCK_AUTH=1  # ゲートウェイが AWS 認証を処理する場合
    ```
  </Tab>
</Tabs>

<h3 id="microsoft-foundry">
  Microsoft Foundry
</h3>

<Tabs>
  <Tab title="企業プロキシ">
    以下の[環境変数](/ja/env-vars)を設定して、Foundry トラフィックを企業プロキシを通じてルーティングします。

    ```bash theme={null}
    # Microsoft Foundry を有効化
    export CLAUDE_CODE_USE_FOUNDRY=1
    export ANTHROPIC_FOUNDRY_RESOURCE=your-resource
    export ANTHROPIC_FOUNDRY_API_KEY=your-api-key  # または Entra ID 認証の場合は省略

    # 企業プロキシを構成
    export HTTPS_PROXY='https://proxy.example.com:8080'
    ```
  </Tab>

  <Tab title="LLM ゲートウェイ">
    以下の[環境変数](/ja/env-vars)を設定して、Foundry トラフィックを LLM ゲートウェイを通じてルーティングします。

    ```bash theme={null}
    # Microsoft Foundry を有効化
    export CLAUDE_CODE_USE_FOUNDRY=1

    # LLM ゲートウェイを構成
    export ANTHROPIC_FOUNDRY_BASE_URL='https://your-llm-gateway.com'
    export ANTHROPIC_FOUNDRY_API_KEY=your-gateway-key  # x-api-key として送信
    ```
  </Tab>
</Tabs>

<h3 id="google-vertex-ai">
  Google Vertex AI
</h3>

<Tabs>
  <Tab title="企業プロキシ">
    以下の[環境変数](/ja/env-vars)を設定して、Vertex AI トラフィックを企業プロキシを通じてルーティングします。

    ```bash theme={null}
    # Vertex を有効化
    export CLAUDE_CODE_USE_VERTEX=1
    export CLOUD_ML_REGION=us-east5
    export ANTHROPIC_VERTEX_PROJECT_ID=your-project-id

    # 企業プロキシを構成
    export HTTPS_PROXY='https://proxy.example.com:8080'
    ```
  </Tab>

  <Tab title="LLM ゲートウェイ">
    以下の[環境変数](/ja/env-vars)を設定して、Vertex AI トラフィックを LLM ゲートウェイを通じてルーティングします。

    ```bash theme={null}
    # Vertex を有効化
    export CLAUDE_CODE_USE_VERTEX=1

    # LLM ゲートウェイを構成
    export ANTHROPIC_VERTEX_BASE_URL='https://your-llm-gateway.com/vertex'
    export CLAUDE_CODE_SKIP_VERTEX_AUTH=1  # ゲートウェイが GCP 認証を処理する場合
    export ANTHROPIC_VERTEX_PROJECT_ID=your-gcp-project-id
    export CLOUD_ML_REGION=us-east5
    ```
  </Tab>
</Tabs>

<Tip>
  Claude Code で `/status` を使用して、プロキシとゲートウェイの構成が正しく適用されていることを確認します。
</Tip>

<h2 id="best-practices-for-organizations">
  組織のベストプラクティス
</h2>

<h3 id="invest-in-documentation-and-memory">
  ドキュメントとメモリに投資する
</h3>

Claude Code がコードベースを理解できるようにドキュメントに投資することを強くお勧めします。組織は複数のレベルで CLAUDE.md ファイルをデプロイできます。

* **組織全体**: macOS の `/Library/Application Support/ClaudeCode/CLAUDE.md` などのシステムディレクトリにデプロイして、会社全体の標準を設定します
* **リポジトリレベル**: プロジェクトアーキテクチャ、ビルドコマンド、貢献ガイドラインを含むリポジトリルートに `CLAUDE.md` ファイルを作成します。ソース管理にチェックインして、すべてのユーザーが利益を得られるようにします

[メモリと CLAUDE.md ファイル](/ja/memory)で詳細をご覧ください。

<h3 id="simplify-deployment">
  デプロイメントを簡素化する
</h3>

カスタム開発環境がある場合は、Claude Code をインストールする「ワンクリック」の方法を作成することが、組織全体での採用を促進するための鍵となることがわかっています。

<h3 id="start-with-guided-usage">
  ガイド付き使用から始める
</h3>

新しいユーザーに Claude Code をコードベースの Q\&A、または小さなバグ修正または機能リクエストで試すことをお勧めします。Claude Code にプランを作成するよう依頼します。Claude の提案を確認し、軌道を外れている場合はフィードバックを提供します。時間が経つにつれて、ユーザーがこの新しいパラダイムをより理解するようになると、Claude Code をより積極的に実行させるのに効果的になります。

<h3 id="pin-model-versions-for-cloud-providers">
  クラウドプロバイダーのモデルバージョンをピン留めする
</h3>

[Bedrock](/ja/amazon-bedrock)、[Vertex AI](/ja/google-vertex-ai)、[Foundry](/ja/microsoft-foundry)、または [Claude Platform on AWS](/ja/claude-platform-on-aws) を通じてデプロイする場合は、`ANTHROPIC_DEFAULT_FABLE_MODEL`、`ANTHROPIC_DEFAULT_OPUS_MODEL`、`ANTHROPIC_DEFAULT_SONNET_MODEL`、および `ANTHROPIC_DEFAULT_HAIKU_MODEL` を使用して特定のモデルバージョンをピン留めします。ピン留めしない場合、モデルエイリアスは Claude Code のそのプロバイダーの組み込みデフォルトに解決され、最新リリースより遅れる可能性があり、アカウントでまだ有効になっていない可能性があります。ピン留めすることで、ユーザーが新しいモデルに移行するタイミングを制御できます。各プロバイダーがデフォルトが利用できない場合に何を行うかについては、[モデル構成](/ja/model-config#pin-models-for-third-party-deployments)を参照してください。

<h3 id="configure-security-policies">
  セキュリティポリシーを構成する
</h3>

セキュリティチームは、Claude Code が実行できることと実行できないことに対する管理権限を構成できます。これはローカル構成によって上書きされません。[詳細をご覧ください](/ja/security)。

<h3 id="leverage-mcp-for-integrations">
  統合に MCP を活用する
</h3>

MCP は Claude Code にチケット管理システムやエラーログへの接続など、より多くの情報を提供する優れた方法です。1 つの中央チームが MCP サーバーを構成し、`.mcp.json` 構成をコードベースにチェックインして、すべてのユーザーが利益を得られるようにすることをお勧めします。[詳細をご覧ください](/ja/mcp)。

Anthropic では、Claude Code を信頼してすべての Anthropic コードベース全体の開発を支援しています。Claude Code を使用することを楽しんでいただけることを願っています。

<h2 id="next-steps">
  次のステップ
</h2>

デプロイメントオプションを選択し、チームのアクセスを構成したら、以下を実行します。

1. **チームにロールアウトする**: インストール手順を共有し、チームメンバーに [Claude Code をインストール](/ja/setup)して認証情報で認証するよう依頼します。
2. **共有構成をセットアップする**: リポジトリに [CLAUDE.md ファイル](/ja/memory)を作成して、Claude Code がコードベースとコーディング標準を理解するのに役立てます。
3. **権限を構成する**: [セキュリティ設定](/ja/security)を確認して、環境内で Claude Code が実行できることと実行できないことを定義します。
