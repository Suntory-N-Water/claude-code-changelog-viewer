---
title: keybindings
source: https://code.claude.com/docs/ja/keybindings.md
---

# キーボードショートカットのカスタマイズ

> キーボードショートカットをカスタマイズして、Claude Code でキーバインディング設定ファイルを使用します。

カスタマイズ可能なキーボードショートカットには Claude Code v2.1.18 以降が必要です。`claude --version` でバージョンを確認してください。

Claude Code はカスタマイズ可能なキーボードショートカットをサポートしています。`/keybindings` を実行して、`~/.claude/keybindings.json` に設定ファイルを作成または開きます。

## 設定ファイル

キーバインディング設定ファイルは、`bindings` 配列を持つオブジェクトです。各ブロックはコンテキストとキーストロークからアクションへのマップを指定します。

キーバインディングファイルへの変更は自動的に検出され、Claude Code を再起動することなく適用されます。

| フィールド | 説明 |
| :- | :- |
| `$schema` | エディタのオートコンプリート用のオプション JSON スキーマ URL |
| `$docs` | オプションのドキュメント URL |
| `bindings` | コンテキスト別のバインディングブロックの配列 |

この例では、チャットコンテキストで `Ctrl+E` を外部エディタを開くにバインドし、`Ctrl+U` をアンバインドします。

```json
{
  "$schema": "https://www.schemastore.org/claude-code-keybindings.json",
  "$docs": "https://code.claude.com/docs/ja/keybindings",
  "bindings": [
    {
      "context": "Chat",
      "bindings": {
        "ctrl+e": "chat:externalEditor",
        "ctrl+u": null
      }
    }
  ]
}
```

## コンテキスト

各バインディングブロックは、バインディングが適用される**コンテキスト**を指定します。

| コンテキスト | 説明 |
| :- | :- |
| `Global` | アプリ全体に適用 |
| `Chat` | メインチャット入力エリア |
| `Autocomplete` | オートコンプリートメニューが開いている |
| `Settings` | 設定メニュー |
| `Confirmation` | 権限と確認ダイアログ |
| `Tabs` | タブナビゲーションコンポーネント |
| `Help` | ヘルプメニューが表示されている |
| `Transcript` | トランスクリプトビューア |
| `HistorySearch` | 履歴検索モード（Ctrl+R） |
| `Task` | バックグラウンドタスクが実行中 |
| `ThemePicker` | テーマピッカーダイアログ |
| `Attachments` | 選択ダイアログ内の画像添付ファイルナビゲーション |
| `Footer` | フッターインジケータナビゲーション（タスク、チーム、diff） |
| `MessageSelector` | 巻き戻しと要約ダイアログのメッセージ選択 |
| `DiffDialog` | Diff ビューアナビゲーション |
| `ModelPicker` | モデルピッカー努力レベル |
| `Select` | 汎用選択/リストコンポーネント |
| `Plugin` | プラグインダイアログ（参照、発見、管理） |
| `Scroll` | 会話スクロールとフルスクリーンモードでのテキスト選択 |
| `Doctor` | `/doctor` 診断スクリーン |

## 利用可能なアクション

アクションは `namespace:action` 形式に従います。例えば、`chat:submit` はメッセージを送信し、`app:toggleTodos` はタスクリストを表示します。各コンテキストには特定のアクションが利用可能です。

### アプリアクション

`Global` コンテキストで利用可能なアクション：

| アクション | デフォルト | 説明 |
| :- | :- | :- |
| `app:interrupt` | Ctrl+C | 現在の操作をキャンセル |
| `app:exit` | Ctrl+D | Claude Code を終了 |
| `app:redraw` | （アンバインド） | ターミナルを強制的に再描画 |
| `app:toggleTodos` | Ctrl+T | タスクリストの表示を切り替え |
| `app:toggleTranscript` | Ctrl+O | 詳細トランスクリプトの表示を切り替え |

### 履歴アクション

コマンド履歴をナビゲートするためのアクション：

| アクション | デフォルト | 説明 |
| :- | :- | :- |
| `history:search` | Ctrl+R | 履歴検索を開く |
| `history:previous` | Up | 前の履歴項目 |
| `history:next` | Down | 次の履歴項目 |

### チャットアクション

`Chat` コンテキストで利用可能なアクション：

