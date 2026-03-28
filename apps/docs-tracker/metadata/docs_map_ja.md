> ## Documentation Index
> Fetch the complete documentation index at: https://code.claude.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Claude code docs map

# Claude Code ドキュメンテーション マップ

これは Claude Code ドキュメンテーション ページのすべてを網羅したマップで、LLM による簡単なナビゲーションのために見出しを含んでいます。

> **注記：** このファイルは GitHub Actions によって自動生成されます。手動で編集しないでください。
> 最終更新日時：2026-02-05 18:34:06 UTC

## ドキュメント構造

このマップは階層構造を使用しています：

* **##** はドキュメンテーション グループを示します（例：「Getting started」）
* **###** は個別のドキュメンテーション ページを示します
* **ネストされた箇条書き** は各ページ内の見出し構造を示します
* 各ページ タイトルは完全なドキュメンテーションへのリンクです

## Getting started

### [overview](https://code.claude.com/docs/ja/overview.md)

* 30 秒で始める
* Claude Code があなたのためにできること
* 開発者が Claude Code を愛する理由
* Claude Code をどこでも使用する
* 次のステップ
* 追加リソース

### [quickstart](https://code.claude.com/docs/ja/quickstart.md)

* 始める前に
* ステップ 1：Claude Code をインストールする
* ステップ 2：アカウントにログインする
* ステップ 3：最初のセッションを開始する
* ステップ 4：最初の質問をする
* ステップ 5：最初のコード変更を行う
* ステップ 6：Claude Code で Git を使用する
* ステップ 7：バグを修正または機能を追加する
* ステップ 8：その他の一般的なワークフローを試す
* 必須コマンド
* 初心者向けのプロ ヒント
* 次は何ですか？
* ヘルプを取得する

### [changelog](https://code.claude.com/docs/ja/changelog.md)

* （見出しが見つかりません）

## コア概念

### [how-claude-code-works](https://code.claude.com/docs/ja/how-claude-code-works.md)

* agentic ループ
  * モデル
  * ツール
* Claude がアクセスできるもの
* セッションで作業する
  * ブランチ間で作業する
  * セッションを再開またはフォークする
  * コンテキストウィンドウ
    * コンテキストがいっぱいになったとき
    * スキルと subagent でコンテキストを管理する
* チェックポイントと権限で安全に保つ
  * チェックポイントで変更を元に戻す
  * Claude ができることを制御する
* Claude Code を効果的に使用する
  * Claude Code にヘルプを求める
  * これは会話です
    * 割り込みと操舵
  * 最初から具体的にする
  * Claude が検証するものを提供する
  * 実装する前に探索する
  * 指示するのではなく委任する
* 次のステップ

### [features-overview](https://code.claude.com/docs/ja/features-overview.md)

* 概要
* 機能を目標に合わせる
  * 類似機能を比較する
  * 機能がどのようにレイヤー化されるかを理解する
  * 機能を組み合わせる
* コンテキスト コストを理解する
  * 機能別のコンテキスト コスト
  * 機能がどのように読み込まれるかを理解する
* 詳細を学ぶ

### [common-workflows](https://code.claude.com/docs/ja/common-workflows.md)

* 新しいコードベースを理解する
  * コードベースの概要をすばやく取得する
  * 関連するコードを見つける
* バグを効率的に修正する
* コードをリファクタリングする
* 特殊な subagent を使用する
* Plan Mode を使用して安全なコード分析を行う
  * Plan Mode を使用する場合
  * Plan Mode の使用方法
  * 例：複雑なリファクタリングの計画
  * Plan Mode をデフォルトとして構成する
* テストで作業する
* プル リクエストを作成する
* ドキュメンテーションを処理する
* 画像で作業する
* ファイルとディレクトリを参照する
* 拡張思考（thinking mode）を使用する
  * thinking mode を構成する
  * 拡張思考がどのように機能するか
* 以前の会話を再開する
  * セッションに名前を付ける
  * セッション ピッカーを使用する
* Git worktrees で並列 Claude Code セッションを実行する
* Claude を unix スタイル ユーティリティとして使用する
  * 検証プロセスに Claude を追加する
  * パイプイン、パイプアウト
  * 出力形式を制御する
* Claude の機能について質問する
  * 質問例
* 次のステップ

### [best-practices](https://code.claude.com/docs/ja/best-practices.md)

* Claude に作業を検証する方法を提供する
* 最初に探索し、次に計画し、次にコードを書く
* プロンプトで具体的なコンテキストを提供する
  * リッチ コンテンツを提供する
* 環境を構成する
  * 効果的な CLAUDE.md を書く
  * 権限を構成する
  * CLI ツールを使用する
  * MCP servers を接続する
  * hooks を設定する
  * skills を作成する
  * カスタム subagent を作成する
  * plugins をインストールする
* 効果的にコミュニケーションを取る
  * コードベースの質問をする
  * Claude にインタビューさせる
* セッションを管理する
  * 早期かつ頻繁に方向転換する
  * コンテキストを積極的に管理する
  * 調査に subagent を使用する
  * チェックポイントで巻き戻す
  * 会話を再開する
* 自動化とスケール
  * ヘッドレス モードを実行する
  * 複数の Claude セッションを実行する
  * ファイル全体にファンアウトする
  * Safe Autonomous Mode
* 一般的な失敗パターンを回避する
* 直感を開発する
* 関連リソース

## ターミナルの外

