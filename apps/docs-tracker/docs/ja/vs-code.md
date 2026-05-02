---
title: vs-code
source: https://code.claude.com/docs/ja/vs-code.md
---

# VS Code で Claude Code を使用する

> Claude Code 拡張機能を VS Code にインストールして設定します。インラインの差分表示、@-メンション、プラン確認、キーボードショートカットを使用した AI コーディング支援を取得します。

VS Code 拡張機能は、Claude Code 用のネイティブグラフィカルインターフェースを提供し、IDE に直接統合されています。これは VS Code で Claude Code を使用する推奨方法です。

この拡張機能を使用すると、Claude のプランを受け入れる前に確認および編集でき、編集が行われるときに自動的に受け入れることができ、選択範囲から特定の行範囲を持つファイルを @-メンションでき、会話履歴にアクセスでき、複数の会話を別々のタブまたはウィンドウで開くことができます。

## 前提条件

インストール前に、以下があることを確認してください。

- VS Code 1.98.0 以上
- Anthropic アカウント（拡張機能を初めて開くときにサインインします）。Amazon Bedrock や Google Vertex AI などのサードパーティプロバイダーを使用している場合は、代わりに[サードパーティプロバイダーを使用する](#use-third-party-providers)を参照してください。

拡張機能には CLI（コマンドラインインターフェース）が含まれており、VS Code の統合ターミナルからアクセスして高度な機能を使用できます。詳細については、[VS Code 拡張機能と Claude Code CLI](#vs-code-extension-vs-claude-code-cli) を参照してください。

## 拡張機能をインストールする

IDE のリンクをクリックして直接インストールします。

- [VS Code 用にインストール](vscode:extension/anthropic.claude-code)
- [Cursor 用にインストール](cursor:extension/anthropic.claude-code)

または、VS Code で `Cmd+Shift+X`（Mac）または `Ctrl+Shift+X`（Windows/Linux）を押して拡張機能ビューを開き、「Claude Code」を検索して、**インストール**をクリックします。

インストール後に拡張機能が表示されない場合は、VS Code を再起動するか、コマンドパレットから「Developer: Reload Window」を実行してください。

## はじめに

インストール後、VS Code インターフェースを通じて Claude Code の使用を開始できます。

VS Code 全体で、Spark アイコンは Claude Code を示します。

Claude を開く最速の方法は、**エディタツールバー**（エディタの右上隅）の Spark アイコンをクリックすることです。このアイコンは、ファイルを開いている場合にのみ表示されます。

Claude Code を開く他の方法：

- **アクティビティバー**：左サイドバーの Spark アイコンをクリックしてセッションリストを開きます。任意のセッションをクリックしてフルエディタタブとして開くか、新しいセッションを開始します。このアイコンは常にアクティビティバーに表示されます。
- **コマンドパレット**：`Cmd+Shift+P`（Mac）または `Ctrl+Shift+P`（Windows/Linux）を押し、「Claude Code」と入力して、「Open in New Tab」などのオプションを選択します。
- **ステータスバー**：ウィンドウの右下隅の **✱ Claude Code** をクリックします。ファイルを開いていない場合でも機能します。

Claude パネルをドラッグして、VS Code 内の任意の場所に再配置できます。詳細については、[ワークフローをカスタマイズする](#customize-your-workflow)を参照してください。

パネルを初めて開くと、サインイン画面が表示されます。**Sign in** をクリックして、ブラウザで認可を完了します。

後で **Not logged in · Please run /login** が表示される場合、拡張機能はサインイン画面を自動的に再度開きます。表示されない場合は、コマンドパレットから **Developer: Reload Window** でウィンドウをリロードします。

シェルで `ANTHROPIC_API_KEY` が設定されているのにサインインプロンプトが表示される場合、VS Code がシェル環境を継承していない可能性があります。ターミナルから `code .` で VS Code を起動して環境変数を継承するか、代わりに Claude アカウントでサインインします。

サインイン後、**Learn Claude Code** チェックリストが表示されます。**Show me** をクリックして各項目を実行するか、X で閉じます。後で再度開くには、VS Code 設定の Extensions → Claude Code で **Hide Onboarding** をオフにします。

Claude にコードやファイルの支援を依頼します。これには、何かの仕組みを説明すること、問題をデバッグすること、または変更を加えることが含まれます。

Claude は自動的に選択したテキストを表示します。`Option+K`（Mac）/ `Alt+K`（Windows/Linux）を押して、@-メンション参照（`@file.ts#5-10` など）をプロンプトに挿入することもできます。

ファイル内の特定の行について質問する例を次に示します。

Claude がファイルを編集したい場合、元のコードと提案された変更の並べて比較を表示し、許可を求めます。編集を受け入れるか、拒否するか、Claude に別の方法を指示できます。受け入れる前に差分ビューで提案されたコンテンツを直接編集した場合、Claude はそれを変更したことが通知されるため、ファイルが元のプロポーザルと一致すると想定しません。

Claude Code でできることについてのアイデアについては、[一般的なワークフロー](/ja/common-workflows)を参照してください。

コマンドパレットから'Claude Code: Open Walkthrough'を実行して、基本的なガイド付きツアーを取得します。

## プロンプトボックスを使用する

プロンプトボックスは複数の機能をサポートしています。

- **許可モード**：プロンプトボックスの下部のモード指示器をクリックしてモードを切り替えます。通常モードでは、Claude は各アクション前に許可を求めます。Plan モードでは、Claude は実行内容を説明し、変更を加える前に承認を待ちます。VS Code は自動的にプランをフルマークダウンドキュメントとして開き、Claude が開始する前にフィードバックを提供するためのインラインコメントを追加できます。自動受け入れモードでは、Claude は許可を求めずに編集を行います。VS Code 設定の `claudeCode.initialPermissionMode` でデフォルトを設定します。
- **コマンドメニュー**：`/` をクリックするか `/` と入力してコマンドメニューを開きます。オプションには、ファイルの添付、モデルの切り替え、拡張思考の切り替え、プラン使用状況の表示（`/usage`）、および [Remote Control](/ja/remote-control) セッションの開始（`/remote-control`）が含まれます。カスタマイズセクションは、MCP サーバー、hooks、メモリ、権限、プラグインへのアクセスを提供します。ターミナルアイコン付きのアイテムは統合ターミナルで開きます。
- **コンテキスト指示器**：プロンプトボックスは、Claude のコンテキストウィンドウをどの程度使用しているかを表示します。Claude は必要に応じて自動的にコンパクト化するか、`/compact` を手動で実行できます。
- **拡張思考**：Claude が複雑な問題を推論するためにより多くの時間を費やすことができます。コマンドメニュー（`/`）を使用してオンに切り替えます。Claude の推論は会話に折りたたまれたブロックとして表示されます。ブロックをクリックして読むか、`Ctrl+O` を押してセッション内のすべての思考ブロックを展開または折りたたみます。詳細については、[拡張思考](/ja/common-workflows#use-extended-thinking-thinking-mode)を参照してください。
- **複数行入力**：`Shift+Enter` を押して送信せずに新しい行を追加します。これは質問ダイアログの'その他'フリーテキスト入力でも機能します。

### ファイルとフォルダを参照する

@-メンションを使用して、特定のファイルまたはフォルダに関するコンテキストを Claude に提供します。`@` の後にファイルまたはフォルダ名を入力すると、Claude はそのコンテンツを読み取り、それについて質問したり、変更を加えたりできます。Claude Code はあいまい一致をサポートしているため、部分的な名前を入力して必要なものを見つけることができます。

```text
> Explain the logic in @auth (fuzzy matches auth.js, AuthService.ts, etc.)
> What's in @src/components/ (include a trailing slash for folders)
```

大きな PDF の場合、Claude にファイル全体ではなく特定のページを読むよう依頼できます。単一ページ、1～10 ページなどの範囲、または 3 ページ以降などのオープンエンド範囲です。

エディタでテキストを選択すると、Claude は強調表示されたコードを自動的に表示できます。プロンプトボックスのフッターは、選択されている行数を表示します。`Option+K`（Mac）/ `Alt+K`（Windows/Linux）を押して、ファイルパスと行番号を含む @-メンション（例：`@app.ts#5-10`）を挿入します。選択指示器をクリックして、Claude が強調表示されたテキストを表示できるかどうかを切り替えます。目のスラッシュアイコンは、選択が Claude から隠されていることを意味します。

また、`Shift` を押しながらファイルをプロンプトボックスにドラッグして、添付ファイルとして追加することもできます。任意の添付ファイルの X をクリックしてコンテキストから削除します。

### 過去の会話を再開する

Claude Code パネルの上部の **Session history** ボタンをクリックして、会話履歴にアクセスします。キーワードで検索するか、時間（今日、昨日、過去 7 日間など）で参照できます。任意の会話をクリックして、完全なメッセージ履歴で再開します。新しいセッションは、最初のメッセージに基づいて AI が生成したタイトルを受け取ります。セッションの上にマウスを置くと、名前変更と削除アクションが表示されます。説明的なタイトルを付けるために名前を変更するか、リストから削除するために削除します。セッションの再開の詳細については、[一般的なワークフロー](/ja/common-workflows#resume-previous-conversations)を参照してください。

### Claude.ai からリモートセッションを再開する

[Web 上の Claude Code](/ja/claude-code-on-the-web) を使用している場合、VS Code でそれらのリモートセッションを直接再開できます。これには、Anthropic Console ではなく **Claude.ai Subscription** でサインインする必要があります。

Claude Code パネルの上部の **Session history** ボタンをクリックします。

ダイアログには 2 つのタブが表示されます。Local と Remote。**Remote** をクリックして claude.ai からのセッションを表示します。

リモートセッションを参照または検索します。任意のセッションをクリックしてダウンロードし、会話をローカルで続行します。

リモートタブに表示されるのは、GitHub リポジトリで開始された Web セッションのみです。再開するとローカルに会話履歴が読み込まれます。変更は claude.ai に同期されません。

## ワークフローをカスタマイズする

起動して実行したら、Claude パネルを再配置したり、複数のセッションを実行したり、ターミナルモードに切り替えたりできます。

### Claude が存在する場所を選択する

Claude パネルをドラッグして、VS Code 内の任意の場所に再配置できます。パネルのタブまたはタイトルバーをつかんでドラッグします。

- **セカンダリサイドバー**：ウィンドウの右側。コーディング中に Claude を表示したままにします。
- **プライマリサイドバー**：Explorer、Search などのアイコンが付いた左サイドバー。
- **エディタ領域**：Claude をファイルの横のタブとして開きます。サイドタスクに便利です。

メイン Claude セッションにはサイドバーを使用し、サイドタスク用に追加のタブを開きます。Claude はお好みの場所を記憶しています。アクティビティバーセッションリストアイコンは Claude パネルとは別です。セッションリストは常にアクティビティバーに表示されますが、Claude パネルアイコンはパネルが左サイドバーにドッキングされている場合にのみそこに表示されます。

### 複数の会話を実行する

コマンドパレットから **Open in New Tab** または **Open in New Window** を使用して、追加の会話を開始します。各会話は独自の履歴とコンテキストを保持し、異なるタスクで並行して作業できます。

タブを使用する場合、Spark アイコンの小さな色付きドットはステータスを示します。青は許可リクエストが保留中であることを意味し、オレンジはタブが非表示の間に Claude が完了したことを意味します。

### ターミナルモードに切り替える

デフォルトでは、拡張機能はグラフィカルチャットパネルを開きます。CLI スタイルのインターフェースを使用する場合は、[Use Terminal 設定](vscode://settings/claudeCode.useTerminal)を開いてボックスをチェックします。

VS Code 設定（Mac で `Cmd+,` または Windows/Linux で `Ctrl+,`）を開き、Extensions → Claude Code に移動して、**Use Terminal** をチェックすることもできます。

## プラグインを管理する

VS Code 拡張機能には、[プラグイン](/ja/plugins)をインストールおよび管理するためのグラフィカルインターフェースが含まれています。プロンプトボックスで `/plugins` と入力して、**Manage plugins** インターフェースを開きます。

### プラグインをインストールする

プラグインダイアログには 2 つのタブが表示されます。**Plugins** と **Marketplaces**。

Plugins タブで：

- **Installed plugins** は上部に表示され、有効または無効にするためのトグルスイッチがあります。
- **Available plugins** は設定されたマーケットプレイスから下に表示されます。
- 名前または説明でプラグインをフィルタリングするために検索します。
- 利用可能なプラグインで **Install** をクリックします。

プラグインをインストールするときは、インストールスコープを選択します。

- **Install for you**：すべてのプロジェクトで利用可能（ユーザースコープ）
- **Install for this project**：プロジェクト協力者と共有（プロジェクトスコープ）
- **Install locally**：このリポジトリでのみ、あなたのためだけ（ローカルスコープ）

### マーケットプレイスを管理する

**Marketplaces** タブに切り替えて、プラグインソースを追加または削除します。

- GitHub リポジトリ、URL、またはローカルパスを入力して新しいマーケットプレイスを追加します。
- 更新アイコンをクリックしてマーケットプレイスのプラグインリストを更新します。
- ゴミ箱アイコンをクリックしてマーケットプレイスを削除します。

変更を加えた後、バナーが表示され、Claude Code を再起動して更新を適用するよう促します。

VS Code のプラグイン管理は、内部で同じ CLI コマンドを使用します。拡張機能で設定したプラグインとマーケットプレイスは CLI でも利用可能であり、その逆も同様です。

プラグインシステムの詳細については、[Plugins](/ja/plugins) と [Plugin marketplaces](/ja/plugin-marketplaces) を参照してください。

## Chrome でブラウザタスクを自動化する

Claude を Chrome ブラウザに接続して、Web アプリをテストし、コンソールログでデバッグし、VS Code を離れることなくブラウザワークフローを自動化します。これには、[Claude in Chrome extension](https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn) バージョン 1.0.36 以上が必要です。

プロンプトボックスで `@browser` と入力し、その後に Claude に実行させたいことを入力します。

```text
@browser go to localhost:3000 and check the console for errors
```

添付メニューを開いて、新しいタブを開くやページコンテンツを読むなどの特定のブラウザツールを選択することもできます。

Claude はブラウザタスク用に新しいタブを開き、ブラウザのログイン状態を共有するため、既にサインインしているサイトにアクセスできます。

セットアップ手順、機能の完全なリスト、トラブルシューティングについては、[Use Claude Code with Chrome](/ja/chrome) を参照してください。

## VS Code コマンドとショートカット

コマンドパレット（Mac で `Cmd+Shift+P` または Windows/Linux で `Ctrl+Shift+P`）を開き、「Claude Code」と入力して、Claude Code 拡張機能で利用可能なすべての VS Code コマンドを表示します。

一部のショートカットは、どのパネルが「フォーカス」されているか（キーボード入力を受け取っているか）によって異なります。カーソルがコードファイルにある場合、エディタはフォーカスされています。カーソルが Claude のプロンプトボックスにある場合、Claude はフォーカスされています。`Cmd+Esc` / `Ctrl+Esc` を使用してそれらを切り替えます。

これらは拡張機能を制御するための VS Code コマンドです。組み込みの Claude Code コマンドのすべてが拡張機能で利用可能なわけではありません。詳細については、[VS Code extension vs. Claude Code CLI](#vs-code-extension-vs-claude-code-cli) を参照してください。

| コマンド | ショートカット | 説明 |
| - | - | - |
| Focus Input | `Cmd+Esc`（Mac）/ `Ctrl+Esc`（Windows/Linux） | エディタと Claude 間のフォーカスを切り替える |
| Open in Side Bar | - | Claude を左サイドバーで開く |
| Open in Terminal | - | Claude をターミナルモードで開く |
| Open in New Tab | `Cmd+Shift+Esc`（Mac）/ `Ctrl+Shift+Esc`（Windows/Linux） | 新しい会話をエディタタブとして開く |
| Open in New Window | - | 新しい会話を別のウィンドウで開く |
| New Conversation | `Cmd+N`（Mac）/ `Ctrl+N`（Windows/Linux） | 新しい会話を開始する。Claude がフォーカスされている必要があり、`enableNewConversationShortcut` が `true` に設定されている必要があります。 |
| Insert @-Mention Reference | `Option+K`（Mac）/ `Alt+K`（Windows/Linux） | 現在のファイルと選択への参照を挿入する（エディタがフォーカスされている必要があります） |
| Show Logs | - | 拡張機能デバッグログを表示する |
| Logout | - | Anthropic アカウントからサインアウトする |

### 他のツールから VS Code タブを起動する

拡張機能は `vscode://anthropic.claude-code/open` で URI ハンドラーを登録します。これを使用して、独自のツーリングから新しい Claude Code タブを開きます。シェルエイリアス、ブラウザブックマークレット、または URL を開くことができるスクリプト。VS Code がまだ実行されていない場合、URL を開くと最初に起動します。VS Code が既に実行されている場合、URL は現在フォーカスされているウィンドウで開きます。

オペレーティングシステムの URL オープナーでハンドラーを呼び出します。

```bash theme={null}
open "vscode://anthropic.claude-code/open"
```

```bash theme={null}
xdg-open "vscode://anthropic.claude-code/open"
```

PowerShell で：

```powershell theme={null}
Start-Process "vscode://anthropic.claude-code/open"
```

`cmd.exe` では、`start` はその最初の引用符付き引数をウィンドウタイトルとして扱うため、URL の前に空のタイトルを渡します：

```cmd theme={null}
start "" "vscode://anthropic.claude-code/open"
```

ハンドラーは 2 つのオプションのクエリパラメーターを受け入れます：

| パラメーター | 説明 |
| - | - |
| `prompt` | プロンプトボックスに事前入力するテキスト。URL エンコードされている必要があります。プロンプトは事前入力されていますが、自動的には送信されません。 |
| `session` | 新しい会話を開始する代わりに再開するセッション ID。セッションは、VS Code で現在開いているワークスペースに属している必要があります。セッションが見つからない場合、新しい会話が代わりに開始されます。セッションが既にタブで開いている場合、そのタブがフォーカスされます。セッション ID をプログラムで取得するには、[Continue conversations](/ja/headless#continue-conversations) を参照してください。 |

例えば、「review my changes」で事前入力されたタブを開くには：

```text
vscode://anthropic.claude-code/open?prompt=review%20my%20changes
```

ターミナルセッションを VS Code タブの代わりに起動するには、CLI の `claude-cli://` ハンドラーを使用します。[Launch sessions from links](/ja/deep-links) を参照してください。

## 設定を構成する

拡張機能には 2 種類の設定があります。

- **VS Code の拡張機能設定**：VS Code 内の拡張機能の動作を制御します。`Cmd+,`（Mac）または `Ctrl+,`（Windows/Linux）で開き、Extensions → Claude Code に移動します。`/` と入力して **General Config** を選択して設定を開くこともできます。
- **`~/.claude/settings.json` の Claude Code 設定**：拡張機能と CLI 間で共有されます。許可されたコマンド、環境変数、hooks、MCP サーバーに使用します。詳細については、[Settings](/ja/settings) を参照してください。

`"$schema": "https://json.schemastore.org/claude-code-settings.json"` を `settings.json` に追加して、VS Code で利用可能なすべての設定のオートコンプリートとインライン検証を取得します。

### 拡張機能設定

| 設定 | デフォルト | 説明 |
| - | - | - |
| `useTerminal` | `false` | グラフィカルパネルの代わりにターミナルモードで Claude を起動します。 |
| `initialPermissionMode` | `default` | 新しい会話の承認プロンプトを制御します。`default`、`plan`、`acceptEdits`、または `bypassPermissions`。[permission modes](/ja/permission-modes) を参照してください。 |
| `preferredLocation` | `panel` | Claude が開く場所：`sidebar`（右）または `panel`（新しいタブ） |
| `autosave` | `true` | Claude が読み取りまたは書き込みする前にファイルを自動保存します。 |
| `useCtrlEnterToSend` | `false` | Enter の代わりに Ctrl/Cmd+Enter を使用してプロンプトを送信します。 |
| `enableNewConversationShortcut` | `false` | Cmd/Ctrl+N を有効にして新しい会話を開始します。 |
| `hideOnboarding` | `false` | オンボーディングチェックリスト（卒業キャップアイコン）を非表示にします。 |
| `respectGitIgnore` | `true` | ファイル検索から .gitignore パターンを除外します。 |
| `usePythonEnvironment` | `true` | Claude を実行するときにワークスペースの Python 環境をアクティベートします。Python 拡張機能が必要です。 |
| `environmentVariables` | `[]` | Claude プロセスの環境変数を設定します。共有設定には Claude Code 設定を使用します。 |
| `disableLoginPrompt` | `false` | 認証プロンプトをスキップします（サードパーティプロバイダーセットアップ用）。 |
| `allowDangerouslySkipPermissions` | `false` | [Auto mode](/ja/permission-modes#eliminate-prompts-with-auto-mode) と Bypass permissions をモード選択ツールに追加します。Auto mode には [plan、admin、model、provider の要件](/ja/permission-modes#eliminate-prompts-with-auto-mode)があるため、このトグルがオンでも利用不可のままである可能性があります。Bypass permissions は、インターネットアクセスのないサンドボックスでのみ使用してください。 |
| `claudeProcessWrapper` | - | Claude プロセスを起動するために使用される実行可能ファイルパス |

## VS Code 拡張機能と Claude Code CLI

Claude Code は VS Code 拡張機能（グラフィカルパネル）と CLI（ターミナルのコマンドラインインターフェース）の両方として利用可能です。一部の機能は CLI でのみ利用可能です。CLI のみの機能が必要な場合は、VS Code の統合ターミナルで `claude` を実行します。

| 機能 | CLI | VS Code 拡張機能 |
| - | - | - |
| コマンドと skills | [すべて](/ja/commands) | サブセット（`/` と入力して利用可能なものを表示） |
| MCP サーバー設定 | はい | 部分的（CLI 経由でサーバーを追加。チャットパネルで `/mcp` を使用して既存のサーバーを管理） |
| チェックポイント | はい | はい |
| `!` bash ショートカット | はい | いいえ |
| タブ補完 | はい | いいえ |

### チェックポイントで巻き戻す

VS Code 拡張機能はチェックポイントをサポートしており、Claude のファイル編集を追跡し、以前の状態に巻き戻すことができます。任意のメッセージの上にマウスを置いて巻き戻しボタンを表示し、3 つのオプションから選択します。

- **Fork conversation from here**：このメッセージからの新しい会話ブランチを開始し、すべてのコード変更をそのまま保持します。
- **Rewind code to here**：会話の完全な履歴を保持しながら、ファイル変更をこのポイントに戻します。
- **Fork conversation and rewind code**：新しい会話ブランチを開始し、ファイル変更をこのポイントに戻します。

チェックポイントの仕組みと制限の詳細については、[Checkpointing](/ja/checkpointing) を参照してください。

### VS Code で CLI を実行する

VS Code に留まりながら CLI を使用するには、統合ターミナル（Windows/Linux で `` Ctrl+` `` または Mac で `` Cmd+` ``）を開き、`claude` を実行します。CLI は自動的に IDE と統合され、差分表示や診断共有などの機能を提供します。

外部ターミナルを使用している場合は、Claude Code 内で `/ide` を実行して VS Code に接続します。

### 拡張機能と CLI を切り替える

拡張機能と CLI は同じ会話履歴を共有します。拡張機能の会話を CLI で続行するには、ターミナルで `claude --resume` を実行します。これにより、会話を検索して選択できるインタラクティブピッカーが開きます。

### プロンプトにターミナル出力を含める

プロンプトで `@terminal:name` を使用してターミナル出力を参照します。ここで `name` はターミナルのタイトルです。これにより、Claude はコマンド出力、エラーメッセージ、またはログをコピーペーストせずに表示できます。

### バックグラウンドプロセスを監視する

Claude が長時間実行されるコマンドを実行すると、拡張機能はステータスバーに進行状況を表示します。ただし、バックグラウンドタスクの可視性は CLI と比較して制限されています。より良い可視性のために、Claude にコマンドを出力させて、VS Code の統合ターミナルで実行できるようにします。

### MCP で外部ツールに接続する

MCP（Model Context Protocol）サーバーは Claude に外部ツール、データベース、API へのアクセスを提供します。

MCP サーバーを追加するには、統合ターミナル（`` Ctrl+` `` または `` Cmd+` ``）を開き、`claude mcp add` を実行します。以下の例は GitHub のリモート MCP サーバーを追加します。このサーバーはヘッダーとして渡される[個人用アクセストークン](https://github.com/settings/personal-access-tokens)で認証します。

```bash
claude mcp add --transport http github https://api.githubcopilot.com/mcp/ \
  --header "Authorization: Bearer YOUR_GITHUB_PAT"
```

設定されたら、Claude にツールを使用するよう依頼します（例：「Review PR #456」）。

VS Code を離れることなく MCP サーバーを管理するには、チャットパネルで `/mcp` と入力します。MCP 管理ダイアログでは、サーバーを有効または無効にし、サーバーに再接続し、OAuth 認証を管理できます。利用可能なサーバーについては、[MCP documentation](/ja/mcp) を参照してください。

## git で作業する

Claude Code は git と統合され、VS Code でバージョン管理ワークフローを直接支援します。Claude にコミット変更、プルリクエスト作成、またはブランチ間での作業を依頼します。

### コミットとプルリクエストを作成する

Claude はコミットをステージング、コミットメッセージを作成、作業に基づいてプルリクエストを作成できます。

```text
> commit my changes with a descriptive message
> create a pr for this feature
> summarize the changes I've made to the auth module
```

プルリクエストを作成するときに、Claude は実際のコード変更に基づいて説明を生成し、テストまたは実装の決定についてのコンテキストを追加できます。

### 並列タスク用に git worktrees を使用する

`--worktree`（`-w`）フラグを使用して、独自のファイルとブランチを持つ分離された worktree で Claude を開始します。

```bash
claude --worktree feature-auth
```

各 worktree は git 履歴を共有しながら独立したファイル状態を保持します。これにより、異なるタスクで作業するときに Claude インスタンスが互いに干渉するのを防ぎます。詳細については、[Run parallel sessions with Git worktrees](/ja/common-workflows#run-parallel-claude-code-sessions-with-git-worktrees) を参照してください。

## サードパーティプロバイダーを使用する

デフォルトでは、Claude Code は Anthropic の API に直接接続します。組織が Amazon Bedrock、Google Vertex AI、または Microsoft Foundry を使用して Claude にアクセスする場合は、代わりにプロバイダーを使用するように拡張機能を設定します。

[Disable Login Prompt 設定](vscode://settings/claudeCode.disableLoginPrompt)を開いてボックスをチェックします。

VS Code 設定（Mac で `Cmd+,` または Windows/Linux で `Ctrl+,`）を開き、'Claude Code login'を検索して、**Disable Login Prompt** をチェックすることもできます。

プロバイダーのセットアップガイドに従います。

- [Claude Code on Amazon Bedrock](/ja/amazon-bedrock)
- [Claude Code on Google Vertex AI](/ja/google-vertex-ai)
- [Claude Code on Microsoft Foundry](/ja/microsoft-foundry)

これらのガイドは、`~/.claude/settings.json` でプロバイダーを設定することをカバーしており、VS Code 拡張機能と CLI 間で設定が共有されることを保証します。

## セキュリティとプライバシー

コードはプライベートのままです。Claude Code はコード支援を提供するためにコードを処理しますが、モデルのトレーニングには使用しません。データ処理とログアウトの方法の詳細については、[Data and privacy](/ja/data-usage) を参照してください。

自動編集権限が有効な場合、Claude Code は VS Code が自動的に実行する可能性がある VS Code 設定ファイル（`settings.json` や `tasks.json` など）を変更できます。信頼できないコードで作業するときのリスクを軽減するには、以下を実行します。

- 信頼できないワークスペースに対して [VS Code Restricted Mode](https://code.visualstudio.com/docs/editor/workspace-trust#_restricted-mode) を有効にします。
- 編集の自動受け入れの代わりに手動承認モードを使用します。
- 変更を受け入れる前に慎重に確認します。

### 組み込み IDE MCP サーバー

拡張機能がアクティブな場合、CLI が自動的に接続するローカル MCP サーバーを実行します。これは、CLI が VS Code のネイティブ差分ビューアで差分を開く方法、`@`-メンション用に現在の選択を読む方法、および Jupyter ノートブックで作業しているときに VS Code にセルを実行するよう依頼する方法です。

サーバーは `ide` という名前で、設定するものがないため `/mcp` から非表示になっています。ただし、組織が `PreToolUse` hook を使用して MCP ツールをホワイトリストに登録している場合は、それが存在することを知る必要があります。

**トランスポートと認証。** サーバーは `127.0.0.1` にバインドし、ランダムな高いポートで、他のマシンからはアクセスできません。各拡張機能のアクティベーションは、接続するために CLI が提示する必要がある新しいランダム認証トークンを生成します。トークンは `~/.claude/ide/` の下のロックファイルに書き込まれ、`0600` 権限を持つ `0700` ディレクトリにあるため、VS Code を実行しているユーザーのみがそれを読むことができます。

**モデルに公開されるツール。** サーバーは約 12 個のツールをホストしていますが、モデルに表示されるのは 2 つだけです。残りは、CLI が独自の UI（差分を開く、選択を読む、ファイルを保存する）に使用する内部 RPC であり、ツールリストが Claude に到達する前にフィルタリングされます。

| ツール名（hooks で見られるとおり） | 実行内容 | 書き込み？ |
| - | - | - |
| `mcp__ide__getDiagnostics` | 言語サーバー診断を返します。VS Code の問題パネルのエラーと警告。オプションで 1 つのファイルにスコープされます。 | いいえ |
| `mcp__ide__executeCode` | アクティブな Jupyter ノートブックのカーネルで Python コードを実行します。以下の確認フローを参照してください。 | はい |

**Jupyter 実行は常に最初に尋ねます。** `mcp__ide__executeCode` は何も静かに実行できません。各呼び出しで、コードはアクティブなノートブックの最後に新しいセルとして挿入され、VS Code はそれをビューにスクロールし、ネイティブ Quick Pick は **Execute** または **Cancel** を尋ねます。キャンセル（または `Esc` でピッカーを閉じる）は Claude にエラーを返し、何も実行されません。ツールはまた、アクティブなノートブックがない場合、Jupyter 拡張機能（`ms-toolsai.jupyter`）がインストールされていない場合、またはカーネルが Python でない場合に完全に拒否します。

Quick Pick 確認は `PreToolUse` hooks とは別です。`mcp__ide__executeCode` のホワイトリストエントリにより、Claude はセルを*提案*できます。VS Code 内の Quick Pick は、それを*実際に*実行できるようにするものです。

## 一般的な問題を修正する

### 拡張機能がインストールされない

- VS Code の互換バージョン（1.98.0 以上）があることを確認します。
- VS Code に拡張機能をインストールする権限があることを確認します。
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code) から直接インストールしてみてください。

### Spark アイコンが表示されない

Spark アイコンは、ファイルを開いている場合、**エディタツールバー**（エディタの右上）に表示されます。表示されない場合：

1. **ファイルを開く**：アイコンはファイルを開く必要があります。フォルダを開いているだけでは不十分です。
2. **VS Code バージョンを確認**：1.98.0 以上が必要です（Help → About）
3. **VS Code を再起動**：コマンドパレットから「Developer: Reload Window」を実行します。
4. **競合する拡張機能を無効にする**：他の AI 拡張機能（Cline、Continue など）を一時的に無効にします。
5. **ワークスペーストラストを確認**：拡張機能は制限モードでは機能しません。

または、**ステータスバー**（右下隅）の「✱ Claude Code」をクリックします。これはファイルを開かなくても機能します。**コマンドパレット**（`Cmd+Shift+P` / `Ctrl+Shift+P`）を使用して「Claude Code」と入力することもできます。

### Claude Code が応答しない

Claude Code がプロンプトに応答しない場合：

1. **インターネット接続を確認**：安定したインターネット接続があることを確認します。
2. **新しい会話を開始**：新しい会話を開始して、問題が続くかどうかを確認します。
3. **CLI を試す**：ターミナルから `claude` を実行して、より詳細なエラーメッセージが表示されるかどうかを確認します。

問題が続く場合は、エラーの詳細を含めて [GitHub で問題を報告](https://github.com/anthropics/claude-code/issues)してください。

## 拡張機能をアンインストールする

Claude Code 拡張機能をアンインストールするには：

1. 拡張機能ビューを開きます（Mac で `Cmd+Shift+X` または Windows/Linux で `Ctrl+Shift+X`）
2. 「Claude Code」を検索します。
3. **Uninstall** をクリックします。

拡張機能データを削除してすべての設定をリセットするには：

```bash
rm -rf ~/.vscode/globalStorage/anthropic.claude-code
```

追加のヘルプについては、[troubleshooting guide](/ja/troubleshooting) を参照してください。

## 次のステップ

VS Code で Claude Code をセットアップしたので：

- [一般的なワークフローを探索](/ja/common-workflows)して Claude Code を最大限に活用します。
- [MCP サーバーをセットアップ](/ja/mcp)して、外部ツールで Claude の機能を拡張します。CLI を使用してサーバーを追加し、チャットパネルで `/mcp` を使用して管理します。
- [Claude Code 設定を構成](/ja/settings)して、許可されたコマンド、hooks などをカスタマイズします。これらの設定は拡張機能と CLI 間で共有されます。
