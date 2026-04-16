---
title: desktop
source: https://code.claude.com/docs/ja/desktop.md
---

# Claude Code Desktop を使用する

> Claude Code Desktop をさらに活用する：コンピュータ使用、電話から Dispatch セッションを送信、Git 分離による並列セッション、ビジュアル diff レビュー、アプリプレビュー、PR 監視、コネクタ、エンタープライズ設定。

Claude Desktop アプリ内の Code タブを使用すると、ターミナルではなくグラフィカルインターフェイスを通じて Claude Code を使用できます。

Desktop は標準的な Claude Code エクスペリエンスに以下の機能を追加します：

- [ビジュアル diff レビュー](#review-changes-with-diff-view)（インラインコメント付き）
- [ライブアプリプレビュー](#preview-your-app)（dev サーバー付き）
- [コンピュータ使用](#let-claude-use-your-computer)（macOS でアプリを開いてスクリーンを制御）
- [GitHub PR 監視](#monitor-pull-request-status)（自動修正と自動マージ付き）
- [並列セッション](#work-in-parallel-with-sessions)（自動 Git worktree 分離付き）
- [Dispatch](#sessions-from-dispatch) 統合：電話からタスクを送信し、ここでセッションを取得
- [スケジュール済みタスク](#schedule-recurring-tasks)（定期的に Claude を実行）
- [コネクタ](#connect-external-tools)（GitHub、Slack、Linear など）
- ローカル、[SSH](#ssh-sessions)、および[クラウド](#run-long-running-tasks-remotely)環境

Desktop は初めてですか？[はじめに](/ja/desktop-quickstart)を参照してアプリをインストールし、最初の編集を行ってください。

このページでは、[コードの操作](#work-with-code)、[コンピュータ使用](#let-claude-use-your-computer)、[セッションの管理](#manage-sessions)、[Claude Code の拡張](#extend-claude-code)、[スケジュール済みタスク](#schedule-recurring-tasks)、および[設定](#environment-configuration)について説明します。また、[CLI 比較](#coming-from-the-cli)と[トラブルシューティング](#troubleshooting)も含まれています。

## セッションを開始する

最初のメッセージを送信する前に、プロンプト領域で 4 つのことを設定してください：

- **環境**：Claude が実行される場所を選択します。ローカルマシンの場合は**Local**、Anthropic ホスト型クラウドセッションの場合は**Remote**、管理するリモートマシンの場合は[**SSH 接続**](#ssh-sessions)を選択します。[環境設定](#environment-configuration)を参照してください。
- **プロジェクトフォルダ**：Claude が作業するフォルダまたはリポジトリを選択します。リモートセッションの場合、[複数のリポジトリ](#run-long-running-tasks-remotely)を追加できます。
- **モデル**：送信ボタンの横のドロップダウンから[モデル](/ja/model-config#available-models)を選択します。セッションが開始されるとモデルはロックされます。
- **権限モード**：[モードセレクタ](#choose-a-permission-mode)から Claude がどの程度の自律性を持つかを選択します。セッション中にこれを変更できます。

タスクを入力して**Enter**キーを押してセッションを開始します。各セッションは独自のコンテキストと変更を追跡します。

## コードの操作

Claude に適切なコンテキストを提供し、それが独立して実行する量を制御し、変更内容を確認します。

### プロンプトボックスを使用する

Claude に実行させたいことを入力して**Enter**キーを押して送信します。Claude はプロジェクトファイルを読み取り、[権限モード](#choose-a-permission-mode)に基づいて変更を加えてコマンドを実行します。いつでも Claude を中断できます：停止ボタンをクリックするか、修正を入力して**Enter**キーを押します。Claude は実行を停止し、入力に基づいて調整します。

プロンプトボックスの横の\*\*+\*\*ボタンをクリックすると、ファイル添付、[スキル](#use-skills)、[コネクタ](#connect-external-tools)、および[プラグイン](#install-plugins)にアクセスできます。

### ファイルとコンテキストをプロンプトに追加する

プロンプトボックスは外部コンテキストを取り込む 2 つの方法をサポートしています：

- **@mention ファイル**：`@`の後にファイル名を入力して、ファイルを会話コンテキストに追加します。Claude はそのファイルを読み取り、参照できます。@mention はリモートセッションでは利用できません。
- **ファイルを添付**：添付ボタンを使用するか、ファイルをプロンプトに直接ドラッグアンドドロップして、画像、PDF、およびその他のファイルをプロンプトに添付します。これはバグのスクリーンショット、デザインモックアップ、または参照ドキュメントを共有するのに便利です。

### 権限モードを選択する

権限モードは、セッション中に Claude がどの程度の自律性を持つかを制御します：ファイルの編集、コマンドの実行、またはその両方の前に確認するかどうかです。送信ボタンの横のモードセレクタを使用して、いつでもモードを切り替えることができます。Ask permissions で開始して Claude が実行する内容を正確に確認してから、慣れてきたら Auto accept edits または Plan mode に移動します。

| モード | 設定キー | 動作 |
| - | - | - |
| **Ask permissions** | `default` | Claude はファイルの編集またはコマンドの実行の前に確認を求めます。diff を確認し、各変更を受け入れるか拒否できます。新規ユーザーに推奨されます。 |
| **Auto accept edits** | `acceptEdits` | Claude はファイル編集を自動的に受け入れますが、ターミナルコマンドの実行前には確認を求めます。ファイル変更を信頼し、より高速な反復を望む場合に使用します。 |
| **Plan mode** | `plan` | Claude はコードを分析し、ファイルを変更したりコマンドを実行したりせずにプランを作成します。アプローチを最初に確認したい複雑なタスクに適しています。 |
| **Auto** | `auto` | Claude はすべてのアクションをバックグラウンド安全チェック付きで実行し、リクエストとの整合性を確認します。権限プロンプトを削減しながら監視を維持します。現在研究プレビューです。Team、Enterprise、および API プランで利用可能です。Claude Sonnet 4.6 または Opus 4.6 が必要です。Settings → Claude Code で有効にします。 |
| **Bypass permissions** | `bypassPermissions` | Claude は権限プロンプトなしで実行され、CLI の`--dangerously-skip-permissions`と同等です。Settings → Claude Code の「Allow bypass permissions mode」で有効にします。サンドボックス化されたコンテナまたは VM でのみ使用してください。エンタープライズ管理者はこのオプションを無効にできます。 |

`dontAsk`権限モードは[CLI](/ja/permission-modes#allow-only-pre-approved-tools-with-dontask-mode)でのみ利用可能です。

複雑なタスクを Plan mode で開始して、Claude が変更を加える前にアプローチをマップアウトするようにします。プランを承認したら、Auto accept edits または Ask permissions に切り替えて実行します。このワークフローの詳細については、[最初に探索してからプランしてからコード化する](/ja/best-practices#explore-first-then-plan-then-code)を参照してください。

リモートセッションは Auto accept edits と Plan mode をサポートしています。Ask permissions はリモートセッションがデフォルトでファイル編集を自動受け入れするため利用できず、Bypass permissions はリモート環境が既にサンドボックス化されているため利用できません。

エンタープライズ管理者は利用可能な権限モードを制限できます。詳細については、[エンタープライズ設定](#enterprise-configuration)を参照してください。

### アプリをプレビューする

Claude は dev サーバーを起動し、埋め込みブラウザを開いて変更を確認できます。これはフロントエンド Web アプリとバックエンドサーバーの両方で機能します：Claude は API エンドポイントをテストし、サーバーログを表示し、見つけた問題を反復処理できます。ほとんどの場合、Claude はプロジェクトファイルを編集した後、サーバーを自動的に起動します。いつでも Claude にプレビューを要求することもできます。デフォルトでは、Claude は編集後に[変更を自動検証](#auto-verify-changes)します。

プレビューパネルから、以下を実行できます：

- 埋め込みブラウザで実行中のアプリと直接対話する
- Claude が自動的に独自の変更を検証するのを監視する：スクリーンショットを撮影し、DOM を検査し、要素をクリックし、フォームに入力し、見つけた問題を修正します
- セッションツールバーの**Preview**ドロップダウンからサーバーを開始または停止する
- ドロップダウンで**Persist sessions**を選択して、サーバーの再起動時にクッキーとローカルストレージを保持し、開発中に再度ログインする必要がないようにする
- サーバー設定を編集するか、すべてのサーバーを一度に停止する

Claude はプロジェクトに基づいて初期サーバー設定を作成します。アプリがカスタム dev コマンドを使用する場合、`.claude/launch.json`を編集してセットアップに合わせます。完全なリファレンスについては、[プレビューサーバーを設定する](#configure-preview-servers)を参照してください。

保存されたセッションデータをクリアするには、Settings → Claude Code で**Persist preview sessions**をオフに切り替えます。プレビューを完全に無効にするには、Settings → Claude Code で**Preview**をオフに切り替えます。

### diff ビューで変更を確認する

Claude がコードに変更を加えた後、diff ビューを使用して、プルリクエストを作成する前にファイルごとに変更を確認できます。

Claude がファイルを変更すると、`+12 -1`などの追加および削除された行数を示す diff 統計インジケータが表示されます。このインジケータをクリックして diff ビューアを開きます。左側にファイルリストが表示され、右側に各ファイルの変更が表示されます。

特定の行にコメントするには、diff 内の任意の行をクリックしてコメントボックスを開きます。フィードバックを入力して**Enter**キーを押してコメントを追加します。複数の行にコメントを追加した後、すべてのコメントを一度に送信します：

- **macOS**：**Cmd+Enter**を押す
- **Windows**：**Ctrl+Enter**を押す

Claude はコメントを読み取り、要求された変更を加えます。これは確認できる新しい diff として表示されます。

### コードを確認する

diff ビューで、右上のツールバーの**Review code**をクリックして、Claude にコミット前に変更を評価するよう依頼します。Claude は現在の diff を検査し、diff ビューに直接コメントを残します。任意のコメントに応答するか、Claude に修正を依頼できます。

レビューは高シグナル問題に焦点を当てています：コンパイルエラー、明確なロジックエラー、セキュリティ脆弱性、および明らかなバグです。スタイル、フォーマット、既存の問題、またはリンターが検出するものにはフラグを立てません。

### プルリクエストステータスを監視する

プルリクエストを開いた後、CI ステータスバーがセッションに表示されます。Claude Code は GitHub CLI を使用してチェック結果をポーリングし、失敗を表示します。

- **Auto-fix**：有効にすると、Claude は失敗出力を読み取り、反復することで、失敗した CI チェックを自動的に修正しようとします。
- **Auto-merge**：有効にすると、Claude はすべてのチェックが成功したら PR をマージします。マージ方法はスカッシュです。Auto-merge がこれを機能させるために[GitHub リポジトリ設定で有効にされている](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-auto-merge-for-pull-requests-in-your-repository)必要があります。

CI ステータスバーの**Auto-fix**および**Auto-merge**トグルを使用して、いずれかのオプションを有効にします。Claude Code はまた、CI が完了したときにデスクトップ通知を送信します。

PR 監視には、[GitHub CLI（`gh`）](https://cli.github.com/)がマシンにインストールされ、認証されている必要があります。`gh`がインストールされていない場合、Desktop は PR を作成しようとする最初の時点でインストールを促します。

## Claude にコンピュータを使用させる

コンピュータ使用により、Claude はアプリを開き、スクリーンを制御し、あなたがするのと同じ方法でマシンで直接作業できます。iOS シミュレータでネイティブアプリをテストするよう Claude に依頼したり、CLI がないデスクトップツールと対話したり、GUI を通じてのみ機能する何かを自動化したりします。

コンピュータ使用は macOS の研究プレビューであり、Pro または Max プランが必要です。Team または Enterprise プランでは利用できません。Claude Desktop アプリが実行されている必要があります。

コンピュータ使用はデフォルトでオフです。[設定で有効にして](#enable-computer-use)、Claude がスクリーンを制御する前に必要な macOS 権限を付与してください。

[サンドボックス化された Bash ツール](/ja/sandboxing)とは異なり、コンピュータ使用は実際のデスクトップで実行され、承認したものへのアクセス権があります。Claude は各アクションをチェックし、オンスクリーンコンテンツからの潜在的なプロンプトインジェクションにフラグを立てますが、信頼境界は異なります。ベストプラクティスについては、[コンピュータ使用安全ガイド](https://support.claude.com/en/articles/14128542)を参照してください。

### コンピュータ使用が適用される場合

Claude はアプリまたはサービスと対話するための複数の方法を持ち、コンピュータ使用は最も広範で最も遅いです。最も正確なツールを最初に試します：

- サービスの[コネクタ](#connect-external-tools)がある場合、Claude はコネクタを使用します。
- タスクがシェルコマンドの場合、Claude は Bash を使用します。
- タスクがブラウザ作業であり、[Chrome の Claude](/ja/chrome)がセットアップされている場合、Claude はそれを使用します。
- これらのいずれも適用されない場合、Claude はコンピュータ使用を使用します。

[アプリごとのアクセス層](#app-permissions)はこれを強化します：ブラウザはビューのみに制限され、ターミナルと IDE はクリックのみに制限され、Claude をコンピュータ使用がアクティブな場合でも専用ツールに向けます。スクリーン制御は、ネイティブアプリ、ハードウェア制御パネル、iOS シミュレータ、または API のない独自ツールなど、他に何も到達できないものに予約されています。

### コンピュータ使用を有効にする

コンピュータ使用はデフォルトでオフです。それが必要な何かをするよう Claude に依頼し、それがオフの場合、Claude は Settings でコンピュータ使用を有効にすれば、タスクを実行できることを伝えます。

Claude Desktop の最新バージョンがあることを確認してください。[claude.com/download](https://claude.com/download)でダウンロードまたは更新してから、アプリを再起動します。

デスクトップアプリで、**Settings > General**（**Desktop app**の下）に移動します。**Computer use**トグルを見つけてオンにします。

トグルが表示されない場合は、macOS で Pro または Max プランを使用していることを確認してから、アプリを更新して再起動します。

トグルが有効になる前に、2 つの macOS システム権限を付与します：

- **Accessibility**：Claude がクリック、入力、スクロールできるようにします
- **Screen Recording**：Claude がスクリーンに表示されているものを見ることができるようにします

Settings ページは各権限の現在のステータスを表示します。いずれかが拒否されている場合、バッジをクリックして関連するシステム設定ペインを開きます。

### アプリ権限

Claude が初めてアプリを使用する必要がある場合、セッションにプロンプトが表示されます。**Allow for this session**または**Deny**をクリックします。承認は現在のセッション、または[Dispatch が生成したセッション](#sessions-from-dispatch)では 30 分間有効です。

プロンプトは、Claude がそのアプリに対して取得するコントロールのレベルも表示します。これらの層はアプリカテゴリによって固定され、変更できません：

| 層 | Claude ができること | 適用対象 |
| :- | :- | :- |
| ビューのみ | スクリーンショットでアプリを見る | ブラウザ、取引プラットフォーム |
| クリックのみ | クリックとスクロール、ただし入力またはキーボードショートカットは不可 | ターミナル、IDE |
| フルコントロール | クリック、入力、ドラッグ、キーボードショートカットの使用 | その他すべて |

Terminal、Finder、System Settings などの広範なリーチを持つアプリは、承認が何を付与するかを知るようにプロンプトに追加の警告を表示します。

**Settings > General**（**Desktop app**の下）で 2 つの設定を設定できます：

- **Denied apps**：ここにアプリを追加して、プロンプトなしで拒否します。Claude は許可されたアプリのアクションを通じて拒否されたアプリに間接的に影響を与える可能性がありますが、拒否されたアプリと直接対話することはできません。
- **Unhide apps when Claude finishes**：Claude が作業している間、他のウィンドウは非表示になり、承認されたアプリのみと対話します。Claude が完了すると、この設定をオフにしない限り、非表示のウィンドウが復元されます。

## セッションを管理する

各セッションは独立した会話であり、独自のコンテキストと変更があります。複数のセッションを並列で実行するか、作業をクラウドに送信するか、Dispatch にセッションを電話から開始させることができます。

### セッションで並列に作業する

サイドバーの\*\*+ New session\*\*をクリックして、複数のタスクを並列で作業します。Git リポジトリの場合、各セッションは[Git worktrees](/ja/common-workflows#run-parallel-claude-code-sessions-with-git-worktrees)を使用してプロジェクトの独立した分離コピーを取得するため、1 つのセッションの変更は、コミットするまで他のセッションに影響しません。

Worktrees はデフォルトで`<project-root>/.claude/worktrees/`に保存されます。Settings → Claude Code の「Worktree location」でカスタムディレクトリに変更できます。また、すべての worktree ブランチ名の前に付加されるブランチプレフィックスを設定することもできます。これは Claude が作成したブランチを整理するのに便利です。完了したら、サイドバーのセッションにマウスを合わせてアーカイブアイコンをクリックして worktree を削除します。

gitignored ファイル（`.env`など）を新しい worktrees に含めるには、プロジェクトルートに[`.worktreeinclude`ファイル](/ja/common-workflows#copy-gitignored-files-to-worktrees)を作成します。

セッション分離には[Git](https://git-scm.com/downloads)が必要です。ほとんどの Mac には Git がデフォルトで含まれています。Terminal で`git --version`を実行して確認してください。Windows では、Code タブが機能するために Git が必要です：[Git for Windows をダウンロード](https://git-scm.com/downloads/win)し、インストールしてアプリを再起動します。Git エラーが発生した場合は、Cowork セッションを試してセットアップのトラブルシューティングを行ってください。

サイドバーの上部のフィルタアイコンを使用して、セッションをステータス（Active、Archived）と環境（Local、Cloud）でフィルタリングします。セッション名を確認またはコンテキスト使用状況を確認するには、アクティブセッションの上部のツールバーのセッションタイトルをクリックします。コンテキストがいっぱいになると、Claude は自動的に会話を要約して作業を続けます。`/compact`を入力して要約をより早くトリガーし、コンテキストスペースを解放することもできます。[コンテキストウィンドウ](/ja/how-claude-code-works#the-context-window)を参照して、圧縮がどのように機能するかについての詳細を確認してください。

### 長時間実行されるタスクをリモートで実行する

大規模なリファクタリング、テストスイート、マイグレーション、またはその他の長時間実行されるタスクの場合、セッションを開始するときに**Local**の代わりに**Remote**を選択します。リモートセッションは Anthropic のクラウドインフラストラクチャで実行され、アプリを閉じたりコンピュータをシャットダウンしたりしても続行します。いつでも戻ってきて進捗を確認するか、Claude を別の方向に導くことができます。[claude.ai/code](https://claude.ai/code)または Claude iOS アプリからリモートセッションを監視することもできます。

リモートセッションは複数のリポジトリもサポートしています。クラウド環境を選択した後、リポジトリピルの横の\*\*+\*\*ボタンをクリックして、セッションに追加のリポジトリを追加します。各リポジトリは独自のブランチセレクタを取得します。これは共有ライブラリとそのコンシューマーの更新など、複数のコードベースにまたがるタスクに便利です。

リモートセッションがどのように機能するかについての詳細については、[Web 上の Claude Code](/ja/claude-code-on-the-web)を参照してください。

### 別のサーフェスで続行する

セッションツールバーの右下の VS Code アイコンからアクセスできる**Continue in**メニューを使用すると、セッションを別のサーフェスに移動できます：

- **Claude Code on the Web**：ローカルセッションをリモートで実行し続けるために送信します。Desktop はブランチをプッシュし、会話の要約を生成し、完全なコンテキストを持つ新しいリモートセッションを作成します。その後、ローカルセッションをアーカイブするか保持するかを選択できます。これはクリーンなワーキングツリーが必要であり、SSH セッションでは利用できません。
- **Your IDE**：現在の作業ディレクトリでサポートされている IDE でプロジェクトを開きます。

### Dispatch からのセッション

[Dispatch](https://support.claude.com/en/articles/13947068)は、[Cowork](https://claude.com/product/cowork#dispatch-and-computer-use)タブに存在する Claude との永続的な会話です。Dispatch にタスクをメッセージで送信すると、それをどのように処理するかを決定します。

タスクは 2 つの方法で Code セッションになります：「Claude Code セッションを開いてログインバグを修正する」など直接要求するか、Dispatch がタスクが開発作業であると判断して自動的に生成するかです。通常 Code にルーティングされるタスクには、バグの修正、依存関係の更新、テストの実行、またはプルリクエストの開くが含まれます。研究、ドキュメント編集、スプレッドシート作業は Cowork に留まります。

どちらの方法でも、Code セッションは Code タブのサイドバーに**Dispatch**バッジ付きで表示されます。完了したときまたは承認が必要なときに、電話でプッシュ通知を受け取ります。

[コンピュータ使用](#let-claude-use-your-computer)が有効な場合、Dispatch が生成した Code セッションもそれを使用できます。これらのセッションのアプリ承認は 30 分後に期限切れになり、通常の Code セッションのようにセッション全体を続けるのではなく、再度プロンプトが表示されます。

セットアップ、ペアリング、Dispatch 設定については、[Dispatch ヘルプ記事](https://support.claude.com/en/articles/13947068)を参照してください。Dispatch には Pro または Max プランが必要であり、Team または Enterprise プランでは利用できません。

Dispatch は、ターミナルから離れているときに Claude で作業する複数の方法の 1 つです。[プラットフォームと統合](/ja/platforms#work-when-you-are-away-from-your-terminal)を参照して、Remote Control、Channels、Slack、スケジュール済みタスクと比較してください。

## Claude Code を拡張する

外部サービスを接続し、再利用可能なワークフローを追加し、Claude の動作をカスタマイズし、プレビューサーバーを設定します。

### 外部ツールを接続する

ローカルおよび[SSH](#ssh-sessions)セッションの場合、プロンプトボックスの横の\*\*+**ボタンをクリックして**Connectors**を選択し、Google Calendar、Slack、GitHub、Linear、Notion などの統合を追加します。セッションの前または中にコネクタを追加できます。**+\*\*ボタンはリモートセッションでは利用できませんが、[スケジュール済みタスク](/ja/web-scheduled-tasks)はタスク作成時にコネクタを設定します。

コネクタを管理または切断するには、デスクトップアプリの Settings → Connectors に移動するか、プロンプトボックスの Connectors メニューから**Manage connectors**を選択します。

接続すると、Claude はカレンダーを読み取り、メッセージを送信し、問題を作成し、ツールと直接対話できます。セッションで設定されているコネクタについて Claude に尋ねることができます。

コネクタは[MCP サーバー](/ja/mcp)であり、グラフィカルセットアップフローを備えています。サポートされているサービスとの迅速な統合に使用します。Connectors にリストされていない統合の場合、[設定ファイル](/ja/mcp#installing-mcp-servers)を介して MCP サーバーを手動で追加します。また、[カスタムコネクタを作成](https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp)することもできます。

### スキルを使用する

[スキル](/ja/skills)は Claude ができることを拡張します。Claude は関連する場合に自動的にロードするか、直接呼び出すことができます：プロンプトボックスで`/`を入力するか、**+**ボタンをクリックして**Slash commands**を選択して、利用可能なものを参照します。これには[組み込みコマンド](/ja/commands)、[カスタムスキル](/ja/skills#create-custom-skills)、コードベースからのプロジェクトスキル、および[インストール済みプラグイン](/ja/plugins)からのスキルが含まれます。1 つを選択すると、入力フィールドで強調表示されます。その後にタスクを入力して、通常どおり送信します。

### プラグインをインストールする

[プラグイン](/ja/plugins)は、スキル、エージェント、hooks、MCP サーバー、および LSP 設定を Claude Code に追加する再利用可能なパッケージです。ターミナルを使用せずにデスクトップアプリからプラグインをインストールできます。

ローカルおよび[SSH](#ssh-sessions)セッションの場合、プロンプトボックスの横の\*\*+**ボタンをクリックして**Plugins**を選択して、インストール済みプラグインとそのコマンドを確認します。プラグインを追加するには、サブメニューから**Add plugin\*\*を選択してプラグインブラウザを開きます。これは、公式 Anthropic マーケットプレイスを含む、設定された[マーケットプレイス](/ja/plugin-marketplaces)から利用可能なプラグインを表示します。**Manage plugins**を選択して、プラグインを有効化、無効化、またはアンインストールします。

プラグインはユーザーアカウント、特定のプロジェクト、またはローカルのみにスコープできます。プラグインはリモートセッションでは利用できません。プラグインの作成を含む完全なプラグインリファレンスについては、[プラグイン](/ja/plugins)を参照してください。

### プレビューサーバーを設定する

Claude は dev サーバーセットアップを自動的に検出し、セッションを開始するときに選択したフォルダのルートの`.claude/launch.json`に設定を保存します。Preview はこのフォルダを作業ディレクトリとして使用するため、親フォルダを選択した場合、独自の dev サーバーを持つサブフォルダは自動的に検出されません。サブフォルダのサーバーで作業するには、そのフォルダで直接セッションを開始するか、設定を手動で追加します。

サーバーの起動方法をカスタマイズするには、たとえば`npm run dev`の代わりに`yarn dev`を使用するか、ポートを変更するには、ファイルを手動で編集するか、Preview ドロップダウンの**Edit configuration**をクリックしてコードエディタで開きます。ファイルはコメント付き JSON をサポートしています。

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "my-app",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "port": 3000
    }
  ]
}
```

同じプロジェクトから異なるサーバーを実行するために複数の設定を定義できます。たとえば、フロントエンドと API です。以下の[例](#examples)を参照してください。

#### 変更を自動検証する

`autoVerify`が有効な場合、Claude はファイルを編集した後、コード変更を自動的に検証します。スクリーンショットを撮影し、エラーをチェックし、応答を完了する前に変更が機能することを確認します。

Auto-verify はデフォルトで有効です。`.claude/launch.json`に`"autoVerify": false`を追加してプロジェクトごとに無効にするか、**Preview**ドロップダウンメニューから切り替えます。

```json
{
  "version": "0.0.1",
  "autoVerify": false,
  "configurations": [...]
}
```

無効にすると、プレビューツールは引き続き利用可能であり、いつでも Claude に検証を依頼できます。Auto-verify は編集後に自動的に実行します。

#### 設定フィールド

`configurations`配列の各エントリは、以下のフィールドを受け入れます：

| フィールド | 型 | 説明 |
| - | - | - |
| `name` | string | このサーバーの一意の識別子 |
| `runtimeExecutable` | string | 実行するコマンド（`npm`、`yarn`、`node`など） |
| `runtimeArgs` | string\[] | `runtimeExecutable`に渡される引数（`["run", "dev"]`など） |
| `port` | number | サーバーがリッスンするポート。デフォルトは 3000 |
| `cwd` | string | プロジェクトルートに相対的な作業ディレクトリ。デフォルトはプロジェクトルート。プロジェクトルートを明示的に参照するには`${workspaceFolder}`を使用します |
| `env` | object | `{ "NODE_ENV": "development" }`などのキーと値のペアとしての追加環境変数。このファイルはリポジトリにコミットされるため、ここにシークレットを入れないでください。シェルプロファイルで設定されたシークレットは自動的に継承されます。 |
| `autoPort` | boolean | ポート競合の処理方法。以下を参照してください |
| `program` | string | `node`で実行するスクリプト。[`program`と`runtimeExecutable`を使用する場合](#when-to-use-program-vs-runtimeexecutable)を参照してください |
| `args` | string\[] | `program`に渡される引数。`program`が設定されている場合のみ使用されます |

##### `program`と`runtimeExecutable`を使用する場合

`runtimeExecutable`を`runtimeArgs`と共に使用して、パッケージマネージャーを通じて dev サーバーを起動します。たとえば、`"runtimeExecutable": "npm"`と`"runtimeArgs": ["run", "dev"]`は`npm run dev`を実行します。

`node`で直接実行したいスタンドアロンスクリプトがある場合は`program`を使用します。たとえば、`"program": "server.js"`は`node server.js`を実行します。`args`で追加フラグを渡します。

#### ポート競合

`autoPort`フィールドは、優先ポートが既に使用されている場合の処理を制御します：

- **`true`**：Claude は自動的に空きポートを見つけて使用します。ほとんどの dev サーバーに適しています。
- **`false`**：Claude はエラーで失敗します。OAuth コールバックまたは CORS 許可リストなど、サーバーが特定のポートを使用する必要がある場合に使用します。
- **設定されていない（デフォルト）**：Claude はサーバーがそのポートを必要とするかどうかを尋ねてから、答えを保存します。

Claude が別のポートを選択すると、割り当てられたポートを`PORT`環境変数を通じてサーバーに渡します。

#### 例

これらの設定は、異なるプロジェクトタイプの一般的なセットアップを示しています：

この設定は、Yarn を使用してポート 3000 で Next.js アプリを実行します：

```json theme={null}
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "web",
      "runtimeExecutable": "yarn",
      "runtimeArgs": ["dev"],
      "port": 3000
    }
  ]
}
```

フロントエンドと API サーバーを持つモノレポの場合、複数の設定を定義します。フロントエンドは`autoPort: true`を使用して、3000 が使用されている場合は空きポートを選択し、API サーバーはポート 8080 を正確に必要とします：

```json theme={null}
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "frontend",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "cwd": "apps/web",
      "port": 3000,
      "autoPort": true
    },
    {
      "name": "api",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "start"],
      "cwd": "server",
      "port": 8080,
      "env": { "NODE_ENV": "development" },
      "autoPort": false
    }
  ]
}
```

パッケージマネージャーコマンドを使用する代わりに Node.js スクリプトを直接実行するには、`program`フィールドを使用します：

```json theme={null}
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "server",
      "program": "server.js",
      "args": ["--verbose"],
      "port": 4000
    }
  ]
}
```

## 定期的なタスクをスケジュールする

デフォルトでは、スケジュール済みタスクは、選択した時間と頻度で自動的に新しいセッションを開始します。毎日のコード レビュー、依存関係の更新チェック、またはカレンダーとインボックスから取得する朝のブリーフィングなどの定期的な作業に使用します。

### スケジュール オプションを比較する

Claude Code offers three ways to schedule recurring work:

| | [Cloud](/en/routines) | [Desktop](/en/desktop-scheduled-tasks) | [`/loop`](/en/scheduled-tasks) |
| :- | :- | :- | :- |
| Runs on | Anthropic cloud | Your machine | Your machine |
| Requires machine on | No | Yes | Yes |
| Requires open session | No | No | Yes |
| Persistent across restarts | Yes | Yes | Restored on `--resume` if unexpired |
| Access to local files | No (fresh clone) | Yes | Yes |
| MCP servers | Connectors configured per task | [Config files](/en/mcp) and connectors | Inherits from session |
| Permission prompts | No (runs autonomously) | Configurable per task | Inherits from session |
| Customizable schedule | Via `/schedule` in the CLI | Yes | Yes |
| Minimum interval | 1 hour | 1 minute | 1 minute |

Use **cloud tasks** for work that should run reliably without your machine. Use **Desktop tasks** when you need access to local files and tools. Use **`/loop`** for quick polling during a session.

Schedule ページは 2 種類のタスクをサポートしています：

- **ローカルタスク**：マシンで実行されます。ローカルファイルとツールに直接アクセスできますが、デスクトップアプリが開いていてコンピュータが起動している必要があります。
- **リモートタスク**：Anthropic が管理するクラウドインフラストラクチャで実行されます。コンピュータがオフの場合でも実行し続けますが、ローカルチェックアウトではなくリポジトリの新しいクローンに対して機能します。

両方の種類は同じタスクグリッドに表示されます。**New task**をクリックして、作成する種類を選択します。このセクションの残りはローカルタスクをカバーしています。リモートタスクについては、[クラウドスケジュール済みタスク](/ja/web-scheduled-tasks)を参照してください。

[スケジュール済みタスクの実行方法](#how-scheduled-tasks-run)を参照して、ローカルタスクの実行を逃した場合とキャッチアップ動作の詳細を確認してください。

デフォルトでは、ローカルスケジュール済みタスクは、コミットされていない変更を含む、作業ディレクトリの現在の状態に対して実行されます。プロンプト入力の worktree トグルを有効にして、各実行に独立した Git worktree を与えます。これは[並列セッション](#work-in-parallel-with-sessions)と同じ方法です。

ローカルスケジュール済みタスクを作成するには、サイドバーの**Schedule**をクリックし、**New task**をクリックして、**New local task**を選択します。これらのフィールドを設定します：

| フィールド | 説明 |
| - | - |
| Name | タスクの識別子。小文字のケバブケースに変換され、ディスク上のフォルダ名として使用されます。タスク全体で一意である必要があります。 |
| Description | タスクリストに表示される短い要約。 |
| Prompt | タスクが実行されるときに Claude に送信される指示。プロンプトボックスで任意のメッセージを書くのと同じ方法で書きます。プロンプト入力には、モデル、権限モード、作業フォルダ、および worktree のコントロールも含まれます。 |
| Frequency | タスクが実行される頻度。以下の[頻度オプション](#frequency-options)を参照してください。 |

任意のセッションで実行したいことを説明することで、タスクを作成することもできます。たとえば、「毎朝 9 時に実行される毎日のコード レビューを設定する」などです。

### 頻度オプション

- **Manual**：スケジュールなし、**Run now**をクリックしたときのみ実行されます。オンデマンドでトリガーするプロンプトを保存するのに便利です
- **Hourly**：毎時間実行されます。各タスクは API トラフィックを分散させるために時間の上部から最大 10 分の固定オフセットを取得します
- **Daily**：時間ピッカーを表示し、デフォルトは現地時間の午前 9 時です
- **Weekdays**：Daily と同じですが、土曜日と日曜日をスキップします
- **Weekly**：時間ピッカーと日付ピッカーを表示します

ピッカーが提供しないインターバル（15 分ごと、毎月初日など）の場合、任意の Desktop セッションで Claude に尋ねてスケジュールを設定します。プレーンテキストを使用します。たとえば、「6 時間ごとにすべてのテストを実行するタスクをスケジュールする」などです。

### スケジュール済みタスクの実行方法

ローカルスケジュール済みタスクはマシンで実行されます。Desktop はアプリが開いている間、毎分スケジュールをチェックし、開いている手動セッションとは独立して、タスクが期限になったときに新しいセッションを開始します。各タスクは、API トラフィックを分散させるために、スケジュール時刻の後に最大 10 分の固定遅延を取得します。遅延は決定的です：同じタスクは常に同じオフセットで開始されます。

タスクが実行されると、デスクトップ通知が表示され、新しいセッションがサイドバーの**Scheduled**セクションの下に表示されます。それを開いて、Claude が実行した内容を確認し、変更を確認するか、権限プロンプトに応答します。セッションは他のセッションと同じように機能します：Claude はファイルを編集し、コマンドを実行し、コミットを作成し、プルリクエストを開くことができます。

タスクはデスクトップアプリが実行されていてコンピュータが起動している間のみ実行されます。コンピュータがスケジュール時刻を通じてスリープ状態になった場合、実行はスキップされます。アイドルスリープを防ぐには、Settings の**Desktop app → General**で**Keep computer awake**を有効にします。ラップトップの蓋を閉じるとまだスリープ状態になります。コンピュータがオフの場合でも実行する必要があるタスクについては、代わりに[リモートタスク](/ja/web-scheduled-tasks)を使用します。

### 実行を逃した場合

アプリが起動するか、コンピュータが起動すると、Desktop は過去 7 日間に各タスクが実行を逃したかどうかをチェックします。逃した場合、Desktop は最近逃した時刻に対して正確に 1 つのキャッチアップ実行を開始し、それより古いものを破棄します。6 日間逃した毎日のタスクは起動時に 1 回実行されます。Desktop はキャッチアップ実行が開始されたときに通知を表示します。

プロンプトを書くときはこれを念頭に置いてください。午前 9 時にスケジュールされたタスクは、コンピュータが一日中スリープ状態だった場合、午後 11 時に実行される可能性があります。タイミングが重要な場合は、プロンプト自体にガードレールを追加します。たとえば、「今日のコミットのみを確認してください。午後 5 時以降の場合は、レビューをスキップして、逃したものの要約を投稿してください。」

### スケジュール済みタスクの権限

各タスクは独自の権限モードを持ち、タスクを作成または編集するときに設定します。`~/.claude/settings.json`からの許可ルールもスケジュール済みタスクセッションに適用されます。タスクが Ask モードで実行され、権限がないツールを実行する必要がある場合、実行は承認するまで停止します。セッションはサイドバーで開いたままなので、後で応答できます。

停止を避けるには、タスクを作成した後に**Run now**をクリックし、権限プロンプトを監視し、各プロンプトに対して「常に許可」を選択します。そのタスクの将来の実行は、プロンプトなしで同じツールを自動承認します。タスクの詳細ページからこれらの承認を確認および取り消すことができます。

### スケジュール済みタスクを管理する

**Schedule**リストのタスクをクリックして、その詳細ページを開きます。ここから以下を実行できます：

- **Run now**：次のスケジュール時刻を待たずにタスクを直ちに開始する
- **Toggle repeats**：タスクを削除せずにスケジュール実行を一時停止または再開する
- **Edit**：プロンプト、頻度、フォルダ、またはその他の設定を変更する
- **Review history**：コンピュータがスリープ状態だったためにスキップされたものを含む、すべての過去の実行を確認する
- **Review allowed permissions**：**Always allowed**パネルからこのタスクの保存されたツール承認を確認および取り消す
- **Delete**：タスクを削除し、それが作成したすべてのセッションをアーカイブする

任意の Desktop セッションで Claude に尋ねることで、タスクを管理することもできます。たとえば、「dependency-audit タスクを一時停止する」、「standup-prep タスクを削除する」、または「スケジュール済みタスクを表示する」などです。

ディスク上のタスクのプロンプトを編集するには、`~/.claude/scheduled-tasks/<task-name>/SKILL.md`を開きます（[`CLAUDE_CONFIG_DIR`](/ja/env-vars)が設定されている場合はその下）。ファイルは`name`と`description`の YAML frontmatter を使用し、プロンプトが本体です。変更は次の実行時に有効になります。スケジュール、フォルダ、モデル、および有効状態はこのファイルにはありません：Edit フォームを通じて変更するか、Claude に尋ねます。

## 環境設定

[セッションを開始する](#start-a-session)ときに選択する環境は、Claude が実行される場所と接続方法を決定します：

- **Local**：マシンで実行され、ファイルに直接アクセスできます
- **Remote**：Anthropic のクラウドインフラストラクチャで実行されます。アプリを閉じても、セッションは続行されます。
- **SSH**：SSH 経由で接続するリモートマシンで実行されます。たとえば、独自のサーバー、クラウド VM、または dev コンテナなどです。

### ローカルセッション

ローカルセッションはシェルから環境変数を継承します。追加の変数が必要な場合は、`~/.zshrc`または`~/.bashrc`などのシェルプロファイルで設定し、デスクトップアプリを再起動します。サポートされている変数の完全なリストについては、[環境変数](/ja/env-vars)を参照してください。

[拡張思考](/ja/common-workflows#use-extended-thinking-thinking-mode)はデフォルトで有効になっており、複雑な推論タスクのパフォーマンスを向上させますが、追加のトークンを使用します。思考を完全に無効にするには、シェルプロファイルで`MAX_THINKING_TOKENS=0`を設定します。Opus では、適応的推論が思考の深さを制御するため、`MAX_THINKING_TOKENS`は`0`を除いて無視されます。

### リモートセッション

リモートセッションはアプリを閉じても、バックグラウンドで続行されます。使用状況は[サブスクリプションプランの制限](/ja/costs)にカウントされ、別の計算料金はありません。

異なるネットワークアクセスレベルと環境変数を持つカスタムクラウド環境を作成できます。リモートセッションを開始するときに環境ドロップダウンを選択し、**Add environment**を選択します。ネットワークアクセスと環境変数の設定の詳細については、[クラウド環境](/ja/claude-code-on-the-web#cloud-environment)を参照してください。

### SSH セッション

SSH セッションを使用すると、デスクトップアプリをインターフェイスとして使用しながら、リモートマシンで Claude Code を実行できます。これは、クラウド VM、dev コンテナ、または特定のハードウェアまたは依存関係を持つサーバーに存在するコードベースで作業するのに便利です。

SSH 接続を追加するには、セッションを開始する前に環境ドロップダウンをクリックして、**+ Add SSH connection**を選択します。ダイアログは以下を要求します：

- **Name**：この接続のフレンドリーラベル
- **SSH Host**：`user@hostname`または`~/.ssh/config`で定義されたホスト
- **SSH Port**：空のままの場合はデフォルトの 22、または SSH config からのポート
- **Identity File**：`~/.ssh/id_rsa`などの秘密鍵へのパス。デフォルトキーまたは SSH config を使用するには空のままにします。

追加されると、接続は環境ドロップダウンに表示されます。それを選択して、そのマシンでセッションを開始します。Claude はリモートマシンで実行され、そのファイルとツールにアクセスできます。

Claude Code はリモートマシンにインストールされている必要があります。接続されると、SSH セッションは権限モード、コネクタ、プラグイン、および MCP サーバーをサポートします。

## エンタープライズ設定

Teams または Enterprise プランの組織は、管理コンソールコントロール、管理設定ファイル、およびデバイス管理ポリシーを通じてデスクトップアプリの動作を管理できます。

### 管理コンソールコントロール

これらの設定は[管理設定コンソール](https://claude.ai/admin-settings/claude-code)を通じて設定されます：

- **Code in the desktop**：組織内のユーザーがデスクトップアプリで Claude Code にアクセスできるかどうかを制御します
- **Code in the web**：組織の[Web セッション](/ja/claude-code-on-the-web)を有効または無効にします
- **Remote Control**：組織の[Remote Control](/ja/remote-control)を有効または無効にします
- **Disable Bypass permissions mode**：組織内のユーザーが bypass permissions モードを有効にするのを防ぎます

### 管理設定

管理設定はプロジェクトおよびユーザー設定をオーバーライドし、Desktop が CLI セッションを生成するときに適用されます。これらのキーを組織の[管理設定](/ja/settings#settings-precedence)ファイルで設定するか、管理コンソールを通じてリモートでプッシュできます。

| キー | 説明 |
| - | - |
| `permissions.disableBypassPermissionsMode` | ユーザーが Bypass permissions モードを有効にするのを防ぐには`"disable"`に設定します。 |
| `disableAutoMode` | ユーザーが[Auto](/ja/permission-modes#eliminate-prompts-with-auto-mode)モードを有効にするのを防ぐには`"disable"`に設定します。モードセレクタから Auto を削除します。`permissions`の下でも受け入れられます。 |
| `autoMode` | 組織全体で auto mode 分類器が信頼およびブロックするものをカスタマイズします。[auto mode 分類器を設定する](/ja/permissions#configure-the-auto-mode-classifier)を参照してください。 |

`permissions.disableBypassPermissionsMode`と`disableAutoMode`はユーザーおよびプロジェクト設定でも機能しますが、管理設定に配置するとユーザーがそれらをオーバーライドするのを防ぎます。`autoMode`はユーザー設定、`.claude/settings.local.json`、および管理設定から読み取られますが、チェックイン済みの`.claude/settings.json`からは読み取られません：クローンされたリポジトリは独自の分類器ルールを注入できません。`allowManagedPermissionRulesOnly`と`allowManagedHooksOnly`を含む管理専用設定の完全なリストについては、[管理専用設定](/ja/permissions#managed-only-settings)を参照してください。

管理コンソールを通じてアップロードされたリモート管理設定は、現在 CLI および IDE セッションにのみ適用されます。Desktop 固有の制限については、上記の管理コンソールコントロールを使用します。

### デバイス管理ポリシー

IT チームは、macOS の MDM または Windows のグループポリシーを通じてデスクトップアプリを管理できます。利用可能なポリシーには、Claude Code 機能の有効化または無効化、自動更新の制御、およびカスタムデプロイメント URL の設定が含まれます。

- **macOS**：Jamf または Kandji などのツールを使用して`com.anthropic.Claude`プリファレンスドメインを通じて設定します
- **Windows**：`SOFTWARE\Policies\Claude`のレジストリを通じて設定します

### 認証と SSO

エンタープライズ組織はすべてのユーザーに SSO を要求できます。プランレベルの詳細については[認証](/ja/authentication)を参照し、SAML および OIDC 設定については[SSO の設定](https://support.claude.com/en/articles/13132885-setting-up-single-sign-on-sso)を参照してください。

### データ処理

Claude Code はローカルセッションではコードをローカルで処理するか、リモートセッションでは Anthropic のクラウドインフラストラクチャで処理します。会話とコードコンテキストは処理のために Anthropic の API に送信されます。データ保持、プライバシー、およびコンプライアンスの詳細については、[データ処理](/ja/data-usage)を参照してください。

### デプロイメント

Desktop はエンタープライズデプロイメントツールを通じて配布できます：

- **macOS**：Jamf または Kandji などの MDM を使用して`.dmg`インストーラーを通じて配布します
- **Windows**：MSIX パッケージまたは`.exe`インストーラーを通じてデプロイします。サイレントインストールを含むエンタープライズデプロイメントオプションについては、[Deploy Claude Desktop for Windows](https://support.claude.com/en/articles/12622703-deploy-claude-desktop-for-windows)を参照してください。

プロキシ設定、ファイアウォール許可リスト、LLM ゲートウェイなどのネットワーク設定については、[ネットワーク設定](/ja/network-config)を参照してください。

完全なエンタープライズ設定リファレンスについては、[エンタープライズ設定ガイド](https://support.claude.com/en/articles/12622667-enterprise-configuration)を参照してください。

## CLI から来ましたか？

既に Claude Code CLI を使用している場合、Desktop は同じ基盤となるエンジンをグラフィカルインターフェイスで実行します。同じマシン上で、同じプロジェクト上でも、両方を同時に実行できます。各々は個別のセッション履歴を保持しますが、CLAUDE.md ファイルを通じて設定とプロジェクトメモリを共有します。

CLI セッションを Desktop に移動するには、ターミナルで`/desktop`を実行します。Claude はセッションを保存し、デスクトップアプリで開いてから CLI を終了します。このコマンドは macOS と Windows でのみ利用可能です。

Desktop と CLI をいつ使用するか：ビジュアル diff レビュー、ファイル添付、またはサイドバーのセッション管理が必要な場合は Desktop を使用します。スクリプト、自動化、サードパーティプロバイダー、またはターミナルワークフローを優先する場合は CLI を使用します。

### CLI フラグの同等物

このテーブルは、一般的な CLI フラグのデスクトップアプリの同等物を示しています。リストされていないフラグは、スクリプトまたは自動化用に設計されているため、デスクトップの同等物がありません。

| CLI | Desktop の同等物 |
| - | - |
| `--model sonnet` | セッションを開始する前に、送信ボタンの横のモデルドロップダウン |
| `--resume`、`--continue` | サイドバーのセッションをクリック |
| `--permission-mode` | 送信ボタンの横のモードセレクタ |
| `--dangerously-skip-permissions` | Bypass permissions モード。Settings → Claude Code → 「Allow bypass permissions mode」で有効にします。エンタープライズ管理者はこの設定を無効にできます。 |
| `--add-dir` | リモートセッションで\*\*+\*\*ボタンで複数のリポジトリを追加 |
| `--allowedTools`、`--disallowedTools` | Desktop では利用できません |
| `--verbose` | 利用できません。システムログを確認してください：macOS の Console.app、Windows の Event Viewer → Windows Logs → Application |
| `--print`、`--output-format` | 利用できません。Desktop はインタラクティブのみです。 |
| `ANTHROPIC_MODEL`環境変数 | 送信ボタンの横のモデルドロップダウン |
| `MAX_THINKING_TOKENS`環境変数 | シェルプロファイルで設定；ローカルセッションに適用されます。[環境設定](#environment-configuration)を参照してください。 |

### 共有設定

Desktop と CLI は同じ設定ファイルを読み取るため、セットアップが引き継がれます：

- プロジェクト内の\*\*[CLAUDE.md](/ja/memory)\*\*ファイルは両方で使用されます
- `~/.claude.json`または`.mcp.json`で設定された\*\*[MCP サーバー](/ja/mcp)\*\*は両方で機能します
- 設定で定義された\*\*[Hooks](/ja/hooks)**および**[スキル](/ja/skills)\*\*は両方に適用されます
- `~/.claude.json`および`~/.claude/settings.json`の\*\*[設定](/ja/settings)\*\*は共有されます。`settings.json`の権限ルール、許可されたツール、およびその他の設定は Desktop セッションに適用されます。
- **モデル**：Sonnet、Opus、および Haiku は両方で利用可能です。Desktop では、セッションを開始する前に送信ボタンの横のドロップダウンからモデルを選択します。アクティブなセッション中にモデルを変更することはできません。

**MCP サーバー：デスクトップチャットアプリと Claude Code**：Claude Desktop チャットアプリの`claude_desktop_config.json`で設定された MCP サーバーは Claude Code とは別であり、Code タブに表示されません。Claude Code で MCP サーバーを使用するには、`~/.claude.json`またはプロジェクトの`.mcp.json`ファイルで設定します。詳細については、[MCP 設定](/ja/mcp#installing-mcp-servers)を参照してください。

### 機能比較

このテーブルは、CLI と Desktop の間のコア機能を比較しています。CLI フラグの完全なリストについては、[CLI リファレンス](/ja/cli-reference)を参照してください。

| 機能 | CLI | Desktop |
| - | - | - |
| 権限モード | `dontAsk`を含むすべてのモード | Ask permissions、Auto accept edits、Plan mode、Auto、および Settings 経由の Bypass permissions |
| `--dangerously-skip-permissions` | CLI フラグ | Bypass permissions モード。Settings → Claude Code → 「Allow bypass permissions mode」で有効にします |
| [サードパーティプロバイダー](/ja/third-party-integrations) | Bedrock、Vertex、Foundry | 利用できません。Desktop は Anthropic の API に直接接続します。 |
| [MCP サーバー](/ja/mcp) | 設定ファイルで設定 | ローカルおよび SSH セッションの Connectors UI、または設定ファイル |
| [プラグイン](/ja/plugins) | `/plugin`コマンド | プラグインマネージャー UI |
| @mention ファイル | テキストベース | オートコンプリート付き；ローカルおよび SSH セッションのみ |
| ファイル添付 | 利用できません | 画像、PDF |
| セッション分離 | [`--worktree`](/ja/cli-reference)フラグ | 自動 worktrees |
| 複数セッション | 別のターミナル | サイドバータブ |
| 定期的なタスク | cron ジョブ、CI パイプライン | [スケジュール済みタスク](#schedule-recurring-tasks) |
| コンピュータ使用 | macOS での[アプリとスクリーン制御](#let-claude-use-your-computer) | macOS での[アプリとスクリーン制御](#let-claude-use-your-computer) |
| Dispatch 統合 | 利用できません | サイドバーの[Dispatch セッション](#sessions-from-dispatch) |
| スクリプトと自動化 | [`--print`](/ja/cli-reference)、[Agent SDK](/ja/headless) | 利用できません |

### Desktop では利用できないもの

以下の機能は CLI または VS Code 拡張機能でのみ利用可能です：

- **サードパーティプロバイダー**：Desktop は Anthropic の API に直接接続します。代わりに Bedrock、Vertex、または Foundry で[CLI](/ja/quickstart)を使用します。
- **Linux**：デスクトップアプリは macOS と Windows でのみ利用可能です。
- **インラインコード提案**：Desktop はオートコンプリートスタイルの提案を提供しません。会話型プロンプトと明示的なコード変更を通じて機能します。
- **エージェントチーム**：マルチエージェントオーケストレーションは[CLI](/ja/agent-teams)および[Agent SDK](/ja/headless)を通じて利用可能であり、Desktop では利用できません。

## トラブルシューティング

### バージョンを確認する

実行しているデスクトップアプリのバージョンを確認するには：

- **macOS**：メニューバーの**Claude**をクリックしてから、**About Claude**をクリック
- **Windows**：**Help**をクリックしてから、**About**をクリック

バージョン番号をクリックしてクリップボードにコピーします。

### Code タブの 403 またはエラー認証エラー

Code タブを使用するときに`Error 403: Forbidden`またはその他の認証エラーが表示される場合：

1. アプリメニューからサインアウトして再度サインインします。これが最も一般的な修正です。
2. アクティブな有料サブスクリプション（Pro、Max、Teams、または Enterprise）があることを確認します。
3. CLI は機能するが Desktop は機能しない場合、デスクトップアプリを完全に終了し（ウィンドウを閉じるだけではなく）、再度開いてサインインします。
4. インターネット接続とプロキシ設定を確認します。

### 起動時に空白または停止画面

アプリが開いても空白または応答しない画面が表示される場合：

1. アプリを再起動します。
2. 保留中の更新を確認します。アプリは起動時に自動更新されます。
3. Windows では、**Windows Logs → Application**の Event Viewer でクラッシュログを確認します。

### 「Failed to load session」

`Failed to load session`が表示される場合、選択したフォルダが存在しなくなった可能性があります。Git リポジトリがインストールされていない Git LFS を必要とする可能性があります。またはファイル権限がアクセスを防ぐ可能性があります。別のフォルダを選択するか、アプリを再起動してみてください。

### セッションがインストール済みツールを見つけられない

Claude が`npm`、`node`、またはその他の CLI コマンドなどのツールを見つけられない場合、ツールが通常のターミナルで機能することを確認し、シェルプロファイルが PATH を正しく設定していることを確認し、デスクトップアプリを再起動して環境変数を再度読み込みます。

### Git および Git LFS エラー

Windows では、Code タブがローカルセッションを開始するために Git が必要です。「Git is required」が表示される場合、[Git for Windows](https://git-scm.com/downloads/win)をインストールしてアプリを再起動します。

「Git LFS is required by this repository but is not installed」が表示される場合、[git-lfs.com](https://git-lfs.com/)から Git LFS をインストールし、`git lfs install`を実行してアプリを再起動します。

### Windows で MCP サーバーが機能しない

MCP サーバートグルが応答しない場合、または Windows でサーバーが接続に失敗する場合、サーバーが設定で正しく設定されていることを確認し、アプリを再起動し、Task Manager でサーバープロセスが実行されていることを確認し、接続エラーについてサーバーログを確認します。

### アプリが終了しない

- **macOS**：Cmd+Q を押します。アプリが応答しない場合、Cmd+Option+Esc で Force Quit を使用し、Claude を選択して Force Quit をクリックします。
- **Windows**：Ctrl+Shift+Esc で Task Manager を使用して Claude プロセスを終了します。

### Windows 固有の問題

- **インストール後に PATH が更新されない**：新しいターミナルウィンドウを開きます。PATH の更新は新しいターミナルセッションにのみ適用されます。
- **同時インストールエラー**：別のインストールが進行中であるというエラーが表示されるが、実際には進行中でない場合、インストーラーを管理者として実行してみてください。
- **ARM64**：Windows ARM64 デバイスは完全にサポートされています。

### Intel Mac で Cowork タブが利用できない

Cowork タブは macOS で Apple Silicon（M1 以降）が必要です。Windows では、Cowork はサポートされているすべてのハードウェアで利用可能です。Chat および Code タブは Intel Mac で正常に機能します。

### CLI で開くときに「Branch doesn't exist yet」

リモートセッションはローカルマシンに存在しないブランチを作成できます。セッションツールバーのブランチ名をクリックしてコピーしてから、ローカルでフェッチします：

```bash
git fetch origin <branch-name>
git checkout <branch-name>
```

### まだ立ち往生していますか？

- [GitHub Issues](https://github.com/anthropics/claude-code/issues)でバグを検索またはファイルします
- [Claude サポートセンター](https://support.claude.com/)にアクセスします

バグをファイルするときは、デスクトップアプリのバージョン、オペレーティングシステム、正確なエラーメッセージ、および関連ログを含めます。macOS では Console.app を確認します。Windows では Event Viewer → Windows Logs → Application を確認します。