### [claude-code-on-the-web](https://code.claude.com/docs/ja/claude-code-on-the-web.md)

* Claude Code on the web とは何ですか？
* Claude Code on the web を使用できるのは誰ですか？
* Getting started
* どのように機能するか
* diff ビューで変更を確認する
* Web とターミナル間でタスクを移動する
  * ターミナルから web へ
    * バックグラウンド タスクのヒント
  * web からターミナルへ
    * テレポートの要件
  * セッションを共有する
    * Enterprise または Teams アカウントから共有する
    * Max または Pro アカウントから共有する
* クラウド環境
  * デフォルト イメージ
    * 利用可能なツールを確認する
    * 言語固有のセットアップ
    * データベース
  * 環境構成
  * 依存関係管理
    * ローカル実行とリモート実行
    * 環境変数を永続化する
* ネットワーク アクセスとセキュリティ
  * ネットワーク ポリシー
    * GitHub プロキシ
    * セキュリティ プロキシ
  * アクセス レベル
  * デフォルトで許可されるドメイン
    * Anthropic Services
    * Version Control
    * Container Registries
    * Cloud Platforms
    * Package Managers - JavaScript/Node
    * Package Managers - Python
    * Package Managers - Ruby
    * Package Managers - Rust
    * Package Managers - Go
    * Package Managers - JVM
    * Package Managers - Other Languages
    * Linux Distributions
    * Development Tools & Platforms
    * Cloud Services & Monitoring
    * Content Delivery & Mirrors
    * Schema & Configuration
    * Model Context Protocol
  * カスタマイズされたネットワーク アクセスのセキュリティ ベスト プラクティス
* セキュリティと分離
* 価格とレート制限
* 制限事項
* ベスト プラクティス
* 関連リソース

### [desktop](https://code.claude.com/docs/ja/desktop.md)

* インストールとセットアップ
* Getting started
* できること
  * 権限モードを選択する
  * セッションで並列に作業する
  * 長時間実行されるタスクをリモートで実行する
  * diff ビューで変更を確認する
* Claude Code を拡張する
  * 外部ツールを接続する
  * カスタム skills を作成する
  * hooks でワークフローを自動化する
* 環境構成
* Desktop が CLI とどのように関連するか
  * CLI フラグの同等物
  * 共有構成
  * 何が異なるか
* トラブルシューティング
  * バージョンを確認する
  * CLI で開くときの「Branch doesn't exist yet」
  * 「Failed to load session」エラー
  * アプリが終了しない
  * Windows インストールの問題
  * セッションがインストール済みツールを見つけられない
  * MCP servers が機能しない（Windows）
  * Git LFS エラー
* Enterprise 構成
* 関連リソース

### [chrome](https://code.claude.com/docs/ja/chrome.md)

* 機能
* 前提条件
* CLI で始める
  * Chrome をデフォルトで有効にする
  * サイト権限を管理する
* ワークフロー例
  * ローカル Web アプリケーションをテストする
  * コンソール ログでデバッグする
  * フォーム入力を自動化する
  * Google Docs でコンテンツを作成する
  * Web ページからデータを抽出する
  * マルチサイト ワークフローを実行する
  * デモ GIF を記録する
* トラブルシューティング
  * 拡張機能が検出されない
  * ブラウザが応答しない
  * 長いセッション中に接続が切れる
  * Windows 固有の問題
  * 一般的なエラー メッセージ
* 関連項目も参照

### [vs-code](https://code.claude.com/docs/ja/vs-code.md)

* 前提条件
* 拡張機能をインストールする
* Getting started
* プロンプト ボックスを使用する
  * ファイルとフォルダを参照する
  * 過去の会話を再開する
  * Claude.ai からリモート セッションを再開する
* ワークフローをカスタマイズする
  * Claude がどこに存在するかを選択する
  * 複数の会話を実行する
  * ターミナル モードに切り替える
* plugins を管理する
  * plugins をインストールする
  * マーケットプレイスを管理する
* Chrome でブラウザ タスクを自動化する
* VS Code コマンドとショートカット
* 設定を構成する
  * 拡張機能の設定
* VS Code 拡張機能と Claude Code CLI
  * チェックポイントで巻き戻す
  * VS Code で CLI を実行する
  * 拡張機能と CLI を切り替える
  * プロンプトにターミナル出力を含める
  * バックグラウンド プロセスを監視する
  * MCP で外部ツールに接続する
* git で作業する
  * コミットとプル リクエストを作成する
  * 並列タスクに git worktrees を使用する
* サードパーティ プロバイダーを使用する
* セキュリティとプライバシー
* 一般的な問題を修正する
  * 拡張機能がインストールされない
  * Spark アイコンが表示されない
  * Claude Code が応答しない
* 拡張機能をアンインストールする
* 次のステップ

### [jetbrains](https://code.claude.com/docs/ja/jetbrains.md)

* サポートされている IDE
* 機能
* インストール
  * マーケットプレイス インストール
* 使用方法
  * IDE から
  * 外部ターミナルから
* 構成
  * Claude Code 設定
  * Plugin 設定
    * 一般設定
    * ESC キー構成
* 特別な構成
  * リモート開発
  * WSL 構成
* トラブルシューティング
  * Plugin が機能しない
  * IDE が検出されない
  * コマンドが見つからない
* セキュリティに関する考慮事項

### [github-actions](https://code.claude.com/docs/ja/github-actions.md)

