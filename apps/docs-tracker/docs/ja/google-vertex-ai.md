---
title: google-vertex-ai
source: https://code.claude.com/docs/ja/google-vertex-ai.md
---

# Google Vertex AI 上の Claude Code

> Google Vertex AI を通じた Claude Code の設定方法について学びます。セットアップ、IAM 設定、トラブルシューティングを含みます。

## 前提条件

Claude Code を Vertex AI で設定する前に、以下を確認してください。

- 請求が有効になっている Google Cloud Platform（GCP）アカウント
- Vertex AI API が有効になっている GCP プロジェクト
- 目的の Claude モデルへのアクセス（例：Claude Sonnet 4.6）
- Google Cloud SDK（`gcloud`）がインストールされ、設定されていること
- 目的の GCP リージョンに割り当てられたクォータ

Claude Code を複数のユーザーにデプロイする場合は、[モデルバージョンをピン留めして](#5-pin-model-versions)、Anthropic が新しいモデルをリリースしたときの破損を防いでください。

## リージョン設定

Claude Code は Vertex AI の[グローバル](https://cloud.google.com/blog/products/ai-machine-learning/global-endpoint-for-claude-models-generally-available-on-vertex-ai)エンドポイントと地域別エンドポイントの両方で使用できます。

Vertex AI は、すべての[リージョン](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/locations#genai-partner-models)で Claude Code のデフォルトモデルをサポートしていない場合があります。また、[グローバルエンドポイント](https://cloud.google.com/vertex-ai/generative-ai/docs/partner-models/use-partner-models#supported_models)でもサポートしていない場合があります。サポートされているリージョンに切り替えるか、地域別エンドポイントを使用するか、サポートされているモデルを指定する必要がある場合があります。

## セットアップ

### 1. Vertex AI API を有効にする

GCP プロジェクトで Vertex AI API を有効にします。

```bash
# プロジェクト ID を設定
gcloud config set project YOUR-PROJECT-ID

# Vertex AI API を有効にする
gcloud services enable aiplatform.googleapis.com
```

### 2. モデルアクセスをリクエストする

Vertex AI で Claude モデルへのアクセスをリクエストします。

1. [Vertex AI Model Garden](https://console.cloud.google.com/vertex-ai/model-garden) に移動します
2. 「Claude」モデルを検索します
3. 目的の Claude モデルへのアクセスをリクエストします（例：Claude Sonnet 4.6）
4. 承認を待ちます（24 ～ 48 時間かかる場合があります）

### 3. GCP 認証情報を設定する

Claude Code は標準的な Google Cloud 認証を使用します。

詳細については、[Google Cloud 認証ドキュメント](https://cloud.google.com/docs/authentication)を参照してください。

認証時に、Claude Code は `ANTHROPIC_VERTEX_PROJECT_ID` 環境変数からプロジェクト ID を自動的に使用します。これをオーバーライドするには、次の環境変数のいずれかを設定します。`GCLOUD_PROJECT`、`GOOGLE_CLOUD_PROJECT`、または `GOOGLE_APPLICATION_CREDENTIALS`。

### 4. Claude Code を設定する

次の環境変数を設定します。

```bash
# Vertex AI 統合を有効にする
export CLAUDE_CODE_USE_VERTEX=1
export CLOUD_ML_REGION=global
export ANTHROPIC_VERTEX_PROJECT_ID=YOUR-PROJECT-ID

# オプション：カスタムエンドポイントまたはゲートウェイ用に Vertex エンドポイント URL をオーバーライドする
# export ANTHROPIC_VERTEX_BASE_URL=https://aiplatform.googleapis.com

# オプション：必要に応じてプロンプトキャッシングを無効にする
export DISABLE_PROMPT_CACHING=1

# CLOUD_ML_REGION=global の場合、グローバルエンドポイントをサポートしていないモデルのリージョンをオーバーライドする
export VERTEX_REGION_CLAUDE_HAIKU_4_5=us-east5
export VERTEX_REGION_CLAUDE_4_6_SONNET=europe-west1
```

各モデルバージョンには独自の `VERTEX_REGION_CLAUDE_*` 変数があります。完全なリストについては、[環境変数リファレンス](/ja/env-vars)を参照してください。どのモデルがグローバルエンドポイントをサポートしているか、または地域別のみをサポートしているかを確認するには、[Vertex Model Garden](https://console.cloud.google.com/vertex-ai/model-garden)を確認してください。

[プロンプトキャッシング](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)は、`cache_control` エフェメラルフラグを指定すると自動的にサポートされます。これを無効にするには、`DISABLE_PROMPT_CACHING=1` を設定します。レート制限を高くするには、Google Cloud サポートに連絡してください。Vertex AI を使用する場合、Google Cloud 認証情報を通じて認証が処理されるため、`/login` および `/logout` コマンドは無効になります。

### 5. モデルバージョンをピン留めする

すべてのデプロイメントに対して特定のモデルバージョンをピン留めしてください。モデルエイリアス（`sonnet`、`opus`、`haiku`）をピン留めなしで使用する場合、Claude Code は Vertex AI プロジェクトで有効になっていない新しいモデルバージョンを使用しようとする可能性があり、Anthropic がアップデートをリリースしたときに既存のユーザーが破損します。

これらの環境変数を特定の Vertex AI モデル ID に設定します。

```bash
export ANTHROPIC_DEFAULT_OPUS_MODEL='claude-opus-4-6'
export ANTHROPIC_DEFAULT_SONNET_MODEL='claude-sonnet-4-6'
export ANTHROPIC_DEFAULT_HAIKU_MODEL='claude-haiku-4-5@20251001'
```

現在および従来のモデル ID については、[モデル概要](https://platform.claude.com/docs/en/about-claude/models/overview)を参照してください。環境変数の完全なリストについては、[モデル設定](/ja/model-config#pin-models-for-third-party-deployments)を参照してください。

Claude Code は、ピン留め変数が設定されていない場合、これらのデフォルトモデルを使用します。

| モデルタイプ | デフォルト値 |
| :- | :- |
| プライマリモデル | `claude-sonnet-4-5@20250929` |
| 小型/高速モデル | `claude-haiku-4-5@20251001` |

モデルをさらにカスタマイズするには、以下を実行します。

```bash
export ANTHROPIC_MODEL='claude-opus-4-6'
export ANTHROPIC_DEFAULT_HAIKU_MODEL='claude-haiku-4-5@20251001'
```

## IAM 設定

必要な IAM 権限を割り当てます。

`roles/aiplatform.user` ロールには、必要な権限が含まれています。

- `aiplatform.endpoints.predict` - モデル呼び出しとトークンカウントに必要

より制限的な権限については、上記の権限のみを持つカスタムロールを作成してください。

詳細については、[Vertex IAM ドキュメント](https://cloud.google.com/vertex-ai/docs/general/access-control)を参照してください。

Claude Code 用に専用の GCP プロジェクトを作成して、コスト追跡とアクセス制御を簡素化してください。

## 100 万トークンコンテキストウィンドウ

Claude Opus 4.6、Sonnet 4.6、Sonnet 4.5、および Sonnet 4 は、Vertex AI で[100 万トークンコンテキストウィンドウ](https://platform.claude.com/docs/en/build-with-claude/context-windows#1m-token-context-window)をサポートしています。Claude Code は、100 万トークンモデルバリアントを選択すると、拡張コンテキストウィンドウを自動的に有効にします。

ピン留めされたモデルの 100 万トークンコンテキストウィンドウを有効にするには、モデル ID に `[1m]` を追加します。詳細については、[サードパーティデプロイメント用のモデルをピン留めする](/ja/model-config#pin-models-for-third-party-deployments)を参照してください。

## トラブルシューティング

クォータの問題が発生した場合：

- [Cloud Console](https://cloud.google.com/docs/quotas/view-manage) を通じて現在のクォータを確認するか、クォータ増加をリクエストしてください

「モデルが見つかりません」404 エラーが発生した場合：

- [Model Garden](https://console.cloud.google.com/vertex-ai/model-garden) でモデルが有効になっていることを確認してください
- 指定されたリージョンへのアクセス権があることを確認してください
- `CLOUD_ML_REGION=global` を使用している場合、[Model Garden](https://console.cloud.google.com/vertex-ai/model-garden) の「サポートされている機能」でモデルがグローバルエンドポイントをサポートしていることを確認してください。グローバルエンドポイントをサポートしていないモデルの場合は、以下のいずれかを実行してください。
  - `ANTHROPIC_MODEL` または `ANTHROPIC_DEFAULT_HAIKU_MODEL` を通じてサポートされているモデルを指定するか、
  - `VERTEX_REGION_<MODEL_NAME>` 環境変数を使用して地域別エンドポイントを設定してください

429 エラーが発生した場合：

- 地域別エンドポイントの場合、プライマリモデルと小型/高速モデルが選択したリージョンでサポートされていることを確認してください
- `CLOUD_ML_REGION=global` に切り替えて、より良い可用性を得ることを検討してください

## 追加リソース

- [Vertex AI ドキュメント](https://cloud.google.com/vertex-ai/docs)
- [Vertex AI 価格](https://cloud.google.com/vertex-ai/pricing)
- [Vertex AI クォータと制限](https://cloud.google.com/vertex-ai/docs/quotas)
