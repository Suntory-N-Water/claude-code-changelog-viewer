---
title: chrome
source: https://code.claude.com/docs/ja/chrome.md
---

# Chrome で Claude Code を使用する

> Claude Code を Chrome ブラウザに接続して、Web アプリをテストし、コンソールログでデバッグし、フォーム入力を自動化し、Web ページからデータを抽出します。

Claude Code は [Claude in Chrome ブラウザ拡張機能](https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn) と統合され、CLI または [VS Code 拡張機能](/ja/vs-code#automate-browser-tasks-with-chrome) からブラウザ自動化機能を提供します。コードをビルドしてから、コンテキストを切り替えることなくブラウザでテストおよびデバッグできます。

Claude はブラウザタスク用に新しいタブを開き、ブラウザのログイン状態を共有するため、既にサインインしているサイトにアクセスできます。ブラウザアクションはリアルタイムで表示される Chrome ウィンドウで実行されます。Claude がログインページまたは CAPTCHA に遭遇した場合、一時停止して手動で処理するよう求めます。

Chrome 統合は Google Chrome と Microsoft Edge で動作します。Brave、Arc、またはその他の Chromium ベースのブラウザではまだサポートされていません。Windows Subsystem for Linux（WSL）でもサポートされていません。

機能

Chrome が接続されている場合、単一のワークフロー内でブラウザアクションとコーディングタスクをチェーンできます。

- **ライブデバッグ**：コンソールエラーと DOM 状態を直接読み取り、それらを引き起こしたコードを修正します
- **デザイン検証**：Figma モックから UI をビルドしてから、ブラウザで開いて一致することを確認します
- **Web アプリテスト**：フォーム検証をテストし、ビジュアルリグレッションをチェックするか、ユーザーフローを検証します
- **認証済み Web アプリ**：API コネクタなしで、ログインしている Google Docs、Gmail、Notion、またはその他のアプリと対話します
- **データ抽出**：Web ページから構造化情報を取得してローカルに保存します
- **タスク自動化**：データ入力、フォーム入力、またはマルチサイトワークフローなどの反復的なブラウザタスクを自動化します
- **セッション記録**：ブラウザインタラクションを GIF として記録して、何が起こったかを文書化または共有します

前提条件

Claude Code を Chrome で使用する前に、以下が必要です。

- [Google Chrome](https://www.google.com/chrome/) または [Microsoft Edge](https://www.microsoft.com/edge) ブラウザ
- [Claude in Chrome 拡張機能](https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn) バージョン 1.0.36 以上（Chrome Web Store で両方のブラウザで利用可能）
- [Claude Code](/ja/quickstart#step-1-install-claude-code) バージョン 2.0.73 以上
- 直接 Anthropic プラン（Pro、Max、Team、または Enterprise）

Chrome 統合は Amazon Bedrock、Google Cloud の Agent Platform、Microsoft Foundry などのサードパーティプロバイダーを通じては利用できません。Claude にサードパーティプロバイダーを通じてのみアクセスする場合、この機能を使用するには別の claude.ai アカウントが必要です。

CLI で開始する

`--chrome` フラグで Claude Code を起動します。

```bash theme={null}
claude --chrome
```

既存のセッション内から `/chrome` を実行して Chrome を有効にすることもできます。

この例は、ページに移動し、それと対話し、ターミナルまたはエディターからすべてを報告します。

```text theme={null}
Go to code.claude.com/docs, click on the search box,
type "hooks", and tell me what results appear
```

いつでも `/chrome` を実行して接続ステータスを確認し、権限を管理し、拡張機能を再接続するか、使用する接続されたブラウザを選択できます。ブラウザアクションが開始されるときに複数のブラウザが接続されている場合、Claude はいずれかを選択するよう促します。

VS Code については、[VS Code でのブラウザ自動化](/ja/vs-code#automate-browser-tasks-with-chrome) を参照してください。

Chrome をデフォルトで有効にする

各セッションで `--chrome` を渡すことを避けるには、`/chrome` を実行して「デフォルトで有効」を選択します。

[VS Code 拡張機能](/ja/vs-code#automate-browser-tasks-with-chrome) では、Chrome 拡張機能がインストールされている場合、Chrome はいつでも利用可能です。追加のフラグは必要ありません。

CLI で Chrome をデフォルトで有効にすると、ブラウザツールが常にロードされるため、コンテキスト使用量が増加します。コンテキスト消費の増加に気付いた場合、この設定を無効にして、必要な場合にのみ `--chrome` を使用してください。

サイト権限を管理する

サイトレベルの権限は Chrome 拡張機能から継承されます。Chrome 拡張機能の設定で権限を管理して、Claude がブラウズ、クリック、入力できるサイトを制御します。

ブラウザツールをプランモードで使用する

[プランモード](/ja/permission-modes#analyze-before-you-edit-with-plan-mode) では、ページまたはブラウザの状態のみを読み取るブラウザツール呼び出しは権限プロンプトなしで実行され、状態を変更する呼び出しは承認を求めるプロンプトが表示されます。

- **読み取り専用呼び出し**: `read_page`、`get_page_text`、`find`、コンソールメッセージまたはネットワークリクエストの読み取り、およびスクリーンショットの撮影
- **状態変更呼び出し**: クリック、入力、ナビゲーション、タブとウィンドウ管理、および GIF の記録

v2.1.199 以降、`tabs_context_mcp` の `createIfEmpty`、コンソールおよびネットワークリーダーの `clear`、またはスクリーンショットの `save_to_disk` など、状態変更入力フラグを設定する読み取り専用呼び出しも承認を求めるプロンプトが表示されます。`browser_batch` 呼び出しは、その内部のすべてのアクションが読み取り専用の場合にのみ、プロンプトなしで実行されます。

ワークフロー例

これらの例は、ブラウザアクションとコーディングタスクを組み合わせる一般的な方法を示しています。`/mcp` を実行して `claude-in-chrome` を選択すると、利用可能なブラウザツールの完全なリストが表示されます。

ローカル Web アプリケーションをテストする

Web アプリを開発する場合、変更が正しく機能することを確認するよう Claude に依頼します。

```text
I just updated the login form validation. Can you open localhost:3000,
try submitting the form with invalid data, and check if the error
messages appear correctly?
```

Claude はローカルサーバーに移動し、フォームと対話し、観察したことを報告します。

コンソールログでデバッグする

Claude はコンソール出力を読み取って問題の診断を支援できます。ログが詳細になる可能性があるため、すべてのコンソール出力を要求するのではなく、探すパターンを Claude に伝えます。

```text
Open the dashboard page and check the console for any errors when
the page loads.
```

Claude はコンソールメッセージを読み取り、特定のパターンまたはエラータイプでフィルタリングできます。

フォーム入力を自動化する

反復的なデータ入力タスクを高速化します。

```text
I have a spreadsheet of customer contacts in contacts.csv. For each row,
go to the CRM at crm.example.com, click "Add Contact", and fill in the
name, email, and phone fields.
```

Claude はローカルファイルを読み取り、Web インターフェースをナビゲートし、各レコードのデータを入力します。

Google Docs でコンテンツをドラフトする

API セットアップなしで Claude を使用してドキュメントに直接書き込みます。

```text
Draft a project update based on the recent commits and add it to my
Google Doc at docs.google.com/document/d/abc123
```

Claude はドキュメントを開き、エディターをクリックしてコンテンツを入力します。これは、ログインしているあらゆる Web アプリで機能します。Gmail、Notion、Sheets など。

Web ページからデータを抽出する

Web サイトから構造化情報を取得します。

```text
Go to the product listings page and extract the name, price, and
availability for each item. Save the results as a CSV file.
```

Claude はページに移動し、コンテンツを読み取り、データを構造化形式にコンパイルします。

マルチサイトワークフローを実行する

複数の Web サイト間でタスクを調整します。

```text
Check my calendar for meetings tomorrow, then for each meeting with
an external attendee, look up their company website and add a note
about what they do.
```

Claude はタブ間で動作して情報を収集し、ワークフローを完了します。

デモ GIF を記録する

ブラウザインタラクションの共有可能な記録を作成します。

```text
Record a GIF showing how to complete the checkout flow, from adding
an item to the cart through to the confirmation page.
```

Claude はインタラクションシーケンスを記録し、GIF ファイルとして保存します。

トラブルシューティング

拡張機能が検出されない

Claude Code が Chrome 拡張機能を検出できない場合：

1. Chrome 拡張機能が `chrome://extensions` にインストールされ、有効になっていることを確認します
2. `claude --version` を実行して Claude Code が最新であることを確認します
3. Chrome が実行されていることを確認します
4. `/chrome` を実行して「Reconnect extension」を選択し、接続を再確立します
5. 問題が解決しない場合、Claude Code と Chrome の両方を再起動します

Chrome 統合を初めて有効にすると、Claude Code はネイティブメッセージングホスト設定ファイルをインストールします。Chrome はスタートアップ時にこのファイルを読み取るため、最初の試行で拡張機能が検出されない場合、Chrome を再起動して新しい設定を取得します。

v2.1.199 以降、Claude Code は初回インストール時のみ拡張機能の接続を促すブラウザタブを開きます。設定ファイルを書き直す後続セッション（例えば Claude Code ビルドまたは設定ディレクトリを切り替えた後）では、再度開きません。

接続がまだ失敗する場合、ホスト設定ファイルが以下の場所に存在することを確認します。

Chrome の場合：

- **macOS**：`~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.anthropic.claude_code_browser_extension.json`
- **Linux**：`~/.config/google-chrome/NativeMessagingHosts/com.anthropic.claude_code_browser_extension.json`
- **Windows**：Windows レジストリで `HKCU\Software\Google\Chrome\NativeMessagingHosts\` を確認します

Edge の場合：

- **macOS**：`~/Library/Application Support/Microsoft Edge/NativeMessagingHosts/com.anthropic.claude_code_browser_extension.json`
- **Linux**：`~/.config/microsoft-edge/NativeMessagingHosts/com.anthropic.claude_code_browser_extension.json`
- **Windows**：Windows レジストリで `HKCU\Software\Microsoft\Edge\NativeMessagingHosts\` を確認します

ブラウザが応答しない

Claude のブラウザコマンドが機能しなくなった場合：

1. モーダルダイアログ（alert、confirm、prompt）がページをブロックしているかどうかを確認します。JavaScript ダイアログはブラウザイベントをブロックし、Claude がコマンドを受け取るのを防ぎます。ダイアログを手動で閉じてから、Claude に続行するよう伝えます。
2. Claude に新しいタブを作成して再度試すよう依頼します
3. `chrome://extensions` で拡張機能を無効にしてから再度有効にして Chrome 拡張機能を再起動します

長いセッション中に接続が切れる

Chrome 拡張機能のサービスワーカーは長時間のセッション中にアイドル状態になる可能性があり、接続が切れます。非アクティブ期間後にブラウザツールが機能しなくなった場合、`/chrome` を実行して「Reconnect extension」を選択します。

Windows 固有の問題

Windows では、以下の問題が発生する可能性があります。

- **名前付きパイプの競合（EADDRINUSE）**：別のプロセスが同じ名前付きパイプを使用している場合、Claude Code を再起動します。Chrome を使用している他の Claude Code セッションを閉じます。
- **ネイティブメッセージングホストエラー**：ネイティブメッセージングホストがスタートアップ時にクラッシュする場合、Claude Code を再インストールしてホスト設定を再生成してみてください。

一般的なエラーメッセージ

これらは最も頻繁に遭遇するエラーと、それらを解決する方法です。

| エラー | 原因 | 修正 |
| - | - | - |
| "Browser extension is not connected" | ネイティブメッセージングホストが拡張機能に到達できない | Chrome と Claude Code を再起動してから、`/chrome` を実行して再接続します |
| "Extension not detected" | Chrome 拡張機能がインストールされていないか、無効になっている | `chrome://extensions` で拡張機能をインストールまたは有効にします |
| "No tab available" | Claude がタブの準備ができる前に動作しようとした | Claude に新しいタブを作成して再度試すよう依頼します |
| "Receiving end does not exist" | 拡張機能サービスワーカーがアイドル状態になった | `/chrome` を実行して「Reconnect extension」を選択します |

関連項目

- [コンピュータ使用](/ja/computer-use)：ブラウザでタスクを実行できない場合にネイティブ macOS アプリを制御します
- [VS Code で Claude Code を使用する](/ja/vs-code#automate-browser-tasks-with-chrome)：VS Code 拡張機能でのブラウザ自動化
- [CLI リファレンス](/ja/cli-reference)：`--chrome` を含むコマンドラインフラグ
- [一般的なワークフロー](/ja/common-workflows)：Claude Code を使用するその他の方法
- [データとプライバシー](/ja/data-usage)：Claude Code がデータを処理する方法
- [Chrome で Claude を使い始める](https://support.claude.com/en/articles/12012173-getting-started-with-claude-in-chrome)：ショートカット、スケジューリング、権限を含む Chrome 拡張機能の完全なドキュメント