* Claude Code GitHub Actions を使用する理由
* Claude ができること
  * Claude Code Action
* セットアップ
* クイック セットアップ
* 手動セットアップ
* ベータ版からアップグレードする
  * 必須の変更
  * Breaking Changes リファレンス
  * Before and After の例
* ユースケース例
  * 基本的なワークフロー
  * skills を使用する
  * プロンプトを使用したカスタム自動化
  * 一般的なユースケース
* ベスト プラクティス
  * CLAUDE.md 構成
  * セキュリティに関する考慮事項
  * パフォーマンスの最適化
  * CI コスト
* 構成例
* AWS Bedrock と Google Vertex AI で使用する
  * 前提条件
    * Google Cloud Vertex AI の場合：
    * AWS Bedrock の場合：
* トラブルシューティング
  * Claude が @claude コマンドに応答しない
  * CI が Claude のコミットで実行されない
  * 認証エラー
* 高度な構成
  * Action パラメータ
    * CLI 引数を渡す
  * 代替統合方法
  * Claude の動作をカスタマイズする

### [gitlab-ci-cd](https://code.claude.com/docs/ja/gitlab-ci-cd.md)

* Claude Code を GitLab で使用する理由
* どのように機能するか
* Claude ができること
* セットアップ
  * クイック セットアップ
  * 手動セットアップ（本番環境に推奨）
* ユースケース例
  * Issue を MR に変換する
  * 実装ヘルプを取得する
  * バグをすばやく修正する
* AWS Bedrock と Google Vertex AI で使用する
* 構成例
  * 基本的な .gitlab-ci.yml（Claude API）
  * AWS Bedrock ジョブ例（OIDC）
  * Google Vertex AI ジョブ例（Workload Identity Federation）
* ベスト プラクティス
  * CLAUDE.md 構成
  * セキュリティに関する考慮事項
  * パフォーマンスの最適化
  * CI コスト
* セキュリティとガバナンス
* トラブルシューティング
  * Claude が @claude コマンドに応答しない
  * ジョブがコメントを書き込むか MR を開くことができない
  * 認証エラー
* 高度な構成
  * 一般的なパラメータと変数
  * Claude の動作をカスタマイズする

### [slack](https://code.claude.com/docs/ja/slack.md)

* ユースケース
* 前提条件
* Slack で Claude Code をセットアップする
* どのように機能するか
  * 自動検出
  * コンテキスト収集
  * セッション フロー
* ユーザー インターフェース要素
  * App Home
  * メッセージ アクション
  * リポジトリ選択
* アクセスと権限
  * ユーザーレベルのアクセス
  * ワークスペース レベルのアクセス
  * チャネルベースのアクセス制御
* どこで何にアクセスできるか
* ベスト プラクティス
  * 効果的なリクエストを書く
  * Slack と web を使用する場合
* トラブルシューティング
  * セッションが開始されない
  * リポジトリが表示されない
  * 間違ったリポジトリが選択されている
  * 認証エラー
  * セッション有効期限切れ
* 現在の制限事項
* 関連リソース

## Claude Code で構築する

### [sub-agents](https://code.claude.com/docs/ja/sub-agents.md)

* 組み込み subagent
* クイックスタート：最初の subagent を作成する
* subagent を構成する
  * /agents コマンドを使用する
  * subagent スコープを選択する
  * subagent ファイルを書く
    * サポートされている frontmatter フィールド
  * モデルを選択する
  * subagent 機能を制御する
    * 利用可能なツール
    * 権限モード
    * skills を subagent にプリロードする
    * 永続メモリを有効にする
      * 永続メモリのヒント
    * hooks を使用した条件付きルール
    * 特定の subagent を無効にする
  * subagent の hooks を定義する
    * subagent frontmatter の hooks
    * subagent イベントのプロジェクト レベル hooks
* subagent で作業する
  * 自動委任を理解する
  * subagent をフォアグラウンドまたはバックグラウンドで実行する
  * 一般的なパターン
    * 大量操作を分離する
    * 並列研究を実行する
    * subagent をチェーンする
  * subagent とメイン会話の間で選択する
  * subagent コンテキストを管理する
    * subagent を再開する
    * 自動コンパクション
* subagent の例
  * コード レビュアー
  * デバッガー
  * データ サイエンティスト
  * データベース クエリ バリデーター
* 次のステップ

### [agent-teams](https://code.claude.com/docs/ja/agent-teams.md)

* agent teams を使用する場合
  * subagent と比較する
* agent teams を有効にする
* 最初の agent team を開始する
* agent team を制御する
  * 表示モードを選択する
  * チームメイトとモデルを指定する
  * チームメイトの計画承認を要求する
  * delegate mode を使用する
  * チームメイトと直接話す
  * タスクを割り当てて要求する
  * チームメイトをシャットダウンする
  * チームをクリーンアップする
* agent teams がどのように機能するか
  * Claude が agent teams をどのように開始するか
  * アーキテクチャ
  * 権限
  * コンテキストと通信
  * トークン使用量
* ユースケース例
  * 並列コード レビューを実行する
  * 競合する仮説で調査する
* ベスト プラクティス
  * チームメイトに十分なコンテキストを提供する
  * タスクを適切なサイズにする
  * チームメイトが終了するのを待つ
  * 研究とレビューから始める
  * ファイルの競合を回避する
  * 監視と操舵
