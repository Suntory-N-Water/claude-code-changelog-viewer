---
title: network-config
source: https://code.claude.com/docs/ja/network-config.md
---

# エンタープライズネットワーク設定

> プロキシサーバー、カスタム認証局（CA）、相互 Transport Layer Security（mTLS）認証を使用して、エンタープライズ環境向けに Claude Code を設定します。

Claude Code は、環境変数を通じてさまざまなエンタープライズネットワークおよびセキュリティ設定をサポートしています。これには、企業プロキシサーバーを通じたトラフィックのルーティング、カスタム認証局（CA）の信頼、および強化されたセキュリティのための相互 Transport Layer Security（mTLS）証明書による認証が含まれます。

このページに表示されているすべての環境変数は、[`settings.json`](/ja/settings) でも設定できます。

## プロキシ設定

### 環境変数

Claude Code は標準的なプロキシ環境変数に対応しています。

```bash
# HTTPS プロキシ（推奨）
export HTTPS_PROXY=https://proxy.example.com:8080

# HTTP プロキシ（HTTPS が利用できない場合）
export HTTP_PROXY=http://proxy.example.com:8080

# 特定のリクエストのプロキシをバイパス - スペース区切り形式
export NO_PROXY="localhost 192.168.1.1 example.com .example.com"
# 特定のリクエストのプロキシをバイパス - カンマ区切り形式
export NO_PROXY="localhost,192.168.1.1,example.com,.example.com"
# すべてのリクエストのプロキシをバイパス
export NO_PROXY="*"
```

Claude Code は SOCKS プロキシをサポートしていません。

### 基本認証

プロキシが基本認証を必要とする場合は、プロキシ URL に認証情報を含めます。

```bash
export HTTPS_PROXY=http://username:password@proxy.example.com:8080
```

スクリプトにパスワードをハードコーディングすることは避けてください。代わりに環境変数またはセキュアな認証情報ストレージを使用してください。

高度な認証（NTLM、Kerberos など）が必要なプロキシの場合は、認証方法をサポートする LLM Gateway サービスの使用を検討してください。

## CA 証明書ストア

デフォルトでは、Claude Code は、バンドルされた Mozilla CA 証明書とオペレーティングシステムの証明書ストアの両方を信頼しています。CrowdStrike Falcon や Zscaler などのエンタープライズ TLS インスペクションプロキシは、ルート証明書が OS 信頼ストアにインストールされている場合、追加の設定なしで動作します。

システム CA ストア統合には、ネイティブ Claude Code バイナリ配布が必要です。Node.js ランタイムで実行している場合、システム CA ストアは自動的にマージされません。その場合は、`NODE_EXTRA_CA_CERTS=/path/to/ca-cert.pem` を設定して、エンタープライズルート CA を信頼してください。

`CLAUDE_CODE_CERT_STORE` は、カンマ区切りのソースリストを受け入れます。認識される値は、Claude Code に付属する Mozilla CA セットの場合は `bundled`、オペレーティングシステムの信頼ストアの場合は `system` です。デフォルトは `bundled,system` です。

バンドルされた Mozilla CA セットのみを信頼するには：

```bash
export CLAUDE_CODE_CERT_STORE=bundled
```

OS 証明書ストアのみを信頼するには：

```bash
export CLAUDE_CODE_CERT_STORE=system
```

`CLAUDE_CODE_CERT_STORE` には、専用の `settings.json` スキーマキーがありません。`~/.claude/settings.json` の `env` ブロック、またはプロセス環境で直接設定してください。

## カスタム CA 証明書

エンタープライズ環境でカスタム CA を使用している場合は、Claude Code をそれを直接信頼するように設定します。

```bash
export NODE_EXTRA_CA_CERTS=/path/to/ca-cert.pem
```

## mTLS 認証

クライアント証明書認証が必要なエンタープライズ環境の場合：