| アクション | デフォルト | 説明 |
| :- | :- | :- |
| `chat:cancel` | Escape | 現在の入力をキャンセル |
| `chat:clearInput` | Ctrl+L | 入力を保持したまま全画面再描画を強制します。[フルスクリーンレンダリング](/ja/fullscreen#clear-the-conversation)では、2 秒以内に 2 回押して `/clear` を実行 |
| `chat:clearScreen` | Cmd+K | [フルスクリーンレンダリング](/ja/fullscreen#clear-the-conversation)では、2 秒以内に 2 回押して `/clear` を実行 |
| `chat:killAgents` | Ctrl+X Ctrl+K | このセッション内のすべての実行中の[バックグラウンドサブエージェント](/ja/sub-agents#run-subagents-in-foreground-or-background)を終了 |
| `chat:cycleMode` | Shift+Tab\* | 権限モードをサイクル |
| `chat:modelPicker` | Meta+P | モデルピッカーを開く |
| `chat:fastMode` | Meta+O | 高速モードを切り替え |
| `chat:thinkingToggle` | Meta+T | 拡張思考を切り替え |
| `chat:submit` | Enter | メッセージを送信 |
| `chat:newline` | Ctrl+J | 送信せずに改行を挿入 |
| `chat:undo` | Ctrl+\_、Ctrl+Shift+- | 最後のアクションを元に戻す |
| `chat:externalEditor` | Ctrl+G、Ctrl+X Ctrl+E | 外部エディタで開く |
| `chat:stash` | Ctrl+S | 現在のプロンプトを保存 |
| `chat:imagePaste` | Ctrl+V（Windows では Alt+V） | 画像を貼り付け |

\*VT モードなし（Node \<24.2.0/\<22.17.0、Bun \<1.2.23）の Windows では、デフォルトは Meta+M です。

### オートコンプリートアクション

`Autocomplete` コンテキストで利用可能なアクション：

| アクション | デフォルト | 説明 |
| :- | :- | :- |
| `autocomplete:accept` | Tab | 提案を受け入れ |
| `autocomplete:dismiss` | Escape | メニューを閉じる |
| `autocomplete:previous` | Up | 前の提案 |
| `autocomplete:next` | Down | 次の提案 |

### 確認アクション

`Confirmation` コンテキストで利用可能なアクション：

| アクション | デフォルト | 説明 |
| :- | :- | :- |
| `confirm:yes` | Y、Enter | アクションを確認 |
| `confirm:no` | N、Escape | アクションを拒否 |
| `confirm:previous` | Up | 前のオプション |
| `confirm:next` | Down | 次のオプション |
| `confirm:nextField` | Tab | 次のフィールド |
| `confirm:previousField` | （アンバインド） | 前のフィールド |
| `confirm:toggle` | Space | 選択を切り替え |
| `confirm:cycleMode` | Shift+Tab | 権限モードをサイクル |
| `confirm:toggleExplanation` | Ctrl+E | 権限説明を切り替え |

### 権限アクション

権限ダイアログの `Confirmation` コンテキストで利用可能なアクション：

| アクション | デフォルト | 説明 |
| :- | :- | :- |
| `permission:toggleDebug` | （アンバインド） | 権限デバッグ情報を切り替え。Ctrl+D の以前のデフォルトは v2.1.146 で削除されました。これは `app:exit` をシャドウしていたためです |

### トランスクリプトアクション

`Transcript` コンテキストで利用可能なアクション：

| アクション | デフォルト | 説明 |
| :- | :- | :- |
| `transcript:toggleShowAll` | Ctrl+E | すべてのコンテンツの表示を切り替え |
| `transcript:exit` | q、Ctrl+C、Escape | トランスクリプトビューを終了 |

### 履歴検索アクション

`HistorySearch` コンテキストで利用可能なアクション：

| アクション | デフォルト | 説明 |
| :- | :- | :- |
| `historySearch:next` | Ctrl+R | 次のマッチ |
| `historySearch:accept` | Escape、Tab | 選択を受け入れ |
| `historySearch:cancel` | Ctrl+C | 検索をキャンセル |
| `historySearch:execute` | Enter | 選択したコマンドを実行 |
| `historySearch:cycleScope` | Ctrl+S | スコープをサイクル：セッション、プロジェクト、すべて |

### タスクアクション

`Task` コンテキストで利用可能なアクション：

| アクション | デフォルト | 説明 |
| :- | :- | :- |
| `task:background` | Ctrl+B | 現在のタスクをバックグラウンドに |

### テーマアクション

`ThemePicker` コンテキストで利用可能なアクション：

| アクション | デフォルト | 説明 |
| :- | :- | :- |
| `theme:toggleSyntaxHighlighting` | Ctrl+T | シンタックスハイライトを切り替え |

### ヘルプアクション

`Help` コンテキストで利用可能なアクション：

| アクション | デフォルト | 説明 |
| :- | :- | :- |
| `help:dismiss` | Escape | ヘルプメニューを閉じる |

### タブアクション

`Tabs` コンテキストで利用可能なアクション：

| アクション | デフォルト | 説明 |
| :- | :- | :- |
| `tabs:next` | Tab、Right | 次のタブ |
| `tabs:previous` | Shift+Tab、Left | 前のタブ |

### 添付ファイルアクション

`Attachments` コンテキストで利用可能なアクション：

| アクション | デフォルト | 説明 |
| :- | :- | :- |
| `attachments:next` | Right | 次の添付ファイル |
| `attachments:previous` | Left | 前の添付ファイル |
| `attachments:remove` | Backspace、Delete | 選択した添付ファイルを削除 |
| `attachments:exit` | Down、Escape | 添付ファイルナビゲーションを終了 |

### フッターアクション

`Footer` コンテキストで利用可能なアクション：

| アクション | デフォルト | 説明 |
| :- | :- | :- |
| `footer:next` | Right | 次のフッター項目 |
| `footer:previous` | Left | 前のフッター項目 |
| `footer:up` | Up | フッター内で上に移動（最上部で選択解除） |
| `footer:down` | Down | フッター内で下に移動 |
| `footer:openSelected` | Enter | 選択したフッター項目を開く |
| `footer:clearSelection` | Escape | フッター選択をクリア |

### メッセージセレクタアクション

`MessageSelector` コンテキストで利用可能なアクション：

| アクション | デフォルト | 説明 |
| :- | :- | :- |
| `messageSelector:up` | Up、K、Ctrl+P | リストで上に移動 |
| `messageSelector:down` | Down、J、Ctrl+N | リストで下に移動 |
| `messageSelector:top` | Ctrl+Up、Shift+Up、Meta+Up、Shift+K | 最上部にジャンプ |
| `messageSelector:bottom` | Ctrl+Down、Shift+Down、Meta+Down、Shift+J | 最下部にジャンプ |
| `messageSelector:select` | Enter | メッセージを選択 |

### Diff アクション

`DiffDialog` コンテキストで利用可能なアクション：

| アクション | デフォルト | 説明 |
| :- | :- | :- |
| `diff:dismiss` | Escape | Diff ビューアを閉じる |
| `diff:previousSource` | Left | 前の Diff ソース |
| `diff:nextSource` | Right | 次の Diff ソース |
| `diff:previousFile` | Up、K | ファイルリストの前のファイル。詳細ビューで 1 行上にスクロール |
| `diff:nextFile` | Down、J | ファイルリストの次のファイル。詳細ビューで 1 行下にスクロール |
| `diff:viewDetails` | Enter | Diff の詳細を表示 |
| `diff:back` | （コンテキスト固有） | Diff ビューアで戻る |

Diff 詳細ビューは、ページャースタイルのキーを標準的な[スクロールアクション](#scroll-actions)にバインドします。これらのバインディングは `DiffDialog` コンテキストの一部であり、詳細ビューにのみ適用されます。[スクロールアクション](#scroll-actions)の下に記載されている `Scroll` コンテキストのデフォルトは変わりません。

| アクション | デフォルト | 説明 |
| :- | :- | :- |
| `scroll:pageUp` | PageUp | ビューポートの半分だけ上にスクロール |
| `scroll:pageDown` | PageDown | ビューポートの半分だけ下にスクロール |
| `scroll:fullPageUp` | Shift+Space、B | ビューポート全体だけ上にスクロール |
| `scroll:fullPageDown` | Space | ビューポート全体だけ下にスクロール |
| `scroll:top` | G、Home | 最上部にジャンプ |
| `scroll:bottom` | Shift+G、End | 最下部にジャンプ |

### モデルピッカーアクション

`ModelPicker` コンテキストで利用可能なアクション：

| アクション | デフォルト | 説明 |
| :- | :- | :- |
| `modelPicker:decreaseEffort` | Left | 努力レベルを低下 |
| `modelPicker:increaseEffort` | Right | 努力レベルを増加 |
| `modelPicker:setAsDefault` | d | ハイライトされたモデルを新しいセッションのデフォルトとして設定 |

### 選択アクション

`Select` コンテキストで利用可能なアクション：

| アクション | デフォルト | 説明 |
| :- | :- | :- |
| `select:next` | Down、J、Ctrl+N | 次のオプション |
| `select:previous` | Up、K、Ctrl+P | 前のオプション |
| `select:accept` | Enter | 選択を受け入れ |
| `select:cancel` | Escape | 選択をキャンセル |

### プラグインアクション

`Plugin` コンテキストで利用可能なアクション：

| アクション | デフォルト | 説明 |
| :- | :- | :- |
| `plugin:toggle` | Space | プラグイン選択を切り替え |
| `plugin:install` | I | 選択したプラグインをインストール |
| `plugin:favorite` | F | 選択したプラグインをお気に入りにして、インストール済みタブの上部付近にソートされるようにします |

### 設定アクション

`Settings` コンテキストで利用可能なアクション：

| アクション | デフォルト | 説明 |
| :- | :- | :- |
| `settings:search` | / | 検索モードに入る |
| `settings:retry` | R | 使用状況データの読み込みを再試行（エラー時） |
| `settings:close` | Enter | 変更を保存して設定パネルを閉じます。Escape は変更を破棄して閉じます |

### Doctor アクション

`Doctor` コンテキストで利用可能なアクション：

| アクション | デフォルト | 説明 |
| :- | :- | :- |
| `doctor:fix` | F | 診断レポートを Claude に送信して、報告された問題を修正します。問題が見つかった場合のみアクティブ |

### 音声アクション

[音声ディクテーション](/ja/voice-dictation)が有効な場合、`Chat` コンテキストで利用可能なアクション：

| アクション | デフォルト | 説明 |
| :- | :- | :- |
| `voice:pushToTalk` | Space | プロンプトをディクテートします。`/voice` モードに応じて押し続けるか、タップします |

### スクロールアクション

[フルスクリーンレンダリング](/ja/fullscreen)が有効な場合、`Scroll` コンテキストで利用可能なアクション：

| アクション | デフォルト | 説明 |
| :- | :- | :- |
| `scroll:lineUp` | （アンバインド） | 1 行上にスクロール。マウスホイールスクロールがこのアクションをトリガー |
| `scroll:lineDown` | （アンバインド） | 1 行下にスクロール。マウスホイールスクロールがこのアクションをトリガー |
| `scroll:pageUp` | PageUp | ビューポート高さの半分だけ上にスクロール |
| `scroll:pageDown` | PageDown | ビューポート高さの半分だけ下にスクロール |
| `scroll:top` | Ctrl+Home | 会話の開始位置にジャンプ |
| `scroll:bottom` | Ctrl+End | 最新メッセージにジャンプして自動フォローを再度有効化 |
| `scroll:halfPageUp` | （アンバインド） | ビューポート高さの半分だけ上にスクロール。`scroll:pageUp` と同じ動作で、vi スタイルの再バインドのために提供 |
| `scroll:halfPageDown` | （アンバインド） | ビューポート高さの半分だけ下にスクロール。`scroll:pageDown` と同じ動作で、vi スタイルの再バインドのために提供 |
| `scroll:fullPageUp` | （アンバインド） | ビューポート高さ全体だけ上にスクロール |
| `scroll:fullPageDown` | （アンバインド） | ビューポート高さ全体だけ下にスクロール |
| `selection:copy` | Ctrl+Shift+C / Cmd+C | 選択したテキストをクリップボードにコピー |
| `selection:clear` | （アンバインド） | アクティブなテキスト選択をクリア |
| `selection:extendLeft` | Shift+Left | アクティブな選択を 1 列左に拡張 |
| `selection:extendRight` | Shift+Right | アクティブな選択を 1 列右に拡張 |
| `selection:extendUp` | Shift+Up | アクティブな選択を 1 行上に拡張。選択が上端に達するとビューポートをスクロール |
| `selection:extendDown` | Shift+Down | アクティブな選択を 1 行下に拡張。選択が下端に達するとビューポートをスクロール |
| `selection:extendLineStart` | Shift+Home | アクティブな選択を行の開始位置に拡張 |
| `selection:extendLineEnd` | Shift+End | アクティブな選択を行の終了位置に拡張 |

## キーストロークシンタックス

### モディファイア

`+` セパレータでモディファイアキーを使用します。

- `ctrl` または `control` - Control キー
- `shift` - Shift キー
- `alt`、`opt`、`option`、または `meta` - Windows と Linux の Alt キー、macOS の Option キー
- `cmd`、`command`、`super`、または `win` - macOS の Command キー、Windows の Windows キー、Linux の Super キー

`cmd` グループは Super モディファイアを報告するターミナル（Kitty キーボードプロトコルまたは xterm の `modifyOtherKeys` モードをサポートするターミナルなど）でのみ検出されます。ほとんどのターミナルはこれを送信しないため、すべての場所で機能するバインディングには `ctrl` または `meta` を使用してください。

例えば：

```text
ctrl+k          Ctrl + K
shift+tab       Shift + Tab
meta+p          macOS の Option + P、その他の場所では Alt + P
ctrl+shift+c    複数のモディファイア
```

### 大文字

スタンドアロンの大文字は Shift を意味します。例えば、`K` は `shift+k` と同等です。これは大文字と小文字のキーが異なる意味を持つ vim スタイルのバインディングに便利です。

モディファイア付きの大文字（例：`ctrl+K`）はスタイル的に扱われ、Shift を意味**しません** — `ctrl+K` は `ctrl+k` と同じです。

### コード

コードはスペースで区切られたキーストロークのシーケンスです。

```text
ctrl+k ctrl+s   Ctrl+K を押して、リリースしてから Ctrl+S
```

### 特殊キー

- `escape` または `esc` - Escape キー
- `enter` または `return` - Enter キー
- `tab` - Tab キー
- `space` - スペースバー
- `up`、`down`、`left`、`right` - 矢印キー
- `backspace`、`delete` - Delete キー

## デフォルトショートカットをアンバインド

アクションを `null` に設定して、デフォルトショートカットをアンバインドします。

```json
{
  "bindings": [
    {
      "context": "Chat",
      "bindings": {
        "ctrl+s": null
      }
    }
  ]
}
```

これはコードバインディングでも機能します。プレフィックスを共有するすべてのコードをアンバインドすると、そのプレフィックスを単一キーバインディングとして使用できるようになります。

```json
{
  "bindings": [
    {
      "context": "Chat",
      "bindings": {
        "ctrl+x ctrl+k": null,
        "ctrl+x ctrl+e": null,
        "ctrl+x": "chat:newline"
      }
    }
  ]
}
```

プレフィックス上の一部のコードをアンバインドしても、すべてをアンバインドしない場合、プレフィックスを押すと残りのバインディングのコード待機モードに入ります。

## 予約済みショートカット

これらのショートカットは再バインドできません。

| ショートカット | 理由 |
| :- | :- |
| Ctrl+C | ハードコードされた割り込み/キャンセル |
| Ctrl+D | ハードコードされた終了 |
| Ctrl+M | ターミナルの Enter と同じ（どちらも CR を送信） |
| Caps Lock | ターミナルアプリケーションに配信されない |

## ターミナルの競合

一部のショートカットはターミナルマルチプレクサと競合する可能性があります。

| ショートカット | 競合 |
| :- | :- |
| Ctrl+B | tmux プレフィックス（2 回押して送信） |
| Ctrl+A | GNU screen プレフィックス |
| Ctrl+Z | Unix プロセス一時停止（SIGTSTP） |

## Vim モードの相互作用

Vim モードが `/config` → エディタモードで有効な場合、キーバインディングと Vim モードは独立して動作します。

- **Vim モード** はテキスト入力レベルで入力を処理します（カーソル移動、モード、モーション）
- **キーバインディング** はコンポーネントレベルでアクションを処理します（todos を切り替え、送信など）
- Vim モードの Escape キーは INSERT から NORMAL モードに切り替わります。`chat:cancel` をトリガーしません
- ほとんどの Ctrl+key ショートカットは Vim モードを通過してキーバインディングシステムに渡されます
- Vim NORMAL モードでは、`?` はヘルプメニューを表示します（Vim の動作）
- Vim NORMAL モードでは、`/` は履歴検索を開きます。標準モードの Ctrl+R と同じです

## 検証

Claude Code はキーバインディングを検証し、以下の警告を表示します。

- 解析エラー（無効な JSON または構造）
- 無効なコンテキスト名
- 予約済みショートカットの競合
- ターミナルマルチプレクサの競合
- 同じコンテキスト内の重複バインディング

`/doctor` を実行して、キーバインディングの警告を確認します。
