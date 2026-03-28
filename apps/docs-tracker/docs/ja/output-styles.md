---
title: output-styles
source: https://code.claude.com/docs/ja/output-styles.md
---

# 出力スタイル

> ソフトウェアエンジニアリング以外の用途に合わせて Claude Code をカスタマイズする

出力スタイルを使用すると、Claude Code をあらゆるタイプのエージェントとして使用できます。ローカルスクリプトの実行、ファイルの読み書き、TODO の追跡など、コアの機能を保持したままです。

## 組み込み出力スタイル

Claude Code の **Default** 出力スタイルは既存のシステムプロンプトであり、ソフトウェアエンジニアリングタスクを効率的に完了するのに役立つように設計されています。

コードベースと Claude の動作方法を教えることに焦点を当てた、2 つの追加の組み込み出力スタイルがあります。

- **Explanatory**: ソフトウェアエンジニアリングタスクの完了を支援しながら、教育的な「Insights」を提供します。実装の選択肢とコードベースのパターンを理解するのに役立ちます。

- **Learning**: 協調的な学習型モードです。Claude はコーディング中に「Insights」を共有するだけでなく、小さな戦略的なコードの一部を自分で実装するよう求めます。Claude Code はコード内に `TODO(human)` マーカーを追加して、実装するべき箇所を示します。

## 出力スタイルの仕組み

出力スタイルは Claude Code のシステムプロンプトを直接変更します。

- すべての出力スタイルは、効率的な出力のための指示（簡潔に応答するなど）を除外します。
- カスタム出力スタイルは、`keep-coding-instructions` が true でない限り、コーディングのための指示（テストでコードを検証するなど）を除外します。
- すべての出力スタイルは、システムプロンプトの最後に独自のカスタム指示が追加されます。
- すべての出力スタイルは、会話中に出力スタイルの指示に従うよう Claude に思い出させるリマインダーをトリガーします。

## 出力スタイルを変更する

`/config` を実行し、**Output style** を選択してメニューからスタイルを選択します。選択内容は [ローカルプロジェクトレベル](/ja/settings) の `.claude/settings.local.json` に保存されます。

メニューなしでスタイルを設定するには、設定ファイルの `outputStyle` フィールドを直接編集します。

```json
{
  "outputStyle": "Explanatory"
}
```

出力スタイルはセッション開始時にシステムプロンプトで設定されるため、変更は新しいセッションを開始した次回に有効になります。これにより、会話全体を通じてシステムプロンプトが安定し、プロンプトキャッシングがレイテンシとコストを削減できます。

## カスタム出力スタイルを作成する

カスタム出力スタイルは、frontmatter とシステムプロンプトに追加されるテキストを含む Markdown ファイルです。

```markdown
---
name: My Custom Style
description:
  A brief description of what this style does, to be displayed to the user
---

# Custom Style Instructions

You are an interactive CLI tool that helps users with software engineering
tasks. [Your custom instructions here...]

## Specific Behaviors

[Define how the assistant should behave in this style...]
```

これらのファイルはユーザーレベル（`~/.claude/output-styles`）またはプロジェクトレベル（`.claude/output-styles`）に保存できます。

### Frontmatter

出力スタイルファイルは、メタデータを指定するための frontmatter をサポートしています。

| Frontmatter | 目的 | デフォルト |
| :- | :- | :- |
| `name` | 出力スタイルの名前（ファイル名でない場合） | ファイル名から継承 |
| `description` | `/config` ピッカーに表示される出力スタイルの説明 | なし |
| `keep-coding-instructions` | Claude Code のシステムプロンプトのコーディング関連の部分を保持するかどうか | false |

## 関連機能との比較

### 出力スタイル vs. CLAUDE.md vs. --append-system-prompt

出力スタイルは、ソフトウェアエンジニアリング固有の Claude Code のデフォルトシステムプロンプトの部分を完全に「オフ」にします。CLAUDE.md も `--append-system-prompt` も Claude Code のデフォルトシステムプロンプトを編集しません。CLAUDE.md は内容をユーザーメッセージとして Claude Code のデフォルトシステムプロンプトの「後に」追加します。`--append-system-prompt` はコンテンツをシステムプロンプトに追加します。

### 出力スタイル vs. [Agents](/ja/sub-agents)

出力スタイルはメインエージェントループに直接影響し、システムプロンプトのみに影響します。エージェントは特定のタスクを処理するために呼び出され、使用するモデル、利用可能なツール、エージェントをいつ使用するかに関するコンテキストなどの追加設定を含めることができます。

### 出力スタイル vs. [Skills](/ja/skills)

出力スタイルは Claude の応答方法（フォーマット、トーン、構造）を変更し、選択されると常にアクティブです。Skills はタスク固有のプロンプトであり、`/skill-name` で呼び出すか、関連する場合に Claude が自動的に読み込みます。一貫したフォーマット設定を使用する場合は出力スタイルを使用します。再利用可能なワークフローとタスクの場合は Skills を使用します。
