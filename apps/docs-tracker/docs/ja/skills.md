---
title: skills
source: https://code.claude.com/docs/ja/skills.md
---

# スキルで Claude を拡張する

> Claude Code でスキルを作成、管理、共有して Claude の機能を拡張します。カスタムコマンドとバンドルされたスキルが含まれます。

スキルは Claude ができることを拡張します。`SKILL.md` ファイルに指示を記述すると、Claude はそれをツールキットに追加します。Claude は関連する場合にスキルを使用するか、`/skill-name` で直接呼び出すことができます。

`/help` や `/compact` などの組み込みコマンドについては、[組み込みコマンドリファレンス](/ja/commands)を参照してください。

**カスタムコマンドはスキルにマージされました。** `.claude/commands/deploy.md` のファイルと `.claude/skills/deploy/SKILL.md` のスキルの両方が `/deploy` を作成し、同じように機能します。既存の `.claude/commands/` ファイルは引き続き機能します。スキルは追加機能を提供します。サポートファイル用のディレクトリ、[スキルを呼び出すユーザーを制御する](#control-who-invokes-a-skill)ためのフロントマター、および Claude が関連する場合に自動的にスキルを読み込む機能です。

Claude Code スキルは [Agent Skills](https://agentskills.io) オープンスタンダードに従い、複数の AI ツール全体で機能します。Claude Code は [呼び出し制御](#control-who-invokes-a-skill)、[サブエージェント実行](#run-skills-in-a-subagent)、[動的コンテキスト注入](#inject-dynamic-context)などの追加機能でスタンダードを拡張します。

## バンドルされたスキル

バンドルされたスキルは Claude Code に付属し、すべてのセッションで利用可能です。固定ロジックを直接実行する[組み込みコマンド](/ja/commands)とは異なり、バンドルされたスキルはプロンプトベースです。Claude に詳細なプレイブックを提供し、ツールを使用して作業を調整させます。つまり、バンドルされたスキルは並列エージェントを生成し、ファイルを読み取り、コードベースに適応できます。

バンドルされたスキルは他のスキルと同じ方法で呼び出します。`/` の後にスキル名を入力します。下の表では、`<arg>` は必須引数を示し、`[arg]` はオプション引数を示します。

| スキル | 目的 |
| :- | :- |
| `/batch <instruction>` | コードベース全体の大規模な変更を並列で調整します。コードベースを調査し、作業を 5 ～ 30 個の独立したユニットに分解し、計画を提示します。承認されると、分離された [git worktree](/ja/common-workflows#run-parallel-claude-code-sessions-with-git-worktrees) 内の各ユニットごとに 1 つのバックグラウンドエージェントを生成します。各エージェントはそのユニットを実装し、テストを実行し、プルリクエストを開きます。git リポジトリが必要です。例：`/batch migrate src/ from Solid to React` |
| `/claude-api` | プロジェクトの言語（Python、TypeScript、Java、Go、Ruby、C#、PHP、または cURL）の Claude API リファレンス資料と Python および TypeScript の Agent SDK リファレンスを読み込みます。ツール使用、ストリーミング、バッチ、構造化出力、および一般的な落とし穴をカバーします。また、コードが `anthropic`、`@anthropic-ai/sdk`、または `claude_agent_sdk` をインポートする場合は自動的にアクティブになります |
| `/debug [description]` | 現在のセッションのデバッグログを読み取ることで、セッションをトラブルシューティングします。デバッグログはデフォルトではオフです。`claude --debug` で開始した場合を除き、セッション中に `/debug` を実行するとその時点からログのキャプチャを開始します。オプションで問題を説明して分析に焦点を当てます |
| `/loop [interval] <prompt>` | セッションが開いている間、プロンプトを間隔で繰り返し実行します。デプロイをポーリングしたり、PR を監視したり、別のスキルを定期的に再実行したりするのに便利です。例：`/loop 5m check if the deploy finished`。[スケジュールに従ってプロンプトを実行する](/ja/scheduled-tasks)を参照してください |
| `/simplify [focus]` | 最近変更したファイルをコード再利用、品質、効率の問題についてレビューし、修正します。3 つのレビューエージェントを並列で生成し、その結果を集約し、修正を適用します。テキストを渡して特定の懸念事項に焦点を当てます：`/simplify focus on memory efficiency` |

## はじめに

### 最初のスキルを作成する

この例は、Claude に視覚的な図と類推を使用してコードを説明するように教えるスキルを作成します。デフォルトのフロントマターを使用するため、何かの仕組みを尋ねるときに Claude が自動的にスキルを読み込むか、`/explain-code` で直接呼び出すことができます。

個人用スキルフォルダにスキル用のディレクトリを作成します。個人用スキルはすべてのプロジェクト全体で利用可能です。

```bash theme={null}
mkdir -p ~/.claude/skills/explain-code
```

すべてのスキルには `SKILL.md` ファイルが必要です。2 つの部分があります。YAML フロントマター（`---` マーカー間）は Claude にスキルをいつ使用するかを伝え、マークダウンコンテンツはスキルが呼び出されるときに Claude が従う指示です。`name` フィールドは `/slash-command` になり、`description` は Claude がスキルを自動的に読み込むかどうかを決定するのに役立ちます。

`~/.claude/skills/explain-code/SKILL.md` を作成します：

```yaml theme={null}
---
name: explain-code
description: Explains code with visual diagrams and analogies. Use when explaining how code works, teaching about a codebase, or when the user asks "how does this work?"
---

When explaining code, always include:

1. **Start with an analogy**: Compare the code to something from everyday life
2. **Draw a diagram**: Use ASCII art to show the flow, structure, or relationships
3. **Walk through the code**: Explain step-by-step what happens
4. **Highlight a gotcha**: What's a common mistake or misconception?

Keep explanations conversational. For complex concepts, use multiple analogies.
```

2 つの方法でテストできます：

**説明に一致するものを尋ねることで Claude に自動的に呼び出させます：**

```text theme={null}
How does this code work?
```

**またはスキル名で直接呼び出します：**

```text theme={null}
/explain-code src/auth/login.ts
```

どちらの方法でも、Claude の説明に類推と ASCII 図が含まれるはずです。

### スキルが存在する場所

スキルを保存する場所によって、誰がそれを使用できるかが決まります：

| 場所 | パス | 適用対象 |
| :- | :- | :- |
| Enterprise | [管理設定](/ja/settings#settings-files)を参照 | 組織内のすべてのユーザー |
| Personal | `~/.claude/skills/<skill-name>/SKILL.md` | すべてのプロジェクト |
| Project | `.claude/skills/<skill-name>/SKILL.md` | このプロジェクトのみ |
| Plugin | `<plugin>/skills/<skill-name>/SKILL.md` | プラグインが有効な場所 |

スキルがレベル全体で同じ名前を共有する場合、優先度の高い場所が優先されます：enterprise > personal > project。プラグインスキルは `plugin-name:skill-name` 名前空間を使用するため、他のレベルと競合することはできません。`.claude/commands/` にファイルがある場合、それらは同じように機能しますが、スキルとコマンドが同じ名前を共有する場合、スキルが優先されます。

#### ネストされたディレクトリからの自動検出

サブディレクトリ内のファイルを操作する場合、Claude Code はネストされた `.claude/skills/` ディレクトリからスキルを自動的に検出します。たとえば、`packages/frontend/` 内のファイルを編集している場合、Claude Code は `packages/frontend/.claude/skills/` でもスキルを探します。これはパッケージが独自のスキルを持つモノレポセットアップをサポートします。

各スキルは `SKILL.md` をエントリポイントとするディレクトリです：

```text
my-skill/
├── SKILL.md           # Main instructions (required)
├── template.md        # Template for Claude to fill in
├── examples/
│   └── sample.md      # Example output showing expected format
└── scripts/
    └── validate.sh    # Script Claude can execute
```

`SKILL.md` はメイン指示を含み、必須です。他のファイルはオプションで、より強力なスキルを構築できます。Claude が入力するテンプレート、期待される形式を示す出力例、Claude が実行できるスクリプト、または詳細なリファレンスドキュメント。`SKILL.md` からこれらのファイルを参照して、Claude が各ファイルの内容と読み込むタイミングを知るようにします。詳細については、[サポートファイルを追加する](#add-supporting-files)を参照してください。

`.claude/commands/` 内のファイルは引き続き機能し、同じ[フロントマター](#frontmatter-reference)をサポートします。スキルはサポートファイルなどの追加機能をサポートするため、推奨されます。

#### 追加ディレクトリからのスキル

`--add-dir` 経由で追加されたディレクトリ内の `.claude/skills/` で定義されたスキルは自動的に読み込まれ、ライブ変更検出によって取得されるため、セッション中に再起動せずに編集できます。

`--add-dir` ディレクトリの CLAUDE.md ファイルはデフォルトでは読み込まれません。読み込むには、`CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1` を設定します。[追加ディレクトリから読み込む](/ja/memory#load-from-additional-directories)を参照してください。

## スキルを設定する

スキルは `SKILL.md` の上部の YAML フロントマターと、その後に続くマークダウンコンテンツを通じて設定されます。

### スキルコンテンツのタイプ

スキルファイルには任意の指示を含めることができますが、それらを呼び出す方法を考えることは、含める内容をガイドするのに役立ちます：

**リファレンスコンテンツ** は Claude が現在の作業に適用する知識を追加します。規約、パターン、スタイルガイド、ドメイン知識。このコンテンツはインラインで実行されるため、Claude は会話コンテキストと一緒に使用できます。

```yaml
---
name: api-conventions
description: API design patterns for this codebase
---

When writing API endpoints:
- Use RESTful naming conventions
- Return consistent error formats
- Include request validation
```

**タスクコンテンツ** は Claude に特定のアクション（デプロイ、コミット、コード生成など）のステップバイステップの指示を提供します。これらは多くの場合、Claude が実行を決定するのではなく、`/skill-name` で直接呼び出したいアクションです。`disable-model-invocation: true` を追加して、Claude が自動的にトリガーするのを防ぎます。

```yaml
---
name: deploy
description: Deploy the application to production
context: fork
disable-model-invocation: true
---

Deploy the application:
1. Run the test suite
2. Build the application
3. Push to the deployment target
```

`SKILL.md` には何でも含めることができますが、スキルを呼び出す方法（ユーザー、Claude、またはその両方）と実行場所（インラインまたはサブエージェント）を考えることは、含める内容をガイドするのに役立ちます。複雑なスキルの場合、[サポートファイルを追加する](#add-supporting-files)ことで、メインスキルに焦点を当てることもできます。

### フロントマターリファレンス

マークダウンコンテンツを超えて、`SKILL.md` ファイルの上部の `---` マーカー間の YAML フロントマターフィールドを使用してスキルの動作を設定できます：

```yaml
---
name: my-skill
description: What this skill does
disable-model-invocation: true
allowed-tools: Read, Grep
---

Your skill instructions here...
```

すべてのフィールドはオプションです。Claude がスキルをいつ使用するかを知るために、`description` のみが推奨されます。

| フィールド | 必須 | 説明 |
| :- | :- | :- |
| `name` | いいえ | スキルの表示名。省略した場合、ディレクトリ名を使用します。小文字、数字、ハイフンのみ（最大 64 文字）。 |
| `description` | 推奨 | スキルが何をするか、いつ使用するか。Claude はこれを使用してスキルを適用するかどうかを決定します。省略した場合、マークダウンコンテンツの最初の段落を使用します。 |
| `argument-hint` | いいえ | 予想される引数を示すためにオートコンプリート中に表示されるヒント。例：`[issue-number]` または `[filename] [format]`。 |
| `disable-model-invocation` | いいえ | Claude がこのスキルを自動的に読み込むのを防ぐには `true` に設定します。`/name` で手動でトリガーするワークフロー用です。デフォルト：`false`。 |
| `user-invocable` | いいえ | `/` メニューから非表示にするには `false` に設定します。ユーザーが直接呼び出すべきではないバックグラウンド知識用です。デフォルト：`true`。 |
| `allowed-tools` | いいえ | このスキルがアクティブな場合、Claude が許可を求めずに使用できるツール。 |
| `model` | いいえ | このスキルがアクティブな場合に使用するモデル。 |
| `effort` | いいえ | [努力レベル](/ja/model-config#adjust-effort-level)（このスキルがアクティブな場合）。セッション努力レベルをオーバーライドします。デフォルト：セッションから継承。オプション：`low`、`medium`、`high`、`max`（Opus 4.6 のみ）。 |
| `context` | いいえ | フォークされたサブエージェントコンテキストで実行するには `fork` に設定します。 |
| `agent` | いいえ | `context: fork` が設定されている場合に使用するサブエージェントタイプ。 |
| `hooks` | いいえ | このスキルのライフサイクルにスコープされたフック。設定形式については、[スキルとエージェントのフック](/ja/hooks#hooks-in-skills-and-agents)を参照してください。 |

#### 利用可能な文字列置換

スキルはスキルコンテンツの動的値の文字列置換をサポートします：

| 変数 | 説明 |
| :- | :- |
| `$ARGUMENTS` | スキルを呼び出すときに渡されたすべての引数。`$ARGUMENTS` がコンテンツに存在しない場合、引数は `ARGUMENTS: <value>` として追加されます。 |
| `$ARGUMENTS[N]` | 0 ベースのインデックスで特定の引数にアクセスします（例：最初の引数の場合は `$ARGUMENTS[0]`）。 |
| `$N` | `$ARGUMENTS[N]` の短縮形（例：最初の引数の場合は `$0`、2 番目の引数の場合は `$1`）。 |
| `${CLAUDE_SESSION_ID}` | 現在のセッション ID。ログ、セッション固有のファイルの作成、またはスキル出力とセッションの相関付けに便利です。 |
| `${CLAUDE_SKILL_DIR}` | スキルの `SKILL.md` ファイルを含むディレクトリ。プラグインスキルの場合、これはプラグインルートではなく、プラグイン内のスキルのサブディレクトリです。bash インジェクションコマンドでこれを使用して、現在の作業ディレクトリに関係なく、スキルにバンドルされたスクリプトまたはファイルを参照します。 |

**置換を使用した例：**

```yaml
---
name: session-logger
description: Log activity for this session
---

Log the following to logs/${CLAUDE_SESSION_ID}.log:

$ARGUMENTS
```

### サポートファイルを追加する

スキルはディレクトリ内に複数のファイルを含めることができます。これにより、`SKILL.md` は本質的なものに焦点を当てながら、Claude は必要な場合にのみ詳細なリファレンス資料にアクセスできます。大規模なリファレンスドキュメント、API 仕様、または例のコレクションは、スキルが実行されるたびにコンテキストに読み込む必要はありません。

```text
my-skill/
├── SKILL.md (required - overview and navigation)
├── reference.md (detailed API docs - loaded when needed)
├── examples.md (usage examples - loaded when needed)
└── scripts/
    └── helper.py (utility script - executed, not loaded)
```

`SKILL.md` からサポートファイルを参照して、Claude が各ファイルの内容と読み込むタイミングを知るようにします：

```markdown
## Additional resources

- For complete API details, see [reference.md](reference.md)
- For usage examples, see [examples.md](examples.md)
```

`SKILL.md` を 500 行以下に保ちます。詳細なリファレンス資料を別のファイルに移動します。

### スキルを呼び出すユーザーを制御する

デフォルトでは、ユーザーと Claude の両方がスキルを呼び出すことができます。`/skill-name` を入力して直接呼び出すことができ、Claude は会話に関連する場合に自動的にスキルを読み込むことができます。2 つのフロントマターフィールドでこれを制限できます：

- **`disable-model-invocation: true`**：ユーザーのみがスキルを呼び出すことができます。`/commit`、`/deploy`、`/send-slack-message` など、副作用があるワークフロー、またはタイミングを制御したいワークフロー用です。コードが準備完了に見えるため、Claude がデプロイを決定することは望ましくありません。

- **`user-invocable: false`**：Claude のみがスキルを呼び出すことができます。アクションとして実行できないバックグラウンド知識用です。`legacy-system-context` スキルは古いシステムの仕組みを説明します。Claude はこれが関連する場合に知っているべきですが、`/legacy-system-context` はユーザーが実行する意味のあるアクションではありません。

この例は、ユーザーのみがトリガーできるデプロイスキルを作成します。`disable-model-invocation: true` フィールドは Claude が自動的に実行するのを防ぎます：

```yaml
---
name: deploy
description: Deploy the application to production
disable-model-invocation: true
---

Deploy $ARGUMENTS to production:

1. Run the test suite
2. Build the application
3. Push to the deployment target
4. Verify the deployment succeeded
```

2 つのフィールドが呼び出しとコンテキスト読み込みにどのように影響するかは次のとおりです：

| フロントマター | ユーザーが呼び出せる | Claude が呼び出せる | コンテキストに読み込まれるタイミング |
| :- | :- | :- | :- |
| （デフォルト） | はい | はい | 説明は常にコンテキストに含まれ、呼び出されるとフルスキルが読み込まれます |
| `disable-model-invocation: true` | はい | いいえ | 説明はコンテキストに含まれず、ユーザーが呼び出すとフルスキルが読み込まれます |
| `user-invocable: false` | いいえ | はい | 説明は常にコンテキストに含まれ、呼び出されるとフルスキルが読み込まれます |

通常のセッションでは、スキルの説明がコンテキストに読み込まれるため、Claude は利用可能なものを知っていますが、フルスキルコンテンツは呼び出されるときにのみ読み込まれます。[プリロードされたスキルを持つサブエージェント](/ja/sub-agents#preload-skills-into-subagents)は異なります。フルスキルコンテンツはスタートアップで注入されます。

### ツールアクセスを制限する

`allowed-tools` フィールドを使用して、スキルがアクティブな場合に Claude が使用できるツールを制限します。このスキルは、Claude がファイルを探索できるが変更できない読み取り専用モードを作成します：

```yaml
---
name: safe-reader
description: Read files without making changes
allowed-tools: Read, Grep, Glob
---
```

### スキルに引数を渡す

ユーザーと Claude の両方がスキルを呼び出すときに引数を渡すことができます。引数は `$ARGUMENTS` プレースホルダーを通じて利用可能です。

このスキルは GitHub の問題を番号で修正します。`$ARGUMENTS` プレースホルダーはスキル名の後に続くものに置き換えられます：

```yaml
---
name: fix-issue
description: Fix a GitHub issue
disable-model-invocation: true
---

Fix GitHub issue $ARGUMENTS following our coding standards.

1. Read the issue description
2. Understand the requirements
3. Implement the fix
4. Write tests
5. Create a commit
```

`/fix-issue 123` を実行すると、Claude は'Fix GitHub issue 123 following our coding standards...'を受け取ります。

引数を使用してスキルを呼び出しても、スキルに `$ARGUMENTS` が含まれていない場合、Claude Code はスキルコンテンツの最後に `ARGUMENTS: <your input>` を追加するため、Claude は入力したものを引き続き見ることができます。

位置で個別の引数にアクセスするには、`$ARGUMENTS[N]` または短い `$N` を使用します：

```yaml
---
name: migrate-component
description: Migrate a component from one framework to another
---

Migrate the $ARGUMENTS[0] component from $ARGUMENTS[1] to $ARGUMENTS[2].
Preserve all existing behavior and tests.
```

`/migrate-component SearchBar React Vue` を実行すると、`$ARGUMENTS[0]` が `SearchBar` に、`$ARGUMENTS[1]` が `React` に、`$ARGUMENTS[2]` が `Vue` に置き換えられます。`$N` 短縮形を使用する同じスキル：

```yaml
---
name: migrate-component
description: Migrate a component from one framework to another
---

Migrate the $0 component from $1 to $2.
Preserve all existing behavior and tests.
```

## 高度なパターン

### 動的コンテキストを注入する

`` !`<command>` `` 構文はスキルコンテンツが Claude に送信される前にシェルコマンドを実行します。コマンド出力はプレースホルダーを置き換えるため、Claude はコマンド自体ではなく実際のデータを受け取ります。

このスキルは GitHub CLI でライブ PR データを取得することで、プルリクエストを要約します。`` !`gh pr diff` `` および他のコマンドが最初に実行され、その出力がプロンプトに挿入されます：

```yaml
---
name: pr-summary
description: Summarize changes in a pull request
context: fork
agent: Explore
allowed-tools: Bash(gh *)
---

## Pull request context
- PR diff: !`gh pr diff`
- PR comments: !`gh pr view --comments`
- Changed files: !`gh pr diff --name-only`

## Your task
Summarize this pull request...
```

このスキルが実行されるとき：

1. 各 `` !`<command>` `` が直ちに実行されます（Claude が何かを見る前に）
2. 出力はスキルコンテンツのプレースホルダーを置き換えます
3. Claude は実際の PR データを含む完全にレンダリングされたプロンプトを受け取ります

これは前処理であり、Claude が実行するものではありません。Claude は最終結果のみを見ます。

スキルで[拡張思考](/ja/common-workflows#use-extended-thinking-thinking-mode)を有効にするには、スキルコンテンツのどこかに'ultrathink'という単語を含めます。

### スキルをサブエージェントで実行する

スキルを分離して実行したい場合は、フロントマターに `context: fork` を追加します。スキルコンテンツはサブエージェントを駆動するプロンプトになります。会話履歴にアクセスできません。

`context: fork` は明示的な指示を含むスキルにのみ意味があります。スキルにタスクなしで'これらの API 規約を使用する'などのガイドラインが含まれている場合、サブエージェントはガイドラインを受け取りますが、実行可能なプロンプトがなく、意味のある出力なしで返されます。

スキルと[サブエージェント](/ja/sub-agents)は 2 つの方向で連携します：

| アプローチ | システムプロンプト | タスク | また読み込む |
| :- | :- | :- | :- |
| `context: fork` を持つスキル | エージェントタイプから（`Explore`、`Plan` など） | SKILL.md コンテンツ | CLAUDE.md |
| `skills` フィールドを持つサブエージェント | サブエージェントのマークダウン本体 | Claude の委任メッセージ | プリロードされたスキル + CLAUDE.md |

`context: fork` を使用すると、スキルにタスクを記述し、実行するエージェントタイプを選択します。逆の場合（スキルをリファレンス資料として使用するカスタムサブエージェントを定義する）については、[サブエージェント](/ja/sub-agents#preload-skills-into-subagents)を参照してください。

#### 例：Explore エージェントを使用した研究スキル

このスキルはフォークされた Explore エージェントで研究を実行します。スキルコンテンツはタスクになり、エージェントはコードベース探索に最適化された読み取り専用ツールを提供します：

```yaml
---
name: deep-research
description: Research a topic thoroughly
context: fork
agent: Explore
---

Research $ARGUMENTS thoroughly:

1. Find relevant files using Glob and Grep
2. Read and analyze the code
3. Summarize findings with specific file references
```

このスキルが実行されるとき：

1. 新しい分離されたコンテキストが作成されます
2. サブエージェントはスキルコンテンツをプロンプト（'$ARGUMENTS を徹底的に調査...'）として受け取ります
3. `agent` フィールドは実行環境（モデル、ツール、権限）を決定します
4. 結果は要約され、メイン会話に返されます

`agent` フィールドは使用するサブエージェント設定を指定します。オプションには、組み込みエージェント（`Explore`、`Plan`、`general-purpose`）または `.claude/agents/` からのカスタムサブエージェントが含まれます。省略した場合、`general-purpose` を使用します。

### Claude のスキルアクセスを制限する

デフォルトでは、Claude は `disable-model-invocation: true` が設定されていないスキルを呼び出すことができます。`allowed-tools` を定義するスキルは、スキルがアクティブな場合、これらのツールへのアクセスを許可なしで Claude に付与します。[権限設定](/ja/permissions)は引き続き、他のすべてのツールのベースライン承認動作を管理します。`/compact` や `/init` などの組み込みコマンドは、Skill ツールを通じて利用できません。

Claude が呼び出すことができるスキルを制御する 3 つの方法：

**すべてのスキルを無効にする** には、`/permissions` で Skill ツールを拒否します：

```text
# Add to deny rules:
Skill
```

**特定のスキルを許可または拒否する** には、[権限ルール](/ja/permissions)を使用します：

```text
# Allow only specific skills
Skill(commit)
Skill(review-pr *)

# Deny specific skills
Skill(deploy *)
```

権限構文：完全一致の場合は `Skill(name)`、任意の引数を含むプレフィックス一致の場合は `Skill(name *)`。

**個別のスキルを非表示にする** には、フロントマターに `disable-model-invocation: true` を追加します。これにより、スキルが Claude のコンテキストから完全に削除されます。

`user-invocable` フィールドはメニューの可視性のみを制御し、Skill ツールアクセスは制御しません。プログラムによる呼び出しをブロックするには `disable-model-invocation: true` を使用します。

## スキルを共有する

スキルはオーディエンスに応じて異なるスコープで配布できます：

- **プロジェクトスキル**：`.claude/skills/` をバージョン管理にコミットします
- **プラグイン**：[プラグイン](/ja/plugins)に `skills/` ディレクトリを作成します
- **管理**：[管理設定](/ja/settings#settings-files)を通じて組織全体にデプロイします

### 視覚的な出力を生成する

スキルは任意の言語でスクリプトをバンドルして実行でき、Claude に単一のプロンプトで可能なもの以上の機能を提供します。1 つの強力なパターンは視覚的な出力を生成することです。ブラウザで開くインタラクティブな HTML ファイルで、データの探索、デバッグ、またはレポートの作成に使用できます。

この例はコードベースエクスプローラーを作成します。ディレクトリを展開および折りたたむことができるインタラクティブなツリービュー、一目でファイルサイズを確認でき、ファイルタイプを色で識別できます。

スキルディレクトリを作成します：

```bash
mkdir -p ~/.claude/skills/codebase-visualizer/scripts
```

`~/.claude/skills/codebase-visualizer/SKILL.md` を作成します。説明は Claude にこのスキルをいつアクティブにするかを伝え、指示は Claude にバンドルされたスクリプトを実行するよう伝えます：

````yaml theme={null}
---
name: codebase-visualizer
description: Generate an interactive collapsible tree visualization of your codebase. Use when exploring a new repo, understanding project structure, or identifying large files.
allowed-tools: Bash(python *)
---

# Codebase Visualizer

Generate an interactive HTML tree view that shows your project's file structure with collapsible directories.

## Usage

Run the visualization script from your project root:

```bash
python ~/.claude/skills/codebase-visualizer/scripts/visualize.py .
```

This creates `codebase-map.html` in the current directory and opens it in your default browser.

## What the visualization shows

- **Collapsible directories**: Click folders to expand/collapse
- **File sizes**: Displayed next to each file
- **Colors**: Different colors for different file types
- **Directory totals**: Shows aggregate size of each folder
````

`~/.claude/skills/codebase-visualizer/scripts/visualize.py` を作成します。このスクリプトはディレクトリツリーをスキャンし、以下を含む自己完結型の HTML ファイルを生成します：

- ファイル数、ディレクトリ数、合計サイズ、ファイルタイプ数を示す**サマリーサイドバー**
- コードベースをファイルタイプ別に分類する**棒グラフ**（サイズ別トップ 8）
- ディレクトリを展開および折りたたむことができる**折りたたみ可能なツリー**（色分けされたファイルタイプインジケーター付き）

スクリプトは Python が必要ですが、組み込みライブラリのみを使用するため、インストールするパッケージはありません：

```python expandable
#!/usr/bin/env python3
"""Generate an interactive collapsible tree visualization of a codebase."""

import json
import sys
import webbrowser
from pathlib import Path
from collections import Counter

IGNORE = {'.git', 'node_modules', '__pycache__', '.venv', 'venv', 'dist', 'build'}

def scan(path: Path, stats: dict) -> dict:
    result = {"name": path.name, "children": [], "size": 0}
    try:
        for item in sorted(path.iterdir()):
            if item.name in IGNORE or item.name.startswith('.'):
                continue
            if item.is_file():
                size = item.stat().st_size
                ext = item.suffix.lower() or '(no ext)'
                result["children"].append({"name": item.name, "size": size, "ext": ext})
                result["size"] += size
                stats["files"] += 1
                stats["extensions"][ext] += 1
                stats["ext_sizes"][ext] += size
            elif item.is_dir():
                stats["dirs"] += 1
                child = scan(item, stats)
                if child["children"]:
                    result["children"].append(child)
                    result["size"] += child["size"]
    except PermissionError:
        pass
    return result

def generate_html(data: dict, stats: dict, output: Path) -> None:
    ext_sizes = stats["ext_sizes"]
    total_size = sum(ext_sizes.values()) or 1
    sorted_exts = sorted(ext_sizes.items(), key=lambda x: -x[1])[:8]
    colors = {
        '.js': '#f7df1e', '.ts': '#3178c6', '.py': '#3776ab', '.go': '#00add8',
        '.rs': '#dea584', '.rb': '#cc342d', '.css': '#264de4', '.html': '#e34c26',
        '.json': '#6b7280', '.md': '#083fa1', '.yaml': '#cb171e', '.yml': '#cb171e',
        '.mdx': '#083fa1', '.tsx': '#3178c6', '.jsx': '#61dafb', '.sh': '#4eaa25',
    }
    lang_bars = "".join(
        f'<div class="bar-row"><span class="bar-label">{ext}</span>'
        f'<div class="bar" style="width:{(size/total_size)*100}%;background:{colors.get(ext,"#6b7280")}"></div>'
        f'<span class="bar-pct">{(size/total_size)*100:.1f}%</span></div>'
        for ext, size in sorted_exts
    )
    def fmt(b):
        if b < 1024: return f"{b} B"
        if b < 1048576: return f"{b/1024:.1f} KB"
        return f"{b/1048576:.1f} MB"

    html = f'''<!DOCTYPE html>
<html><head>
  <meta charset="utf-8"><title>Codebase Explorer</title>
  <style>
    body {{ font: 14px/1.5 system-ui, sans-serif; margin: 0; background: #1a1a2e; color: #eee; }}
    .container {{ display: flex; height: 100vh; }}
    .sidebar {{ width: 280px; background: #252542; padding: 20px; border-right: 1px solid #3d3d5c; overflow-y: auto; flex-shrink: 0; }}
    .main {{ flex: 1; padding: 20px; overflow-y: auto; }}
    h1 {{ margin: 0 0 10px 0; font-size: 18px; }}
    h2 {{ margin: 20px 0 10px 0; font-size: 14px; color: #888; text-transform: uppercase; }}
    .stat {{ display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #3d3d5c; }}
    .stat-value {{ font-weight: bold; }}
    .bar-row {{ display: flex; align-items: center; margin: 6px 0; }}
    .bar-label {{ width: 55px; font-size: 12px; color: #aaa; }}
    .bar {{ height: 18px; border-radius: 3px; }}
    .bar-pct {{ margin-left: 8px; font-size: 12px; color: #666; }}
    .tree {{ list-style: none; padding-left: 20px; }}
    details {{ cursor: pointer; }}
    summary {{ padding: 4px 8px; border-radius: 4px; }}
    summary:hover {{ background: #2d2d44; }}
    .folder {{ color: #ffd700; }}
    .file {{ display: flex; align-items: center; padding: 4px 8px; border-radius: 4px; }}
    .file:hover {{ background: #2d2d44; }}
    .size {{ color: #888; margin-left: auto; font-size: 12px; }}
    .dot {{ width: 8px; height: 8px; border-radius: 50%; margin-right: 8px; }}
  </style>
</head><body>
  <div class="container">
    <div class="sidebar">
      <h1>📊 Summary</h1>
      <div class="stat"><span>Files</span><span class="stat-value">{stats["files"]:,}</span></div>
      <div class="stat"><span>Directories</span><span class="stat-value">{stats["dirs"]:,}</span></div>
      <div class="stat"><span>Total size</span><span class="stat-value">{fmt(data["size"])}</span></div>
      <div class="stat"><span>File types</span><span class="stat-value">{len(stats["extensions"])}</span></div>
      <h2>By file type</h2>
      {lang_bars}
    </div>
    <div class="main">
      <h1>📁 {data["name"]}</h1>
      <ul class="tree" id="root"></ul>
    </div>
  </div>
  <script>
    const data = {json.dumps(data)};
    const colors = {json.dumps(colors)};
    function fmt(b) {{ if (b < 1024) return b + ' B'; if (b < 1048576) return (b/1024).toFixed(1) + ' KB'; return (b/1048576).toFixed(1) + ' MB'; }}
    function render(node, parent) {{
      if (node.children) {{
        const det = document.createElement('details');
        det.open = parent === document.getElementById('root');
        det.innerHTML = `<summary><span class="folder">📁 ${{node.name}}</span><span class="size">${{fmt(node.size)}}</span></summary>`;
        const ul = document.createElement('ul'); ul.className = 'tree';
        node.children.sort((a,b) => (b.children?1:0)-(a.children?1:0) || a.name.localeCompare(b.name));
        node.children.forEach(c => render(c, ul));
        det.appendChild(ul);
        const li = document.createElement('li'); li.appendChild(det); parent.appendChild(li);
      }} else {{
        const li = document.createElement('li'); li.className = 'file';
        li.innerHTML = `<span class="dot" style="background:${{colors[node.ext]||'#6b7280'}}"></span>${{node.name}}<span class="size">${{fmt(node.size)}}</span>`;
        parent.appendChild(li);
      }}
    }}
    data.children.forEach(c => render(c, document.getElementById('root')));
  </script>
</body></html>'''
    output.write_text(html)

if __name__ == '__main__':
    target = Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
    stats = {"files": 0, "dirs": 0, "extensions": Counter(), "ext_sizes": Counter()}
    data = scan(target, stats)
    out = Path('codebase-map.html')
    generate_html(data, stats, out)
    print(f'Generated {out.absolute()}')
    webbrowser.open(f'file://{out.absolute()}')
```

テストするには、任意のプロジェクトで Claude Code を開き、「Visualize this codebase」と尋ねます。Claude はスクリプトを実行し、`codebase-map.html` を生成し、ブラウザで開きます。

このパターンは任意の視覚的な出力に機能します。依存関係グラフ、テストカバレッジレポート、API ドキュメント、またはデータベーススキーマの視覚化。バンドルされたスクリプトが重い処理を行い、Claude が調整を処理します。

## トラブルシューティング

### スキルがトリガーされない

Claude がスキルを期待どおりに使用しない場合：

1. 説明にユーザーが自然に言うキーワードが含まれていることを確認します
2. スキルが「利用可能なスキルは何ですか？」に表示されることを確認します
3. 説明により密接に一致するようにリクエストを言い換えてみます
4. スキルがユーザー呼び出し可能な場合は、`/skill-name` で直接呼び出してみます

### スキルが頻繁にトリガーされる

Claude がスキルを使用したくない場合：

1. 説明をより具体的にします
2. スキルを手動で呼び出したい場合のみ `disable-model-invocation: true` を追加します

### Claude がすべてのスキルを見ない

スキルの説明がコンテキストに読み込まれるため、Claude は利用可能なものを知っています。多くのスキルがある場合、文字予算を超える可能性があります。予算は動的にコンテキストウィンドウの 2% でスケーリングされ、16,000 文字のフォールバックがあります。`/context` を実行して、除外されたスキルに関する警告を確認します。

制限をオーバーライドするには、`SLASH_COMMAND_TOOL_CHAR_BUDGET` 環境変数を設定します。

## 関連リソース

- **[サブエージェント](/ja/sub-agents)**：特化したエージェントにタスクを委任する
- **[プラグイン](/ja/plugins)**：他の拡張機能でスキルをパッケージ化して配布する
- **[フック](/ja/hooks)**：ツールイベント周辺のワークフローを自動化する
- **[メモリ](/ja/memory)**：永続的なコンテキストのための CLAUDE.md ファイルを管理する
- **[組み込みコマンド](/ja/commands)**：組み込み `/` コマンドのリファレンス
- **[権限](/ja/permissions)**：ツールとスキルアクセスを制御する