* トラブルシューティング
  * チームメイトが表示されない
  * 権限プロンプトが多すぎる
  * チームメイトがエラーで停止する
  * リードが作業完了前にシャットダウンする
  * 孤立した tmux セッション
* 制限事項
* 次のステップ

### [plugins](https://code.claude.com/docs/ja/plugins.md)

* plugins とスタンドアロン構成を使用する場合
* クイックスタート
  * 前提条件
  * 最初の plugin を作成する
* Hello Command
  * Plugin 構造の概要
  * より複雑な plugin を開発する
    * Plugin に Skills を追加する
    * Plugin に LSP servers を追加する
    * 複雑な plugin を整理する
    * Plugin をローカルでテストする
    * Plugin の問題をデバッグする
    * Plugin を共有する
  * 既存の構成を plugin に変換する
    * 移行ステップ
    * 移行時に変わること
  * 次のステップ
    * Plugin ユーザー向け
    * Plugin 開発者向け

### [discover-plugins](https://code.claude.com/docs/ja/discover-plugins.md)

* マーケットプレイスがどのように機能するか
* 公式 Anthropic マーケットプレイス
  * コード インテリジェンス
    * コード インテリジェンス plugin から Claude が得るもの
  * 外部統合
  * 開発ワークフロー
  * 出力スタイル
* 試す：デモ マーケットプレイスを追加する
* マーケットプレイスを追加する
  * GitHub から追加する
  * 他の Git ホストから追加する
  * ローカル パスから追加する
  * リモート URL から追加する
* plugin をインストールする
* インストール済み plugin を管理する
* マーケットプレイスを管理する
  * インタラクティブ インターフェイスを使用する
  * CLI コマンドを使用する
  * 自動更新を構成する
* チーム マーケットプレイスを構成する
* トラブルシューティング
  * /plugin コマンドが認識されない
  * 一般的な問題
  * コード インテリジェンスの問題
* 次のステップ

### [skills](https://code.claude.com/docs/ja/skills.md)

* Getting started
  * 最初の skill を作成する
  * skill がどこに存在するか
    * ネストされたディレクトリからの自動検出
* skill を構成する
  * skill コンテンツのタイプ
  * Frontmatter リファレンス
    * 利用可能な文字列置換
  * サポート ファイルを追加する
  * skill を呼び出すユーザーを制御する
  * ツール アクセスを制限する
  * skill に引数を渡す
* 高度なパターン
  * 動的コンテキストを注入する
  * subagent で skill を実行する
    * 例：Explore agent を使用した Research skill
  * Claude の skill アクセスを制限する
* skill を共有する
  * ビジュアル出力を生成する
* トラブルシューティング
  * Skill がトリガーされない
  * Skill がトリガーされすぎる
  * Claude が私のすべての skill を見ていない
* 関連リソース

### [output-styles](https://code.claude.com/docs/ja/output-styles.md)

* 組み込み出力スタイル
* 出力スタイルがどのように機能するか
* 出力スタイルを変更する
* カスタム出力スタイルを作成する
  * Frontmatter
* 関連機能との比較
  * Output Styles と CLAUDE.md と --append-system-prompt
  * Output Styles と [Agents](/ja/sub-agents)
  * Output Styles と [Skills](/ja/skills)

### [hooks-guide](https://code.claude.com/docs/ja/hooks-guide.md)

* 最初の hook を設定する
* 自動化できること
  * Claude が入力を必要とするときに通知を受け取る
  * 編集後にコードを自動フォーマットする
  * 保護されたファイルへの編集をブロックする
  * コンパクション後にコンテキストを再注入する
* hooks がどのように機能するか
  * 入力を読み取り、出力を返す
    * Hook 入力
    * Hook 出力
    * 構造化 JSON 出力
  * マッチャーで hooks をフィルタリングする
  * hook の場所を構成する
* プロンプトベースの hooks
* Agent ベースの hooks
* 制限事項とトラブルシューティング
  * 制限事項
  * Hook が発火しない
  * 出力に Hook エラーがある
  * `/hooks` に構成された hooks が表示されない
  * Stop hook が永遠に実行される
  * JSON 検証に失敗した
  * デバッグ技術
* 詳細を学ぶ

### [headless](https://code.claude.com/docs/ja/headless.md)

* 基本的な使用方法
* 例
  * 構造化出力を取得する
  * レスポンスをストリーミングする
  * ツールを自動承認する
  * コミットを作成する
  * システム プロンプトをカスタマイズする
  * 会話を続ける
* 次のステップ

### [mcp](https://code.claude.com/docs/ja/mcp.md)

* MCP でできること
* 人気のある MCP servers
* MCP servers をインストールする
  * オプション 1：リモート HTTP server を追加する
  * オプション 2：リモート SSE server を追加する
  * オプション 3：ローカル stdio server を追加する
  * サーバーを管理する
  * 動的ツール更新
  * Plugin が提供する MCP servers
* MCP インストール スコープ
  * ローカル スコープ
  * プロジェクト スコープ
  * ユーザー スコープ
  * 適切なスコープを選択する
  * スコープ階層と優先順位
  * `.mcp.json` の環境変数展開
* 実践的な例
  * 例：Sentry でエラーを監視する
  * 例：コード レビューのために GitHub に接続する
  * 例：PostgreSQL データベースをクエリする
* リモート MCP servers で認証する
  * 事前構成された OAuth 認証情報を使用する
