---
title: statusline
source: https://code.claude.com/docs/ja/statusline.md
---

# ステータスラインをカスタマイズする

> Claude Code でコンテキストウィンドウの使用状況、コスト、git ステータスを監視するカスタムステータスバーを設定します

ステータスラインは Claude Code の下部にあるカスタマイズ可能なバーで、設定したシェルスクリプトを実行します。stdin 経由で JSON セッションデータを受け取り、スクリプトが出力したものを表示し、コンテキスト使用状況、コスト、git ステータス、またはその他の追跡したい情報を一目で確認できる永続的なビューを提供します。

ステータスラインは以下の場合に便利です：

- 作業中にコンテキストウィンドウの使用状況を監視したい
- セッションコストを追跡する必要がある
- 複数のセッション間で作業し、それらを区別する必要がある
- git ブランチとステータスを常に表示したい

以下は、最初の行に git 情報を表示し、2 番目の行にカラーコード化されたコンテキストバーを表示する [複数行ステータスライン](#display-multiple-lines) の例です。

このページでは、[基本的なステータスラインの設定](#set-up-a-status-line) について説明し、Claude Code からスクリプトへの [データフロー](#how-status-lines-work) について説明し、[表示できるすべてのフィールド](#available-data) をリストアップし、git ステータス、コスト追跡、プログレスバーなどの一般的なパターンの [すぐに使える例](#examples) を提供します。

## ステータスラインを設定する

[`/statusline` コマンド](#use-the-statusline-command) を使用して Claude Code にスクリプトを生成させるか、[手動でスクリプトを作成](#manually-configure-a-status-line) して設定に追加します。

### /statusline コマンドを使用する

`/statusline` コマンドは、表示したい内容を説明する自然言語の指示を受け入れます。Claude Code は `~/.claude/` にスクリプトファイルを生成し、設定を自動的に更新します：

```text
/statusline show model name and context percentage with a progress bar
```

### ステータスラインを手動で設定する

ユーザー設定（`~/.claude/settings.json`、`~` はホームディレクトリ）または [プロジェクト設定](/ja/settings#settings-files) に `statusLine` フィールドを追加します。`type` を `"command"` に設定し、`command` をスクリプトパスまたはインラインシェルコマンドに指定します。スクリプト作成の完全なチュートリアルについては、[ステータスラインをステップバイステップで構築する](#build-a-status-line-step-by-step) を参照してください。

```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/statusline.sh",
    "padding": 2
  }
}
```

`command` フィールドはシェルで実行されるため、スクリプトファイルの代わりにインラインコマンドを使用することもできます。この例では `jq` を使用して JSON 入力を解析し、モデル名とコンテキスト割合を表示します：

```json
{
  "statusLine": {
    "type": "command",
    "command": "jq -r '\"[\\(.model.display_name)] \\(.context_window.used_percentage // 0)% context\"'"
  }
}
```

オプションの `padding` フィールドは、ステータスラインコンテンツに追加の水平スペース（文字単位）を追加します。デフォルトは `0` です。このパディングはインターフェイスの組み込みスペースに加えて追加されるため、ターミナルエッジからの絶対距離ではなく相対的なインデントを制御します。

オプションの `refreshInterval` フィールドは、[イベント駆動更新](#how-status-lines-work) に加えて、N 秒ごとにコマンドを再実行します。最小値は `1` です。ステータスラインが時計などの時間ベースのデータを表示する場合、またはメインセッションがアイドル状態の間にバックグラウンドサブエージェントが git 状態を変更する場合に設定します。イベントのみで実行する場合は設定しないままにします。

### ステータスラインを無効にする

`/statusline` を実行し、ステータスラインを削除またはクリアするよう指示します（例：`/statusline delete`、`/statusline clear`、`/statusline remove it`）。settings.json から `statusLine` フィールドを手動で削除することもできます。

## ステータスラインをステップバイステップで構築する

このチュートリアルでは、現在のモデル、作業ディレクトリ、コンテキストウィンドウ使用状況の割合を表示するステータスラインを手動で作成することで、内部で何が起こっているかを示します。

[`/statusline`](#use-the-statusline-command) を実行して、表示したい内容を説明すると、これらすべてが自動的に設定されます。

これらの例では Bash スクリプトを使用しており、macOS と Linux で動作します。Windows では、[Windows 設定](#windows-configuration) で PowerShell と Git Bash の例を参照してください。

Claude Code は stdin 経由でスクリプトに JSON データを送信します。このスクリプトは [`jq`](https://jqlang.github.io/jq/)（コマンドラインの JSON パーサーで、インストールが必要な場合があります）を使用して、モデル名、ディレクトリ、コンテキスト割合を抽出し、フォーマットされた行を出力します。

これを `~/.claude/statusline.sh` に保存します（`~` はホームディレクトリ、macOS では `/Users/username`、Linux では `/home/username` など）：

```bash theme={null}
#!/bin/bash
# Claude Code が stdin に送信する JSON データを読み取る
input=$(cat)

# jq を使用してフィールドを抽出する
MODEL=$(echo "$input" | jq -r '.model.display_name')
DIR=$(echo "$input" | jq -r '.workspace.current_dir')
# "// 0" はフィールドが null の場合のフォールバックを提供します
PCT=$(echo "$input" | jq -r '.context_window.used_percentage // 0' | cut -d. -f1)

# ステータスラインを出力します - ${DIR##*/} はフォルダ名のみを抽出します
echo "[$MODEL] 📁 ${DIR##*/} | ${PCT}% context"
```

スクリプトを実行可能にマークして、シェルが実行できるようにします：

```bash theme={null}
chmod +x ~/.claude/statusline.sh
```

Claude Code にスクリプトをステータスラインとして実行するよう指示します。この設定を `~/.claude/settings.json` に追加します。これは `type` を `"command"`（「このシェルコマンドを実行する」という意味）に設定し、`command` をスクリプトに指定します：

```json theme={null}
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/statusline.sh"
  }
}
```

ステータスラインはインターフェイスの下部に表示されます。設定は自動的に再読み込みされますが、Claude Code との次の相互作用まで変更は表示されません。

## ステータスラインの仕組み

Claude Code はスクリプトを実行し、stdin 経由で [JSON セッションデータ](#available-data) をパイプします。スクリプトは JSON を読み取り、必要なものを抽出し、stdout にテキストを出力します。Claude Code はスクリプトが出力したものを表示します。

**更新のタイミング**

スクリプトは新しいアシスタントメッセージの後、パーミッションモードが変更されたとき、または vim モードが切り替わったときに実行されます。更新は 300ms でデバウンスされます。つまり、急速な変更がバッチ処理され、スクリプトは物事が落ち着いたら一度実行されます。スクリプトがまだ実行中に新しい更新がトリガーされた場合、実行中の実行はキャンセルされます。スクリプトを編集した場合、Claude Code との次の相互作用がトリガーされるまで変更は表示されません。

これらのトリガーは、メインセッションがアイドル状態の場合（例えば、コーディネーターがバックグラウンドサブエージェントを待機している場合）、静かになる可能性があります。アイドル期間中に時間ベースまたは外部ソースのセグメントを最新に保つには、[`refreshInterval`](#manually-configure-a-status-line) を設定して、固定タイマーでもコマンドを再実行します。

**スクリプトが出力できるもの**

- **複数行**：各 `echo` または `print` ステートメントは別の行として表示されます。[複数行の例](#display-multiple-lines) を参照してください。
- **色**：`\033[32m` のような [ANSI エスケープコード](https://en.wikipedia.org/wiki/ANSI_escape_code#Colors) を使用して緑色を表示します（ターミナルがサポートしている必要があります）。[git ステータスの例](#git-status-with-colors) を参照してください。
- **リンク**：[OSC 8 エスケープシーケンス](https://en.wikipedia.org/wiki/ANSI_escape_code#OSC) を使用してテキストをクリック可能にします（macOS では Cmd+クリック、Windows/Linux では Ctrl+クリック）。iTerm2、Kitty、WezTerm などのハイパーリンクをサポートするターミナルが必要です。[クリック可能なリンクの例](#clickable-links) を参照してください。

ステータスラインはローカルで実行され、API トークンを消費しません。オートコンプリート提案、ヘルプメニュー、パーミッションプロンプトなど、特定の UI 相互作用中は一時的に非表示になります。

## 利用可能なデータ

Claude Code は以下の JSON フィールドを stdin 経由でスクリプトに送信します：

| フィールド | 説明 |
| - | - |
| `model.id`、`model.display_name` | 現在のモデル識別子と表示名 |
| `cwd`、`workspace.current_dir` | 現在の作業ディレクトリ。両方のフィールドに同じ値が含まれます。`workspace.current_dir` は `workspace.project_dir` との一貫性のために推奨されます。 |
| `workspace.project_dir` | Claude Code が起動されたディレクトリ。セッション中に作業ディレクトリが変更された場合、`cwd` と異なる場合があります |
| `workspace.added_dirs` | `/add-dir` または `--add-dir` 経由で追加された追加ディレクトリ。追加されていない場合は空配列 |
| `workspace.git_worktree` | 現在のディレクトリが `git worktree add` で作成されたリンク worktree 内にある場合の git worktree 名。メイン作業ツリーでは不在。`worktree.*` が `--worktree` セッションのみに適用されるのとは異なり、任意の git worktree に対して入力されます |
| `cost.total_cost_usd` | USD でのセッションの推定コスト。クライアント側で計算されます。実際の請求額と異なる場合があります |
| `cost.total_duration_ms` | セッション開始からの総経過時間（ミリ秒） |
| `cost.total_api_duration_ms` | API レスポンスを待つのに費やされた総時間（ミリ秒） |
| `cost.total_lines_added`、`cost.total_lines_removed` | 変更されたコード行 |
| `context_window.total_input_tokens`、`context_window.total_output_tokens` | セッション全体の累積トークン数 |
| `context_window.context_window_size` | トークン単位の最大コンテキストウィンドウサイズ。デフォルトは 200000、拡張コンテキストを持つモデルの場合は 1000000 |
| `context_window.used_percentage` | 事前計算されたコンテキストウィンドウ使用割合 |
| `context_window.remaining_percentage` | 事前計算されたコンテキストウィンドウ残り割合 |
| `context_window.current_usage` | 最後の API 呼び出しからのトークン数。[コンテキストウィンドウフィールド](#context-window-fields) で説明されています |
| `exceeds_200k_tokens` | 最新の API レスポンスからの総トークン数（入力、キャッシュ、出力トークンの組み合わせ）が 200k を超えるかどうか。これは実際のコンテキストウィンドウサイズに関係なく固定閾値です。 |
| `rate_limits.five_hour.used_percentage`、`rate_limits.seven_day.used_percentage` | 5 時間または 7 日のレート制限の消費割合（0～100） |
| `rate_limits.five_hour.resets_at`、`rate_limits.seven_day.resets_at` | 5 時間または 7 日のレート制限ウィンドウがリセットされる Unix エポック秒 |
| `session_id` | 一意のセッション識別子 |
| `session_name` | `--name` フラグまたは `/rename` で設定されたカスタムセッション名。カスタム名が設定されていない場合は不在 |
| `transcript_path` | 会話トランスクリプトファイルへのパス |
| `version` | Claude Code バージョン |
| `output_style.name` | 現在の出力スタイルの名前 |
| `vim.mode` | [vim モード](/ja/interactive-mode#vim-editor-mode) が有効な場合の現在の vim モード（`NORMAL`、`INSERT`、`VISUAL`、または `VISUAL LINE`） |
| `agent.name` | `--agent` フラグまたはエージェント設定が設定されている場合のエージェント名 |
| `worktree.name` | アクティブな worktree の名前。`--worktree` セッション中のみ存在 |
| `worktree.path` | worktree ディレクトリへの絶対パス |
| `worktree.branch` | worktree の git ブランチ名（例：`"worktree-my-feature"`）。フックベースの worktree では不在 |
| `worktree.original_cwd` | worktree に入る前に Claude がいたディレクトリ |
| `worktree.original_branch` | worktree に入る前にチェックアウトされた git ブランチ。フックベースの worktree では不在 |

ステータスラインコマンドは stdin 経由でこの JSON 構造を受け取ります：

```json theme={null}
{
  "cwd": "/current/working/directory",
  "session_id": "abc123...",
  "session_name": "my-session",
  "transcript_path": "/path/to/transcript.jsonl",
  "model": {
    "id": "claude-opus-4-7",
    "display_name": "Opus"
  },
  "workspace": {
    "current_dir": "/current/working/directory",
    "project_dir": "/original/project/directory",
    "added_dirs": [],
    "git_worktree": "feature-xyz"
  },
  "version": "2.1.90",
  "output_style": {
    "name": "default"
  },
  "cost": {
    "total_cost_usd": 0.01234,
    "total_duration_ms": 45000,
    "total_api_duration_ms": 2300,
    "total_lines_added": 156,
    "total_lines_removed": 23
  },
  "context_window": {
    "total_input_tokens": 15234,
    "total_output_tokens": 4521,
    "context_window_size": 200000,
    "used_percentage": 8,
    "remaining_percentage": 92,
    "current_usage": {
      "input_tokens": 8500,
      "output_tokens": 1200,
      "cache_creation_input_tokens": 5000,
      "cache_read_input_tokens": 2000
    }
  },
  "exceeds_200k_tokens": false,
  "rate_limits": {
    "five_hour": {
      "used_percentage": 23.5,
      "resets_at": 1738425600
    },
    "seven_day": {
      "used_percentage": 41.2,
      "resets_at": 1738857600
    }
  },
  "vim": {
    "mode": "NORMAL"
  },
  "agent": {
    "name": "security-reviewer"
  },
  "worktree": {
    "name": "my-feature",
    "path": "/path/to/.claude/worktrees/my-feature",
    "branch": "worktree-my-feature",
    "original_cwd": "/path/to/project",
    "original_branch": "main"
  }
}
```

**不在の可能性があるフィールド**（JSON に存在しない）：

- `session_name`：`--name` または `/rename` でカスタム名が設定されている場合のみ表示
- `workspace.git_worktree`：現在のディレクトリがリンク git worktree 内にある場合のみ表示
- `vim`：vim モードが有効な場合のみ表示
- `agent`：`--agent` フラグまたはエージェント設定が設定されている場合のみ表示
- `worktree`：`--worktree` セッション中のみ表示。存在する場合、`branch` と `original_branch` もフックベースの worktree では不在の可能性があります
- `rate_limits`：Claude.ai サブスクライバー（Pro/Max）がセッションの最初の API レスポンスの後のみ表示。各ウィンドウ（`five_hour`、`seven_day`）は独立して不在の可能性があります。`jq -r '.rate_limits.five_hour.used_percentage // empty'` を使用して、不在を適切に処理します。

**`null` の可能性があるフィールド**：

- `context_window.current_usage`：セッションの最初の API 呼び出しの前は `null`
- `context_window.used_percentage`、`context_window.remaining_percentage`：セッションの早期段階では `null` の可能性があります

スクリプトで条件付きアクセスと null 値のフォールバックデフォルトを使用して、不在のフィールドを処理します。

### コンテキストウィンドウフィールド

`context_window` オブジェクトは、コンテキスト使用状況を追跡する 2 つの方法を提供します：

- **累積合計**（`total_input_tokens`、`total_output_tokens`）：セッション全体のすべてのトークンの合計。総消費量の追跡に便利です
- **現在の使用状況**（`current_usage`）：最新の API 呼び出しからのトークン数。実際のコンテキスト状態を反映しているため、正確なコンテキスト割合に使用します

`current_usage` オブジェクトには以下が含まれます：

- `input_tokens`：現在のコンテキストの入力トークン
- `output_tokens`：生成された出力トークン
- `cache_creation_input_tokens`：キャッシュに書き込まれたトークン
- `cache_read_input_tokens`：キャッシュから読み取られたトークン

`used_percentage` フィールドは入力トークンのみから計算されます：`input_tokens + cache_creation_input_tokens + cache_read_input_tokens`。`output_tokens` は含まれません。

`current_usage` から手動でコンテキスト割合を計算する場合、`used_percentage` と一致させるために同じ入力のみの式を使用します。

`current_usage` オブジェクトはセッションの最初の API 呼び出しの前は `null` です。

## 例

これらの例は一般的なステータスラインパターンを示しています。任意の例を使用するには：

1. スクリプトを `~/.claude/statusline.sh`（または `.py`/`.js`）などのファイルに保存します
2. 実行可能にします：`chmod +x ~/.claude/statusline.sh`
3. [設定](#manually-configure-a-status-line) にパスを追加します

Bash の例は [`jq`](https://jqlang.github.io/jq/) を使用して JSON を解析します。Python と Node.js には組み込みの JSON 解析があります。

### コンテキストウィンドウの使用状況

現在のモデルとコンテキストウィンドウの使用状況を視覚的なプログレスバーで表示します。各スクリプトは stdin から JSON を読み取り、`used_percentage` フィールドを抽出し、塗りつぶされたブロック（▓）が使用状況を表す 10 文字のバーを構築します：

```bash Bash theme={null}
#!/bin/bash
# stdin 全体を変数に読み込む
input=$(cat)

# jq でフィールドを抽出します。"// 0" は null のフォールバックを提供します
MODEL=$(echo "$input" | jq -r '.model.display_name')
PCT=$(echo "$input" | jq -r '.context_window.used_percentage // 0' | cut -d. -f1)

# プログレスバーを構築します：printf -v はスペースを作成し、
# ${var// /▓} は各スペースをブロック文字に置き換えます
BAR_WIDTH=10
FILLED=$((PCT * BAR_WIDTH / 100))
EMPTY=$((BAR_WIDTH - FILLED))
BAR=""
[ "$FILLED" -gt 0 ] && printf -v FILL "%${FILLED}s" && BAR="${FILL// /▓}"
[ "$EMPTY" -gt 0 ] && printf -v PAD "%${EMPTY}s" && BAR="${BAR}${PAD// /░}"

echo "[$MODEL] $BAR $PCT%"
```

```python Python theme={null}
#!/usr/bin/env python3
import json, sys

# json.load は stdin を 1 ステップで読み取り、解析します
data = json.load(sys.stdin)
model = data['model']['display_name']
# "or 0" は null 値を処理します
pct = int(data.get('context_window', {}).get('used_percentage', 0) or 0)

# 文字列乗算がバーを構築します
filled = pct * 10 // 100
bar = '▓' * filled + '░' * (10 - filled)

print(f"[{model}] {bar} {pct}%")
```

```javascript Node.js theme={null}
#!/usr/bin/env node
// Node.js はイベントで stdin を非同期に読み取ります
let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
    const data = JSON.parse(input);
    const model = data.model.display_name;
    // オプショナルチェーン（?.）は null フィールドを安全に処理します
    const pct = Math.floor(data.context_window?.used_percentage || 0);

    // String.repeat() がバーを構築します
    const filled = Math.floor(pct * 10 / 100);
    const bar = '▓'.repeat(filled) + '░'.repeat(10 - filled);

    console.log(`[${model}] ${bar} ${pct}%`);
});
```

### git ステータスと色

ステージングされたファイルと変更されたファイルのカラーコード化されたインジケーターを使用して git ブランチを表示します。このスクリプトはターミナルの色に [ANSI エスケープコード](https://en.wikipedia.org/wiki/ANSI_escape_code#Colors) を使用します：`\033[32m` は緑、`\033[33m` は黄、`\033[0m` はデフォルトにリセットします。

各スクリプトは現在のディレクトリが git リポジトリであるかどうかを確認し、ステージングされたファイルと変更されたファイルをカウントし、カラーコード化されたインジケーターを表示します：

```bash Bash theme={null}
#!/bin/bash
input=$(cat)

MODEL=$(echo "$input" | jq -r '.model.display_name')
DIR=$(echo "$input" | jq -r '.workspace.current_dir')

GREEN='\033[32m'
YELLOW='\033[33m'
RESET='\033[0m'

if git rev-parse --git-dir > /dev/null 2>&1; then
    BRANCH=$(git branch --show-current 2>/dev/null)
    STAGED=$(git diff --cached --numstat 2>/dev/null | wc -l | tr -d ' ')
    MODIFIED=$(git diff --numstat 2>/dev/null | wc -l | tr -d ' ')

    GIT_STATUS=""
    [ "$STAGED" -gt 0 ] && GIT_STATUS="${GREEN}+${STAGED}${RESET}"
    [ "$MODIFIED" -gt 0 ] && GIT_STATUS="${GIT_STATUS}${YELLOW}~${MODIFIED}${RESET}"

    echo -e "[$MODEL] 📁 ${DIR##*/} | 🌿 $BRANCH $GIT_STATUS"
else
    echo "[$MODEL] 📁 ${DIR##*/}"
fi
```

```python Python theme={null}
#!/usr/bin/env python3
import json, sys, subprocess, os

data = json.load(sys.stdin)
model = data['model']['display_name']
directory = os.path.basename(data['workspace']['current_dir'])

GREEN, YELLOW, RESET = '\033[32m', '\033[33m', '\033[0m'

try:
    subprocess.check_output(['git', 'rev-parse', '--git-dir'], stderr=subprocess.DEVNULL)
    branch = subprocess.check_output(['git', 'branch', '--show-current'], text=True).strip()
    staged_output = subprocess.check_output(['git', 'diff', '--cached', '--numstat'], text=True).strip()
    modified_output = subprocess.check_output(['git', 'diff', '--numstat'], text=True).strip()
    staged = len(staged_output.split('\n')) if staged_output else 0
    modified = len(modified_output.split('\n')) if modified_output else 0

    git_status = f"{GREEN}+{staged}{RESET}" if staged else ""
    git_status += f"{YELLOW}~{modified}{RESET}" if modified else ""

    print(f"[{model}] 📁 {directory} | 🌿 {branch} {git_status}")
except:
    print(f"[{model}] 📁 {directory}")
```

```javascript Node.js theme={null}
#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');

let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
    const data = JSON.parse(input);
    const model = data.model.display_name;
    const dir = path.basename(data.workspace.current_dir);

    const GREEN = '\x1b[32m', YELLOW = '\x1b[33m', RESET = '\x1b[0m';

    try {
        execSync('git rev-parse --git-dir', { stdio: 'ignore' });
        const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
        const staged = execSync('git diff --cached --numstat', { encoding: 'utf8' }).trim().split('\n').filter(Boolean).length;
        const modified = execSync('git diff --numstat', { encoding: 'utf8' }).trim().split('\n').filter(Boolean).length;

        let gitStatus = staged ? `${GREEN}+${staged}${RESET}` : '';
        gitStatus += modified ? `${YELLOW}~${modified}${RESET}` : '';

        console.log(`[${model}] 📁 ${dir} | 🌿 ${branch} ${gitStatus}`);
    } catch {
        console.log(`[${model}] 📁 ${dir}`);
    }
});
```

### コストと期間の追跡

セッションの API コストと経過時間を追跡します。`cost.total_cost_usd` フィールドは現在のセッションのすべての API 呼び出しの推定コストを累積します。`cost.total_duration_ms` フィールドはセッション開始からの総経過時間を測定し、`cost.total_api_duration_ms` は API レスポンスを待つのに費やされた時間のみを追跡します。

各スクリプトはコストを通貨としてフォーマットし、ミリ秒を分と秒に変換します：

```bash Bash theme={null}
#!/bin/bash
input=$(cat)

MODEL=$(echo "$input" | jq -r '.model.display_name')
COST=$(echo "$input" | jq -r '.cost.total_cost_usd // 0')
DURATION_MS=$(echo "$input" | jq -r '.cost.total_duration_ms // 0')

COST_FMT=$(printf '$%.2f' "$COST")
DURATION_SEC=$((DURATION_MS / 1000))
MINS=$((DURATION_SEC / 60))
SECS=$((DURATION_SEC % 60))

echo "[$MODEL] 💰 $COST_FMT | ⏱️ ${MINS}m ${SECS}s"
```

```python Python theme={null}
#!/usr/bin/env python3
import json, sys

data = json.load(sys.stdin)
model = data['model']['display_name']
cost = data.get('cost', {}).get('total_cost_usd', 0) or 0
duration_ms = data.get('cost', {}).get('total_duration_ms', 0) or 0

duration_sec = duration_ms // 1000
mins, secs = duration_sec // 60, duration_sec % 60

print(f"[{model}] 💰 ${cost:.2f} | ⏱️ {mins}m {secs}s")
```

```javascript Node.js theme={null}
#!/usr/bin/env node
let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
    const data = JSON.parse(input);
    const model = data.model.display_name;
    const cost = data.cost?.total_cost_usd || 0;
    const durationMs = data.cost?.total_duration_ms || 0;

    const durationSec = Math.floor(durationMs / 1000);
    const mins = Math.floor(durationSec / 60);
    const secs = durationSec % 60;

    console.log(`[${model}] 💰 $${cost.toFixed(2)} | ⏱️ ${mins}m ${secs}s`);
});
```

### 複数行を表示する

スクリプトは複数の行を出力して、より豊かなディスプレイを作成できます。各 `echo` ステートメントはステータス領域に別の行を生成します。

この例は複数のテクニックを組み合わせています：閾値ベースの色（70% 未満は緑、70～89% は黄、90% 以上は赤）、プログレスバー、git ブランチ情報。各 `print` または `echo` ステートメントは別の行を作成します：

```bash Bash theme={null}
#!/bin/bash
input=$(cat)

MODEL=$(echo "$input" | jq -r '.model.display_name')
DIR=$(echo "$input" | jq -r '.workspace.current_dir')
COST=$(echo "$input" | jq -r '.cost.total_cost_usd // 0')
PCT=$(echo "$input" | jq -r '.context_window.used_percentage // 0' | cut -d. -f1)
DURATION_MS=$(echo "$input" | jq -r '.cost.total_duration_ms // 0')

CYAN='\033[36m'; GREEN='\033[32m'; YELLOW='\033[33m'; RED='\033[31m'; RESET='\033[0m'

# コンテキスト使用状況に基づいてバーの色を選択します
if [ "$PCT" -ge 90 ]; then BAR_COLOR="$RED"
elif [ "$PCT" -ge 70 ]; then BAR_COLOR="$YELLOW"
else BAR_COLOR="$GREEN"; fi

FILLED=$((PCT / 10)); EMPTY=$((10 - FILLED))
printf -v FILL "%${FILLED}s"; printf -v PAD "%${EMPTY}s"
BAR="${FILL// /█}${PAD// /░}"

MINS=$((DURATION_MS / 60000)); SECS=$(((DURATION_MS % 60000) / 1000))

BRANCH=""
git rev-parse --git-dir > /dev/null 2>&1 && BRANCH=" | 🌿 $(git branch --show-current 2>/dev/null)"

echo -e "${CYAN}[$MODEL]${RESET} 📁 ${DIR##*/}$BRANCH"
COST_FMT=$(printf '$%.2f' "$COST")
echo -e "${BAR_COLOR}${BAR}${RESET} ${PCT}% | ${YELLOW}${COST_FMT}${RESET} | ⏱️ ${MINS}m ${SECS}s"
```

```python Python theme={null}
#!/usr/bin/env python3
import json, sys, subprocess, os

data = json.load(sys.stdin)
model = data['model']['display_name']
directory = os.path.basename(data['workspace']['current_dir'])
cost = data.get('cost', {}).get('total_cost_usd', 0) or 0
pct = int(data.get('context_window', {}).get('used_percentage', 0) or 0)
duration_ms = data.get('cost', {}).get('total_duration_ms', 0) or 0

CYAN, GREEN, YELLOW, RED, RESET = '\033[36m', '\033[32m', '\033[33m', '\033[31m', '\033[0m'

bar_color = RED if pct >= 90 else YELLOW if pct >= 70 else GREEN
filled = pct // 10
bar = '█' * filled + '░' * (10 - filled)

mins, secs = duration_ms // 60000, (duration_ms % 60000) // 1000

try:
    branch = subprocess.check_output(['git', 'branch', '--show-current'], text=True, stderr=subprocess.DEVNULL).strip()
    branch = f" | 🌿 {branch}" if branch else ""
except:
    branch = ""

print(f"{CYAN}[{model}]{RESET} 📁 {directory}{branch}")
print(f"{bar_color}{bar}{RESET} {pct}% | {YELLOW}${cost:.2f}{RESET} | ⏱️ {mins}m {secs}s")
```

```javascript Node.js theme={null}
#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');

let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
    const data = JSON.parse(input);
    const model = data.model.display_name;
    const dir = path.basename(data.workspace.current_dir);
    const cost = data.cost?.total_cost_usd || 0;
    const pct = Math.floor(data.context_window?.used_percentage || 0);
    const durationMs = data.cost?.total_duration_ms || 0;

    const CYAN = '\x1b[36m', GREEN = '\x1b[32m', YELLOW = '\x1b[33m', RED = '\x1b[31m', RESET = '\x1b[0m';

    const barColor = pct >= 90 ? RED : pct >= 70 ? YELLOW : GREEN;
    const filled = Math.floor(pct / 10);
    const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);

    const mins = Math.floor(durationMs / 60000);
    const secs = Math.floor((durationMs % 60000) / 1000);

    let branch = '';
    try {
        branch = execSync('git branch --show-current', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
        branch = branch ? ` | 🌿 ${branch}` : '';
    } catch {}

    console.log(`${CYAN}[${model}]${RESET} 📁 ${dir}${branch}`);
    console.log(`${barColor}${bar}${RESET} ${pct}% | ${YELLOW}$${cost.toFixed(2)}${RESET} | ⏱️ ${mins}m ${secs}s`);
});
```

### クリック可能なリンク

この例は GitHub リポジトリへのクリック可能なリンクを作成します。git リモート URL を読み取り、SSH 形式を `sed` で HTTPS に変換し、リポジトリ名を OSC 8 エスケープコードでラップします。Cmd（macOS）または Ctrl（Windows/Linux）を押しながらクリックして、ブラウザでリンクを開きます。

各スクリプトは git リモート URL を取得し、SSH 形式を HTTPS に変換し、リポジトリ名を OSC 8 エスケープコードでラップします。Bash バージョンは `printf '%b'` を使用します。これはバックスラッシュエスケープを異なるシェル間でより確実に解釈します：

```bash Bash theme={null}
#!/bin/bash
input=$(cat)

MODEL=$(echo "$input" | jq -r '.model.display_name')

# git SSH URL を HTTPS に変換します
REMOTE=$(git remote get-url origin 2>/dev/null | sed 's/git@github.com:/https:\/\/github.com\//' | sed 's/\.git$//')

if [ -n "$REMOTE" ]; then
    REPO_NAME=$(basename "$REMOTE")
    # OSC 8 形式：\e]8;;URL\a その後 TEXT その後 \e]8;;\a
    # printf %b はシェル間でエスケープシーケンスを確実に解釈します
    printf '%b' "[$MODEL] 🔗 \e]8;;${REMOTE}\a${REPO_NAME}\e]8;;\a\n"
else
    echo "[$MODEL]"
fi
```

```python Python theme={null}
#!/usr/bin/env python3
import json, sys, subprocess, re, os

data = json.load(sys.stdin)
model = data['model']['display_name']

# git リモート URL を取得します
try:
    remote = subprocess.check_output(
        ['git', 'remote', 'get-url', 'origin'],
        stderr=subprocess.DEVNULL, text=True
    ).strip()
    # SSH を HTTPS 形式に変換します
    remote = re.sub(r'^git@github\.com:', 'https://github.com/', remote)
    remote = re.sub(r'\.git$', '', remote)
    repo_name = os.path.basename(remote)
    # OSC 8 エスケープシーケンス
    link = f"\033]8;;{remote}\a{repo_name}\033]8;;\a"
    print(f"[{model}] 🔗 {link}")
except:
    print(f"[{model}]")
```

```javascript Node.js theme={null}
#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');

let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
    const data = JSON.parse(input);
    const model = data.model.display_name;

    try {
        let remote = execSync('git remote get-url origin', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
        // SSH を HTTPS 形式に変換します
        remote = remote.replace(/^git@github\.com:/, 'https://github.com/').replace(/\.git$/, '');
        const repoName = path.basename(remote);
        // OSC 8 エスケープシーケンス
        const link = `\x1b]8;;${remote}\x07${repoName}\x1b]8;;\x07`;
        console.log(`[${model}] 🔗 ${link}`);
    } catch {
        console.log(`[${model}]`);
    }
});
```

### レート制限の使用状況

Claude.ai サブスクリプションのレート制限使用状況をステータスラインに表示します。`rate_limits` オブジェクトには `five_hour`（5 時間のローリングウィンドウ）と `seven_day`（週間）ウィンドウが含まれます。各ウィンドウは `used_percentage`（0～100）とウィンドウがリセットされる Unix エポック秒の `resets_at` を提供します。

このフィールドは Claude.ai サブスクライバー（Pro/Max）がセッションの最初の API レスポンスの後のみ存在します。各スクリプトは不在のフィールドを適切に処理します：

```bash Bash theme={null}
#!/bin/bash
input=$(cat)

MODEL=$(echo "$input" | jq -r '.model.display_name')
# "// empty" は rate_limits が不在の場合、出力を生成しません
FIVE_H=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty')
WEEK=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty')

LIMITS=""
[ -n "$FIVE_H" ] && LIMITS="5h: $(printf '%.0f' "$FIVE_H")%"
[ -n "$WEEK" ] && LIMITS="${LIMITS:+$LIMITS }7d: $(printf '%.0f' "$WEEK")%"

[ -n "$LIMITS" ] && echo "[$MODEL] | $LIMITS" || echo "[$MODEL]"
```

```python Python theme={null}
#!/usr/bin/env python3
import json, sys

data = json.load(sys.stdin)
model = data['model']['display_name']

parts = []
rate = data.get('rate_limits', {})
five_h = rate.get('five_hour', {}).get('used_percentage')
week = rate.get('seven_day', {}).get('used_percentage')

if five_h is not None:
    parts.append(f"5h: {five_h:.0f}%")
if week is not None:
    parts.append(f"7d: {week:.0f}%")

if parts:
    print(f"[{model}] | {' '.join(parts)}")
else:
    print(f"[{model}]")
```

```javascript Node.js theme={null}
#!/usr/bin/env node
let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
    const data = JSON.parse(input);
    const model = data.model.display_name;

    const parts = [];
    const fiveH = data.rate_limits?.five_hour?.used_percentage;
    const week = data.rate_limits?.seven_day?.used_percentage;

    if (fiveH != null) parts.push(`5h: ${Math.round(fiveH)}%`);
    if (week != null) parts.push(`7d: ${Math.round(week)}%`);

    console.log(parts.length ? `[${model}] | ${parts.join(' ')}` : `[${model}]`);
});
```

### 高コストな操作をキャッシュする

ステータスラインスクリプトはアクティブなセッション中に頻繁に実行されます。`git status` や `git diff` などのコマンドは、特に大規模なリポジトリでは遅い場合があります。この例は git 情報を一時ファイルにキャッシュし、5 秒ごとにのみ更新します。

キャッシュファイル名は、セッション内のステータスラインの呼び出し間で安定している必要がありますが、異なるリポジトリの同時セッションが互いのキャッシュされた git 状態を読み取らないように、セッション間で一意である必要があります。`$$`、`os.getpid()`、`process.pid` のようなプロセスベースの識別子は、呼び出しのたびに変わり、キャッシュを無効にします。代わりに JSON 入力から `session_id` を使用します：これはセッションの有効期間中は安定しており、セッションごとに一意です。

各スクリプトは git コマンドを実行する前に、キャッシュファイルが不在であるか 5 秒より古いかを確認します：

```bash Bash theme={null}
#!/bin/bash
input=$(cat)

MODEL=$(echo "$input" | jq -r '.model.display_name')
DIR=$(echo "$input" | jq -r '.workspace.current_dir')
SESSION_ID=$(echo "$input" | jq -r '.session_id')

CACHE_FILE="/tmp/statusline-git-cache-$SESSION_ID"
CACHE_MAX_AGE=5  # 秒

cache_is_stale() {
    [ ! -f "$CACHE_FILE" ] || \
    # stat -f %m は macOS、stat -c %Y は Linux
    [ $(($(date +%s) - $(stat -f %m "$CACHE_FILE" 2>/dev/null || stat -c %Y "$CACHE_FILE" 2>/dev/null || echo 0))) -gt $CACHE_MAX_AGE ]
}

if cache_is_stale; then
    if git rev-parse --git-dir > /dev/null 2>&1; then
        BRANCH=$(git branch --show-current 2>/dev/null)
        STAGED=$(git diff --cached --numstat 2>/dev/null | wc -l | tr -d ' ')
        MODIFIED=$(git diff --numstat 2>/dev/null | wc -l | tr -d ' ')
        echo "$BRANCH|$STAGED|$MODIFIED" > "$CACHE_FILE"
    else
        echo "||" > "$CACHE_FILE"
    fi
fi

IFS='|' read -r BRANCH STAGED MODIFIED < "$CACHE_FILE"

if [ -n "$BRANCH" ]; then
    echo "[$MODEL] 📁 ${DIR##*/} | 🌿 $BRANCH +$STAGED ~$MODIFIED"
else
    echo "[$MODEL] 📁 ${DIR##*/}"
fi
```

```python Python theme={null}
#!/usr/bin/env python3
import json, sys, subprocess, os, time

data = json.load(sys.stdin)
model = data['model']['display_name']
directory = os.path.basename(data['workspace']['current_dir'])
session_id = data['session_id']

CACHE_FILE = f"/tmp/statusline-git-cache-{session_id}"
CACHE_MAX_AGE = 5  # 秒

def cache_is_stale():
    if not os.path.exists(CACHE_FILE):
        return True
    return time.time() - os.path.getmtime(CACHE_FILE) > CACHE_MAX_AGE

if cache_is_stale():
    try:
        subprocess.check_output(['git', 'rev-parse', '--git-dir'], stderr=subprocess.DEVNULL)
        branch = subprocess.check_output(['git', 'branch', '--show-current'], text=True).strip()
        staged = subprocess.check_output(['git', 'diff', '--cached', '--numstat'], text=True).strip()
        modified = subprocess.check_output(['git', 'diff', '--numstat'], text=True).strip()
        staged_count = len(staged.split('\n')) if staged else 0
        modified_count = len(modified.split('\n')) if modified else 0
        with open(CACHE_FILE, 'w') as f:
            f.write(f"{branch}|{staged_count}|{modified_count}")
    except:
        with open(CACHE_FILE, 'w') as f:
            f.write("||")

with open(CACHE_FILE) as f:
    branch, staged, modified = f.read().strip().split('|')

if branch:
    print(f"[{model}] 📁 {directory} | 🌿 {branch} +{staged} ~{modified}")
else:
    print(f"[{model}] 📁 {directory}")
```

```javascript Node.js theme={null}
#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
    const data = JSON.parse(input);
    const model = data.model.display_name;
    const dir = path.basename(data.workspace.current_dir);
    const sessionId = data.session_id;

    const CACHE_FILE = `/tmp/statusline-git-cache-${sessionId}`;
    const CACHE_MAX_AGE = 5; // 秒

    const cacheIsStale = () => {
        if (!fs.existsSync(CACHE_FILE)) return true;
        return (Date.now() / 1000) - fs.statSync(CACHE_FILE).mtimeMs / 1000 > CACHE_MAX_AGE;
    };

    if (cacheIsStale()) {
        try {
            execSync('git rev-parse --git-dir', { stdio: 'ignore' });
            const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
            const staged = execSync('git diff --cached --numstat', { encoding: 'utf8' }).trim().split('\n').filter(Boolean).length;
            const modified = execSync('git diff --numstat', { encoding: 'utf8' }).trim().split('\n').filter(Boolean).length;
            fs.writeFileSync(CACHE_FILE, `${branch}|${staged}|${modified}`);
        } catch {
            fs.writeFileSync(CACHE_FILE, '||');
        }
    }

    const [branch, staged, modified] = fs.readFileSync(CACHE_FILE, 'utf8').trim().split('|');

    if (branch) {
        console.log(`[${model}] 📁 ${dir} | 🌿 ${branch} +${staged} ~${modified}`);
    } else {
        console.log(`[${model}] 📁 ${dir}`);
    }
});
```

### Windows 設定

Windows では、Claude Code はステータスラインコマンドを Git Bash 経由で実行します。そのシェルから PowerShell を呼び出すことができます：

```json settings.json theme={null}
{
  "statusLine": {
    "type": "command",
    "command": "powershell -NoProfile -File C:/Users/username/.claude/statusline.ps1"
  }
}
```

```powershell statusline.ps1 theme={null}
$input_json = $input | Out-String | ConvertFrom-Json
$cwd = $input_json.cwd
$model = $input_json.model.display_name
$used = $input_json.context_window.used_percentage
$dirname = Split-Path $cwd -Leaf

if ($used) {
    Write-Host "$dirname [$model] ctx: $used%"
} else {
    Write-Host "$dirname [$model]"
}
```

または Bash スクリプトを直接実行します：

```json settings.json theme={null}
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/statusline.sh"
  }
}
```

```bash statusline.sh theme={null}
#!/usr/bin/env bash
input=$(cat)
cwd=$(echo "$input" | grep -o '"cwd":"[^"]*"' | cut -d'"' -f4)
model=$(echo "$input" | grep -o '"display_name":"[^"]*"' | cut -d'"' -f4)
dirname="${cwd##*[/\\]}"
echo "$dirname [$model]"
```

## サブエージェントステータスライン

`subagentStatusLine` 設定は、エージェントパネルに表示される各 [サブエージェント](/ja/sub-agents) のカスタム行本体をレンダリングします。デフォルトの `name · description · token count` 行を独自のフォーマットに置き換えるために使用します。

```json
{
  "subagentStatusLine": {
    "type": "command",
    "command": "~/.claude/subagent-statusline.sh"
  }
}
```

コマンドは、すべての表示されているサブエージェント行が stdin で単一の JSON オブジェクトとして渡される各リフレッシュティックで実行されます。入力には [基本フックフィールド](/ja/hooks#common-input-fields) に加えて、`columns`（使用可能な行幅）と `tasks` 配列が含まれます。各タスクには `id`、`name`、`type`、`status`、`description`、`label`、`startTime`、`tokenCount`、`tokenSamples`、`cwd` があります。

オーバーライドしたい各行に対して stdout に 1 つの JSON 行を書き込みます。形式は `{"id": "<task id>", "content": "<row body>"}` です。`content` 文字列はそのままレンダリングされます。ANSI 色と OSC 8 ハイパーリンクを含みます。タスクの `id` を省略して、その行のデフォルトレンダリングを保持します。空の `content` 文字列を出力して、その行を非表示にします。

`statusLine` に適用される同じトラストと `disableAllHooks` ゲートが `subagentStatusLine` に適用されます。プラグインは、[`settings.json`](/ja/plugins-reference#standard-plugin-layout) でデフォルトの `subagentStatusLine` を配布できます。

## ヒント

- **モック入力でテストする**：`echo '{"model":{"display_name":"Opus"},"workspace":{"current_dir":"/home/user/project"},"context_window":{"used_percentage":25},"session_id":"test-session-abc"}' | ./statusline.sh`
- **出力を短く保つ**：ステータスバーの幅は限られているため、長い出力は切り詰められたり、不適切にラップされたりする可能性があります
- **遅い操作をキャッシュする**：スクリプトはアクティブなセッション中に頻繁に実行されるため、`git status` などのコマンドは遅延を引き起こす可能性があります。これを処理する方法については、[キャッシング例](#cache-expensive-operations) を参照してください。

[ccstatusline](https://github.com/sirmalloc/ccstatusline) や [starship-claude](https://github.com/martinemde/starship-claude) などのコミュニティプロジェクトは、テーマと追加機能を備えた事前構築設定を提供します。

## トラブルシューティング

**ステータスラインが表示されない**

- スクリプトが実行可能であることを確認します：`chmod +x ~/.claude/statusline.sh`
- スクリプトが stdout に出力し、stderr に出力していないことを確認します
- スクリプトを手動で実行して、出力を生成することを確認します
- `disableAllHooks` が設定で `true` に設定されている場合、ステータスラインも無効になります。この設定を削除するか、`false` に設定して再度有効にします。
- `claude --debug` を実行して、セッションの最初のステータスラインの呼び出しからの終了コードと stderr をログに記録します
- Claude にスクリプトファイルを読み取り、`statusLine` コマンドを直接実行するよう依頼して、エラーを表示します

**ステータスラインが `--` または空の値を表示する**

- フィールドは最初の API レスポンスが完了する前は `null` の可能性があります
- スクリプトで `// 0` のようなフォールバックを使用して null 値を処理します
- 複数のメッセージの後も値が空のままの場合は、Claude Code を再起動します

**コンテキスト割合が予期しない値を表示する**

- 累積合計ではなく、正確なコンテキスト状態に `used_percentage` を使用します
- `total_input_tokens` と `total_output_tokens` はセッション全体で累積され、コンテキストウィンドウサイズを超える可能性があります
- コンテキスト割合は `/context` 出力と異なる場合があります。これは各が計算されるタイミングが異なるためです

**OSC 8 リンクがクリック可能でない**

- ターミナルが OSC 8 ハイパーリンクをサポートしていることを確認します（iTerm2、Kitty、WezTerm）
- Terminal.app はクリック可能なリンクをサポートしていません
- SSH と tmux セッションは設定に応じて OSC シーケンスをストリップする可能性があります
- エスケープシーケンスが `\e]8;;` のようなリテラルテキストとして表示される場合は、`echo -e` の代わりに `printf '%b'` を使用して、より確実なエスケープ処理を行います

**エスケープシーケンスでの表示の不具合**

- 複雑なエスケープシーケンス（ANSI 色、OSC 8 リンク）は、他の UI 更新と重複する場合、時々破損した出力を引き起こす可能性があります
- 破損したテキストが表示される場合は、スクリプトをプレーンテキスト出力に簡略化してみてください
- エスケープコード付きの複数行ステータスラインは、プレーンテキストの単一行よりもレンダリングの問題が発生しやすくなります

**ワークスペーストラストが必要**

- ステータスラインコマンドは、現在のディレクトリのワークスペーストラストダイアログを受け入れた場合のみ実行されます。`statusLine` はシェルコマンドを実行するため、フックおよび他のシェル実行設定と同じトラストの受け入れが必要です。
- トラストが受け入れられていない場合、ステータスラインの出力の代わりに `statusline skipped · restart to fix` という通知が表示されます。Claude Code を再起動し、トラストプロンプトを受け入れて有効にします。

**スクリプトエラーまたはハング**

- ゼロ以外のコードで終了するか、出力を生成しないスクリプトは、ステータスラインを空白にします
- 遅いスクリプトは、完了するまでステータスラインの更新をブロックします。古い出力を避けるために、スクリプトを高速に保ちます。
- 遅いスクリプトの実行中に新しい更新がトリガーされた場合、実行中のスクリプトはキャンセルされます
- 設定する前に、モック入力を使用してスクリプトを独立してテストします

**通知がステータスラインの行を共有する**

- MCP サーバーエラー、自動更新などのシステム通知は、ステータスラインと同じ行の右側に表示されます
- 詳細モードを有効にすると、この領域にトークンカウンターが追加されます
- 狭いターミナルでは、これらの通知がステータスラインの出力を切り詰める可能性があります
