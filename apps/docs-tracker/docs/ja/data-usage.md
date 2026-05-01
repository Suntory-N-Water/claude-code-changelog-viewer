---
title: data-usage
source: https://code.claude.com/docs/ja/data-usage.md
---

# データ使用

> Anthropic の Claude のデータ使用ポリシーについて学習します

## データポリシー

### データトレーニングポリシー

**コンシューマーユーザー（Free、Pro、Max プラン）**：
将来の Claude モデルの改善のためにデータを使用することを許可するかどうかを選択できます。この設定がオンの場合、Free、Pro、Max アカウントからのデータを使用して新しいモデルをトレーニングします（これらのアカウントから Claude Code を使用する場合も含みます）。

**商用ユーザー**：（Team および Enterprise プラン、API、サードパーティプラットフォーム、Claude Gov）既存のポリシーを維持します。Anthropic は、商用条件の下で Claude Code に送信されたコードまたはプロンプトを使用して生成モデルをトレーニングしません。ただし、カスタマーがモデル改善のためにデータを提供することを選択した場合は除きます（例えば、[Developer Partner Program](https://support.claude.com/ja/articles/11174108-about-the-development-partner-program)）。

### Development Partner Program

[Development Partner Program](https://support.claude.com/ja/articles/11174108-about-the-development-partner-program) などを通じて、トレーニング用の資料を提供する方法に明示的にオプトインした場合、提供された資料を使用してモデルをトレーニングする可能性があります。組織管理者は、組織の Development Partner Program に明示的にオプトインできます。このプログラムは Anthropic ファーストパーティ API でのみ利用可能であり、Bedrock または Vertex ユーザーは利用できないことに注意してください。

### `/feedback` コマンドを使用したフィードバック

`/feedback` コマンドを使用して Claude Code に関するフィードバックを送信することを選択した場合、製品とサービスを改善するためにフィードバックを使用する可能性があります。`/feedback` を通じて共有されたトランスクリプトは 5 年間保持されます。

### セッション品質調査

Claude Code で「How is Claude doing this session?」プロンプトが表示されたときに、この調査に応答する場合（「Dismiss」を選択する場合を含む）、数値評価のみが記録されます。この調査の一部として、会話トランスクリプト、入力、出力、またはその他のセッションデータは収集または保存されません。サムズアップ/ダウンフィードバックまたは `/feedback` レポートとは異なり、このセッション品質調査は単純な製品満足度メトリックです。

数値評価プロンプトの後、「Can Anthropic look at your session transcript to help us improve Claude Code?」と尋ねる別の追加フォローアップが表示される場合があります。これは数値評価とは異なるオプションの 2 番目のステップです。

- **Yes**：会話トランスクリプト、サブエージェントトランスクリプト、ディスクからの生のセッションログファイルを Anthropic にアップロードします。既知の API キーとトークンパターンはアップロード前に削除されます。ソースコード、ファイルコンテンツ、およびその他の会話コンテンツはそのままアップロードされます。共有されたトランスクリプトは最大 6 ヶ月間保持されます。
- **No**：何も送信せずに拒否します
- **Don't ask again**：拒否し、今後のセッションでこのフォローアップが表示されなくなります

**Yes** を明示的に選択しない限り、何もアップロードされません。[ゼロデータ保持](/ja/zero-data-retention) を設定している組織、または組織ポリシーで製品フィードバックが無効になっている組織は、このフォローアップを表示しません。数値評価プロンプトの後に送信されたセッショントランスクリプトを含む、この調査への応答は、データトレーニング設定に影響を与えず、AI モデルをトレーニングするために使用することはできません。

これらの調査を無効にするには、`CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY=1` を設定します。調査は、`DISABLE_TELEMETRY` または `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` が設定されている場合にも無効になります。無効にする代わりに頻度を制御するには、設定ファイルで [`feedbackSurveyRate`](/ja/settings#available-settings) を `0` から `1` の間の確率に設定します。

### データ保持

Anthropic は、アカウントタイプと設定に基づいて Claude Code データを保持します。

**コンシューマーユーザー（Free、Pro、Max プラン）**：

- モデル改善のためのデータ使用を許可するユーザー：モデル開発とセキュリティ改善をサポートするための 5 年間の保持期間
- モデル改善のためのデータ使用を許可しないユーザー：30 日間の保持期間
- プライバシー設定は、[claude.ai/settings/data-privacy-controls](https://claude.ai/settings/data-privacy-controls) でいつでも変更できます。

**商用ユーザー（Team、Enterprise、API）**：

- 標準：30 日間の保持期間
- [ゼロデータ保持](/ja/zero-data-retention)：Claude for Enterprise の Claude Code で利用可能。ZDR は組織ごとに有効になります。新しい各組織は、アカウントチームによって個別に ZDR を有効にする必要があります
- ローカルキャッシング：Claude Code クライアントは、セッション再開を有効にするために、`~/.claude/projects/` の下にセッショントランスクリプトをプレーンテキストでローカルに 30 日間保存します。`cleanupPeriodDays` で期間を調整できます。[application data](/ja/claude-directory#application-data) を参照して、何が保存されているか、およびそれをクリアする方法を確認してください。

Web 上の個別の Claude Code セッションはいつでも削除できます。セッションを削除すると、セッションのイベントデータが永久に削除されます。セッションの削除方法については、[Delete sessions](/ja/claude-code-on-the-web#delete-sessions) を参照してください。

データ保持慣行の詳細については、[Privacy Center](https://privacy.anthropic.com/) を参照してください。

詳細については、[Commercial Terms of Service](https://www.anthropic.com/legal/commercial-terms)（Team、Enterprise、API ユーザー向け）または [Consumer Terms](https://www.anthropic.com/legal/consumer-terms)（Free、Pro、Max ユーザー向け）および [Privacy Policy](https://www.anthropic.com/legal/privacy) を確認してください。

## データアクセス

すべてのファーストパーティユーザーの場合、[ローカル Claude Code](#local-claude-code-data-flow-and-dependencies) および [リモート Claude Code](#cloud-execution-data-flow-and-dependencies) に対してログされるデータについて詳しく知ることができます。[Remote Control](/ja/remote-control) セッションは、すべての実行がマシン上で行われるため、ローカルデータフローに従います。リモート Claude Code の場合、Claude は Claude Code セッションを開始するリポジトリにアクセスします。Claude は接続したが、セッションを開始していないリポジトリにはアクセスしません。

## ローカル Claude Code：データフローと依存関係

以下の図は、インストール中および通常の操作中に Claude Code が外部サービスにどのように接続するかを示しています。実線は必須の接続を示し、破線はオプションまたはユーザーが開始したデータフローを表します。

Claude Code はローカルで実行されます。LLM と対話するために、Claude Code はネットワーク経由でデータを送信します。このデータには、すべてのユーザープロンプトとモデル出力が含まれます。データは TLS 1.2 以上で転送中に暗号化されます。Claude Code はほとんどの一般的な VPN および LLM プロキシと互換性があります。

保存時の暗号化はモデルプロバイダーによって異なります：

| プロバイダー | 保存時の暗号化 |
| - | - |
| Anthropic API | インフラストラクチャレベルのディスク暗号化（AES-256）。サーバー側の永続化がない場合は [Zero Data Retention](/ja/zero-data-retention) を有効にしてください。 |
| Amazon Bedrock | AWS 管理キーを使用した AES-256。AWS KMS を通じてカスタマー管理キーが利用可能です。 |
| Google Cloud Vertex AI | Google 管理の暗号化キー。CMEK が利用可能です。 |
| Microsoft Foundry | リクエストは AES-256 ディスク暗号化を備えた Anthropic インフラストラクチャにルーティングされます。 |

Claude Code は Anthropic の API 上に構築されています。API のセキュリティ制御（API ロギング手順を含む）の詳細については、[Anthropic Trust Center](https://trust.anthropic.com) のコンプライアンスアーティファクトを参照してください。

### クラウド実行：データフローと依存関係

[Claude Code on the web](/ja/claude-code-on-the-web) を使用する場合、セッションはローカルではなく Anthropic が管理する仮想マシンで実行されます。クラウド環境では：

- **コードとデータストレージ**：リポジトリは分離された VM にクローンされます。コードとセッションデータは、アカウントタイプのデータ保持および使用ポリシーの対象となります（上記のデータ保持セクションを参照）
- **認証情報**：GitHub 認証はセキュアプロキシを通じて処理されます。GitHub 認証情報がサンドボックスに入ることはありません
- **ネットワークトラフィック**：すべてのアウトバウンドトラフィックは、監査ログと不正使用防止のためのセキュリティプロキシを通じて行われます
- **セッションデータ**：プロンプト、コード変更、出力は、ローカル Claude Code 使用と同じデータポリシーに従います

クラウド実行のセキュリティの詳細については、[Security](/ja/security#cloud-execution-security) を参照してください。

## テレメトリサービス

Claude Code は、ユーザーのマシンから Statsig サービスに接続して、レイテンシ、信頼性、使用パターンなどの運用メトリックをログします。このログには、コードまたはファイルパスは含まれません。データは TLS を使用して転送中に暗号化され、256 ビット AES 暗号化を使用して保存時に暗号化されます。詳細については、[Statsig security documentation](https://www.statsig.com/trust/security) を参照してください。Statsig テレメトリをオプトアウトするには、`DISABLE_TELEMETRY` 環境変数を設定します。

Claude Code は、ユーザーのマシンから Sentry に接続して、運用エラーログを記録します。データは TLS を使用して転送中に暗号化され、256 ビット AES 暗号化を使用して保存時に暗号化されます。詳細については、[Sentry security documentation](https://sentry.io/security/) を参照してください。エラーログをオプトアウトするには、`DISABLE_ERROR_REPORTING` 環境変数を設定します。

ユーザーが `/feedback` コマンドを実行すると、コードを含む完全な会話履歴のコピーが Anthropic に送信されます。データは転送中に TLS で暗号化されます。オプションで、公開リポジトリに GitHub イシューが作成されます。オプトアウトするには、`DISABLE_FEEDBACK_COMMAND` 環境変数を `1` に設定します。

## API プロバイダーのデフォルト動作

デフォルトでは、Bedrock、Vertex、または Foundry を使用する場合、エラーレポート、テレメトリ、およびバグレポートは無効になります。セッション品質調査と WebFetch ドメインセーフティチェックは例外であり、プロバイダーに関係なく実行されます。`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` を設定することで、調査を含むすべての非必須トラフィックをオプトアウトできます。この変数は WebFetch チェックに影響を与えません。WebFetch チェックには独自のオプトアウトがあります。以下は完全なデフォルト動作です：

| サービス | Claude API | Vertex API | Bedrock API | Foundry API |
| - | - | - | - | - |
| **Statsig（メトリクス）** | デフォルトオン。`DISABLE_TELEMETRY=1` で無効にします。 | デフォルトオフ。`CLAUDE_CODE_USE_VERTEX` は 1 である必要があります。 | デフォルトオフ。`CLAUDE_CODE_USE_BEDROCK` は 1 である必要があります。 | デフォルトオフ。`CLAUDE_CODE_USE_FOUNDRY` は 1 である必要があります。 |
| **Sentry（エラー）** | デフォルトオン。`DISABLE_ERROR_REPORTING=1` で無効にします。 | デフォルトオフ。`CLAUDE_CODE_USE_VERTEX` は 1 である必要があります。 | デフォルトオフ。`CLAUDE_CODE_USE_BEDROCK` は 1 である必要があります。 | デフォルトオフ。`CLAUDE_CODE_USE_FOUNDRY` は 1 である必要があります。 |
| **Claude API（`/feedback` レポート）** | デフォルトオン。`DISABLE_FEEDBACK_COMMAND=1` で無効にします。 | デフォルトオフ。`CLAUDE_CODE_USE_VERTEX` は 1 である必要があります。 | デフォルトオフ。`CLAUDE_CODE_USE_BEDROCK` は 1 である必要があります。 | デフォルトオフ。`CLAUDE_CODE_USE_FOUNDRY` は 1 である必要があります。 |
| **セッション品質調査** | デフォルトオン。`CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY=1` で無効にします。 | デフォルトオン。`CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY=1` で無効にします。 | デフォルトオン。`CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY=1` で無効にします。 | デフォルトオン。`CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY=1` で無効にします。 |
| **WebFetch ドメインセーフティチェック** | デフォルトオン。[settings](/ja/settings) で `skipWebFetchPreflight: true` で無効にします。 | デフォルトオン。[settings](/ja/settings) で `skipWebFetchPreflight: true` で無効にします。 | デフォルトオン。[settings](/ja/settings) で `skipWebFetchPreflight: true` で無効にします。 | デフォルトオン。[settings](/ja/settings) で `skipWebFetchPreflight: true` で無効にします。 |

すべての環境変数は `settings.json` にチェックインできます（[settings reference](/ja/settings) を参照）。

v2.1.126 以降、ホストプラットフォームが `CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST` を設定する場合、Statsig メトリクスは Vertex、Bedrock、および Foundry でデフォルトでオンになり、標準の `DISABLE_TELEMETRY` オプトアウトに従います。Sentry エラーレポートと `/feedback` レポートは、これらのプロバイダーではデフォルトでオフのままです。

### WebFetch ドメインセーフティチェック

URL をフェッチする前に、WebFetch ツールは要求されたホスト名を `api.anthropic.com` に送信して、Anthropic が管理するセーフティブロックリストに対してチェックします。ホスト名のみが送信され、完全な URL、パス、またはページコンテンツは送信されません。結果はホスト名ごとに 5 分間キャッシュされます。

このチェックは、使用するモデルプロバイダーに関係なく実行され、`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` の影響を受けません。ネットワークが `api.anthropic.com` をブロックしている場合、WebFetch リクエストはドメインをホワイトリストに登録するか、[settings](/ja/settings) で `skipWebFetchPreflight: true` を設定するまで失敗します。チェックを無効にすると、WebFetch はブロックリストに相談せずに任意の URL を取得しようとするため、Claude が到達できるドメインを制限する必要がある場合は [`WebFetch` permission rules](/ja/permissions#webfetch) と組み合わせてください。
