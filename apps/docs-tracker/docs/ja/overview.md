---
title: overview
source: https://code.claude.com/docs/ja/overview.md
---

# 概要

> Claude Code は agentic coding ツールで、コードベースを読み取り、ファイルを編集し、コマンドを実行し、開発ツールと統合します。ターミナル、IDE、デスクトップアプリ、ブラウザで利用できます。

Claude Code は AI を活用したコーディングアシスタントで、機能の構築、バグの修正、開発タスクの自動化を支援します。コードベース全体を理解し、複数のファイルとツール間で作業して目標を達成できます。

## はじめに

環境を選択してはじめましょう。ほとんどのサーフェスには [Claude サブスクリプション](https://claude.com/pricing?utm_source=claude_code\&utm_medium=docs\&utm_content=overview_pricing)または [Anthropic Console](https://console.anthropic.com/) アカウントが必要です。Terminal CLI と VS Code は [サードパーティプロバイダー](/ja/third-party-integrations)もサポートしています。

ターミナルで Claude Code を直接操作するための機能豊富な CLI です。ファイルを編集し、コマンドを実行し、コマンドラインからプロジェクト全体を管理できます。

To install Claude Code, use one of the following methods:

**macOS, Linux, WSL:**

```bash theme={null}
curl -fsSL https://claude.ai/install.sh | bash
```

**Windows PowerShell:**

```powershell theme={null}
irm https://claude.ai/install.ps1 | iex
```

**Windows CMD:**

```batch theme={null}
curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd
```

If you see `The token '&&' is not a valid statement separator`, you're in PowerShell, not CMD. If you see `'irm' is not recognized as an internal or external command`, you're in CMD, not PowerShell. Your prompt shows `PS C:\` when you're in PowerShell and `C:\` without the `PS` when you're in CMD.

[Git for Windows](https://git-scm.com/downloads/win) is recommended on native Windows so Claude Code can use the Bash tool. If Git for Windows is not installed, Claude Code uses PowerShell as the shell tool instead. WSL setups do not need Git for Windows.

Native installations automatically update in the background to keep you on the latest version.

```bash theme={null}
brew install --cask claude-code
```

Homebrew offers two casks. `claude-code` tracks the stable release channel, which is typically about a week behind and skips releases with major regressions. `claude-code@latest` tracks the latest channel and receives new versions as soon as they ship.

Homebrew installations do not auto-update. Run `brew upgrade claude-code` or `brew upgrade claude-code@latest`, depending on which cask you installed, to get the latest features and security fixes.

```powershell theme={null}
winget install Anthropic.ClaudeCode
```

WinGet installations do not auto-update. Run `winget upgrade Anthropic.ClaudeCode` periodically to get the latest features and security fixes.

You can also install with [apt, dnf, or apk](/en/setup#install-with-linux-package-managers) on Debian, Fedora, RHEL, and Alpine.

その後、任意のプロジェクトで Claude Code を開始します：

```bash theme={null}
cd your-project
claude
```

初回使用時にログインするよう促されます。これで完了です！[クイックスタートに進む →](/ja/quickstart)

インストールオプション、手動更新、またはアンインストール手順については [高度なセットアップ](/ja/setup) を参照してください。問題が発生した場合は [インストールのトラブルシューティング](/ja/troubleshoot-install) にアクセスしてください。

VS Code 拡張機能は、インラインの差分表示、@-メンション、プラン確認、会話履歴をエディター内で直接提供します。

- [VS Code 用にインストール](vscode:extension/anthropic.claude-code)
- [Cursor 用にインストール](cursor:extension/anthropic.claude-code)

または、拡張機能ビュー（Mac では `Cmd+Shift+X`、Windows/Linux では `Ctrl+Shift+X`）で「Claude Code」を検索してください。インストール後、コマンドパレット（`Cmd+Shift+P` / `Ctrl+Shift+P`）を開き、「Claude Code」と入力して、**新しいタブで開く** を選択します。

[VS Code ではじめる →](/ja/vs-code#get-started)

IDE またはターミナルの外で Claude Code を実行するためのスタンドアロンアプリです。差分を視覚的に確認し、複数のセッションを並行実行し、定期的なタスクをスケジュール設定し、クラウドセッションを開始できます。

ダウンロードしてインストール：

- [macOS](https://claude.ai/api/desktop/darwin/universal/dmg/latest/redirect?utm_source=claude_code\&utm_medium=docs)（Intel および Apple Silicon）
- [Windows](https://claude.ai/api/desktop/win32/x64/setup/latest/redirect?utm_source=claude_code\&utm_medium=docs)（x64）
- [Windows ARM64](https://claude.ai/api/desktop/win32/arm64/setup/latest/redirect?utm_source=claude_code\&utm_medium=docs)

インストール後、Claude を起動し、サインインして、**Code** タブをクリックしてコーディングを開始します。[有料サブスクリプション](https://claude.com/pricing?utm_source=claude_code\&utm_medium=docs\&utm_content=overview_desktop_pricing)が必要です。

[デスクトップアプリについて詳しく →](/ja/desktop-quickstart)

ローカルセットアップなしでブラウザで Claude Code を実行します。長時間実行されるタスクを開始して完了を待つ、ローカルにないリポジトリで作業する、または複数のタスクを並行実行できます。デスクトップブラウザと Claude iOS アプリで利用できます。

[claude.ai/code](https://claude.ai/code) でコーディングを開始します。

[Web ではじめる →](/ja/web-quickstart)

IntelliJ IDEA、PyCharm、WebStorm、その他の JetBrains IDE 用のプラグインで、インタラクティブな差分表示と選択コンテキスト共有機能があります。

JetBrains Marketplace から [Claude Code プラグイン](https://plugins.jetbrains.com/plugin/27310-claude-code-beta-) をインストールして IDE を再起動します。

[JetBrains ではじめる →](/ja/jetbrains)

## できること

Claude Code を使用できるいくつかの方法を紹介します：

Claude Code は、1 日を費やす退屈なタスクを処理します：テストされていないコードのテスト作成、プロジェクト全体のリントエラー修正、マージコンフリクト解決、依存関係の更新、リリースノートの作成。

```bash theme={null}
claude "write tests for the auth module, run them, and fix any failures"
```

プレーンテキストで実現したいことを説明します。Claude Code はアプローチを計画し、複数のファイル間でコードを作成し、動作を検証します。

バグの場合は、エラーメッセージを貼り付けるか、症状を説明します。Claude Code はコードベース全体で問題をトレースし、根本原因を特定し、修正を実装します。詳細な例については [一般的なワークフロー](/ja/common-workflows) を参照してください。

Claude Code は git と直接連携します。変更をステージングし、コミットメッセージを作成し、ブランチを作成し、プルリクエストを開きます。

```bash theme={null}
claude "commit my changes with a descriptive message"
```

CI では、[GitHub Actions](/ja/github-actions) または [GitLab CI/CD](/ja/gitlab-ci-cd) でコードレビューと問題トリアージを自動化できます。

[Model Context Protocol（MCP）](/ja/mcp) は、AI ツールを外部データソースに接続するためのオープンスタンダードです。MCP を使用すると、Claude Code は Google Drive のデザインドキュメントを読み取り、Jira のチケットを更新し、Slack からデータをプルするか、独自のカスタムツーリングを使用できます。[MCP クイックスタート](/ja/mcp-quickstart) は、最初のサーバーをエンドツーエンドで接続します。

[`CLAUDE.md`](/ja/memory) はプロジェクトルートに追加するマークダウンファイルで、Claude Code はすべてのセッションの開始時に読み取ります。コーディング標準、アーキテクチャの決定、推奨ライブラリ、レビューチェックリストを設定するために使用します。Claude は [自動メモリ](/ja/memory#auto-memory) も構築し、ビルドコマンドやデバッグの洞察などの学習内容を保存し、何も書かずにセッション間で共有します。

[スキル](/ja/skills) を作成して、チームが共有できる反復可能なワークフローをパッケージ化します（`/review-pr` や `/deploy-staging` など）。

[フック](/ja/hooks) を使用すると、ファイル編集後の自動フォーマットやコミット前のリント実行など、Claude Code アクション前後にシェルコマンドを実行できます。

[複数の Claude Code エージェント](/ja/sub-agents) を生成して、タスクの異なる部分に同時に取り組みます。リードエージェントが作業を調整し、サブタスクを割り当て、結果をマージします。

複数の完全なセッションを並行して実行し、1 つの画面から監視するには、[バックグラウンドエージェント](/ja/agent-view) を使用します。完全にカスタムなワークフローの場合、[Agent SDK](/ja/agent-sdk/overview) を使用すると、Claude Code のツールと機能を活用した独自のエージェントを構築でき、オーケストレーション、ツールアクセス、権限を完全に制御できます。

Claude Code は構成可能で Unix 哲学に従います。ログをパイプで渡し、CI で実行するか、他のツールと連鎖させます：

```bash theme={null}
# 最近のログ出力を分析する
tail -200 app.log | claude -p "Slack me if you see any anomalies"

# CI で翻訳を自動化する
claude -p "translate new strings into French and raise a PR for review"

# ファイル全体でバルク操作
git diff main --name-only | claude -p "review these changed files for security issues"
```

すべてのコマンドとフラグのセットについては [CLI リファレンス](/ja/cli-reference) を参照してください。

繰り返される作業を自動化するためにスケジュールで Claude を実行します：朝の PR レビュー、夜間の CI 障害分析、週次の依存関係監査、または PR マージ後のドキュメント同期。

- [ルーティン](/ja/routines) は Anthropic が管理するインフラストラクチャで実行されるため、コンピューターがオフの場合でも実行し続けます。API 呼び出しまたは GitHub イベントでトリガーすることもできます。Web、デスクトップアプリ、または CLI で `/schedule` を実行して作成します。
- [デスクトップスケジュール済みタスク](/ja/desktop-scheduled-tasks) はマシン上で実行され、ローカルファイルとツールに直接アクセスできます
- [`/loop`](/ja/scheduled-tasks) は CLI セッション内でプロンプトを繰り返し、クイックポーリングを行います

セッションは単一のサーフェスに限定されません。コンテキストが変わるにつれて、環境間で作業を移動します：

- デスクから離れて、電話または [リモートコントロール](/ja/remote-control) を使用した任意のブラウザから作業を続けます
- [Dispatch](/ja/desktop#sessions-from-dispatch) にメッセージを送信して、電話からタスクを送信し、作成されたデスクトップセッションを開きます
- [Web](/ja/claude-code-on-the-web) または [iOS アプリ](https://apps.apple.com/app/claude-by-anthropic/id6473753684) で長時間実行されるタスクを開始し、`claude --teleport` でターミナルにプルします
- ターミナルセッションを [デスクトップアプリ](/ja/desktop) に `/desktop` で渡して、視覚的な差分確認を行います
- チームチャットからタスクをルーティング：[Slack](/ja/slack) で `@Claude` にメンションしてバグレポートを送信し、プルリクエストを取得します

## Claude Code をどこでも使用する

各サーフェスは同じ基盤となる Claude Code エンジンに接続するため、CLAUDE.md ファイル、設定、MCP サーバーはすべてのサーフェスで機能します。

上記の [Terminal](/ja/quickstart)、[VS Code](/ja/vs-code)、[JetBrains](/ja/jetbrains)、[Desktop](/ja/desktop)、[Web](/ja/claude-code-on-the-web) 環境を超えて、Claude Code は CI/CD、チャット、ブラウザワークフローと統合します：

| 実現したいこと | 最適なオプション |
| - | - |
| ローカルセッションを電話または別のデバイスから続行する | [リモートコントロール](/ja/remote-control) |
| Telegram、Discord、iMessage、または独自の webhook からセッションにイベントをプッシュする | [チャネル](/ja/channels) |
| ローカルでタスクを開始し、モバイルで続行する | [Web](/ja/claude-code-on-the-web) または [Claude iOS アプリ](https://apps.apple.com/app/claude-by-anthropic/id6473753684) |
| 定期的なスケジュールで Claude を実行する | [ルーティン](/ja/routines) または [デスクトップスケジュール済みタスク](/ja/desktop-scheduled-tasks) |
| PR レビューと問題トリアージを自動化する | [GitHub Actions](/ja/github-actions) または [GitLab CI/CD](/ja/gitlab-ci-cd) |
| すべての PR で自動コードレビューを取得する | [GitHub Code Review](/ja/code-review) |
| Slack からプルリクエストへバグレポートをルーティングする | [Slack](/ja/slack) |
| ライブ Web アプリケーションをデバッグする | [Chrome](/ja/chrome) |
| 独自のワークフロー用のカスタムエージェントを構築する | [Agent SDK](/ja/agent-sdk/overview) |

## 次のステップ

Claude Code をインストールしたら、これらのガイドでさらに詳しく学べます。

- [クイックスタート](/ja/quickstart)：コードベースの探索から修正のコミットまで、最初の実際のタスクを実行します
- [指示とメモリを保存する](/ja/memory)：CLAUDE.md ファイルと自動メモリで Claude に永続的な指示を与えます
- [一般的なワークフロー](/ja/common-workflows) と [ベストプラクティス](/ja/best-practices)：Claude Code から最大限の価値を得るためのパターン
- [設定](/ja/settings)：ワークフローに合わせて Claude Code をカスタマイズします
- [トラブルシューティング](/ja/troubleshooting)：一般的な問題の解決策
- [code.claude.com](https://code.claude.com/)：デモ、価格設定、製品の詳細