* JSON 構成から MCP servers を追加する
* Claude Desktop から MCP servers をインポートする
* Claude Code を MCP server として使用する
* MCP 出力制限と警告
* MCP リソースを使用する
  * MCP リソースを参照する
* MCP Tool Search でスケールする
  * どのように機能するか
  * MCP server 作成者向け
  * ツール検索を構成する
* MCP プロンプトをコマンドとして使用する
  * MCP プロンプトを実行する
* 管理 MCP 構成
  * オプション 1：managed-mcp.json での排他的制御
  * オプション 2：allowlist と denylist を使用したポリシーベースの制御
    * 制限オプション
    * 構成例
    * コマンドベースの制限がどのように機能するか
    * URL ベースの制限がどのように機能するか
    * Allowlist の動作（`allowedMcpServers`）
    * Denylist の動作（`deniedMcpServers`）
    * 重要な注記

### [troubleshooting](https://code.claude.com/docs/ja/troubleshooting.md)

* 一般的なインストール問題
  * Windows インストール問題：WSL のエラー
  * WSL2 サンドボックス セットアップ
  * Linux と Mac インストール問題：権限またはコマンド見つからないエラー
    * 推奨ソリューション：ネイティブ Claude Code インストール
  * Windows：「Claude Code on Windows requires git-bash」
  * Windows：「installMethod is native, but claude command not found」
* 権限と認証
  * 権限プロンプトが繰り返される
  * 認証の問題
* 構成ファイルの場所
  * 構成をリセットする
* パフォーマンスと安定性
  * CPU またはメモリ使用量が多い
  * コマンドがハングまたはフリーズする
  * 検索と検出の問題
  * WSL での検索が遅いまたは不完全
* IDE 統合の問題
  * WSL2 で JetBrains IDE が検出されない
    * WSL2 ネットワーク モード
  * Windows IDE 統合の問題を報告する（ネイティブと WSL の両方）
  * JetBrains（IntelliJ、PyCharm など）ターミナルで Escape キーが機能しない
* Markdown フォーマットの問題
  * コード ブロックに言語タグがない
  * 間隔とフォーマットが一貫していない
  * Markdown 生成のベスト プラクティス
* さらにヘルプを取得する

## デプロイメント

### [third-party-integrations](https://code.claude.com/docs/ja/third-party-integrations.md)

* デプロイメント オプションを比較する
* プロキシとゲートウェイを構成する
  * Amazon Bedrock
  * Microsoft Foundry
  * Google Vertex AI
* 組織向けのベスト プラクティス
  * ドキュメンテーションとメモリに投資する
  * デプロイメントを簡素化する
  * ガイド付き使用から始める
  * セキュリティ ポリシーを構成する
  * 統合に MCP を活用する
* 次のステップ

### [amazon-bedrock](https://code.claude.com/docs/ja/amazon-bedrock.md)

* 前提条件
* セットアップ
  * 1. ユースケース詳細を送信する
  * 2. AWS 認証情報を構成する
    * 高度な認証情報構成
      * 構成例
      * 構成設定の説明
  * 3. Claude Code を構成する
  * 4. モデル構成
  * 5. 出力トークン構成
* IAM 構成
* AWS Guardrails
* トラブルシューティング
* 追加リソース

### [google-vertex-ai](https://code.claude.com/docs/ja/google-vertex-ai.md)

* 前提条件
* リージョン構成
* セットアップ
  * 1. Vertex AI API を有効にする
  * 2. モデル アクセスをリクエストする
  * 3. GCP 認証情報を構成する
  * 4. Claude Code を構成する
  * 5. モデル構成
* IAM 構成
* 1M トークン コンテキスト ウィンドウ
* トラブルシューティング
* 追加リソース

### [microsoft-foundry](https://code.claude.com/docs/ja/microsoft-foundry.md)

* 前提条件
* セットアップ
  * 1. Microsoft Foundry リソースをプロビジョニングする
  * 2. Azure 認証情報を構成する
  * 3. Claude Code を構成する
* Azure RBAC 構成
* トラブルシューティング
* 追加リソース

### [network-config](https://code.claude.com/docs/ja/network-config.md)

* プロキシ構成
  * 環境変数
  * 基本認証
* カスタム CA 証明書
* mTLS 認証
* ネットワーク アクセス要件
* 追加リソース

### [llm-gateway](https://code.claude.com/docs/ja/llm-gateway.md)

* ゲートウェイ要件
* 構成
  * モデル選択
* LiteLLM 構成
  * 前提条件
  * 基本的な LiteLLM セットアップ
    * 認証方法
      * 静的 API キー
      * ヘルパーを使用した動的 API キー
    * 統合エンドポイント（推奨）
    * プロバイダー固有のパススルー エンドポイント（代替）
      * Claude API を LiteLLM 経由で
      * Amazon Bedrock を LiteLLM 経由で
      * Google Vertex AI を LiteLLM 経由で
* 追加リソース

### [devcontainer](https://code.claude.com/docs/ja/devcontainer.md)

* 主な機能
* 4 ステップで Getting started
* 構成の内訳
* セキュリティ機能
* カスタマイズ オプション
* ユースケース例
  * セキュアなクライアント作業
  * チーム オンボーディング
  * 一貫した CI/CD 環境
* 関連リソース

## 管理

### [setup](https://code.claude.com/docs/ja/setup.md)

* システム要件
  * 追加の依存関係
