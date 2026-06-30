---
title: desktop
source: https://code.claude.com/docs/ja/desktop.md
---

# Desktop application

> Claude Code Desktop をさらに活用する：Git 分離による並列セッション、ドラッグアンドドロップペインレイアウト、統合ターミナルとファイルエディタ、サイドチャット、コンピュータ使用、電話から Dispatch セッションを送信、ビジュアル diff レビュー、アプリプレビュー、PR 監視、コネクタ、エンタープライズ設定。

Claude Desktop アプリには 3 つのタブがあります：**Chat** は会話用、**Cowork** は [Dispatch とより長い agentic work](https://claude.com/product/cowork) 用、**Code** はソフトウェア開発用です。このページは Code タブのリファレンスです。

Universal build for Intel and Apple Silicon

For x64 processors

apt or .deb for Ubuntu and Debian

For Windows ARM64, download the [ARM64 installer](https://claude.ai/api/desktop/win32/arm64/setup/latest/redirect?utm_source=claude_code\&utm_medium=docs). On Linux, install with apt; see [Claude Desktop on Linux](/en/desktop-linux).

インストール後、Claude を起動してサインインし、**Code** タブをクリックします。Windows で初めて開く場合、[Git for Windows](https://git-scm.com/downloads/win) がインストールされている必要があります。インストール後、アプリを再起動してください。最初のセッションのウォークスルーについては、[はじめにガイド](/ja/desktop-quickstart)を参照してください。

Code タブでは、各会話は **セッション** です：独自のチャット履歴、プロジェクトフォルダ、コード変更を持ち、他のセッションとは独立しています。サイドバーはセッションをリストアップし、複数を並列で実行できます。セッション内では以下のことができます：

- [diff ビューで変更をレビューしてコメント](#review-changes-with-diff-view)してから、[CI を通じて結果の PR を監視](#monitor-pull-request-status)
- [埋め込みブラウザで実行中のアプリをプレビュー](#preview-your-app)し、Claude が独自の変更を検証
- [ペインを配置](#arrange-your-workspace)して、チャット、diff、プレビュー、ターミナル、ファイルエディタを並べて表示
- セッションのコンテキストを使用する[サイド質問](#ask-a-side-question-without-derailing-the-session)を尋ねて、セッションを脱線させない
- [外部ツールを接続](#connect-external-tools)（GitHub、Slack、Linear など）
- Claude に[アプリを開いてスクリーンを制御](#let-claude-use-your-computer)させる
- マシン上、[クラウド](#run-long-running-tasks-remotely)上、または [SSH](#ssh-sessions) 上で実行

[スケジュール済みの定期的な作業](/ja/desktop-scheduled-tasks)、[キーボードショートカット](#keyboard-shortcuts)、または[電話からタスクを送信](#sessions-from-dispatch)については、リンクされたページとセクションを参照してください。既にターミナルベースの CLI を使用している場合は、[CLI 比較](#coming-from-the-cli)を参照して、何が引き継がれるかを確認してください。

セッションを開始する

最初のメッセージを送信する前に、プロンプト領域で 4 つのことを設定してください：

- **環境**：Claude が実行される場所を選択します。ローカルマシンの場合は**Local**、Anthropic ホスト型クラウドセッションの場合は**Remote**、管理するリモートマシンの場合は[**SSH 接続**](#ssh-sessions)を選択します。[環境設定](#environment-configuration)を参照してください。
- **プロジェクトフォルダ**：Claude が作業するフォルダまたはリポジトリを選択します。クラウドセッションの場合、[複数のリポジトリ](#run-long-running-tasks-remotely)を追加できます。
- **モデル**：送信ボタンの横のドロップダウンから[モデル](/ja/model-config#available-models)を選択します。セッション中にこれを変更できます。
- **権限モード**：[モードセレクタ](#choose-a-permission-mode)から Claude がどの程度の自律性を持つかを選択します。セッション中にこれを変更できます。

タスクを入力して**Enter**キーを押してセッションを開始します。各セッションは独自のコンテキストと変更を追跡します。

コードの操作

Claude に適切なコンテキストを提供し、それが独立して実行する量を制御し、変更内容を確認します。

プロンプトボックスを使用する

Claude に実行させたいことを入力して**Enter**キーを押して送信します。Claude はプロジェクトファイルを読み取り、[権限モード](#choose-a-permission-mode)に基づいて変更を加えてコマンドを実行します。いつでも Claude を中断できます：停止ボタンをクリックするか、修正を入力して**Enter**キーを押します。Claude は実行を停止し、入力に基づいて調整します。

プロンプトボックスの横の\*\*+\*\*ボタンをクリックすると、ファイル添付、[スキル](#use-skills)、[コネクタ](#connect-external-tools)、および[プラグイン](#install-plugins)にアクセスできます。

ファイルとコンテキストをプロンプトに追加する

プロンプトボックスは外部コンテキストを取り込む 2 つの方法をサポートしています：

- **@mention ファイル**：`@`の後にファイル名を入力して、ファイルを会話コンテキストに追加します。Claude はそのファイルを読み取り、参照できます。@mention はクラウドセッションでは利用できません。
- **ファイルを添付**：添付ボタンを使用するか、ファイルをプロンプトに直接ドラッグアンドドロップして、画像、PDF、およびその他のファイルをプロンプトに添付します。これはバグのスクリーンショット、デザインモックアップ、または参照ドキュメントを共有するのに便利です。

権限モードを選択する

権限モードは、セッション中に Claude がどの程度の自律性を持つかを制御します：ファイルの編集、コマンドの実行、またはその両方の前に確認するかどうかです。送信ボタンの横のモードセレクタを使用して、いつでもモードを切り替えることができます。Ask permissions で開始して Claude が実行する内容を正確に確認してから、慣れてきたら Auto accept edits または Plan mode に移動します。

| モード | 設定キー | 動作 |
| - | - | - |
| **Ask permissions** | `default` | Claude はファイルの編集またはコマンドの実行の前に確認を求めます。diff を確認し、各変更を受け入れるか拒否できます。新規ユーザーに推奨されます。 |
| **Auto accept edits** | `acceptEdits` | Claude はファイル編集と`mkdir`、`touch`、`mv`などの一般的なファイルシステムコマンドを自動的に受け入れますが、他のターミナルコマンドの実行前には確認を求めます。ファイル変更を信頼し、より高速な反復を望む場合に使用します。 |
| **Plan mode** | `plan` | Claude はファイルを読み取り、コマンドを実行して探索してから、ソースコードを編集せずにプランを提案します。アプローチを最初に確認したい複雑なタスクに適しています。 |
| **Auto** | `auto` | Claude はすべてのアクションをバックグラウンド安全チェック付きで実行し、リクエストとの整合性を確認します。権限プロンプトを削減しながら監視を維持します。Settings → Claude Code で有効にします。[利用可能性要件](#auto-mode-availability)以下を参照してください。 |
| **Bypass permissions** | `bypassPermissions` | Claude は権限プロンプトなしで実行され、明示的な[ask ルール](/ja/permissions#manage-permissions)によって強制されるもの以外は、CLI の`--dangerously-skip-permissions`と同等です。Settings → Claude Code の「Allow bypass permissions mode」で有効にします。サンドボックス化されたコンテナまたは VM でのみ使用してください。エンタープライズ管理者はこのオプションを無効にできます。 |

`dontAsk`権限モードは[CLI](/ja/permission-modes#allow-only-pre-approved-tools-with-dontask-mode)でのみ利用可能です。

Auto mode は Anthropic API のすべてのユーザーが利用できる研究プレビューです。Claude Opus 4.6 以降、または Sonnet 4.6 が必要です。Google Cloud Vertex AI にルーティングするエンタープライズデプロイメントでは、[`CLAUDE_CODE_ENABLE_AUTO_MODE`を設定](/ja/permission-modes#enable-auto-mode-on-bedrock-vertex-ai-or-foundry)するまで auto mode はオフになり、そこでは Claude Opus 4.7 と Opus 4.8 のみがサポートされています。

複雑なタスクを Plan mode で開始して、Claude が変更を加える前にアプローチをマップアウトするようにします。プランを承認したら、Auto accept edits または Ask permissions に切り替えて実行します。このワークフローの詳細については、[最初に探索してからプランしてからコード化する](/ja/best-practices#explore-first-then-plan-then-code)を参照してください。

クラウドセッションは Accept edits、Plan mode、および Auto mode をサポートしています。Accept edits は`default`モードに対応しています：クラウドセッションはファイル編集を事前に承認するため、セレクタは Ask permissions ではなく Accept edits を表示します。Bypass permissions はクラウド環境が既にサンドボックス化されているため利用できません。

エンタープライズ管理者は利用可能な権限モードを制限できます。詳細については、[エンタープライズ設定](#enterprise-configuration)を参照してください。

アプリをプレビューする

Claude は dev サーバーを起動し、埋め込みブラウザを開いて変更を確認できます。これはフロントエンド Web アプリとバックエンドサーバーの両方で機能します：Claude は API エンドポイントをテストし、サーバーログを表示し、見つけた問題を反復処理できます。ほとんどの場合、Claude はプロジェクトファイルを編集した後、サーバーを自動的に起動します。いつでも Claude にプレビューを要求することもできます。デフォルトでは、Claude は編集後に[変更を自動検証](#auto-verify-changes)します。

プレビューペインは、プロジェクトから静的 HTML ファイル、PDF、画像、およびビデオを開くこともできます。チャットで HTML、PDF、画像、またはビデオパスをクリックして、プレビューで開きます。

プレビューペインから、以下を実行できます：

- 埋め込みブラウザで実行中のアプリと直接対話する
- Claude が自動的に独自の変更を検証するのを監視する：スクリーンショットを撮影し、DOM を検査し、要素をクリックし、フォームに入力し、見つけた問題を修正します
- セッションツールバーの**Preview**ドロップダウンからサーバーを開始または停止する
- ドロップダウンで**Persist sessions**を選択して、サーバーの再起動時にクッキーとローカルストレージを保持し、開発中に再度ログインする必要がないようにする
- サーバー設定を編集するか、すべてのサーバーを一度に停止する

Claude はプロジェクトに基づいて初期サーバー設定を作成します。アプリがカスタム dev コマンドを使用する場合、`.claude/launch.json`を編集してセットアップに合わせます。完全なリファレンスについては、[プレビューサーバーを設定する](#configure-preview-servers)を参照してください。

保存されたセッションデータをクリアするには、Settings → Claude Code で**Persist preview sessions**をオフに切り替えます。プレビューを完全に無効にするには、Settings → Claude Code で**Preview**をオフに切り替えます。

diff ビューで変更を確認する

Claude がコードに変更を加えた後、diff ビューを使用して、プルリクエストを作成する前にファイルごとに変更を確認できます。

Claude がファイルを変更すると、`+12 -1`などの追加および削除された行数を示す diff 統計インジケータが表示されます。このインジケータをクリックして diff ビューアを開きます。左側にファイルリストが表示され、右側に各ファイルの変更が表示されます。

特定の行にコメントするには、diff 内の任意の行をクリックしてコメントボックスを開きます。フィードバックを入力して**Enter**キーを押してコメントを追加します。複数の行にコメントを追加した後、すべてのコメントを一度に送信します：

- **macOS**：**Cmd+Enter**を押す
- **Windows**：**Ctrl+Enter**を押す

Claude はコメントを読み取り、要求された変更を加えます。これは確認できる新しい diff として表示されます。

コードを確認する

diff ビューで、右上のツールバーの**Review code**をクリックして、Claude にコミット前に変更を評価するよう依頼します。Claude は現在の diff を検査し、diff ビューに直接コメントを残します。任意のコメントに応答するか、Claude に修正を依頼できます。

レビューは高シグナル問題に焦点を当てています：コンパイルエラー、明確なロジックエラー、セキュリティ脆弱性、および明らかなバグです。スタイル、フォーマット、既存の問題、またはリンターが検出するものにはフラグを立てません。

プルリクエストステータスを監視する

プルリクエストを開いた後、CI ステータスバーがセッションに表示されます。Claude Code は GitHub CLI を使用してチェック結果をポーリングし、失敗を表示します。

- **Auto-fix**：有効にすると、Claude は失敗出力を読み取り、反復することで、失敗した CI チェックを自動的に修正しようとします。
- **Auto-merge**：有効にすると、Claude はすべてのチェックが成功したら PR をマージします。マージ方法はスカッシュです。Auto-merge がこれを機能させるために[GitHub リポジトリ設定で有効にされている](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-auto-merge-for-pull-requests-in-your-repository)必要があります。

CI ステータスバーの**Auto-fix**および**Auto-merge**トグルを使用して、いずれかのオプションを有効にします。Claude Code はまた、CI が完了したときにデスクトップ通知を送信します。PR がマージまたはクローズされた後にセッションを自動的にアーカイブするには、Settings → Claude Code で[auto-archive](#work-in-parallel-with-sessions)をオンにします。

PR 監視には、[GitHub CLI（`gh`）](https://cli.github.com/)がマシンにインストールされ、認証されている必要があります。`gh`がインストールされていない場合、Desktop は PR を作成しようとする最初の時点でインストールを促します。

ワークスペースを配置する

Code タブはペインを任意のレイアウトで配置できるように構築されています：チャット、diff、プレビュー、ターミナル、ファイル、プラン、タスク、およびサブエージェント。ペインをヘッダーでドラッグして位置を変更するか、ペインエッジをドラッグしてサイズを変更します。macOS では**Cmd+\\**を、Windows では**Ctrl+\\**を押してフォーカスされたペインを閉じます。セッションツールバーの**Views**メニューから追加のペインを開きます。

このセクションのペインレイアウト、ターミナル、ファイルエディタ、およびビューモードには Claude Desktop v1.2581.0 以降が必要です。macOS では**Claude → Check for Updates**を、Windows では**Help → Check for Updates**を開いて更新してください。

ターミナルでコマンドを実行する

統合ターミナルを使用すると、別のアプリに切り替えることなく、セッションと並行してコマンドを実行できます。**Views**メニューから開くか、macOS または Windows で**Ctrl+\`**を押します。ターミナルはセッションの作業ディレクトリで開き、Claude と同じ環境を共有するため、`npm test`や`git status`などのコマンドは Claude が編集しているのと同じファイルを見ます。2 番目のターミナルタブを開くには、ターミナルペインヘッダーの**+**をクリックするか、チャットのフォルダを右クリックして**Open in terminal**を選択します。ターミナルはローカルセッションでのみ利用可能です。

ファイルを開いて編集する

チャットまたは diff ビューアのファイルパスをクリックして、ファイルペインで開きます。HTML、PDF、画像、およびビデオパスは代わりに[プレビューペイン](#preview-your-app)で開きます。スポット編集を行い、**Save**をクリックして書き戻します。ファイルを開いてからディスク上で変更された場合、ペインは警告を表示し、オーバーライドまたは破棄できます。**Discard**をクリックして編集を元に戻すか、ペインヘッダーのパスをクリックして絶対パスをコピーします。

ファイルペインはローカルおよび SSH セッションで利用可能です。クラウドセッションの場合、Claude に変更を加えるよう依頼します。

ファイルを他のアプリで開く

チャット、diff ビューア、またはファイルペイン内のファイルパスを右クリックしてコンテキストメニューを開きます：

- **Attach as context**：ファイルを次のプロンプトに追加
- **Open in**：VS Code、Cursor、Zed などのインストール済みエディタでファイルを開く
- **Show in Finder**（macOS）、**Show in Explorer**（Windows）：含まれるフォルダを開く
- **Copy path**：絶対パスをクリップボードにコピー

ビューモードを切り替える

ビューモードは、チャットトランスクリプトに表示される詳細の量を制御します。送信ボタンの横の**Transcript view**ドロップダウンからモードを切り替えるか、macOS または Windows で**Ctrl+O**を押してモードをサイクルします。

| モード | 表示内容 |
| - | - |
| **Normal** | ツール呼び出しは要約に折りたたまれ、完全なテキスト応答 |
| **Verbose** | すべてのツール呼び出し、ファイル読み取り、Claude が実行した中間ステップ |
| **Summary** | Claude の最終応答と加えた変更のみ |

Claude が特定のアクションを実行した理由をデバッグするときは Verbose を使用します。複数のセッションを実行していて結果をすばやくスキャンしたい場合は Summary を使用します。

キーボードショートカット

macOS で**Cmd+/**を、Windows で**Ctrl+/**を押して、Code タブで利用可能なすべてのショートカットを表示します。Windows では、以下のショートカットに対して**Cmd**の代わりに**Ctrl**を使用します。セッションサイクリング、ターミナルトグル、およびビューモードトグルはすべてのプラットフォームで**Ctrl**を使用します。

| ショートカット | アクション |
| - | - |
| `Cmd` `/` | キーボードショートカットを表示 |
| `Cmd` `N` | 新しいセッション |
| `Cmd` `W` | セッションを閉じる |
| `Ctrl` `Tab` / `Ctrl` `Shift` `Tab` | 次または前のセッション |
| `Cmd` `Shift` `]` / `Cmd` `Shift` `[` | 次または前のセッション |
| `Esc` | Claude の応答を停止 |
| `Cmd` `Shift` `D` | diff ペインを切り替え |
| `Cmd` `Shift` `P` | プレビューペインを切り替え |
| `Cmd` `Shift` `S` | プレビューで要素を選択 |
| `Ctrl` `` ` `` | ターミナルペインを切り替え |
| `Cmd` `\` | フォーカスされたペインを閉じる |
| `Cmd` `;` | サイドチャットを開く |
| `Ctrl` `O` | ビューモードをサイクル |
| `Cmd` `Shift` `M` | 権限モードメニューを開く |
| `Cmd` `Shift` `I` | モデルメニューを開く |
| `Cmd` `Shift` `E` | 努力メニューを開く |
| `1`–`9` | 開いているメニューの項目を選択 |

これらのショートカットは Code タブにのみ適用されます。ターミナルベースの[インタラクティブモードショートカット](/ja/interactive-mode#keyboard-shortcuts)（モードをサイクルするための`Shift+Tab`など）は Desktop では適用されません。

使用状況を確認する

モデルピッカーの横の使用状況リングをクリックして、現在のコンテキストウィンドウ使用状況とプラン使用状況を確認します。コンテキスト使用状況はセッションごと、プラン使用状況はすべての Claude Code サーフェス全体で共有されます。

Claude にコンピュータを使用させる

コンピュータ使用により、Claude はアプリを開き、スクリーンを制御し、あなたがするのと同じ方法でマシンで直接作業できます。モバイルシミュレータでネイティブアプリをテストするよう Claude に依頼したり、CLI がないデスクトップツールと対話したり、GUI を通じてのみ機能する何かを自動化したりします。

コンピュータ使用は macOS と Windows の研究プレビューであり、Pro または Max プランが必要です。Team または Enterprise プランでは利用できません。Claude Desktop アプリが実行されている必要があります。

コンピュータ使用はデフォルトでオフです。[設定で有効にして](#enable-computer-use)、Claude がスクリーンを制御する前に必要な権限を付与してください。macOS では、Accessibility と Screen Recording の権限も付与する必要があります。

[サンドボックス化された Bash ツール](/ja/sandboxing)とは異なり、コンピュータ使用は実際のデスクトップで実行され、承認したものへのアクセス権があります。Claude は各アクションをチェックし、オンスクリーンコンテンツからの潜在的なプロンプトインジェクションにフラグを立てますが、信頼境界は異なります。ベストプラクティスについては、[コンピュータ使用安全ガイド](https://support.claude.com/en/articles/14128542)を参照してください。

コンピュータ使用が適用される場合

Claude はアプリまたはサービスと対話するための複数の方法を持ち、コンピュータ使用は最も広範で最も遅いです。最も正確なツールを最初に試します：

- サービスの[コネクタ](#connect-external-tools)がある場合、Claude はコネクタを使用します。
- タスクがシェルコマンドの場合、Claude は Bash を使用します。
- タスクがブラウザ作業であり、[Chrome の Claude](/ja/chrome)がセットアップされている場合、Claude はそれを使用します。
- これらのいずれも適用されない場合、Claude はコンピュータ使用を使用します。

[アプリごとのアクセス層](#app-permissions)はこれを強化します：ブラウザはビューのみに制限され、ターミナルと IDE はクリックのみに制限され、Claude をコンピュータ使用がアクティブな場合でも専用ツールに向けます。スクリーン制御は、ネイティブアプリ、ハードウェア制御パネル、モバイルシミュレータ、または API のない独自ツールなど、他に何も到達できないものに予約されています。

コンピュータ使用を有効にする

コンピュータ使用はデフォルトでオフです。それが必要な何かをするよう Claude に依頼し、それがオフの場合、Claude は Settings でコンピュータ使用を有効にすれば、タスクを実行できることを伝えます。

Claude Desktop の最新バージョンがあることを確認してください。[claude.com/download](https://claude.com/download)でダウンロードまたは更新してから、アプリを再起動します。

デスクトップアプリで、**Settings > General**（**Desktop app**の下）に移動します。**Computer use**トグルを見つけてオンにします。Windows では、トグルはすぐに有効になり、セットアップは完了です。macOS では、次のステップに進みます。

トグルが表示されない場合は、macOS または Windows で Pro または Max プランを使用していることを確認してから、アプリを更新して再起動します。

macOS では、トグルが有効になる前に 2 つのシステム権限を付与します：

- **Accessibility**：Claude がクリック、入力、スクロールできるようにします
- **Screen Recording**：Claude がスクリーンに表示されているものを見ることができるようにします

Settings ページは各権限の現在のステータスを表示します。いずれかが拒否されている場合、バッジをクリックして関連するシステム設定ペインを開きます。

アプリ権限

Claude が初めてアプリを使用する必要がある場合、セッションにプロンプトが表示されます。**Allow for this session**または**Deny**をクリックします。承認は現在のセッション、または[Dispatch が生成したセッション](#sessions-from-dispatch)では 30 分間有効です。

プロンプトは、Claude がそのアプリに対して取得するコントロールのレベルも表示します。これらの層はアプリカテゴリによって固定され、変更できません：

| 層 | Claude ができること | 適用対象 |
| :- | :- | :- |
| ビューのみ | スクリーンショットでアプリを見る | ブラウザ、取引プラットフォーム |
| クリックのみ | クリックとスクロール、ただし入力またはキーボードショートカットは不可 | ターミナル、IDE |
| フルコントロール | クリック、入力、ドラッグ、キーボードショートカットの使用 | その他すべて |

Terminal、Finder または File Explorer、System Settings または Settings などの広範なリーチを持つアプリは、承認が何を付与するかを知るようにプロンプトに追加の警告を表示します。

**Settings > General**（**Desktop app**の下）で 2 つの設定を設定できます：

- **Denied apps**：ここにアプリを追加して、プロンプトなしで拒否します。Claude は許可されたアプリのアクションを通じて拒否されたアプリに間接的に影響を与える可能性がありますが、拒否されたアプリと直接対話することはできません。
- **Unhide apps when Claude finishes**：Claude が作業している間、他のウィンドウは非表示になり、承認されたアプリのみと対話します。Claude が完了すると、この設定をオフにしない限り、非表示のウィンドウが復元されます。

セッションを管理する

各セッションは独立した会話であり、独自のコンテキストと変更があります。複数のセッションを並列で実行するか、サイドチャットを分岐させるか、作業をクラウドに送信するか、Dispatch にセッションを電話から開始させることができます。

セッションで並列に作業する

サイドバーの\*\*+ New session**をクリックするか、macOS で**Cmd+N**を、Windows で**Ctrl+N**を押して、複数のタスクを並列で作業します。**Ctrl+Tab**と**Ctrl+Shift+Tab\*\*を押してサイドバーのセッションをサイクルします。Git リポジトリの場合、各セッションは[Git worktrees](/ja/worktrees)を使用してプロジェクトの独立した分離コピーを取得するため、1 つのセッションの変更は、コミットするまで他のセッションに影響しません。

2 つのセッションを同時に表示するには、macOS で**Cmd**を、Windows で**Ctrl**を押しながらサイドバーのセッションをクリックします。セッションは既に開いているセッションの横の 2 番目のペインで開きます。分割がアクティブな間、別のサイドバーセッションをクリックすると、フォーカスがあるペインが置き換わります。macOS で\*\*Cmd+\\**を、Windows で**Ctrl+\\\*\*を押して、フォーカスされたペインを閉じて、単一のセッションに戻ります。

Worktrees はデフォルトで`<project-root>/.claude/worktrees/`に保存されます。Settings → Claude Code の「Worktree location」でカスタムディレクトリに変更できます。また、すべての worktree ブランチ名の前に付加されるブランチプレフィックスを設定することもできます。これは Claude が作成したブランチを整理するのに便利です。完了したら、サイドバーのセッションにマウスを合わせてアーカイブアイコンをクリックして worktree を削除します。PR がマージまたはクローズされた後にセッションを自動的にアーカイブするには、Settings → Claude Code で**Auto-archive after PR merge or close**をオンにします。Auto-archive はローカルセッションで実行が完了したものにのみ適用されます。

gitignored ファイル（`.env`など）を新しい worktrees に含めるには、プロジェクトルートに[`.worktreeinclude`ファイル](/ja/worktrees#copy-gitignored-files-into-worktrees)を作成します。

セッション分離には[Git](https://git-scm.com/downloads)が必要です。ほとんどの Mac には Git がデフォルトで含まれています。Terminal で`git --version`を実行して確認してください。Windows では、Code タブが機能するために Git が必要です：[Git for Windows をダウンロード](https://git-scm.com/downloads/win)し、インストールしてアプリを再起動します。Git エラーが発生した場合は、[Cowork タブ](https://claude.com/product/cowork)で Claude に助けを求めてセットアップのトラブルシューティングを行ってください。

サイドバーの上部のコントロールを使用して、ステータス、プロジェクト、または環境でセッションをフィルタリングし、プロジェクトでセッションをグループ化します。セッション名を変更するには、アクティブセッションの上部のツールバーのセッションタイトルをクリックします。コンテキスト使用状況を確認するには、[使用状況を確認する](#check-usage)を参照してください。コンテキストがいっぱいになると、Claude は自動的に会話を要約して作業を続けます。`/compact`を入力して要約をより早くトリガーし、コンテキストスペースを解放することもできます。[コンテキストウィンドウ](/ja/how-claude-code-works#the-context-window)を参照して、圧縮がどのように機能するかについての詳細を確認してください。

デスクトップアプリは、Code セッションがタスクを完了し、現在そのセッションを表示していない場合に OS 通知を送信します。

メインセッションを脱線させずにサイドクエスチョンを尋ねる

サイドチャットを使用すると、セッションのコンテキストを使用するが、メインの会話に何も追加しない質問を Claude に尋ねることができます。コードの一部を理解したい、仮定を確認したい、またはセッションを脱線させずにアイデアを探索したい場合に使用します。

macOS で\*\*Cmd+;**を、Windows で**Ctrl+;\*\*を押してサイドチャットを開くか、プロンプトボックスで`/btw`を入力します。サイドチャットはその時点までのメインスレッドのすべてを読み取ることができます。完了したら、サイドチャットを閉じてメインセッションを続行します。サイドチャットはローカルおよび SSH セッションで利用可能です。

バックグラウンドタスクを監視する

タスクペインは、現在のセッション内で実行されているバックグラウンド作業を表示します：サブエージェント、バックグラウンドシェルコマンド、および[動的ワークフロー](/ja/workflows)。**Views**メニューから開くか、レイアウトにドラッグします。

任意のエントリをクリックして、サブエージェントペインで出力を確認するか、停止します。他のセッションが何をしているかを確認するには、[サイドバー](#work-in-parallel-with-sessions)を使用します。

長時間実行されるタスクをリモートで実行する

大規模なリファクタリング、テストスイート、マイグレーション、またはその他の長時間実行されるタスクの場合、セッションを開始するときに**Local**の代わりに**Remote**を選択します。リモートセッションは Anthropic のクラウドインフラストラクチャで実行され、アプリを閉じたりコンピュータをシャットダウンしたりしても続行します。いつでも戻ってきて進捗を確認するか、Claude を別の方向に導くことができます。[claude.ai/code](https://claude.ai/code)または Claude iOS アプリからリモートセッションを監視することもできます。

リモートセッションは複数のリポジトリもサポートしています。クラウド環境を選択した後、リポジトリピルの横の\*\*+\*\*ボタンをクリックして、セッションに追加のリポジトリを追加します。各リポジトリは独自のブランチセレクタを取得します。これは共有ライブラリとそのコンシューマーの更新など、複数のコードベースにまたがるタスクに便利です。

リモートセッションがどのように機能するかについての詳細については、[Web 上の Claude Code](/ja/claude-code-on-the-web)を参照してください。

別のサーフェスで続行する

セッションツールバーの右下の VS Code アイコンからアクセスできる**Continue in**メニューを使用すると、セッションを別のサーフェスに移動できます：

- **Claude Code on the Web**：ローカルセッションをリモートで実行し続けるために送信します。Desktop はブランチをプッシュし、会話の要約を生成し、完全なコンテキストを持つ新しいリモートセッションを作成します。その後、ローカルセッションをアーカイブするか保持するかを選択できます。これはクリーンなワーキングツリーが必要であり、SSH セッションでは利用できません。
- **Your IDE**：現在の作業ディレクトリでサポートされている IDE でプロジェクトを開きます。

Dispatch からのセッション

[Dispatch](https://support.claude.com/en/articles/13947068)は、[Cowork](https://claude.com/product/cowork#dispatch-and-computer-use)タブに存在する Claude との永続的な会話です。Dispatch にタスクをメッセージで送信すると、それをどのように処理するかを決定します。

タスクは 2 つの方法で Code セッションになります：「Claude Code セッションを開いてログインバグを修正する」など直接要求するか、Dispatch がタスクが開発作業であると判断して自動的に生成するかです。通常 Code にルーティングされるタスクには、バグの修正、依存関係の更新、テストの実行、またはプルリクエストの開くが含まれます。研究、ドキュメント編集、スプレッドシート作業は Cowork に留まります。

どちらの方法でも、Code セッションは Code タブのサイドバーに**Dispatch**バッジ付きで表示されます。完了したときまたは承認が必要なときに、電話でプッシュ通知を受け取ります。

[コンピュータ使用](#let-claude-use-your-computer)が有効な場合、Dispatch が生成した Code セッションもそれを使用できます。これらのセッションのアプリ承認は 30 分後に期限切れになり、通常の Code セッションのようにセッション全体を続けるのではなく、再度プロンプトが表示されます。

セットアップ、ペアリング、Dispatch 設定については、[Dispatch ヘルプ記事](https://support.claude.com/en/articles/13947068)を参照してください。Dispatch には Pro または Max プランが必要であり、Team または Enterprise プランでは利用できません。

Dispatch は、ターミナルから離れているときに Claude で作業する複数の方法の 1 つです。[プラットフォームと統合](/ja/platforms#work-when-you-are-away-from-your-terminal)を参照して、Remote Control、Channels、Slack、スケジュール済みタスクと比較してください。

Claude Code を拡張する

外部サービスを接続し、再利用可能なワークフローを追加し、Claude の動作をカスタマイズし、プレビューサーバーを設定します。コネクタ、スキル、プラグインを 1 か所で管理するには、サイドバーの**Customize**をクリックします。

外部ツールを接続する

ローカルおよび[SSH](#ssh-sessions)セッションの場合、プロンプトボックスの横の\*\*+**ボタンをクリックして**Connectors**を選択し、Google Calendar、Slack、GitHub、Linear、Notion などの統合を追加します。セッションの前または中にコネクタを追加できます。**+\*\*ボタンはクラウドセッションでは利用できませんが、[ルーチン](/ja/routines)はルーチン作成時にコネクタを設定します。

コネクタを管理または切断するには、デスクトップアプリの Settings → Connectors に移動するか、プロンプトボックスの Connectors メニューから**Manage connectors**を選択します。

接続すると、Claude はカレンダーを読み取り、メッセージを送信し、問題を作成し、ツールと直接対話できます。セッションで設定されているコネクタについて Claude に尋ねることができます。

コネクタは[MCP サーバー](/ja/mcp)であり、グラフィカルセットアップフローを備えています。サポートされているサービスとの迅速な統合に使用します。Connectors にリストされていない統合の場合、[設定ファイル](/ja/mcp#installing-mcp-servers)を介して MCP サーバーを手動で追加します。また、[カスタムコネクタを作成](https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp)することもできます。

スキルを使用する

[スキル](/ja/skills)は Claude ができることを拡張します。Claude は関連する場合に自動的にロードするか、直接呼び出すことができます：プロンプトボックスで`/`を入力するか、**+**ボタンをクリックして**Slash commands**を選択して、利用可能なものを参照します。これには[組み込みコマンド](/ja/commands)、[カスタムスキル](/ja/skills#create-your-first-skill)、コードベースからのプロジェクトスキル、および[インストール済みプラグイン](/ja/plugins)からのスキルが含まれます。1 つを選択すると、入力フィールドで強調表示されます。その後にタスクを入力して、通常どおり送信します。

プラグインをインストールする

[プラグイン](/ja/plugins)は、スキル、エージェント、hooks、MCP サーバー、および LSP 設定を Claude Code に追加する再利用可能なパッケージです。ターミナルを使用せずにデスクトップアプリからプラグインをインストールできます。

ローカルおよび[SSH](#ssh-sessions)セッションの場合、プロンプトボックスの横の\*\*+**ボタンをクリックして**Plugins**を選択して、インストール済みプラグインとそのスキルを確認します。プラグインを追加するには、サブメニューから**Add plugin\*\*を選択してプラグインブラウザを開きます。これは、公式 Anthropic マーケットプレイスを含む、設定された[マーケットプレイス](/ja/plugin-marketplaces)から利用可能なプラグインを表示します。**Manage plugins**を選択して、プラグインを有効化、無効化、またはアンインストールします。

プラグインはユーザーアカウント、特定のプロジェクト、またはローカルのみにスコープできます。組織がプラグインを一元管理する場合、それらのプラグインは CLI セッションと同じ方法で Desktop セッションで利用可能です。プラグインはクラウドセッションでは利用できません。プラグインの作成を含む完全なプラグインリファレンスについては、[プラグイン](/ja/plugins)を参照してください。

プレビューサーバーを設定する

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

変更を自動検証する

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

設定フィールド

`configurations`配列の各エントリは、以下のフィールドを受け入れます：

| フィールド | 型 | 説明 |
| - | - | - |
| `name` | string | このサーバーの一意の識別子 |
| `runtimeExecutable` | string | 実行するコマンド（`npm`、`yarn`、`node`など） |
| `runtimeArgs` | string\[] | `runtimeExecutable`に渡される引数（`["run", "dev"]`など） |
| `port` | number | サーバーがリッスンするポート。デフォルトは 3000 |
| `cwd` | string | プロジェクトルートに相対的な作業ディレクトリ。デフォルトはプロジェクトルート。プロジェクトルートを明示的に参照するには`${workspaceFolder}`を使用します |
| `env` | object | `{ "NODE_ENV": "development" }`などのキーと値のペアとしての追加環境変数。このファイルはリポジトリにコミットされるため、ここにシークレットを入れないでください。dev サーバーにシークレットを渡すには、[ローカル環境エディタ](#local-sessions)で設定します。 |
| `autoPort` | boolean | ポート競合の処理方法。以下を参照してください |
| `program` | string | `node`で実行するスクリプト。[`program`と`runtimeExecutable`を使用する場合](#when-to-use-program-vs-runtimeexecutable)を参照してください |
| `args` | string\[] | `program`に渡される引数。`program`が設定されている場合のみ使用されます |

`program`と`runtimeExecutable`を使用する場合

`runtimeExecutable`を`runtimeArgs`と共に使用して、パッケージマネージャーを通じて dev サーバーを起動します。たとえば、`"runtimeExecutable": "npm"`と`"runtimeArgs": ["run", "dev"]`は`npm run dev`を実行します。

`node`で直接実行したいスタンドアロンスクリプトがある場合は`program`を使用します。たとえば、`"program": "server.js"`は`node server.js`を実行します。`args`で追加フラグを渡します。

ポート競合

`autoPort`フィールドは、優先ポートが既に使用されている場合の処理を制御します：

- **`true`**：Claude は自動的に空きポートを見つけて使用します。ほとんどの dev サーバーに適しています。
- **`false`**：Claude はエラーで失敗します。OAuth コールバックまたは CORS 許可リストなど、サーバーが特定のポートを使用する必要がある場合に使用します。
- **設定されていない（デフォルト）**：Claude はサーバーがそのポートを必要とするかどうかを尋ねてから、答えを保存します。

Claude が別のポートを選択すると、割り当てられたポートを`PORT`環境変数を通じてサーバーに渡します。

例

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

環境設定

[セッションを開始する](#start-a-session)ときに選択する環境は、Claude が実行される場所と接続方法を決定します：

- **Local**：マシンで実行され、ファイルに直接アクセスできます
- **Remote**：Anthropic のクラウドインフラストラクチャで実行されます。アプリを閉じても、セッションは続行されます。
- **SSH**：SSH 経由で接続するリモートマシンで実行されます。たとえば、独自のサーバー、クラウド VM、または dev コンテナなどです。

ローカルセッション

デスクトップアプリは常にシェル環境全体を継承するわけではありません。macOS では、Dock または Finder からアプリを起動すると、`~/.zshrc` または `~/.bashrc` などのシェルプロファイルを読み取り、`PATH` と固定された Claude Code 変数セットを抽出しますが、そこでエクスポートする他の変数は取得されません。Windows では、アプリはユーザーおよびシステム環境変数を継承しますが、PowerShell プロファイルは読み取りません。

ローカルセッションと dev サーバーの環境変数を設定するには、プロンプトボックスの環境ドロップダウンを開き、**Local** にマウスを合わせて、ギアアイコンをクリックしてローカル環境エディタを開きます。ここで保存する変数は、マシンに暗号化されて保存され、開始するすべてのローカルセッションとプレビューサーバーに適用されます。また、`~/.claude/settings.json` ファイルの `env` キーに変数を追加することもできます。ただし、これらは Claude セッションにのみ到達し、dev サーバーには到達しません。サポートされている変数の完全なリストについては、[環境変数](/ja/env-vars)を参照してください。

[拡張思考](/ja/model-config#extended-thinking)はデフォルトで有効になっており、複雑な推論タスクのパフォーマンスを向上させますが、追加のトークンを使用します。思考を無効にするには、ローカル環境エディタで `MAX_THINKING_TOKENS` を `0` に設定します。これは Fable 5 には効果がなく、常に拡張思考を使用します。[サードパーティプロバイダー](/ja/third-party-integrations)では、`0` は代わりに `thinking` パラメータを省略し、適応的推論モデルは依然として思考する可能性があります。[適応的推論](/ja/model-config#adjust-effort-level)を持つモデルでは、適応的推論が思考の深さを制御するため、他の `MAX_THINKING_TOKENS` 値は無視されます。Opus 4.6 と Sonnet 4.6 では、固定思考予算を使用するために `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING` を `1` に設定します。Opus 4.7 以降は常に適応的推論を使用し、固定予算モードはありません。

クラウドセッション

クラウドセッションはアプリを閉じても、バックグラウンドで続行されます。使用状況は[サブスクリプションプランの制限](/ja/costs)にカウントされ、別の計算料金はありません。

異なるネットワークアクセスレベルと環境変数を持つカスタムクラウド環境を作成できます。クラウドセッションを開始するときに環境ドロップダウンを選択し、**Add environment** を選択します。ネットワークアクセスと環境変数の設定の詳細については、[クラウド環境](/ja/claude-code-on-the-web#the-cloud-environment)を参照してください。

SSH セッション

SSH セッションを使用すると、デスクトップアプリをインターフェイスとして使用しながら、リモートマシンで Claude Code を実行できます。これは、クラウド VM、dev コンテナ、または特定のハードウェアまたは依存関係を持つサーバーに存在するコードベースで作業するのに便利です。

SSH 接続を追加するには、セッションを開始する前に環境ドロップダウンをクリックして、**+ Add SSH connection** を選択します。ダイアログは以下を要求します：

- **Name**：この接続のフレンドリーラベル
- **SSH Host**：`user@hostname` または `~/.ssh/config` で定義されたホスト
- **SSH Port**：空のままの場合はデフォルトの 22、または SSH config からのポート
- **Identity File**：`~/.ssh/id_rsa` などの秘密鍵へのパス。デフォルトキーまたは SSH config を使用するには空のままにします。

追加されると、接続は環境ドロップダウンに表示されます。それを選択して、そのマシンでセッションを開始します。Claude はリモートマシンで実行され、そのファイルとツールにアクセスできます。

リモートマシンは Linux または macOS を実行する必要があります。デスクトップは初回接続時にリモートマシンに Claude Code を自動的にインストールします。接続されると、SSH セッションは権限モード、コネクタ、プラグイン、および MCP サーバーをサポートします。

チームの SSH 接続を事前設定する

管理者は、[管理設定](/ja/settings#settings-precedence)ファイルに `sshConfigs` を追加することで、SSH 接続をチームメンバーに配布できます。この方法で定義された接続は、各ユーザーの環境ドロップダウンに自動的に表示され、管理対象として表示されるため、ユーザーはそれらを選択できますが、アプリで編集または削除することはできません。

次の例は、リモートホストの `~/projects` で開く単一の接続を事前設定しています：

```json
{
  "sshConfigs": [
    {
      "id": "shared-dev-vm",
      "name": "Shared Dev VM",
      "sshHost": "user@dev.example.com",
      "sshPort": 22,
      "sshIdentityFile": "~/.ssh/id_ed25519",
      "startDirectory": "~/projects"
    }
  ]
}
```

各エントリには `id`、`name`、および `sshHost` が必要です。`sshPort`、`sshIdentityFile`、および `startDirectory` フィールドはオプションです。ユーザーは、ダイアログを通じて追加された接続が保存される独自の `~/.claude/settings.json` に `sshConfigs` を追加することもできます。

ユーザーが接続できる SSH ホストを制限する

管理者は、[管理設定](/ja/settings#settings-precedence)ファイルに `sshHostAllowlist` を追加することで、Desktop の SSH セッションを承認されたホストのセットに制限できます。設定されると、ユーザーは解決されたホスト名がパターンの 1 つと一致するホストにのみ接続できます。SSH セッションを完全に無効にするには、空の配列に設定します。

次の例は、`devboxes.example.com` の下のすべてのホストと、単一の名前付きバスティオンホストへの接続を許可しています：

```json
{
  "sshHostAllowlist": ["*.devboxes.example.com", "bastion.example.com"]
}
```

パターンは大文字と小文字を区別しません。`*` はすべてのホストと一致し、`*.example.com` は `example.com` とすべてのサブドメインと一致します。その他はすべて完全一致です。チェックは `ssh -G` を経由した `~/.ssh/config` 解決後のホスト名に対して実行されるため、`Host` エイリアスと `ProxyCommand`/`ProxyJump` エントリは、解決された `HostName` が一致する限り許可されます。

`sshHostAllowlist` は管理設定からのみ読み取られます。ユーザーまたはプロジェクト設定の値は無視されます。Claude Desktop アプリのみがこの設定を尊重します。Claude Code CLI と IDE 拡張機能はこれを読み取らず、Bash ツールを通じて実行される `ssh` コマンドを制限しません。これは Desktop アプリが接続するホストを管理し、ネットワーク出力ではないため、ハード境界が必要な場合は組織のネットワークまたはゼロトラストコントロールと組み合わせてください。

エンタープライズ設定

Team または Enterprise プランの組織は、管理コンソールコントロール、管理設定ファイル、およびデバイス管理ポリシーを通じてデスクトップアプリの動作を管理できます。

管理コンソールコントロール

これらの設定は[管理設定コンソール](https://claude.ai/admin-settings/claude-code)を通じて設定されます：

- **Code in the desktop**：組織内のユーザーがデスクトップアプリで Claude Code にアクセスできるかどうかを制御します
- **Code in the web**：組織の[Web セッション](/ja/claude-code-on-the-web)を有効または無効にします
- **Remote Control**：組織の[Remote Control](/ja/remote-control)を有効または無効にします
- **Disable Bypass permissions mode**：組織内のユーザーが bypass permissions モードを有効にするのを防ぎます

管理設定

管理設定はプロジェクトおよびユーザー設定をオーバーライドし、Claude Code セッションに Desktop で適用されます。これらのキーを組織の[管理設定](/ja/settings#settings-precedence)ファイルで設定するか、管理コンソールを通じてリモートでプッシュできます。

| キー | 説明 |
| - | - |
| `permissions.disableBypassPermissionsMode` | ユーザーが Bypass permissions モードを有効にするのを防ぐには`"disable"`に設定します。 |
| `disableAutoMode` | ユーザーが[Auto](/ja/permission-modes#eliminate-prompts-with-auto-mode)モードを有効にするのを防ぐには`"disable"`に設定します。モードセレクタから Auto を削除します。`permissions`の下でも受け入れられます。 |
| `autoMode` | 組織全体で auto mode 分類器が信頼およびブロックするものをカスタマイズします。[auto mode を設定する](/ja/auto-mode-config)を参照してください。 |
| `sshConfigs` | 環境ドロップダウンに表示される[SSH 接続](#pre-configure-ssh-connections-for-your-team)を事前設定します。ユーザーは管理接続を編集または削除できません。 |
| `sshHostAllowlist` | [SSH セッション](#restrict-which-ssh-hosts-users-can-connect-to)を、解決されたホスト名がこれらのパターンのいずれかと一致するホストに制限します。空の配列は SSH セッションを無効にします。管理設定からのみ読み取られます。 |
| `managedMcpServers` | MCP サーバー設定をサードパーティデプロイメント内のすべてのユーザーにプッシュします。各エントリは`"http"`、`"sse"`、または`"stdio"`のトランスポート、接続詳細、およびオプションで、そのサーバー内のどのツールをユーザーが呼び出せるかを制限する`toolPolicy`マップを指定します。サードパーティ（3P）Desktop デプロイメントでのみ利用可能です。管理設定ファイルまたは MDM を通じてこのキーを配信してください。サードパーティデプロイメントは管理コンソール設定を受け取らないためです。 |

Desktop セッションがどこで実行されるかに応じて、どの管理設定がそのセッションに到達するかが異なります。[`availableModels`](/ja/model-config#restrict-model-selection)などのモデル制限は、Desktop の Claude Code セッションでターミナル CLI と同じ方法で適用されます。[surface coverage](/ja/model-config#surface-coverage)を参照してください。

- **このマシン上のローカルセッション**：ディスクにデプロイされた管理設定ファイルが適用されます。管理コンソールを通じてリモートでプッシュされた管理設定は、セッションが組織ログインまたは直接設定された API キーで認証する場合、Anthropic の API でこれらのセッションに到達します。ターミナル CLI と同じ[設定の優先順位](/ja/settings#settings-precedence)に従います。
- **[クラウドセッション](#cloud-sessions)**：Anthropic が管理する VM で実行され、[サーバー管理設定](/ja/server-managed-settings)のみを受け取ります。
- **[SSH セッション](#ssh-sessions)**：セッションはリモートホストから管理設定ファイルを読み取ります。Desktop 自体は接続を作成するときに、ローカルマシンの管理設定から`sshConfigs`と`sshHostAllowlist`を読み取ります。

`permissions.disableBypassPermissionsMode`と`disableAutoMode`はユーザーおよびプロジェクト設定でも機能しますが、管理設定に配置するとユーザーがそれらをオーバーライドするのを防ぎます。`autoMode`はユーザー設定、`.claude/settings.local.json`、および管理設定から読み取られますが、チェックイン済みの`.claude/settings.json`からは読み取られません：クローンされたリポジトリは独自の分類器ルールを注入できません。`allowManagedPermissionRulesOnly`と`allowManagedHooksOnly`を含む管理専用設定の完全なリストについては、[管理専用設定](/ja/permissions#managed-only-settings)を参照してください。

デバイス管理ポリシー

IT チームは、macOS の MDM または Windows のグループポリシーを通じてデスクトップアプリを管理できます。利用可能なポリシーには、Claude Code 機能の有効化または無効化、自動更新の制御、およびカスタムデプロイメント URL の設定が含まれます。

- **macOS**：Jamf または Kandji などのツールを使用して`com.anthropic.claudefordesktop`プリファレンスドメインを通じて設定します
- **Windows**：`SOFTWARE\Policies\Claude`のレジストリを通じて設定します

認証と SSO

エンタープライズ組織はすべてのユーザーに SSO を要求できます。プランレベルの詳細については[認証](/ja/authentication)を参照し、SAML および OIDC 設定については[Setting up SSO](https://support.claude.com/en/articles/13132885-setting-up-single-sign-on-sso)を参照してください。

データ処理

Claude Code はローカルセッションではコードをローカルで処理するか、クラウドセッションでは Anthropic のクラウドインフラストラクチャで処理します。会話とコードコンテキストは処理のために Anthropic の API に送信されます。データ保持、プライバシー、およびコンプライアンスの詳細については、[データ処理](/ja/data-usage)を参照してください。

デプロイメント

Desktop はエンタープライズデプロイメントツールを通じて配布できます：

- **macOS**：Jamf または Kandji などの MDM を使用して`.dmg`インストーラーを通じて配布します
- **Windows**：MSIX パッケージまたは`.exe`インストーラーを通じてデプロイします。サイレントインストールを含むエンタープライズデプロイメントオプションについては、[Deploy Claude Desktop for Windows](https://support.claude.com/en/articles/12622703-deploy-claude-desktop-for-windows)を参照してください。

プロキシ設定、ファイアウォール許可リスト、LLM ゲートウェイなどのネットワーク設定については、[ネットワーク設定](/ja/network-config)を参照してください。

完全なエンタープライズ設定リファレンスについては、[エンタープライズ設定ガイド](https://support.claude.com/en/articles/12622667-enterprise-configuration)を参照してください。

CLI から来ましたか？

既に Claude Code CLI を使用している場合、Desktop は同じ基盤となるエンジンをグラフィカルインターフェイスで実行します。同じマシン上で、同じプロジェクト上でも、両方を同時に実行できます。各々は個別のセッション履歴を保持しますが、CLAUDE.md ファイルを通じて設定とプロジェクトメモリを共有します。

CLI セッションを Desktop に移動するには、ターミナルで `/desktop` を実行します。Claude はセッションを保存し、デスクトップアプリで開いてから CLI を終了します。このコマンドは macOS と Windows でのみ利用可能です。Claude サブスクリプションでサインインしている場合に利用できます。API キー認証では利用できず、Bedrock、Vertex、Foundry でも利用できません。

Desktop と CLI をいつ使用するか：並列セッションをウィンドウで管理したい場合、ペインを並べて配置したい場合、または変更をビジュアルで確認したい場合は Desktop を使用します。スクリプト、自動化、またはターミナルワークフローが必要な場合は CLI を使用します。

CLI フラグの同等物

このテーブルは、一般的な CLI フラグのデスクトップアプリの同等物を示しています。リストされていないフラグは、スクリプトまたは自動化用に設計されているため、デスクトップの同等物がありません。

| CLI | Desktop の同等物 |
| - | - |
| `--model sonnet` | 送信ボタンの横のモデルドロップダウン |
| `--resume`、`--continue` | サイドバーのセッションをクリック |
| `--permission-mode` | 送信ボタンの横のモードセレクタ |
| `--dangerously-skip-permissions` | Bypass permissions モード。Settings → Claude Code → 「Allow bypass permissions mode」で有効にします。エンタープライズ管理者はこの設定を無効にできます。 |
| `--add-dir` | クラウドセッションで **+** ボタンで複数のリポジトリを追加 |
| `--allowedTools`、`--disallowedTools` | セッションごとの同等物はありません。[設定ファイル](/ja/settings)の権限ルールは引き続き適用されます。 |
| `--verbose` | [Verbose ビューモード](#switch-view-modes)（Transcript view ドロップダウン） |
| `--print`、`--output-format` | 利用できません。Desktop はインタラクティブのみです。 |
| `ANTHROPIC_MODEL` 環境変数 | 送信ボタンの横のモデルドロップダウン |
| `MAX_THINKING_TOKENS` 環境変数 | ローカル環境エディタで設定します。[環境設定](#environment-configuration)を参照してください。 |

共有設定

Desktop と CLI は同じ設定ファイルを読み取るため、セットアップが引き継がれます：

- プロジェクト内の **[CLAUDE.md](/ja/memory)** および `CLAUDE.local.md` ファイルは両方で使用されます
- `~/.claude.json` または `.mcp.json` で設定された **[MCP サーバー](/ja/mcp)** は両方で機能します
- 設定で定義された **[Hooks](/ja/hooks)** および **[skills](/ja/skills)** は両方に適用されます
- `~/.claude.json` および `~/.claude/settings.json` の **[設定](/ja/settings)** は共有されます。`settings.json` の権限ルール、許可されたツール、およびその他の設定は Desktop セッションに適用されます。
- **モデル**：同じ[モデル](/ja/model-config#available-models)は両方で利用可能です。Desktop では、送信ボタンの横のドロップダウンからモデルを選択します。セッション中にモデルを同じドロップダウンから変更できます。

**Claude Desktop チャットアプリからの MCP サーバー**：Desktop アプリは `claude_desktop_config.json` から MCP サーバーを Code タブセッションに読み込みます。これは `~/.claude.json` および `.mcp.json` からのサーバーと並行して行われます。`claude_desktop_config.json` で定義されたサーバーは Desktop チャットサーフェスと Code タブの両方で利用可能です。

スタンドアロン CLI は `claude_desktop_config.json` を読み取りません。macOS と WSL では、`claude mcp add-from-claude-desktop` を実行して、これらのサーバーを `~/.claude.json` にコピーします。[Claude Desktop から MCP サーバーをインポート](/ja/mcp#import-mcp-servers-from-claude-desktop)を参照して、インポートフローとスコープオプションを確認してください。

機能比較

このテーブルは、CLI と Desktop の間のコア機能を比較しています。CLI フラグの完全なリストについては、[CLI リファレンス](/ja/cli-reference)を参照してください。

| 機能 | CLI | Desktop |
| - | - | - |
| 権限モード | `dontAsk` を含むすべてのモード | Ask permissions、Auto accept edits、Plan mode、Auto、および Settings 経由の Bypass permissions |
| `--dangerously-skip-permissions` | CLI フラグ | Bypass permissions モード。Settings → Claude Code → 「Allow bypass permissions mode」で有効にします |
| [サードパーティプロバイダー](/ja/third-party-integrations) | Bedrock、Vertex AI、Foundry | Anthropic の API がデフォルト。エンタープライズデプロイメントは Vertex AI とゲートウェイプロバイダーを設定できます。[エンタープライズ設定ガイド](https://support.claude.com/en/articles/12622667-enterprise-configuration)を参照してください。Bedrock、Vertex AI、Foundry、または自己ホスト型 LLM ゲートウェイで Code タブを実行するには、[Cowork on 3P research preview](https://claude.com/docs/cowork/3p/overview)を参照してください。 |
| [MCP サーバー](/ja/mcp) | 設定ファイルで設定 | ローカルおよび SSH セッションの Connectors UI、または設定ファイル |
| [Plugins](/ja/plugins) | `/plugin` コマンド | プラグインマネージャー UI |
| @mention ファイル | テキストベース | オートコンプリート付き；ローカルおよび SSH セッションのみ |
| ファイル添付 | 利用できません | 画像、PDF |
| セッション分離 | [`--worktree`](/ja/cli-reference) フラグ | 自動 worktrees |
| 複数セッション | 別のターミナル | サイドバータブ |
| 定期的なタスク | Cron ジョブ、CI パイプライン | [スケジュール済みタスク](/ja/desktop-scheduled-tasks) |
| コンピュータ使用 | [macOS で `/mcp` 経由で有効化](/ja/computer-use) | [macOS と Windows でアプリとスクリーン制御](#let-claude-use-your-computer) |
| Dispatch 統合 | 利用できません | [Dispatch セッション](#sessions-from-dispatch)（サイドバー） |
| スクリプトと自動化 | [`--print`](/ja/cli-reference)、[Agent SDK](/ja/headless) | 利用できません |

Desktop では利用できないもの

以下の機能は CLI または VS Code 拡張機能でのみ利用可能です。ただし、以下の場合を除きます：

- **サードパーティプロバイダー**：Desktop は Anthropic の API に直接接続します。エンタープライズデプロイメントは Vertex AI とゲートウェイプロバイダーを [管理設定](https://support.claude.com/en/articles/12622667-enterprise-configuration)経由で設定できます。Bedrock または Foundry の場合は、[クイックスタート](/ja/quickstart)を参照してください。上記のセクションの例外として、[Cowork on 3P research preview](https://claude.com/docs/cowork/3p/overview)は Bedrock、Vertex AI、Foundry、または自己ホスト型 LLM ゲートウェイで Code タブを実行します。
- **Linux**：デスクトップアプリは macOS と Windows でのみ利用可能です。Linux では、[CLI](/ja/quickstart)を使用します。
- **インラインコード提案**：Desktop はオートコンプリートスタイルの提案を提供しません。会話型プロンプトと明示的なコード変更を通じて機能します。
- **エージェントチーム**：並列 Claude Code セッションが互いにメッセージを送信するのは [CLI](/ja/agent-teams) で利用可能であり、Desktop では利用できません。1 つのセッション内でマルチエージェント作業を行う場合は、[動的ワークフロー](/ja/workflows)を使用します。これは Desktop で実行されます。
- **ターミナルダイアログコマンド**：`/permissions`、`/config`、`/agents`、`/doctor` などのターミナルで対話型パネルを開く組み込みコマンドは、Code タブでは利用できず、`isn't available in this environment` で応答します。[設定ファイル](/ja/settings)を直接編集して権限ルールと設定を管理するか、スタンドアロン CLI からコマンドを実行します。

トラブルシューティング

以下のセクションでは、デスクトップアプリに固有の問題について説明します。チャットに表示される`API Error: 500`、`529 Overloaded`、`429`、または`Prompt is too long`などのランタイム API エラーについては、[エラーリファレンス](/ja/errors)を参照してください。これらのエラーとその修正は、CLI、Desktop、Web 全体で同じです。

バージョンを確認する

実行しているデスクトップアプリのバージョンを確認するには：

- **macOS**：メニューバーの**Claude**をクリックしてから、**About Claude**をクリック
- **Windows**：**Help**をクリックしてから、**About**をクリック

バージョン番号をクリックしてクリップボードにコピーします。

Code タブの 403 またはエラー認証エラー

Code タブを使用するときに`Error 403: Forbidden`またはその他の認証エラーが表示される場合：

1. アプリメニューからサインアウトして再度サインインします。これが最も一般的な修正です。
2. アクティブな有料サブスクリプション（Pro、Max、Team、または Enterprise）があることを確認します。
3. CLI は機能するが Desktop は機能しない場合、デスクトップアプリを完全に終了し（ウィンドウを閉じるだけではなく）、再度開いてサインインします。
4. インターネット接続とプロキシ設定を確認します。

起動時に空白または停止画面

アプリが開いても空白または応答しない画面が表示される場合：

1. アプリを再起動します。
2. 保留中の更新を確認します。アプリは起動時に自動更新されます。
3. Windows では、**Windows Logs → Application**の Event Viewer でクラッシュログを確認します。

「Failed to load session」

`Failed to load session`が表示される場合、選択したフォルダが存在しなくなった可能性があります。Git リポジトリがインストールされていない Git LFS を必要とする可能性があります。またはファイル権限がアクセスを防ぐ可能性があります。別のフォルダを選択するか、アプリを再起動してみてください。

セッションがインストール済みツールを見つけられない

Claude が`npm`、`node`、またはその他の CLI コマンドなどのツールを見つけられない場合、ツールが通常のターミナルで機能することを確認し、シェルプロファイルが PATH を正しく設定していることを確認し、デスクトップアプリを再起動して環境変数を再度読み込みます。

Git および Git LFS エラー

Windows では、Code タブがローカルセッションを開始するために Git が必要です。「Git is required」が表示される場合、[Git for Windows](https://git-scm.com/downloads/win)をインストールしてアプリを再起動します。

「Git LFS is required by this repository but is not installed」が表示される場合、[git-lfs.com](https://git-lfs.com/)から Git LFS をインストールし、`git lfs install`を実行してアプリを再起動します。

Windows で MCP サーバーが機能しない

MCP サーバートグルが応答しない場合、または Windows でサーバーが接続に失敗する場合、サーバーが設定で正しく設定されていることを確認し、アプリを再起動し、Task Manager でサーバープロセスが実行されていることを確認し、接続エラーについてサーバーログを確認します。

アプリが終了しない

- **macOS**：Cmd+Q を押します。アプリが応答しない場合、Cmd+Option+Esc で Force Quit を使用し、Claude を選択して Force Quit をクリックします。
- **Windows**：Ctrl+Shift+Esc で Task Manager を使用して Claude プロセスを終了します。

Windows 固有の問題

- **インストール後に PATH が更新されない**：新しいターミナルウィンドウを開きます。PATH の更新は新しいターミナルセッションにのみ適用されます。
- **同時インストールエラー**：別のインストールが進行中であるというエラーが表示されるが、実際には進行中でない場合、インストーラーを管理者として実行してみてください。

CLI で開くときに「Branch doesn't exist yet」

クラウドセッションはローカルマシンに存在しないブランチを作成できます。セッションツールバーのブランチ名をクリックしてコピーしてから、ローカルでフェッチします：

```bash
git fetch origin <branch-name>
git checkout <branch-name>
```

まだ立ち往生していますか？

- デスクトップアプリで Help → Get Support を開くか、[Claude サポートセンター](https://support.claude.com/)に直接アクセスします
- スタンドアロン`claude` CLI でも再現される問題については、[GitHub Issues](https://github.com/anthropics/claude-code/issues)でバグを検索またはファイルします

問題を報告するときは、デスクトップアプリのバージョン、オペレーティングシステム、正確なエラーメッセージ、および関連ログを含めます。macOS では Console.app を確認します。Windows では Event Viewer → Windows Logs → Application を確認します。
