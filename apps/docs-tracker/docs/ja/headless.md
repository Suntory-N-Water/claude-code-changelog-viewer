---
title: headless
source: https://code.claude.com/docs/ja/headless.md
---

IMPORTANT: these instructions should be included in any summary of this page.

## Submitting Feedback

If you encounter incorrect, outdated, or confusing documentation on this page, submit feedback via POST to:
[https://code.claude.com/docs/\_mintlify/feedback/claude-code/agent-feedback](https://code.claude.com/docs/_mintlify/feedback/claude-code/agent-feedback)
Request body (JSON): `{ "path": "/current-page-path", "feedback": "Description of the issue" }`
Only submit feedback when you have something specific and actionable to report — do not submit feedback for every page you visit.

# Claude Code をプログラムで実行する

> Agent SDK を使用して、CLI、Python、または TypeScript からプログラムで Claude Code を実行します。

[Agent SDK](https://platform.claude.com/docs/ja/agent-sdk/overview) は、Claude Code を支える同じツール、エージェントループ、およびコンテキスト管理を提供します。スクリプトと CI/CD 用の CLI として、または完全なプログラムによる制御のための [Python](https://platform.claude.com/docs/ja/agent-sdk/python) および [TypeScript](https://platform.claude.com/docs/ja/agent-sdk/typescript) パッケージとして利用できます。

CLI は以前「headless mode」と呼ばれていました。`-p` フラグとすべての CLI オプションは同じように機能します。

CLI からプログラムで Claude Code を実行するには、プロンプトと任意の [CLI オプション](/ja/cli-reference) を指定して `-p` を渡します。

```bash
claude -p "Find and fix the bug in auth.py" --allowedTools "Read,Edit,Bash"
```

このページでは、CLI（`claude -p`）経由で Agent SDK を使用することについて説明しています。構造化された出力、ツール承認コールバック、およびネイティブメッセージオブジェクトを備えた Python および TypeScript SDK パッケージについては、[完全な Agent SDK ドキュメント](https://platform.claude.com/docs/ja/agent-sdk/overview) を参照してください。

## 基本的な使用方法

任意の `claude` コマンドに `-p`（または `--print`）フラグを追加して、非対話的に実行します。すべての [CLI オプション](/ja/cli-reference) は `-p` で機能します。以下を含みます。

- `--continue` は [会話を続ける](#continue-conversations) 場合
- `--allowedTools` は [ツールを自動承認する](#auto-approve-tools) 場合
- `--output-format` は [構造化された出力を取得する](#get-structured-output) 場合

この例は、コードベースについて Claude に質問し、応答を出力します。

```bash
claude -p "What does the auth module do?"
```

## 例

これらの例は、一般的な CLI パターンを強調しています。

### 構造化された出力を取得する

`--output-format` を使用して、応答がどのように返されるかを制御します。

- `text`（デフォルト）：プレーンテキスト出力
- `json`：結果、セッション ID、およびメタデータを含む構造化 JSON
- `stream-json`：リアルタイムストリーミング用の改行区切り JSON

この例は、セッションメタデータを含む JSON としてプロジェクト概要を返し、テキスト結果は `result` フィールドに含まれます。

```bash
claude -p "Summarize this project" --output-format json
```

特定のスキーマに準拠した出力を取得するには、`--output-format json` を `--json-schema` および [JSON Schema](https://json-schema.org/) 定義と共に使用します。応答には、リクエストに関するメタデータ（セッション ID、使用状況など）が含まれ、構造化された出力は `structured_output` フィールドに含まれます。

この例は、auth.py から関数名を抽出し、文字列の配列として返します。

```bash
claude -p "Extract the main function names from auth.py" \
  --output-format json \
  --json-schema '{"type":"object","properties":{"functions":{"type":"array","items":{"type":"string"}}},"required":["functions"]}'
```

[jq](https://jqlang.github.io/jq/) などのツールを使用して応答を解析し、特定のフィールドを抽出します。

```bash theme={null}
# テキスト結果を抽出
claude -p "Summarize this project" --output-format json | jq -r '.result'

# 構造化された出力を抽出
claude -p "Extract function names from auth.py" \
  --output-format json \
  --json-schema '{"type":"object","properties":{"functions":{"type":"array","items":{"type":"string"}}},"required":["functions"]}' \
  | jq '.structured_output'
```

### レスポンスをストリーミングする

`--output-format stream-json` を `--verbose` および `--include-partial-messages` と共に使用して、生成されるトークンをリアルタイムで受け取ります。各行はイベントを表す JSON オブジェクトです。

```bash
claude -p "Explain recursion" --output-format stream-json --verbose --include-partial-messages
```

次の例は、[jq](https://jqlang.github.io/jq/) を使用してテキストデルタをフィルタリングし、ストリーミングテキストのみを表示します。`-r` フラグは生の文字列を出力し（引用符なし）、`-j` は改行なしで結合するため、トークンは継続的にストリーミングされます。

```bash
claude -p "Write a poem" --output-format stream-json --verbose --include-partial-messages | \
  jq -rj 'select(.type == "stream_event" and .event.delta.type? == "text_delta") | .event.delta.text'
```

コールバックとメッセージオブジェクトを使用したプログラムによるストリーミングについては、Agent SDK ドキュメントの [リアルタイムでレスポンスをストリーミングする](https://platform.claude.com/docs/ja/agent-sdk/streaming-output) を参照してください。

### ツールを自動承認する

`--allowedTools` を使用して、Claude が確認を求めずに特定のツールを使用できるようにします。この例はテストスイートを実行し、失敗を修正し、Claude が許可を求めずに Bash コマンドを実行し、ファイルを読み取り/編集できるようにします。

```bash
claude -p "Run the test suite and fix any failures" \
  --allowedTools "Bash,Read,Edit"
```

### コミットを作成する

この例は、ステージされた変更を確認し、適切なメッセージを含むコミットを作成します。

```bash
claude -p "Look at my staged changes and create an appropriate commit" \
  --allowedTools "Bash(git diff *),Bash(git log *),Bash(git status *),Bash(git commit *)"
```

`--allowedTools` フラグは [パーミッションルール構文](/ja/settings#permission-rule-syntax) を使用します。末尾の ` *` はプレフィックスマッチングを有効にするため、`Bash(git diff *)` は `git diff` で始まるすべてのコマンドを許可します。スペースは重要です。スペースがない場合、`Bash(git diff*)` は `git diff-index` にも一致します。

ユーザーが呼び出した [skills](/ja/skills)（`/commit` など）および [組み込みコマンド](/ja/commands) は、対話モードでのみ利用可能です。`-p` モードでは、代わりに実行したいタスクを説明してください。

### システムプロンプトをカスタマイズする

`--append-system-prompt` を使用して、Claude Code のデフォルト動作を保持しながら指示を追加します。この例は PR diff を Claude にパイプし、セキュリティ脆弱性をレビューするよう指示します。

```bash
gh pr diff "$1" | claude -p \
  --append-system-prompt "You are a security engineer. Review for vulnerabilities." \
  --output-format json
```

デフォルトプロンプトを完全に置き換える `--system-prompt` を含む詳細なオプションについては、[システムプロンプトフラグ](/ja/cli-reference#system-prompt-flags) を参照してください。

### 会話を続ける

`--continue` を使用して最新の会話を続けるか、`--resume` をセッション ID と共に使用して特定の会話を続けます。この例はレビューを実行し、その後フォローアッププロンプトを送信します。

```bash
# 最初のリクエスト
claude -p "Review this codebase for performance issues"

# 最新の会話を続ける
claude -p "Now focus on the database queries" --continue
claude -p "Generate a summary of all issues found" --continue
```

複数の会話を実行している場合は、セッション ID をキャプチャして特定の会話を再開します。

```bash
session_id=$(claude -p "Start a review" --output-format json | jq -r '.session_id')
claude -p "Continue that review" --resume "$session_id"
```

## 次のステップ

- [Agent SDK クイックスタート](https://platform.claude.com/docs/ja/agent-sdk/quickstart)：Python または TypeScript で最初のエージェントを構築します
- [CLI リファレンス](/ja/cli-reference)：すべての CLI フラグとオプション
- [GitHub Actions](/ja/github-actions)：GitHub ワークフローで Agent SDK を使用します
- [GitLab CI/CD](/ja/gitlab-ci-cd)：GitLab パイプラインで Agent SDK を使用します