* インストール
  * プラットフォーム固有のセットアップ
  * 認証
    * 個人向け
    * チームと組織向け
  * 特定のバージョンをインストールする
  * バイナリ整合性とコード署名
* NPM インストール（非推奨）
* Windows セットアップ
* Claude Code を更新する
  * 自動更新
  * リリース チャネルを構成する
  * 自動更新を無効にする
  * 手動で更新する
* Claude Code をアンインストールする
  * ネイティブ インストール
  * Homebrew インストール
  * WinGet インストール
  * NPM インストール
  * 構成ファイルをクリーンアップする（オプション）

### [authentication](https://code.claude.com/docs/ja/authentication.md)

* 認証方法
  * Claude for Teams または Enterprise
  * Claude Console 認証
  * クラウド プロバイダー認証
* 認証情報管理
* 関連項目も参照

### [security](https://code.claude.com/docs/ja/security.md)

* セキュリティへのアプローチ方法
  * セキュリティ基盤
  * 権限ベースのアーキテクチャ
  * 組み込み保護
  * ユーザーの責任
* プロンプト インジェクションから保護する
  * コア保護
  * プライバシー保護
  * 追加の保護
* MCP セキュリティ
* IDE セキュリティ
* クラウド実行セキュリティ
* セキュリティ ベスト プラクティス
  * 機密コードで作業する
  * チーム セキュリティ
  * セキュリティ問題を報告する
* 関連リソース

### [data-usage](https://code.claude.com/docs/ja/data-usage.md)

* データ ポリシー
  * データ トレーニング ポリシー
  * Development Partner Program
  * `/bug` コマンドを使用したフィードバック
  * セッション品質調査
  * データ保持
* データ アクセス
* ローカル Claude Code：データ フローと依存関係
  * クラウド実行：データ フローと依存関係
* テレメトリ サービス
* API プロバイダー別のデフォルト動作

### [monitoring-usage](https://code.claude.com/docs/ja/monitoring-usage.md)

* クイック スタート
* 管理者構成
* 構成の詳細
  * 一般的な構成変数
  * メトリクス カーディナリティ制御
  * 動的ヘッダー
    * 設定構成
    * スクリプト要件
    * リフレッシュ動作
  * マルチチーム組織サポート
  * 構成例
* 利用可能なメトリクスとイベント
  * 標準属性
  * メトリクス
  * メトリクスの詳細
    * セッション カウンター
    * コード行カウンター
    * プル リクエスト カウンター
    * コミット カウンター
    * コスト カウンター
    * トークン カウンター
    * コード編集ツール決定カウンター
    * アクティブ時間カウンター
  * イベント
    * ユーザー プロンプト イベント
    * ツール結果イベント
    * API リクエスト イベント
    * API エラー イベント
    * ツール決定イベント
* メトリクスとイベント データを解釈する
  * 使用状況監視
  * コスト監視
  * アラートとセグメンテーション
  * イベント分析
* バックエンド に関する考慮事項
  * メトリクスの場合
  * イベント/ログの場合
* サービス情報
* ROI 測定リソース
* セキュリティ/プライバシーに関する考慮事項
* Amazon Bedrock で Claude Code を監視する

### [costs](https://code.claude.com/docs/ja/costs.md)

* コストを追跡する
  * `/cost` コマンドを使用する
* チームのコストを管理する
  * レート制限の推奨事項
  * Agent team トークン コスト
* トークン使用量を削減する
  * コンテキストを積極的に管理する
  * 適切なモデルを選択する
  * MCP server のオーバーヘッドを削減する
  * 型付き言語のコード インテリジェンス plugin をインストールする
  * hooks と skills に処理をオフロードする
  * CLAUDE.md から skills に指示を移動する
  * 拡張思考を調整する
  * 冗長な操作を subagent に委任する
  * agent team コストを管理する
  * 具体的なプロンプトを書く
  * 複雑なタスクで効率的に作業する
* バックグラウンド トークン使用量
* Claude Code の動作の変更を理解する

### [analytics](https://code.claude.com/docs/ja/analytics.md)

* Teams と Enterprise のアナリティクスにアクセスする
  * 貢献メトリクスを有効にする
  * サマリー メトリクスを確認する
  * チャートを探索する
    * 採用を追跡する
    * ユーザーあたりの PR を測定する
    * プル リクエスト内訳を表示する
    * トップ コントリビューターを見つける
  * PR 属性
    * タグ付け基準
    * 属性プロセス
    * 時間ウィンドウ
    * 除外されたファイル
    * 属性に関する注記
  * アナリティクスを最大限に活用する
    * 採用を監視する
    * ROI を測定する
    * パワー ユーザーを特定する
    * プログラムでデータにアクセスする
* API カスタマー向けのアナリティクスにアクセスする
  * チーム インサイトを表示する
* 関連リソース

### [plugin-marketplaces](https://code.claude.com/docs/ja/plugin-marketplaces.md)

* 概要
* ウォークスルー：ローカル マーケットプレイスを作成する
* マーケットプレイス ファイルを作成する
* マーケットプレイス スキーマ
  * 必須フィールド
  * 所有者フィールド
  * オプションのメタデータ
* Plugin エントリ
  * 必須フィールド
  * オプションの plugin フィールド
* Plugin ソース
  * 相対パス
  * GitHub リポジトリ
  * Git リポジトリ
  * 高度な plugin エントリ
