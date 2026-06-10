---
title: security
source: https://code.claude.com/docs/ja/security.md
---

# セキュリティ

> Claude Code のセキュリティ対策とセキュアな使用方法のベストプラクティスについて学びます。

セキュリティへのアプローチ方法

セキュリティの基盤

コードのセキュリティは最優先事項です。Claude Code はセキュリティを中核に据えて構築されており、Anthropic の包括的なセキュリティプログラムに従って開発されています。詳細情報とリソース（SOC 2 Type 2 レポート、ISO 27001 証明書など）については、[Anthropic Trust Center](https://trust.anthropic.com) をご覧ください。

パーミッションベースのアーキテクチャ

Claude Code はデフォルトで厳密な読み取り専用パーミッションを使用します。追加のアクション（ファイルの編集、テストの実行、コマンドの実行）が必要な場合、Claude Code は明示的なパーミッションをリクエストします。ユーザーは、アクションを 1 回だけ承認するか、自動的に許可するかを制御できます。

Claude Code は透明性とセキュリティを備えるように設計されています。例えば、bash コマンドを実行する前に承認が必要であり、直接制御できます。このアプローチにより、ユーザーと組織はパーミッションを直接設定できます。

詳細なパーミッション設定については、[Permissions](/ja/permissions) を参照してください。

組み込み保護機能

agentic システムのリスクを軽減するために：

- **サンドボックス化された bash ツール**: [Sandbox](/ja/sandboxing) bash コマンドをファイルシステムとネットワークの分離で実行し、パーミッションプロンプトを減らしながらセキュリティを維持します。`/sandbox` で有効にして、Claude Code が自律的に動作できる境界を定義します
- **書き込みアクセス制限**: Claude Code は開始されたフォルダとそのサブフォルダにのみ書き込みでき、明示的なパーミッションなしに親ディレクトリのファイルを変更することはできません。Claude Code は作業ディレクトリ外のファイルを読み取ることができます（システムライブラリと依存関係へのアクセスに便利です）が、書き込み操作はプロジェクトスコープに厳密に限定され、明確なセキュリティ境界を作成します
- **プロンプト疲労の軽減**: ユーザーごと、コードベースごと、または組織ごとに頻繁に使用される安全なコマンドのホワイトリスト化をサポート
- **Accept Edits モード**: ファイル編集と `mkdir`、`touch`、`rm`、`mv`、`cp`、`sed` などの固定セットのファイルシステム Bash コマンドを作業ディレクトリ内のパスに対して自動承認します。その他の Bash コマンドとスコープ外のパスはプロンプトが表示されます

ユーザーの責任

Claude Code は、ユーザーが付与したパーミッションのみを持ちます。承認前に、提案されたコードとコマンドのセキュリティを確認する責任があります。

プロンプトインジェクションから保護する

プロンプトインジェクションは、攻撃者が悪意のあるテキストを挿入することで AI アシスタントの指示をオーバーライドまたは操作しようとする手法です。Claude Code にはこれらの攻撃に対する複数のセーフガードが含まれています：

コア保護機能

- **パーミッションシステム**: 機密操作には明示的な承認が必要です
- **コンテキスト認識分析**: 完全なリクエストを分析して潜在的に有害な指示を検出します
- **入力サニタイゼーション**: ユーザー入力を処理することでコマンドインジェクションを防止します
- **コマンドブロックリスト**: `curl` や `wget` のようにウェブから任意のコンテンツを取得するリスクのあるコマンドをデフォルトでブロックします。明示的に許可する場合は、[パーミッションパターンの制限](/ja/permissions#tool-specific-permission-rules) に注意してください

プライバシーセーフガード

データを保護するために、複数のセーフガードを実装しています：

- 機密情報の保持期間の制限（詳細については [Privacy Center](https://privacy.anthropic.com/en/articles/10023548-how-long-do-you-store-my-data) を参照してください）
- ユーザーセッションデータへのアクセス制限
- データトレーニング設定に対するユーザーコントロール。コンシューマーユーザーは [プライバシー設定](https://claude.ai/settings/privacy) をいつでも変更できます。

詳細については、[Commercial Terms of Service](https://www.anthropic.com/legal/commercial-terms)（Team、Enterprise、API ユーザー向け）または [Consumer Terms](https://www.anthropic.com/legal/consumer-terms)（Free、Pro、Max ユーザー向け）および [Privacy Policy](https://www.anthropic.com/legal/privacy) をご確認ください。

追加のセーフガード

- **ネットワークリクエスト承認**: ネットワークリクエストを行うツールはデフォルトでユーザー承認が必要です
- **分離されたコンテキストウィンドウ**: Web fetch は潜在的に悪意のあるプロンプトの注入を避けるために別のコンテキストウィンドウを使用します
- **信頼検証**: 初回のコードベース実行と新しい MCP サーバーには信頼検証が必要です
  - 注：信頼検証は `-p` フラグで非対話的に実行する場合は無効になります。例外は [`--worktree`](/ja/worktrees) で、これはディレクトリに対して信頼が受け入れられていることが必要です
  - 注：Claude Code をホームディレクトリで直接起動する場合、信頼受け入れは現在のセッションのみ保持され、ディスクに書き込まれないため、起動するたびにプロンプトが再度表示されます。これを永続化するための設定はありません。代わりに、プロジェクトサブディレクトリから Claude Code を起動してください。そこでは信頼受け入れはディレクトリごとに保存されます
- **コマンドインジェクション検出**: 疑わしい bash コマンドは、以前にホワイトリストに登録されていても手動承認が必要です
- **フェイルクローズドマッチング**: マッチしないコマンドはデフォルトで手動承認が必要です
- **自然言語説明**: 複雑な bash コマンドにはユーザーの理解のための説明が含まれます
- **セキュアな認証情報ストレージ**: API キーとトークンは暗号化されます。[Credential Management](/ja/authentication#credential-management) を参照してください

**Windows WebDAV セキュリティリスク**: Windows で Claude Code を実行する場合、WebDAV を有効にしたり、Claude Code に `\\*` などの WebDAV サブディレクトリを含む可能性のあるパスへのアクセスを許可することはお勧めしません。[WebDAV は Microsoft によって非推奨になっています](https://learn.microsoft.com/en-us/windows/whats-new/deprecated-features#:~:text=The%20Webclient%20\(WebDAV\)%20service%20is%20deprecated) セキュリティリスクのため。WebDAV を有効にすると、Claude Code がリモートホストへのネットワークリクエストをトリガーし、パーミッションシステムをバイパスする可能性があります。

**信頼できないコンテンツを使用する場合のベストプラクティス**：

1. 承認前に提案されたコマンドを確認します
2. 信頼できないコンテンツを Claude に直接パイプすることを避けます
3. 重要なファイルへの提案された変更を確認します
4. 仮想マシン（VM）を使用してスクリプトを実行し、ツール呼び出しを行います。特に外部 Web サービスと対話する場合
5. `/feedback` で疑わしい動作を報告します

これらの保護機能はリスクを大幅に軽減しますが、どのシステムもすべての攻撃に完全に免疫があるわけではありません。AI ツールを使用する場合は常に良好なセキュリティプラクティスを維持してください。

MCP セキュリティ

Claude Code ユーザーは Model Context Protocol（MCP）サーバーを設定できます。許可された MCP サーバーのリストは、エンジニアがソース管理にチェックインする Claude Code 設定の一部として、ソースコードで設定されます。

独自の MCP サーバーを作成するか、信頼できるプロバイダーからの MCP サーバーを使用することをお勧めします。Claude Code パーミッションを MCP サーバー用に設定できます。Anthropic は MCP サーバーを [リスティング基準](https://claude.com/docs/connectors/building/review-criteria) に照らして確認してから [Anthropic Directory](https://claude.ai/directory) に追加しますが、MCP サーバーのセキュリティ監査または管理は行いません。

IDE セキュリティ

IDE で Claude Code を実行する場合の詳細については、[VS Code security and privacy](/ja/vs-code#security-and-privacy) を参照してください。

クラウド実行セキュリティ

[Claude Code on the web](/ja/claude-code-on-the-web) を使用する場合、追加のセキュリティ制御が実施されます：

- **分離された仮想マシン**: 各クラウドセッションは分離された Anthropic 管理 VM で実行されます
- **ネットワークアクセス制御**: ネットワークアクセスはデフォルトで制限され、無効にするか特定のドメインのみを許可するように設定できます
- **認証情報保護**: 認証はサンドボックス内でスコープされた認証情報を使用するセキュアプロキシを通じて処理され、その後実際の GitHub 認証トークンに変換されます
- **ブランチ制限**: Git push 操作は現在のワーキングブランチに制限されます
- **監査ログ**: クラウド環境内のすべての操作はコンプライアンスと監査目的でログされます
- **自動クリーンアップ**: クラウド環境はセッション完了後に自動的に終了されます

クラウド実行の詳細については、[Claude Code on the web](/ja/claude-code-on-the-web) を参照してください。

[Remote Control](/ja/remote-control) セッションは異なる方法で動作します：Web インターフェースはローカルマシンで実行されている Claude Code プロセスに接続します。すべてのコード実行とファイルアクセスはローカルに留まり、ローカル Claude Code セッション中に流れるのと同じデータが TLS 経由で Anthropic API を通じて流れます。クラウド VM またはサンドボックスは関与しません。接続は複数の短命で狭くスコープされた認証情報を使用し、各認証情報は特定の目的に限定され、独立して有効期限が切れ、単一の侵害された認証情報のブラストラディウスを制限します。

セキュリティベストプラクティス

機密コードの使用

- 承認前にすべての提案された変更を確認してください
- 機密リポジトリにはプロジェクト固有のパーミッション設定を使用してください
- 追加の分離のために [dev containers](/ja/devcontainer) の使用を検討してください
- `/permissions` で定期的にパーミッション設定を監査してください

チームセキュリティ

- [managed settings](/ja/settings#settings-files) を使用して組織標準を実施してください
- 承認されたパーミッション設定をバージョン管理を通じて共有してください
- チームメンバーにセキュリティベストプラクティスについてトレーニングを行ってください
- [OpenTelemetry metrics](/ja/monitoring-usage) を通じて Claude Code の使用を監視してください
- [`ConfigChange` hooks](/ja/hooks#configchange) でセッション中の設定変更を監査またはブロックしてください

セキュリティ問題の報告

Claude Code でセキュリティ脆弱性を発見した場合：

1. 公開で開示しないでください
2. [HackerOne program](https://hackerone.com/4f1f16ba-10d3-4d09-9ecc-c721aad90f24/embedded_submissions/new) を通じて報告してください
3. 詳細な再現手順を含めてください
4. 公開開示前に問題に対処する時間を与えてください

関連リソース

- [Security guidance plugin](/ja/security-guidance)：Claude がセッション中に独自のコード変更の脆弱性をレビューして修正します
- [Sandbox environments](/ja/sandbox-environments)：分離アプローチを比較し、脅威モデルに合わせて選択します
- [Sandboxing](/ja/sandboxing)：Bash コマンドのファイルシステムとネットワーク分離
- [Permissions](/ja/permissions)：パーミッションとアクセス制御を設定します
- [Monitoring usage](/ja/monitoring-usage)：Claude Code アクティビティを追跡および監査します
- [Development containers](/ja/devcontainer)：セキュアで分離された環境
- [Anthropic Trust Center](https://trust.anthropic.com)：セキュリティ認証とコンプライアンス
