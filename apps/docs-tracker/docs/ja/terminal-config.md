---
title: terminal-config
source: https://code.claude.com/docs/ja/terminal-config.md
---

# Claude Code 用にターミナルを設定する

> Shift+Enter で改行を修正し、Claude が完了したときにターミナルベルを取得し、tmux を設定し、カラーテーマを一致させ、Claude Code CLI で Vim モードを有効にします。

Claude Code はどのターミナルでも設定なしで動作します。このページは、特定の動作が期待どおりに機能していない場合のためのものです。以下から症状を見つけてください。すべてが既に正しく感じられる場合は、このページは必要ありません。

- [Shift+Enter が改行を挿入する代わりに送信する](#enter-multiline-prompts)
- [macOS で Option キーショートカットが機能しない](#enable-option-key-shortcuts-on-macos)
- [Claude が完了したときに音またはアラートがない](#get-a-terminal-bell-or-notification)
- [Claude Code を tmux 内で実行している](#configure-tmux)
- [表示がちらつくか、スクロールバックがジャンプする](#switch-to-fullscreen-rendering)
- [プロンプトで Vim キーを使いたい](#edit-prompts-with-vim-keybindings)

このページは、ターミナルが Claude Code に正しい信号を送信するようにすることについてです。Claude Code 自体が応答するキーを変更するには、代わりに [キーバインディング](/ja/keybindings) を参照してください。

## 複数行のプロンプトを入力する

Enter キーを押すとメッセージが送信されます。送信せずに改行を追加するには、Ctrl+J を押すか、`\` を入力してから Enter キーを押します。どちらもセットアップなしですべてのターミナルで機能します。

ほとんどのターミナルでは Shift+Enter も押すことができますが、サポートはターミナルエミュレータによって異なります。

| ターミナル | Shift+Enter で改行 |
| :- | :- |
| Ghostty、Kitty、iTerm2、WezTerm、Warp、Apple Terminal、Windows Terminal | セットアップなしで機能 |
| VS Code、Cursor、Windsurf、Alacritty、Zed | 1 回 `/terminal-setup` を実行 |
| gnome-terminal、PyCharm や Android Studio などの JetBrains IDE | 利用不可。Ctrl+J または `\` の後に Enter を使用 |

VS Code、Cursor、Windsurf、Alacritty、Zed の場合、`/terminal-setup` は Shift+Enter およびその他のキーバインディングをターミナルの設定ファイルに書き込みます。VS Code、Cursor、Windsurf ではエディタ設定で `terminal.integrated.mouseWheelScrollSensitivity` も設定され、[フルスクリーンモード](/ja/fullscreen) でのスクロールがスムーズになります。既存のバインディングと設定はそのまま保持されます。`VSCode terminal Shift+Enter key binding already configured` などのメッセージが表示された場合は、変更は加えられていません。tmux または screen 内ではなく、ホストターミナル内で直接 `/terminal-setup` を実行してください。ホストターミナルの設定に書き込む必要があるためです。

tmux 内で実行している場合、外側のターミナルがサポートしている場合でも、Shift+Enter には以下の [tmux 設定](#configure-tmux) が必要です。

改行を別のキーにバインドするか、Enter が改行を挿入し Shift+Enter が送信するように動作を入れ替えるには、[キーバインディングファイル](/ja/keybindings) で `chat:newline` および `chat:submit` アクションをマップします。

## macOS で Option キーショートカットを有効にする

Claude Code のいくつかのショートカットは Option キーを使用します。例えば、改行の場合は Option+Enter、モデルを切り替える場合は Option+P です。macOS では、ほとんどのターミナルはデフォルトでは Option を修飾子として送信しないため、これらのショートカットは有効にするまで機能しません。このターミナル設定は通常「Option を Meta キーとして使用」というラベルが付いています。Meta は、現在 Option または Alt というラベルが付いているキーの歴史的な Unix 名です。

設定 → プロファイル → キーボードを開き、'Option を Meta キーとして使用'をチェックします。

Claude Code の初回実行プロンプトで'改行と視覚的ベルの場合は Option+Enter'を受け入れた場合、これは既に完了しています。そのプロンプトは `/terminal-setup` を実行し、Apple Terminal プロファイルで Option を Meta として有効にし、オーディオベルをビジュアルスクリーンフラッシュに切り替えます。

設定 → プロファイル → キー → 一般を開き、左 Option キーと右 Option キーを「Esc+」に設定します。

iTerm2 で `/terminal-setup` を実行すると、設定 → 一般 → 選択の下の「ターミナル内のアプリケーションがクリップボードにアクセスできる」が有効になり、`/copy` コマンドがシステムクリップボードに書き込むことができます。このコマンドは tmux 内から実行された場合でも iTerm2 を検出します。変更を有効にするために iTerm2 を再起動してください。

VS Code 設定に `"terminal.integrated.macOptionIsMeta": true` を追加します。

Ghostty、Kitty、およびその他のターミナルについては、ターミナルの設定ファイルで Option-as-Alt または Option-as-Meta 設定を探してください。

## ターミナルベルまたは通知を取得する

Claude がタスクを完了するか、権限プロンプトで一時停止すると、通知イベントが発火します。これをターミナルベルまたはデスクトップ通知として表示すると、長いタスクが実行されている間に他の作業に切り替えることができます。

デフォルトでは Claude Code はデスクトップ通知を Ghostty、Kitty、および iTerm2 でのみ送信します。他のターミナルでは、[`preferredNotifChannel`](/ja/settings#available-settings) を `"terminal_bell"` に設定してターミナルベルを鳴らすか、カスタムサウンドまたはコマンド用に [通知フック](#play-a-sound-with-a-notification-hook) を設定してください。

デスクトップ通知は SSH 経由でローカルマシンに到達するため、リモートセッションでもアラートを表示できます。Ghostty と Kitty はさらなるセットアップなしで OS 通知センターに転送します。iTerm2 では転送を有効にする必要があります。

設定 → プロファイル → ターミナルに移動します。

「Notification Center Alerts」をチェックし、「Filter Alerts」をクリックして「Send escape sequence-generated alerts」を有効にします。

通知がまだ表示されない場合は、ターミナルアプリケーションが OS 設定で通知権限を持っていることを確認し、tmux 内で実行している場合は [パススルーを有効にします](#configure-tmux)。

### 通知フックでサウンドを再生する

任意のターミナルで [通知フック](/ja/hooks-guide#get-notified-when-claude-needs-input) を設定して、Claude があなたの注意が必要なときにサウンドを再生するか、カスタムコマンドを実行できます。フックはデスクトップ通知の代わりではなく、並行して実行されるため、Warp や VS Code 統合ターミナルなどのデスクトップ通知を受け取らないターミナルは、フックを使用するか、`preferredNotifChannel` を `"terminal_bell"` に設定できます。

以下の例は macOS でシステムサウンドを再生します。リンクされたガイドには macOS、Linux、および Windows のデスクトップ通知コマンドがあります。

```json ~/.claude/settings.json theme={null}
{
  "hooks": {
    "Notification": [
      {
        "hooks": [{ "type": "command", "command": "afplay /System/Library/Sounds/Glass.aiff" }]
      }
    ]
  }
}
```

## tmux を設定する

Claude Code が tmux 内で実行されている場合、デフォルトでは 2 つのことが壊れます。Shift+Enter が改行を挿入する代わりに送信し、デスクトップ通知と [プログレスバー](/ja/settings#available-settings) が外側のターミナルに到達しません。これらの行を `~/.tmux.conf` に追加し、`tmux source-file ~/.tmux.conf` を実行して実行中のサーバーに適用します。

```bash ~/.tmux.conf theme={null}
set -g allow-passthrough on
set -s extended-keys on
set -as terminal-features 'xterm*:extkeys'
```

`allow-passthrough` 行により、通知とプログレス更新が tmux に飲み込まれるのではなく、iTerm2、Ghostty、または Kitty に到達できます。`extended-keys` 行により、tmux は Shift+Enter をプレーン Enter と区別できるため、改行ショートカットが機能します。

## カラーテーマを一致させる

`/theme` コマンドを使用するか、`/config` のテーマピッカーを使用して、ターミナルに一致する Claude Code テーマを選択します。自動オプションを選択すると、ターミナルの明るいまたは暗い背景が検出されるため、テーマは OS の外観の変更に従います。Claude Code はターミナルアプリケーションによって設定されるターミナル自体のカラースキームを制御しません。

インターフェースの下部に表示される内容をカスタマイズするには、現在のモデル、作業ディレクトリ、git ブランチ、またはその他のコンテキストを表示する [カスタムステータスライン](/ja/statusline) を設定します。

### カスタムテーマを作成する

カスタムテーマには Claude Code v2.1.118 以降が必要です。

組み込みプリセットに加えて、`/theme` はユーザーが定義したカスタムテーマと、インストール済みの [プラグイン](/ja/plugins-reference#themes) によって提供されるテーマを一覧表示します。リストの最後にある **新しいカスタムテーマ…** を選択して、対話的に作成します。テーマに名前を付けてから、個別のカラートークンを選択してオーバーライドします。カスタムテーマがハイライトされている状態で `Ctrl+E` を押すと、編集できます。

各カスタムテーマは `~/.claude/themes/` 内の JSON ファイルです。`.json` 拡張子を除いたファイル名がテーマのスラッグであり、テーマを選択すると `custom:<slug>` がテーマの設定として保存されます。ファイルには 3 つのオプションフィールドがあります。

| フィールド | 型 | 説明 |
| :- | :- | :- |
| `name` | string | `/theme` に表示されるラベル。デフォルトはファイル名スラッグ |
| `base` | string | テーマの開始元となる組み込みプリセット：`dark`、`light`、`dark-daltonized`、`light-daltonized`、`dark-ansi`、または `light-ansi`。デフォルトは `dark` |
| `overrides` | object | カラートークン名をカラー値にマップします。ここにリストされていないトークンはベースプリセットにフォールスルーします |

カラー値は `#rrggbb`、`#rgb`、`rgb(r,g,b)`、`ansi256(n)`、または `ansi:<name>` を受け入れます。ここで `<name>` は `red` や `cyanBright` などの 16 個の標準 ANSI カラー名の 1 つです。不明なトークンと無効なカラー値は無視されるため、タイプミスはレンダリングを破壊することはできません。

次の例は、ダークプリセットを保持しながら、プロンプトアクセント、エラーテキスト、成功テキストを再色付けするテーマを定義しています。

```json ~/.claude/themes/dracula.json theme={null}
{
  "name": "Dracula",
  "base": "dark",
  "overrides": {
    "claude": "#bd93f9",
    "error": "#ff5555",
    "success": "#50fa7b"
  }
}
```

Claude Code は `~/.claude/themes/` を監視し、ファイルが変更されるとリロードするため、エディターで行われた編集は再起動なしで実行中のセッションに適用されます。

以下は、`overrides` で設定できるトークンをカバーしています。`/theme` の対話的エディターは、ここでカバーされていない少数の単一目的のアクセント（オンボーディング画面の色など）を含む、ライブプレビュー付きの同じトークンを表示します。

次の例は、複数のグループからのトークンを組み合わせています。ブランドアクセント、プランモードボーダー、diff 背景、および全画面メッセージ背景です。

```json ~/.claude/themes/midnight.json theme={null}
{
  "name": "Midnight",
  "base": "dark",
  "overrides": {
    "claude": "#a78bfa",
    "planMode": "#38bdf8",
    "diffAdded": "#14532d",
    "diffRemoved": "#7f1d1d",
    "userMessageBackground": "#1e1b4b"
  }
}
```

#### テキストとアクセントカラー

プライマリブランドアクセントと、インターフェース全体で使用されるフォアグラウンドテキストの色合いを制御します。

| トークン | 制御対象 |
| :- | :- |
| `claude` | プライマリブランドアクセント。スピナーとアシスタントラベルに使用されます |
| `text` | デフォルトのフォアグラウンドテキスト |
| `inverseText` | ステータスバッジなど、色付き背景の上に描画されるテキスト |
| `inactive` | ヒント、タイムスタンプ、無効化されたアイテムなどのセカンダリテキスト |
| `subtle` | 薄いボーダーと強調されていないセカンダリテキスト |
| `suggestion` | オートコンプリート候補とピッカーの選択ハイライト |
| `permission` | パーミッションプロンプトとピッカーを含むダイアログボーダー |
| `remember` | メモリと `CLAUDE.md` インジケーター |

#### ステータスカラー

メッセージとインジケーター全体で成功、失敗、警告状態を通知します。

| トークン | 制御対象 |
| :- | :- |
| `success` | 成功メッセージと合格チェック |
| `error` | エラーメッセージと失敗 |
| `warning` | 警告、注意メッセージ、および自動モードボーダー |
| `merged` | マージされたプルリクエストステータス |

#### 入力ボックスとモードインジケーター

入力ボックスのボーダーカラーと、パーミッションモードまたはインジケーターがアクティブな間に表示されるアクセントを設定します。

| トークン | 制御対象 |
| :- | :- |
| `promptBorder` | デフォルトパーミッションモードの入力ボックスボーダー |
| `planMode` | プランモードアクセントとボーダー |
| `autoAccept` | 受け入れ編集モードアクセントとボーダー |
| `bashBorder` | `!` シェルコマンドを入力するときの入力ボックスボーダー |
| `ide` | IDE 接続インジケーター |
| `fastMode` | 高速モードインジケーター |

#### Diff レンダリング

ファイル編集とレビューで追加および削除されたコードに色を付けます。

| トークン | 制御対象 |
| :- | :- |
| `diffAdded` | 追加された行の背景 |
| `diffRemoved` | 削除された行の背景 |
| `diffAddedDimmed` | 追加された行の近くの変更されていないコンテキストの背景 |
| `diffRemovedDimmed` | 削除された行の近くの変更されていないコンテキストの背景 |
| `diffAddedWord` | 追加された行内の単語レベルのハイライト |
| `diffRemovedWord` | 削除された行内の単語レベルのハイライト |

#### 全画面モード

[全画面レンダリングモード](/ja/fullscreen) でのみ適用されます。メッセージは背景塗りつぶしを持ちます。

| トークン | 制御対象 |
| :- | :- |
| `userMessageBackground` | トランスクリプト内のメッセージの背後の背景 |
| `userMessageBackgroundHover` | ホバーまたは展開中のメッセージの背後の背景 |
| `messageActionsBackground` | アクションバーが開いているときの選択されたメッセージの背後の背景 |
| `bashMessageBackgroundColor` | トランスクリプト内の `!` シェルコマンドエントリの背後の背景 |
| `memoryBackgroundColor` | トランスクリプト内の `#` メモリエントリの背後の背景 |
| `selectionBg` | マウスで選択されたテキストの背景 |

#### 使用量メーターとスピーカーラベル

`/usage` ビューに表示されるバーと、メッセージを区別するラベルを調整します。

| トークン | 制御対象 |
| :- | :- |
| `rate_limit_fill` | 使用量メーターの塗りつぶされた部分 |
| `rate_limit_empty` | 使用量メーターの塗りつぶされていない部分 |
| `briefLabelYou` | メッセージの `You` ラベルの色 |
| `briefLabelClaude` | アシスタントメッセージの `Claude` ラベルの色 |

#### シマー変種とサブエージェントカラー

複数のトークンにはペアになったシマー変種があり、スピナーのアニメーション化されたグラデーションで使用される明るい色を提供します。アニメーションが一致しないように見える場合は、ベーストークンと一緒にシマーをオーバーライドします。

- `claude` と `claudeShimmer`
- `warning` と `warningShimmer`
- `permission` と `permissionShimmer`
- `promptBorder` と `promptBorderShimmer`
- `inactive` と `inactiveShimmer`
- `fastMode` と `fastModeShimmer`

各 [サブエージェント](/ja/sub-agents) と並列タスクは、トランスクリプト内で区別できるように、8 つの名前付きカラーの 1 つで表示されます。トークン名は `<color>_FOR_SUBAGENTS_ONLY` パターンに従います。ここで `<color>` は `red`、`blue`、`green`、`yellow`、`purple`、`orange`、`pink`、または `cyan` です。これらをオーバーライドして、各名前付きカラーの外観を変更します。たとえば、定義に `color: blue` を持つサブエージェントは、`blue_FOR_SUBAGENTS_ONLY` 値を使用して描画されます。

[`ultrathink`](/ja/model-config#use-ultrathink-for-one-off-deep-reasoning) と [`ultraplan`](/ja/ultraplan) キーワードはプロンプト入力で 7 色のレインボーグラデーションでレンダリングされます。トークン名は `rainbow_<color>` と `rainbow_<color>_shimmer` パターンに従います。ここで `<color>` は `red`、`orange`、`yellow`、`green`、`blue`、`indigo`、または `violet` です。

## フルスクリーンレンダリングに切り替える

Claude が作業中に表示がちらつくか、スクロール位置がジャンプする場合は、[フルスクリーンレンダリングモード](/ja/fullscreen) に切り替えます。ターミナルが通常のスクロールバックに追加する代わりに、フルスクリーンアプリ用に予約されている別のスクリーンに描画します。これにより、メモリ使用量が一定に保たれ、スクロールと選択のマウスサポートが追加されます。このモードでは、ターミナルのネイティブスクロールバックではなく、マウスまたは PageUp で Claude Code 内をスクロールします。検索とコピーの方法については、[フルスクリーンページ](/ja/fullscreen#search-and-review-the-conversation) を参照してください。

`/tui fullscreen` を実行して、会話をそのままにして現在のセッションで切り替えます。デフォルトにするには、Claude Code を開始する前に `CLAUDE_CODE_NO_FLICKER` 環境変数を設定します。

```bash Bash と Zsh theme={null}
CLAUDE_CODE_NO_FLICKER=1 claude
```

```powershell PowerShell theme={null}
$env:CLAUDE_CODE_NO_FLICKER = "1"; claude
```

```json ~/.claude/settings.json theme={null}
{
  "env": {
    "CLAUDE_CODE_NO_FLICKER": "1"
  }
}
```

## 大量のコンテンツを貼り付ける

プロンプトに 10,000 文字以上を貼り付けると、Claude Code は入力を `[Pasted text]` プレースホルダーに折りたたんで、入力ボックスが使用可能なままになります。完全なコンテンツは送信時に Claude に送信されます。

VS Code 統合ターミナルは、Claude Code に到達する前に非常に大きな貼り付けから文字をドロップできるため、そこではファイルベースのワークフローを優先します。ファイル全体や長いログなどの非常に大きな入力の場合は、コンテンツをファイルに書き込み、貼り付けの代わりに Claude に読み込むよう依頼します。これにより、会話トランスクリプトが読みやすくなり、Claude が後の手番でパスでファイルを参照できます。

## Vim キーバインディングでプロンプトを編集する

Claude Code には、プロンプト入力用の Vim スタイルの編集モードが含まれています。`/config` → エディタモードを通じて有効にするか、`~/.claude/settings.json` で [`editorMode`](/ja/settings#available-settings) を `"vim"` に設定します。エディタモードを `normal` に戻してオフにします。

Vim モードは NORMAL モードおよび VISUAL モードのモーションと演算子のサブセットをサポートしています。例えば、`hjkl` ナビゲーション、`v`/`V` 選択、およびテキストオブジェクトを使用した `d`/`c`/`y` などです。完全なキーテーブルについては、[Vim エディタモードリファレンス](/ja/interactive-mode#vim-editor-mode) を参照してください。Vim モーションはキーバインディングファイルを通じて再マップできません。

INSERT モードで Enter キーを押すと、標準 Vim とは異なり、プロンプトが送信されます。代わりに改行を挿入するには、NORMAL モードで `o` または `O` を使用するか、Ctrl+J を使用します。

## 関連リソース

- [インタラクティブモード](/ja/interactive-mode)：完全なキーボードショートカットリファレンスと Vim キーテーブル
- [キーバインディング](/ja/keybindings)：Enter と Shift+Enter を含む任意の Claude Code ショートカットを再マップ
- [フルスクリーンレンダリング](/ja/fullscreen)：フルスクリーンモードでのスクロール、検索、コピーの詳細
- [フック ガイド](/ja/hooks-guide)：Linux と Windows の詳細な通知フック例
- [トラブルシューティング](/ja/troubleshooting)：ターミナル設定外の問題の修正