* マーケットプレイスをホストして配布する
  * GitHub でホストする（推奨）
  * 他の git サービスでホストする
  * プライベート リポジトリ
  * 配布前にローカルでテストする
  * チームのマーケットプレイスを要求する
  * 管理マーケットプレイス制限
    * 一般的な構成
    * 制限がどのように機能するか
* 検証とテスト
* トラブルシューティング
  * マーケットプレイスが読み込まれない
  * マーケットプレイス検証エラー
  * Plugin インストール失敗
  * プライベート リポジトリ認証が失敗する
  * 相対パスを持つ Plugin が URL ベースのマーケットプレイスで失敗する
  * インストール後にファイルが見つからない
* 関連項目も参照

## 構成

### [settings](https://code.claude.com/docs/ja/settings.md)

* 構成スコープ
  * 利用可能なスコープ
  * 各スコープを使用する場合
  * スコープがどのように相互作用するか
  * スコープを使用するもの
* 設定ファイル
  * 利用可能な設定
  * 権限設定
  * 権限ルール構文
  * サンドボックス設定
  * 属性設定
  * ファイル提案設定
  * Hook 構成
  * 設定の優先順位
  * 構成システムに関する重要なポイント
  * システム プロンプト
  * 機密ファイルを除外する
* Subagent 構成
* Plugin 構成
  * Plugin 設定
    * `enabledPlugins`
    * `extraKnownMarketplaces`
    * `strictKnownMarketplaces`
  * Plugin を管理する
* 環境変数
* Claude が利用できるツール
  * Bash ツール動作
  * hooks でツールを拡張する
* 関連項目も参照

### [permissions](https://code.claude.com/docs/ja/permissions.md)

* 権限システム
* 権限を管理する
* 権限モード
* 権限ルール構文
  * ツールのすべての使用に一致する
  * 細粒度制御に指定子を使用する
  * ワイルドカード パターン
* ツール固有の権限ルール
  * Bash
  * Read と Edit
  * WebFetch
  * MCP
  * Task（subagent）
* hooks で権限を拡張する
* 作業ディレクトリ
* 権限がサンドボックスとどのように相互作用するか
* 管理設定
  * 管理のみの設定
* 設定の優先順位
* 構成例
* 関連項目も参照

### [sandboxing](https://code.claude.com/docs/ja/sandboxing.md)

* 概要
* サンドボックスが重要な理由
* どのように機能するか
  * ファイルシステム分離
  * ネットワーク分離
  * OS レベルの強制
* Getting started
  * 前提条件
  * サンドボックスを有効にする
  * サンドボックス モード
  * サンドボックスを構成する
* セキュリティ上の利点
  * プロンプト インジェクションからの保護
  * 攻撃面の削減
  * 透過的な操作
* セキュリティの制限事項
* サンドボックスが権限とどのように関連するか
* 高度な使用方法
  * カスタム プロキシ構成
  * 既存のセキュリティ ツールとの統合
* ベスト プラクティス
* オープン ソース
* 制限事項
* 関連項目も参照

### [terminal-config](https://code.claude.com/docs/ja/terminal-config.md)

* テーマと外観
* 改行
* 通知セットアップ
  * iTerm 2 システム通知
  * カスタム通知 hooks
* 大きな入力を処理する
* Vim Mode

### [model-config](https://code.claude.com/docs/ja/model-config.md)

* 利用可能なモデル
  * モデル エイリアス
  * モデルを設定する
* 特別なモデル動作
  * `default` モデル設定
  * `opusplan` モデル設定
  * 努力レベルを調整する
  * \[1m] で拡張コンテキスト
* 現在のモデルを確認する
* 環境変数
  * プロンプト キャッシング構成

### [memory](https://code.claude.com/docs/ja/memory.md)

* メモリ タイプを決定する
* CLAUDE.md インポート
* Claude がメモリをどのように検索するか
  * 追加ディレクトリからメモリを読み込む
* `/memory` でメモリを直接編集する
* プロジェクト メモリをセットアップする
* `.claude/rules/` を使用したモジュール ルール
  * 基本構造
  * パス固有のルール
  * Glob パターン
  * サブディレクトリ
  * シンボリック リンク
  * ユーザーレベルのルール
* 組織レベルのメモリ管理
* メモリ ベスト プラクティス

### [statusline](https://code.claude.com/docs/ja/statusline.md)

* カスタム ステータス ラインを作成する
* どのように機能するか
* JSON 入力構造
* スクリプト例
  * シンプル ステータス ライン
  * Git 対応ステータス ライン
  * Python の例
  * Node.js の例
  * ヘルパー関数アプローチ
  * コンテキスト ウィンドウ使用量
* ヒント
* トラブルシューティング

### [keybindings](https://code.claude.com/docs/ja/keybindings.md)

* 構成ファイル
* コンテキスト
* 利用可能なアクション
  * App アクション
  * History アクション
  * Chat アクション
  * Autocomplete アクション
  * Confirmation アクション
  * Permission アクション
  * Transcript アクション
  * History search アクション
  * Task アクション
  * Theme アクション
  * Help アクション
  * Tabs アクション
  * Attachments アクション
  * Footer アクション
  * Message selector アクション
  * Diff アクション
  * Model picker アクション
  * Select アクション
  * Plugin アクション
  * Settings アクション
* キーストローク構文
  * モディファイア
  * 大文字
  * コード
  * 特殊キー
