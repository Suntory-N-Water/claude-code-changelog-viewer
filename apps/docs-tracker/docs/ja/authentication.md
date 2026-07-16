---
title: authentication
source: https://code.claude.com/docs/ja/authentication.md
---

# 認証

> Claude Code にログインし、個人、チーム、組織向けの認証を設定します。

Claude Code は、セットアップに応じて複数の認証方法をサポートしています。個人ユーザーは Claude.ai アカウントでログインでき、チームは Claude for Teams または Enterprise、Claude Console、または Amazon Bedrock、Google Cloud の Agent Platform、Microsoft Foundry などのクラウドプロバイダーを使用できます。

Claude Code にログインする

[Claude Code をインストール](/ja/setup#install-claude-code)した後、ターミナルで `claude` を実行します。初回起動時に、Claude Code はログインするためのブラウザウィンドウを開きます。

ブラウザが自動的に開かない場合は、`c` を押してログイン URL をクリップボードにコピーし、ブラウザに貼り付けます。

ブラウザがサインイン後にリダイレクトされずにログインコードを表示する場合は、`Paste code here if prompted` プロンプトでそれをターミナルに貼り付けます。これは、ブラウザが Claude Code のローカルコールバックサーバーに到達できない場合に発生します。これは WSL2、SSH セッション、およびコンテナで一般的です。

ログインが完了すると、ターミナルに `Login successful` と表示され、`Enter` キーを押して続行するよう求められます。

以下のいずれかのアカウントタイプで認証できます。

- **Claude Pro または Max サブスクリプション**: Claude.ai アカウントでログインします。[claude.com/pricing](https://claude.com/pricing?utm_source=claude_code\&utm_medium=docs\&utm_content=authentication_pro_max) で購読してください。
- **Claude for Teams または Enterprise**: チーム管理者が招待した Claude.ai アカウントでログインします。
- **Claude Console**: Console 認証情報でログインします。管理者が事前に[招待](#claude-console-authentication)している必要があります。
- **クラウドプロバイダー**: 組織が [Amazon Bedrock](/ja/amazon-bedrock)、[Google Cloud の Agent Platform](/ja/google-vertex-ai)、または [Microsoft Foundry](/ja/microsoft-foundry) を使用している場合は、`claude` を実行する前に必要な環境変数を設定するか、ログインプロンプトで **3rd-party platform** を選択してください。これにより、Bedrock と Vertex AI 向けのインタラクティブセットアップウィザードが起動します。ブラウザログインは不要です。
- **クラウドゲートウェイ**: 組織がセルフホストされた [Claude apps gateway](/ja/claude-apps-gateway) を実行している場合は、`/login` を通じて企業 SSO でサインインします。ゲートウェイが発行したトークンはセッションの唯一の認証情報です。

管理者は [`forceLoginMethod` と `forceLoginOrgUUID`](/ja/settings#available-settings) マネージド設定を使用してインタラクティブログインを制限できます。いずれかが設定されている場合、`ANTHROPIC_API_KEY`、`ANTHROPIC_AUTH_TOKEN`、または `apiKeyHelper` によって認証されたセッションはスタートアップ時にブロックされます。クラウドプロバイダーセッションは影響を受けません。

ログアウトして再認証するには、Claude Code プロンプトで `/logout` と入力します。ログアウトすると、初回起動セットアップ状態もリセットされるため、次回 `claude` を実行するときはログインとセットアップを再度実行します。

ログインに問題がある場合は、[認証のトラブルシューティング](/ja/troubleshoot-install#login-and-authentication)を参照してください。

チーム認証を設定する

チームと組織の場合、Claude Code アクセスを以下のいずれかの方法で設定できます。

- [Claude for Teams または Enterprise](#claude-for-teams-or-enterprise)（ほとんどのチームに推奨）
- [Claude Console](#claude-console-authentication)
- [Claude apps gateway](/ja/claude-apps-gateway)（開発者を IdP でサインインさせ、設定したクラウドプロバイダーに推論をルーティングする自己ホスト型ゲートウェイ）
- [Amazon Bedrock](/ja/amazon-bedrock)
- [Google Cloud の Agent Platform](/ja/google-vertex-ai)
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

Amazon Bedrock、Google Cloud の Agent Platform、または Microsoft Foundry を使用するチームの場合。

[Amazon Bedrock ドキュメント](/ja/amazon-bedrock)、[Google Cloud の Agent Platform ドキュメント](/ja/google-vertex-ai)、または [Microsoft Foundry ドキュメント](/ja/microsoft-foundry)に従ってください。

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
- **サポートされている認証タイプ**: Claude.ai 認証情報、Claude API 認証情報、Microsoft Foundry Auth、Bedrock Auth、Vertex Auth、および [Claude apps gateway](/ja/claude-apps-gateway) セッショントークン。
- **カスタム認証情報スクリプト**: [`apiKeyHelper`](/ja/settings#available-settings) 設定は、API キーを返すシェルスクリプトを実行するように設定できます。
- **更新間隔**: デフォルトでは、`apiKeyHelper` は 5 分後または HTTP 401 レスポンス時に呼び出されます。カスタム更新間隔の場合は、`CLAUDE_CODE_API_KEY_HELPER_TTL_MS` 環境変数を設定してください。
- **遅いヘルパー通知**: `apiKeyHelper` がキーを返すのに 10 秒以上かかる場合、Claude Code はプロンプトバーに経過時間を表示する警告通知を表示します。この通知が定期的に表示される場合は、認証情報スクリプトを最適化できるかどうかを確認してください。
- **ヘルパーの失敗**: スクリプトがエラーで終了したり、タイムアウトしたり、何も出力しない場合、リクエストは 3 回の試行内に [`Your apiKeyHelper script is failing`](/ja/errors#your-apikeyhelper-script-is-failing) で失敗します。v2.1.208 より前では、ヘルパーの失敗は約 10 回のサイレント再試行後に汎用 401 として表示されていました。

`apiKeyHelper`、`ANTHROPIC_API_KEY`、および `ANTHROPIC_AUTH_TOKEN` は CLI およびそれをラップするサーフェス（VS Code 拡張機能、Agent SDK、GitHub Actions を含む）に適用されます。Claude Desktop とクラウドセッションは `apiKeyHelper` を呼び出したり、これらの環境変数を読み込んだりしません。OAuth を使用します。ただし、[サードパーティ推論設定](/ja/llm-gateway-connect#desktop-app)を実行しているデスクトップセッションは、その設定の認証情報で認証します。

期限切れ間近のログインを更新する

`/login` で作成したログインが期限切れまで 5 日以内になると、Claude Code はスタートアップ時に警告を表示します。`Your login expires in 3 days · run /login to renew`。Claude Code v2.1.203 以降が必要です。

`/login` を実行して更新します。警告は情報提供のみであり、リクエストをブロックすることはありません。ログインが実際に期限切れになるまで認証は機能し続けます。ログインの有効期間自体は変わりません。事前警告は v2.1.203 が追加するものです。

保存されたログインが期限切れになり、更新できなくなると、再度サインインするまで、各リクエストは [`Login expired · Please run /login`](/ja/errors#login-expired) で失敗します。v2.1.206 より前では、期限切れのログインはモデルエラーとして表示されていました。

警告は claude.ai または Claude Console ログインがアクティブな認証情報である場合にのみ表示され、クラウドプロバイダー、`ANTHROPIC_API_KEY`、`ANTHROPIC_AUTH_TOKEN`、または `apiKeyHelper` が認証情報を提供する場合には表示されません。

更新を早期に行うことは、無人で実行されるセッションにとって最も重要です。[agent view のバックグラウンドセッション](/ja/agent-view)または [Remote Control](/ja/remote-control) セッションがログインより長く実行される場合、認証情報が期限切れになると進行が停止し、再度サインインするまで復旧できません。

認証の優先順位

複数の認証情報が存在する場合、Claude Code は以下の順序で 1 つを選択します。

1. `CLAUDE_CODE_USE_BEDROCK`、`CLAUDE_CODE_USE_VERTEX`、または `CLAUDE_CODE_USE_FOUNDRY` が設定されている場合のクラウドプロバイダー認証情報。セットアップについては、[サードパーティ統合](/ja/third-party-integrations)を参照してください。
2. `ANTHROPIC_AUTH_TOKEN` 環境変数。`Authorization: Bearer` ヘッダーとして送信されます。Anthropic API キーではなくベアラートークンで認証する [LLM ゲートウェイまたはプロキシ](/ja/llm-gateway)を通じてルーティングする場合に使用します。
3. `ANTHROPIC_API_KEY` 環境変数。`X-Api-Key` ヘッダーとして送信されます。[Claude Console](https://platform.claude.com) からのキーを使用して Anthropic API に直接アクセスする場合に使用します。対話モードでは、キーを承認または拒否するよう 1 回プロンプトが表示され、選択が記憶されます。後で変更するには、`/config` の「Use custom API key」トグルを使用します。トグルは `ANTHROPIC_API_KEY` が環境に設定されている間のみ表示されます。非対話モード（`-p`）では、キーが存在する場合は常に使用されます。
4. [`apiKeyHelper`](/ja/settings#available-settings) スクリプト出力。動的または回転する認証情報（ボルトから取得した短期トークンなど）に使用します。
5. `CLAUDE_CODE_OAUTH_TOKEN` 環境変数。[`claude setup-token`](#generate-a-long-lived-token) によって生成された長期 OAuth トークン。ブラウザログインが利用できない CI パイプラインとスクリプトに使用します。
6. `/login` からのサブスクリプション OAuth 認証情報。これは Claude Pro、Max、Team、および Enterprise ユーザーのデフォルトです。

署名済みの [Claude apps gateway](/ja/claude-apps-gateway) セッションはこのリストの外に位置します。これは Amazon Bedrock または Google Cloud の Agent Platform のようなプロバイダー選択であり、それらより優先されます。ゲートウェイセッションが存在する場合、CLI は `CLAUDE_CODE_USE_BEDROCK`、`CLAUDE_CODE_USE_VERTEX`、または `CLAUDE_CODE_USE_FOUNDRY` が設定されていても、ゲートウェイトークンで認証され、上記のベアラートークン、API キー、および `apiKeyHelper` エントリは使用されません。

アクティブな Claude サブスクリプションがあり、環境に `ANTHROPIC_API_KEY` も設定されている場合、API キーは承認されると優先されます。キーが無効または期限切れの組織に属している場合、これは認証エラーを引き起こす可能性があります。`unset ANTHROPIC_API_KEY` を実行してサブスクリプションにフォールバックし、`/status` をチェックしてどの方法がアクティブであるかを確認します。`Login method` 行はサブスクリプションアカウントを表示し、API キーが使用中の場合は `API key` 行が表示されます。

[Claude Code on the Web](/ja/claude-code-on-the-web) は常にサブスクリプション認証情報を使用します。サンドボックス環境で `ANTHROPIC_API_KEY` または `ANTHROPIC_AUTH_TOKEN` を設定しても、サブスクリプション認証情報はオーバーライドされません。

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
