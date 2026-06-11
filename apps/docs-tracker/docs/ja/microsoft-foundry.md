---
title: microsoft-foundry
source: https://code.claude.com/docs/ja/microsoft-foundry.md
---

# Claude Code on Microsoft Foundry

> Microsoft Foundry を通じて Claude Code を構成する方法について学びます。セットアップ、構成、トラブルシューティングを含みます。

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

<ContactSalesCard surface="foundry" />

<h2 id="prerequisites">
  前提条件
</h2>

Microsoft Foundry で Claude Code を構成する前に、以下を確認してください：

* Microsoft Foundry へのアクセス権を持つ Azure サブスクリプション
* Microsoft Foundry リソースとデプロイメントを作成するための RBAC 権限
* Azure CLI がインストールされ、構成されている（オプション - 認証情報を取得する別のメカニズムがない場合のみ必要）

<Note>
  Claude Code を複数のユーザーにデプロイする場合は、[モデルバージョンをピン留めして](#4-pin-model-versions)、Anthropic が新しいモデルをリリースしたときの破損を防いでください。
</Note>

<h2 id="setup">
  セットアップ
</h2>

<h3 id="1-provision-microsoft-foundry-resource">
  1. Microsoft Foundry リソースをプロビジョニングする
</h3>

まず、Azure で Claude リソースを作成します：

1. [Microsoft Foundry ポータル](https://ai.azure.com/)に移動します
2. 新しいリソースを作成し、リソース名をメモします
3. Claude モデルのデプロイメントを作成します：
   * Claude Opus
   * Claude Sonnet
   * Claude Haiku

<h3 id="2-configure-azure-credentials">
  2) Azure 認証情報を構成する
</h3>

Claude Code は Microsoft Foundry の 2 つの認証方法をサポートしています。セキュリティ要件に最適な方法を選択してください。

**オプション A：API キー認証**

1. Microsoft Foundry ポータルでリソースに移動します
2. **エンドポイントとキー**セクションに移動します
3. **API キー**をコピーします
4. 環境変数を設定します：

```bash
export ANTHROPIC_FOUNDRY_API_KEY=your-azure-api-key
```

**オプション B：Microsoft Entra ID 認証**

`ANTHROPIC_FOUNDRY_API_KEY` が設定されていない場合、Claude Code は Azure SDK [デフォルト認証情報チェーン](https://learn.microsoft.com/en-us/azure/developer/javascript/sdk/authentication/credential-chains#defaultazurecredential-overview)を自動的に使用します。
これは、ローカルおよびリモートワークロードを認証するためのさまざまな方法をサポートしています。

ローカル環境では、一般的に Azure CLI を使用できます：

```bash
az login
```

<Note>
  Microsoft Foundry を使用する場合、認証が Azure 認証情報を通じて処理されるため、`/logout` コマンドは利用できません。
</Note>

<h3 id="3-configure-claude-code">
  3. Claude Code を構成する
</h3>

Microsoft Foundry を有効にするには、以下の環境変数を設定します：

```bash
# Microsoft Foundry 統合を有効にする
export CLAUDE_CODE_USE_FOUNDRY=1

# Azure リソース名（{resource} をリソース名に置き換えます）
export ANTHROPIC_FOUNDRY_RESOURCE={resource}
# または完全なベース URL を提供します：
# export ANTHROPIC_FOUNDRY_BASE_URL=https://{resource}.services.ai.azure.com/anthropic
```

<h3 id="4-pin-model-versions">
  4. モデルバージョンをピン留めする
</h3>

<Warning>
  すべてのデプロイメントに対して特定のモデルバージョンをピン留めしてください。モデルエイリアス（`sonnet`、`opus`、`haiku`）をピン留めなしで使用する場合、Claude Code は Foundry アカウントで利用できない新しいモデルバージョンを使用しようとする可能性があり、Anthropic がアップデートをリリースしたときに既存のユーザーが破損します。Azure デプロイメントを作成するときは、「最新に自動更新」ではなく、特定のモデルバージョンを選択してください。
</Warning>

モデル変数をステップ 1 で作成したデプロイメント名と一致するように設定します。

`ANTHROPIC_DEFAULT_OPUS_MODEL` がない場合、Foundry の `opus` エイリアスは Opus 4.6 に解決されます。最新のモデルを使用するために Opus 4.8 ID に設定します：

```bash
export ANTHROPIC_DEFAULT_OPUS_MODEL='claude-opus-4-8'
export ANTHROPIC_DEFAULT_SONNET_MODEL='claude-sonnet-4-6'
export ANTHROPIC_DEFAULT_HAIKU_MODEL='claude-haiku-4-5'
```

セッションタイトル生成などのバックグラウンドタスクは、通常は Haiku クラスモデルである小型/高速モデルを使用します。Foundry では、すべてのアカウントが Haiku デプロイメントを持っているわけではないため、Claude Code はこれをプライマリモデルにデフォルト設定します。バックグラウンドタスクに Haiku を使用するには、上記のように、アカウントで利用可能な Haiku デプロイメントに `ANTHROPIC_DEFAULT_HAIKU_MODEL` を設定します。

現在および従来のモデル ID については、[モデル概要](https://platform.claude.com/docs/en/about-claude/models/overview)を参照してください。環境変数の完全なリストについては、[モデル構成](/ja/model-config#pin-models-for-third-party-deployments)を参照してください。

[プロンプトキャッシング](/ja/prompt-caching)は自動的に有効になります。デフォルトの 5 分ではなく 1 時間のキャッシュ TTL をリクエストするには、以下の変数を設定します。1 時間の TTL でのキャッシュ書き込みはより高いレートで課金されます：

```bash
export ENABLE_PROMPT_CACHING_1H=1
```

<h3 id="5-run-claude-code">
  5. Claude Code を実行する
</h3>

環境変数を設定したら、プロジェクトディレクトリから Claude Code を起動します：

```bash
claude
```

Claude Code は環境から `CLAUDE_CODE_USE_FOUNDRY` およびその他の Foundry 変数を読み込み、最初のプロンプトで Azure リソースに接続します。Bedrock および Vertex AI とは異なり、Foundry には対話型セットアップウィザードがないため、ステップ 3 およびステップ 4 の環境変数が唯一の構成パスです。

<h2 id="azure-rbac-configuration">
  Azure RBAC 構成
</h2>

`Azure AI User` および `Cognitive Services User` デフォルトロールには、Claude モデルを呼び出すために必要なすべての権限が含まれています。

より制限的な権限の場合は、以下を含むカスタムロールを作成します：

```json
{
  "permissions": [
    {
      "dataActions": [
        "Microsoft.CognitiveServices/accounts/providers/*"
      ]
    }
  ]
}
```

詳細については、[Microsoft Foundry RBAC ドキュメント](https://learn.microsoft.com/en-us/azure/ai-foundry/concepts/rbac-azure-ai-foundry)を参照してください。

<h2 id="troubleshooting">
  トラブルシューティング
</h2>

「Failed to get token from azureADTokenProvider: ChainedTokenCredential authentication failed」というエラーが表示される場合：

* 環境で Entra ID を構成するか、`ANTHROPIC_FOUNDRY_API_KEY` を設定してください。

<h2 id="additional-resources">
  その他のリソース
</h2>

* [Microsoft Foundry ドキュメント](https://learn.microsoft.com/en-us/azure/ai-foundry/what-is-azure-ai-foundry)
* [Microsoft Foundry モデル](https://ai.azure.com/explore/models)
* [Microsoft Foundry 価格](https://azure.microsoft.com/en-us/pricing/details/ai-foundry/)