* デフォルト ショートカットをバインド解除する
* 予約済みショートカット
* ターミナル競合
* Vim mode との相互作用
* 検証

## リファレンス

### [cli-reference](https://code.claude.com/docs/ja/cli-reference.md)

* CLI コマンド
* CLI フラグ
  * Agents フラグ形式
  * システム プロンプト フラグ
* 関連項目も参照

### [interactive-mode](https://code.claude.com/docs/ja/interactive-mode.md)

* キーボード ショートカット
  * 一般的なコントロール
  * テキスト編集
  * テーマと表示
  * 複数行入力
  * クイック コマンド
* 組み込みコマンド
  * MCP プロンプト
* Vim エディター モード
  * モード切り替え
  * ナビゲーション（NORMAL モード）
  * 編集（NORMAL モード）
  * テキスト オブジェクト（NORMAL モード）
* コマンド履歴
  * Ctrl+R での逆検索
* バックグラウンド bash コマンド
  * バックグラウンド処理がどのように機能するか
  * `!` プレフィックス付き Bash モード
* プロンプト提案
* タスク リスト
* PR レビュー ステータス
* 関連項目も参照

### [checkpointing](https://code.claude.com/docs/ja/checkpointing.md)

* チェックポイントがどのように機能するか
  * 自動追跡
  * 変更を巻き戻す
* 一般的なユースケース
* 制限事項
  * Bash コマンド変更は追跡されない
  * 外部変更は追跡されない
  * バージョン管理の代替ではない
* 関連項目も参照

### [hooks](https://code.claude.com/docs/ja/hooks.md)

* Hook ライフサイクル
  * Hook がどのように解決されるか
* 構成
  * Hook の場所
  * マッチャー パターン
    * MCP ツールに一致する
  * Hook ハンドラー フィールド
    * 一般的なフィールド
    * コマンド hook フィールド
    * プロンプトと agent hook フィールド
  * パスでスクリプトを参照する
  * skills と agents の hooks
  * `/hooks` メニュー
  * hooks を無効にするか削除する
* Hook 入力と出力
  * 一般的な入力フィールド
  * 終了コード出力
    * イベントごとの終了コード 2 動作
  * JSON 出力
    * 決定制御
* Hook イベント
  * SessionStart
    * SessionStart 入力
    * SessionStart 決定制御
    * 環境変数を永続化する
  * UserPromptSubmit
    * UserPromptSubmit 入力
    * UserPromptSubmit 決定制御
  * PreToolUse
    * PreToolUse 入力
      * Bash
      * Write
      * Edit
      * Read
      * Glob
      * Grep
      * WebFetch
      * WebSearch
      * Task
    * PreToolUse 決定制御
  * PermissionRequest
    * PermissionRequest 入力
    * PermissionRequest 決定制御
  * PostToolUse
    * PostToolUse 入力
    * PostToolUse 決定制御
  * PostToolUseFailure
    * PostToolUseFailure 入力
    * PostToolUseFailure 決定制御
  * Notification
    * Notification 入力
  * SubagentStart
    * SubagentStart 入力
  * SubagentStop
    * SubagentStop 入力
  * Stop
    * Stop 入力
    * Stop 決定制御
  * PreCompact
    * PreCompact 入力
  * SessionEnd
    * SessionEnd 入力
* プロンプトベースの hooks
  * プロンプトベースの hooks がどのように機能するか
  * プロンプト hook 構成
  * レスポンス スキーマ
  * 例：マルチ基準 Stop hook
* Agent ベースの hooks
  * agent hooks がどのように機能するか
  * Agent hook 構成
* バックグラウンドで hooks を実行する
  * 非同期 hook を構成する
  * 非同期 hooks がどのように実行されるか
  * 例：ファイル変更後にテストを実行する
  * 制限事項
* セキュリティに関する考慮事項
  * 免責事項
  * セキュリティ ベスト プラクティス
* hooks をデバッグする

### [plugins-reference](https://code.claude.com/docs/ja/plugins-reference.md)

* Plugin コンポーネント リファレンス
  * Skills
  * Agents
  * Hooks
  * MCP servers
  * LSP servers
* Plugin インストール スコープ
* Plugin マニフェスト スキーマ
  * 完全なスキーマ
  * 必須フィールド
  * メタデータ フィールド
  * コンポーネント パス フィールド
  * パス動作ルール
  * 環境変数
* Plugin キャッシングとファイル解決
  * Plugin キャッシングがどのように機能するか
  * パス トラバーサルの制限
  * 外部依存関係で作業する
* Plugin ディレクトリ構造
  * 標準 plugin レイアウト
  * ファイルの場所リファレンス
* CLI コマンド リファレンス
  * plugin install
  * plugin uninstall
  * plugin enable
  * plugin disable
  * plugin update
* デバッグと開発ツール
  * デバッグ コマンド
  * 一般的な問題
  * エラー メッセージの例
  * Hook トラブルシューティング
  * MCP server トラブルシューティング
  * ディレクトリ構造の間違い
* 配布とバージョン管理リファレンス
  * バージョン管理
* 関連項目も参照

## リソース

### [legal-and-compliance](https://code.claude.com/docs/ja/legal-and-compliance.md)

* 法的契約
  * ライセンス
  * 商用契約
* コンプライアンス
  * ヘルスケア コンプライアンス（BAA）
* セキュリティと信頼
  * 信頼と安全
  * セキュリティ脆弱性報告