```bash
# 認証用のクライアント証明書
export CLAUDE_CODE_CLIENT_CERT=/path/to/client-cert.pem

# クライアント秘密鍵
export CLAUDE_CODE_CLIENT_KEY=/path/to/client-key.pem

# オプション：暗号化された秘密鍵のパスフレーズ
export CLAUDE_CODE_CLIENT_KEY_PASSPHRASE="your-passphrase"
```

## ネットワークアクセス要件

Claude Code は以下の URL へのアクセスが必要です。

- `api.anthropic.com`：Claude API エンドポイント
- `claude.ai`：claude.ai アカウント用の認証
- `platform.claude.com`：Anthropic Console アカウント用の認証

これらの URL がプロキシ設定とファイアウォールルールでホワイトリストに登録されていることを確認してください。これは、特にコンテナ化された環境または制限されたネットワーク環境で Claude Code を使用する場合に重要です。

[Bedrock](/ja/amazon-bedrock)、[Vertex AI](/ja/google-vertex-ai)、または [Foundry](/ja/microsoft-foundry) を使用する場合、モデルトラフィックは `api.anthropic.com` ではなくプロバイダーに送信されます。WebFetch ツールは、[`skipWebFetchPreflight: true`](/ja/settings) を [settings](/ja/settings) で設定しない限り、[ドメイン安全性チェック](/ja/data-usage#webfetch-domain-safety-check) のために `api.anthropic.com` を呼び出します。

ネイティブインストーラーと更新チェックでは、以下の URL も必要です。古い Claude Code バージョンを実行しているクライアントが `storage.googleapis.com` からフェッチするため、両方をホワイトリストに登録してください。npm を通じて Claude Code をインストールするか、独自のバイナリ配布を管理する場合、エンドユーザーはアクセスが不要な場合があります。

- `downloads.claude.ai`：Claude Code バイナリ、自動更新プログラム、バージョンポインタ、マニフェスト、インストールスクリプト、署名キー、およびプラグイン実行可能ファイルのダウンロードホスト
- `storage.googleapis.com`：古いクライアントで使用されるレガシーダウンロードホスト

[Chrome 統合](/ja/chrome) は WebSocket ブリッジを通じてブラウザ拡張機能に接続します。Chrome で Claude を使用する場合は、アウトバウンド WebSocket 接続用に `bridge.claudeusercontent.com` をホワイトリストに登録してください。

[Claude Code on the web](/ja/claude-code-on-the-web) および [Code Review](/ja/code-review) は、Anthropic が管理するインフラストラクチャからリポジトリに接続します。GitHub Enterprise Cloud 組織が IP アドレスによるアクセスを制限している場合は、[インストール済み GitHub Apps の IP 許可リスト継承を有効にします](https://docs.github.com/en/enterprise-cloud@latest/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/managing-allowed-ip-addresses-for-your-organization#allowing-access-by-github-apps)。Claude GitHub App は IP 範囲を登録するため、この設定を有効にするとマニュアル設定なしでアクセスが可能になります。代わりに[範囲を許可リストに手動で追加する](https://docs.github.com/en/enterprise-cloud@latest/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/managing-allowed-ip-addresses-for-your-organization#adding-an-allowed-ip-address)場合、または他のファイアウォールを設定する場合は、[Anthropic API IP アドレス](https://platform.claude.com/docs/en/api/ip-addresses) を参照してください。

自社ホスト型の [GitHub Enterprise Server](/ja/github-enterprise-server) インスタンスがファイアウォールの背後にある場合は、Anthropic インフラストラクチャがリポジトリをクローンしてレビューコメントを投稿できるように、同じ [Anthropic API IP アドレス](https://platform.claude.com/docs/en/api/ip-addresses) をホワイトリストに登録してください。

## その他のリソース

- [Claude Code 設定](/ja/settings)
- [環境変数リファレンス](/ja/env-vars)
- [トラブルシューティングガイド](/ja/troubleshooting)
