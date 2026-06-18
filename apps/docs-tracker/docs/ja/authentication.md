---
title: authentication
source: https://code.claude.com/docs/ja/authentication.md
---

# 認証

> Claude Code にログインし、個人、チーム、組織向けの認証を設定します。

Claude Code は、セットアップに応じて複数の認証方法をサポートしています。個人ユーザーは Claude.ai アカウントでログインでき、チームは Claude for Teams または Enterprise、Claude Console、または Amazon Bedrock、Google Vertex AI、Microsoft Foundry などのクラウドプロバイダーを使用できます。

Claude Code にログインする

[Claude Code をインストール](/ja/setup#install-claude-code)した後、ターミナルで `claude` を実行します。初回起動時に、Claude Code はログインするためのブラウザウィンドウを開きます。

ブラウザが自動的に開かない場合は、`c` を押してログイン URL をクリップボードにコピーし、ブラウザに貼り付けます。

ブラウザがサインイン後にリダイレクトされずにログインコードを表示する場合は、`Paste code here if prompted` プロンプトでそれをターミナルに貼り付けます。これは、ブラウザが Claude Code のローカルコールバックサーバーに到達できない場合に発生します。これは WSL2、SSH セッション、およびコンテナで一般的です。

以下のいずれかのアカウントタイプで認証できます。

- **Claude Pro または Max サブスクリプション**: Claude.ai アカウントでログインします。[claude.com/pricing](https://claude.com/pricing?utm_source=claude_code\&utm_medium=docs\&utm_content=authentication_pro_max) で購読してください。
- **Claude for Teams または Enterprise**: チーム管理者が招待した Claude.ai アカウントでログインします。
- **Claude Console**: Console 認証情報でログインします。管理者が事前に[招待](#claude-console-authentication)している必要があります。
- **クラウドプロバイダー**: 組織が [Amazon Bedrock](/ja/amazon-bedrock)、[Google Vertex AI](/ja/google-vertex-ai)、または [Microsoft Foundry](/ja/microsoft-foundry) を使用している場合は、`claude` を実行する前に必要な環境変数を設定してください。ブラウザログインは不要です。

ログアウトして再認証するには、Claude Code プロンプトで `/logout` と入力します。

ログインに問題がある場合は、[認証のトラブルシューティング](/ja/troubleshoot-install#login-and-authentication)を参照してください。

チーム認証を設定する

チームと組織の場合、Claude Code アクセスを以下のいずれかの方法で設定できます。

- [Claude for Teams または Enterprise](#claude-for-teams-or-enterprise)（ほとんどのチームに推奨）
- [Claude Console](#claude-console-authentication)
- [Amazon Bedrock](/ja/amazon-bedrock)
- [Google Vertex AI](/ja/google-vertex-ai)
- [Microsoft Foundry](/ja/microsoft-foundry)

Claude for Teams または Enterprise

[Claude for Teams](https://claude.com/pricing?utm_source=claude_code\&utm_medium=docs\&utm_content=authentication_teams#team-&-enterprise) と [Claude for Enterprise](https://anthropic.com/contact-sales?utm_source=claude_code\&utm_medium=docs\&utm_content=authentication_enterprise) は、Claude Code を使用する組織に最適なエクスペリエンスを提供します。チームメンバーは Claude Code と Web 上の Claude の両方にアクセスでき、一元化された請求とチーム管理が可能です。

- **Claude for Teams**: コラボレーション機能、管理ツール、請求管理を備えたセルフサービスプラン。小規模なチームに最適です。
- **Claude for Enterprise**: SSO、ドメインキャプチャ、ロールベースの権限、コンプライアンス API、および組織全体の Claude Code 設定のための管理ポリシー設定を追加します。セキュリティとコンプライアンス要件を持つ大規模な組織に最適です。

[Claude for Teams](https://claude.com/pricing?utm_source=claude_code\&utm_medium=docs\&utm_content=authentication_teams_step#team-&-enterprise) に購読するか、[Claude for Enterprise](https://anthropic.com/contact-sales?utm_source=claude_code\&utm_medium=docs\&utm_content=authentication_enterprise_step) の営業に連絡してください。

管理ダッシュボードからチームメンバーを招待します。

チームメンバーは Claude Code をインストールし、Claude.ai アカウントでログインします。

Claude Console 認証

API ベースの請求を希望する組織の場合、Claude Console を通じてアクセスを設定できます。

既存の Claude Console アカウントを使用するか、新しいアカウントを作成します。

以下のいずれかの方法でユーザーを追加できます。

- Console 内からユーザーを一括招待します。Settings -> Members -> Invite
- [SSO を設定](https://support.claude.com/en/articles/13132885-setting-up-single-sign-on-sso)

ユーザーを招待する際に、以下のいずれかを割り当てます。

- **Claude Code** ロール: ユーザーは Claude Code API キーのみを作成できます
- **Developer** ロール: ユーザーはあらゆる種類の API キーを作成できます

招待された各ユーザーは以下を実行する必要があります。

- Console 招待を受け入れる
- [システム要件を確認](/ja/setup#system-requirements)
- [Claude Code をインストール](/ja/setup#install-claude-code)
- Console アカウント認証情報でログイン

クラウドプロバイダー認証

Amazon Bedrock、Google Vertex AI、または Microsoft Foundry を使用するチームの場合。

[Bedrock ドキュメント](/ja/amazon-bedrock)、[Vertex ドキュメント](/ja/google-vertex-ai)、または [Microsoft Foundry ドキュメント](/ja/microsoft-foundry)に従ってください。

環境変数とクラウド認証情報を生成するための手順をユーザーに配布します。[ここで設定を管理する方法](/ja/settings)についてさらに詳しく読んでください。

ユーザーは [Claude Code をインストール](/ja/setup#install-claude-code)できます。

認証情報管理

Claude Code は認証情報を安全に管理します。

- **保存場所**:
  - macOS では、認証情報は暗号化された macOS Keychain に保存されます。
  - Linux では、認証情報は `~/.claude/.credentials.json` に保存され、ファイルモードは `0600` です。
  - Windows では、認証情報は `%USERPROFILE%\.claude\.credentials.json` に保存され、ユーザープロファイルディレクトリのアクセス制御を継承します。これにより、ファイルはデフォルトでユーザーアカウントに制限されます。
  - Linux または Windows で `CLAUDE_CONFIG_DIR` 環境変数を設定している場合、`.credentials.json` ファイルはそのディレクトリの下に配置されます。
  - Claude Code は `/login` と `/logout` を通じて `.credentials.json` を管理します。リクエストをカスタム API エンドポイント経由でルーティングするには、代わりに [`ANTHROPIC_BASE_URL`](/ja/env-vars) 環境変数を設定してください。
- **サポートされている認証タイプ**: Claude.ai 認証情報、Claude API 認証情報、Azure Auth、Bedrock Auth、および Vertex Auth。
- **カスタム認証情報スクリプト**: [`apiKeyHelper`](/ja/settings#available-settings) 設定は、API キーを返すシェルスクリプトを実行するように設定できます。
- **更新間隔**: デフォルトでは、`apiKeyHelper` は 5 分後または HTTP 401 レスポンス時に呼び出されます。カスタム更新間隔の場合は、`CLAUDE_CODE_API_KEY_HELPER_TTL_MS` 環境変数を設定してください。
- **遅いヘルパー通知**: `apiKeyHelper` がキーを返すのに 10 秒以上かかる場合、Claude Code はプロンプトバーに経過時間を表示する警告通知を表示します。この通知が定期的に表示される場合は、認証情報スクリプトを最適化できるかどうかを確認してください。

`apiKeyHelper`、`ANTHROPIC_API_KEY`、および `ANTHROPIC_AUTH_TOKEN` はターミナル CLI セッションにのみ適用されます。Claude Desktop とクラウドセッションは OAuth のみを使用し、`apiKeyHelper` を呼び出したり、API キー環境変数を読み込んだりしません。

認証の優先順位

複数の認証情報が存在する場合、Claude Code は以下の順序で 1 つを選択します。

1. `CLAUDE_CODE_USE_BEDROCK`、`CLAUDE_CODE_USE_VERTEX`、または `CLAUDE_CODE_USE_FOUNDRY` が設定されている場合のクラウドプロバイダー認証情報。セットアップについては、[サードパーティ統合](/ja/third-party-integrations)を参照してください。
2. `ANTHROPIC_AUTH_TOKEN` 環境変数。`Authorization: Bearer` ヘッダーとして送信されます。Anthropic API キーではなくベアラートークンで認証する [LLM ゲートウェイまたはプロキシ](/ja/llm-gateway)を通じてルーティングする場合に使用します。
3. `ANTHROPIC_API_KEY` 環境変数。`X-Api-Key` ヘッダーとして送信されます。[Claude Console](https://platform.claude.com) からのキーを使用して Anthropic API に直接アクセスする場合に使用します。対話モードでは、キーを承認または拒否するよう 1 回プロンプトが表示され、選択が記憶されます。後で変更するには、`/config` の「Use custom API key」トグルを使用します。非対話モード（`-p`）では、キーが存在する場合は常に使用されます。
4. [`apiKeyHelper`](/ja/settings#available-settings) スクリプト出力。動的または回転する認証情報（ボルトから取得した短期トークンなど）に使用します。
5. `CLAUDE_CODE_OAUTH_TOKEN` 環境変数。[`claude setup-token`](#generate-a-long-lived-token) によって生成された長期 OAuth トークン。ブラウザログインが利用できない CI パイプラインとスクリプトに使用します。
6. `/login` からのサブスクリプション OAuth 認証情報。これは Claude Pro、Max、Team、および Enterprise ユーザーのデフォルトです。

アクティブな Claude サブスクリプションがあり、環境に `ANTHROPIC_API_KEY` も設定されている場合、API キーは承認されると優先されます。キーが無効または期限切れの組織に属している場合、これは認証エラーを引き起こす可能性があります。`unset ANTHROPIC_API_KEY` を実行してサブスクリプションにフォールバックし、`/status` をチェックしてどの方法がアクティブであるかを確認します。

[Claude Code on the Web](/ja/claude-code-on-the-web) は常にサブスクリプション認証情報を使用します。サンドボックス環境の `ANTHROPIC_API_KEY` と `ANTHROPIC_AUTH_TOKEN` はそれらをオーバーライドしません。

長期トークンを生成する

CI パイプライン、スクリプト、または対話的なブラウザログインが利用できない他の環境の場合、`claude setup-token` で 1 年間の OAuth トークンを生成します。

```bash
claude setup-token
```

このコマンドは OAuth 認可を通じてウォークスルーし、トークンをターミナルに出力します。トークンはどこにも保存されません。トークンをコピーして、認証したい場所で `CLAUDE_CODE_OAUTH_TOKEN` 環境変数として設定します。

```bash
export CLAUDE_CODE_OAUTH_TOKEN=your-token
```

このトークンは Claude サブスクリプションで認証され、Pro、Max、Team、または Enterprise プランが必要です。推論のみにスコープされており、[Remote Control](/ja/remote-control) セッションを確立することはできません。

[Bare mode](/ja/headless#start-faster-with-bare-mode) は `CLAUDE_CODE_OAUTH_TOKEN` を読み込みません。スクリプトが `--bare` を渡す場合は、`ANTHROPIC_API_KEY` または `apiKeyHelper` で認証します。
