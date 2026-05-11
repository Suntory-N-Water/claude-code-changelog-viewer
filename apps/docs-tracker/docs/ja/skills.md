---
title: skills
source: https://code.claude.com/docs/ja/skills.md
---

# スキルで Claude を拡張する

> Claude Code でスキルを作成、管理、共有して Claude の機能を拡張します。カスタムコマンドとバンドルされたスキルが含まれます。

スキルは Claude ができることを拡張します。`SKILL.md` ファイルに指示を記述すると、Claude はそれをツールキットに追加します。Claude は関連する場合にスキルを使用するか、`/skill-name` で直接呼び出すことができます。

同じプレイブック、チェックリスト、または複数ステップの手順をチャットに何度も貼り付けるときや、CLAUDE.md のセクションが事実ではなく手順に成長したときにスキルを作成します。CLAUDE.md コンテンツとは異なり、スキルの本体は使用されるときにのみ読み込まれるため、長いリファレンス資料は必要になるまでほぼコストがかかりません。

`/help` や `/compact` などの組み込みコマンド、および `/debug` や `/simplify` などのバンドルされたスキルについては、[コマンドリファレンス](/ja/commands)を参照してください。

**カスタムコマンドはスキルにマージされました。** `.claude/commands/deploy.md` のファイルと `.claude/skills/deploy/SKILL.md` のスキルの両方が `/deploy` を作成し、同じように機能します。既存の `.claude/commands/` ファイルは引き続き機能します。スキルは追加機能を提供します。サポートファイル用のディレクトリ、[スキルを呼び出すユーザーを制御する](#control-who-invokes-a-skill)ためのフロントマター、および Claude が関連する場合に自動的にスキルを読み込む機能です。

Claude Code スキルは [Agent Skills](https://agentskills.io) オープンスタンダードに従い、複数の AI ツール全体で機能します。Claude Code は [呼び出し制御](#control-who-invokes-a-skill)、[サブエージェント実行](#run-skills-in-a-subagent)、[動的コンテキスト注入](#inject-dynamic-context)などの追加機能でスタンダードを拡張します。

## バンドルされたスキル

Claude Code には、すべてのセッションで利用可能な一連のバンドルされたスキルが含まれています。これには `/simplify`、`/batch`、`/debug`、`/loop`、および `/claude-api` が含まれます。固定ロジックを直接実行する組み込みコマンドとは異なり、バンドルされたスキルはプロンプトベースです。Claude に詳細な指示を提供し、ツールを使用して作業を調整させます。他のスキルと同じ方法で呼び出します。`/` の後にスキル名を入力します。

バンドルされたスキルは [コマンドリファレンス](/ja/commands) に組み込みコマンドと一緒にリストされており、目的列に**スキル**とマークされています。

## はじめに

### 最初のスキルを作成する

この例は、git リポジトリ内のコミットされていない変更を要約し、危険な点にフラグを付けるスキルを作成します。プロンプトにライブ diff を取り込むため、Claude が開いているファイルから推測できるものではなく、実際の作業ツリーに基づいた応答が得られます。Claude は変更について尋ねるときにスキルを自動的に読み込むか、`/summarize-changes` で直接呼び出すことができます。

個人用スキルフォルダにスキル用のディレクトリを作成します。個人用スキルはすべてのプロジェクト全体で利用可能です。

```bash theme={null}
mkdir -p ~/.claude/skills/summarize-changes
```

すべてのスキルには `SKILL.md` ファイルが必要です。2 つの部分があります。YAML フロントマター（`---` マーカー間）は Claude にスキルをいつ使用するかを伝え、マークダウンコンテンツはスキルが実行されるときに Claude が従う指示です。ディレクトリ名はコマンドになり、`description` は Claude がスキルを自動的に読み込むかどうかを決定するのに役立ちます。

`~/.claude/skills/summarize-changes/SKILL.md` に保存します：

```yaml theme={null}
---
description: Summarizes uncommitted changes and flags anything risky. Use when the user asks what changed, wants a commit message, or asks to review their diff.
---

## Current changes

!`git diff HEAD`

## Instructions

Summarize the changes above in two or three bullet points, then list any risks you notice such as missing error handling, hardcoded values, or tests that need updating. If the diff is empty, say there are no uncommitted changes.
```

`` !`git diff HEAD` `` 行は[動的コンテキスト注入](#inject-dynamic-context)を使用します。Claude Code はコマンドを実行し、Claude がスキルコンテンツを見る前に行を出力に置き換えるため、指示は現在の diff がすでにインライン化された状態で到着します。

git プロジェクトを開き、任意のファイルに小さな編集を加え、`claude` を実行して Claude Code を起動します。2 つの方法でスキルをテストできます。

**説明に一致するものを尋ねることで Claude に自動的に呼び出させます：**

```text theme={null}
What did I change?
```

**またはスキル名で直接呼び出します：**

```text theme={null}
/summarize-changes
```

どちらの方法でも、Claude は編集の短い要約とリスク一覧で応答するはずです。

### スキルが存在する場所

スキルを保存する場所によって、誰がそれを使用できるかが決まります：

| 場所 | パス | 適用対象 |
| :- | :- | :- |
| Enterprise | [管理設定](/ja/settings#settings-files)を参照 | 組織内のすべてのユーザー |
| Personal | `~/.claude/skills/<skill-name>/SKILL.md` | すべてのプロジェクト |
| Project | `.claude/skills/<skill-name>/SKILL.md` | このプロジェクトのみ |
| Plugin | `<plugin>/skills/<skill-name>/SKILL.md` | プラグインが有効な場所 |

スキルがレベル全体で同じ名前を共有する場合、enterprise は personal をオーバーライドし、personal はプロジェクトをオーバーライドします。プラグインスキルは `plugin-name:skill-name` 名前空間を使用するため、他のレベルと競合することはできません。`.claude/commands/` にファイルがある場合、それらは同じように機能しますが、スキルとコマンドが同じ名前を共有する場合、スキルが優先されます。

#### ライブ変更検出

Claude Code はスキルディレクトリのファイル変更を監視します。`~/.claude/skills/`、プロジェクト `.claude/skills/`、または `--add-dir` ディレクトリ内の `.claude/skills/` の下でスキルを追加、編集、または削除すると、再起動せずに現在のセッション内で有効になります。セッション開始時に存在しなかった最上位のスキルディレクトリを作成するには、Claude Code を再起動して新しいディレクトリを監視できるようにする必要があります。

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

`--add-dir` フラグは[ファイルアクセスを許可](/ja/permissions#additional-directories-grant-file-access-not-configuration)しますが、スキルは例外です。追加されたディレクトリ内の `.claude/skills/` は自動的に読み込まれます。[ライブ変更検出](#live-change-detection)を参照して、セッション中に編集がどのように取得されるかを確認してください。

その他の `.claude/` 設定（サブエージェント、コマンド、出力スタイル）は追加ディレクトリから読み込まれません。読み込まれるもの、読み込まれないもの、および設定をプロジェクト全体で共有するための推奨方法の完全なリストについては、[例外テーブル](/ja/permissions#additional-directories-grant-file-access-not-configuration)を参照してください。

`--add-dir` ディレクトリの CLAUDE.md ファイルはデフォルトでは読み込まれません。読み込むには、`CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1` を設定します。[追加ディレクトリから読み込む](/ja/memory#load-from-additional-directories)を参照してください。

***

title: "スキルを設定する"
description: "YAML フロントマターとマークダウンコンテンツを使用してスキルを設定し、カスタマイズする方法"
--------------------------------------------------------------

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

本体自体は簡潔に保ちます。スキルが読み込まれると、そのコンテンツは[ターン全体でコンテキストに留まり](#skill-content-lifecycle)、すべての行が繰り返されるトークンコストになります。実行内容を述べ、方法や理由を説明するのではなく、[CLAUDE.md コンテンツ](/ja/best-practices#write-an-effective-claude-md)に適用するのと同じ簡潔性テストを適用します。

### フロントマターリファレンス

マークダウンコンテンツを超えて、`SKILL.md` ファイルの上部の `---` マーカー間の YAML フロントマターフィールドを使用してスキルの動作を設定できます：

```yaml
---
name: my-skill
description: What this skill does
disable-model-invocation: true
allowed-tools: Read Grep
---

Your skill instructions here...
```

すべてのフィールドはオプションです。Claude がスキルをいつ使用するかを知るために、`description` のみが推奨されます。

| フィールド | 必須 | 説明 |
| :- | :- | :- |
| `name` | いいえ | スキルの表示名。省略した場合、ディレクトリ名を使用します。小文字、数字、ハイフンのみ（最大 64 文字）。 |
| `description` | 推奨 | スキルが何をするか、いつ使用するか。Claude はこれを使用してスキルを適用するかどうかを決定します。省略した場合、マークダウンコンテンツの最初の段落を使用します。主要なユースケースを前置きしてください。スキルリストのコンテキスト使用量を削減するため、`description` と `when_to_use` の組み合わせテキストは 1,536 文字で短縮されます。 |
| `when_to_use` | いいえ | Claude がスキルを呼び出すべき場合の追加コンテキスト（トリガーフレーズやリクエスト例など）。スキルリストの `description` に追加され、1,536 文字の上限にカウントされます。 |
| `argument-hint` | いいえ | 予想される引数を示すためにオートコンプリート中に表示されるヒント。例：`[issue-number]` または `[filename] [format]`。 |
| `arguments` | いいえ | スキルコンテンツの [`$name` 置換](#available-string-substitutions)用の名前付き位置引数。スペース区切り文字列または YAML リストを受け入れます。名前は順序で位置にマップされます。 |
| `disable-model-invocation` | いいえ | Claude がこのスキルを自動的に読み込むのを防ぐには `true` に設定します。`/name` で手動でトリガーするワークフロー用です。また、スキルが[サブエージェントにプリロードされる](/ja/sub-agents#preload-skills-into-subagents)のを防ぎます。デフォルト：`false`。 |
| `user-invocable` | いいえ | `/` メニューから非表示にするには `false` に設定します。ユーザーが直接呼び出すべきではないバックグラウンド知識用です。デフォルト：`true`。 |
| `allowed-tools` | いいえ | このスキルがアクティブな場合、Claude が許可を求めずに使用できるツール。スペース区切り文字列または YAML リストを受け入れます。 |
| `model` | いいえ | このスキルがアクティブな場合に使用するモデル。オーバーライドは現在のターンの残りに適用され、設定に保存されません。セッションモデルは次のプロンプトで再開されます。[`/model`](/ja/model-config)と同じ値を受け入れるか、アクティブなモデルを保持するために `inherit` を受け入れます。 |
| `effort` | いいえ | [努力レベル](/ja/model-config#adjust-effort-level)（このスキルがアクティブな場合）。セッション努力レベルをオーバーライドします。デフォルト：セッションから継承。オプション：`low`、`medium`、`high`、`xhigh`、`max`。利用可能なレベルはモデルに依存します。 |
| `context` | いいえ | フォークされたサブエージェントコンテキストで実行するには `fork` に設定します。 |
| `agent` | いいえ | `context: fork` が設定されている場合に使用するサブエージェントタイプ。 |
| `hooks` | いいえ | このスキルのライフサイクルにスコープされたフック。設定形式については、[スキルとエージェントのフック](/ja/hooks#hooks-in-skills-and-agents)を参照してください。 |
| `paths` | いいえ | このスキルがアクティブ化されるタイミングを制限する Glob パターン。カンマ区切り文字列または YAML リストを受け入れます。設定されている場合、Claude はパターンに一致するファイルを操作する場合にのみ、スキルを自動的に読み込みます。[パス固有のルール](/ja/memory#path-specific-rules)と同じ形式を使用します。 |
| `shell` | いいえ | このスキルの `` !`command` `` および ` ```! ` ブロックに使用するシェル。`bash`（デフォルト）または `powershell` を受け入れます。`powershell` を設定すると、Windows 上で PowerShell 経由でインラインシェルコマンドが実行されます。`CLAUDE_CODE_USE_POWERSHELL_TOOL=1` が必要です。 |

#### 利用可能な文字列置換

スキルはスキルコンテンツの動的値の文字列置換をサポートします：

| 変数 | 説明 |
| :- | :- |
| `$ARGUMENTS` | スキルを呼び出すときに渡されたすべての引数。`$ARGUMENTS` がコンテンツに存在しない場合、引数は `ARGUMENTS: <value>` として追加されます。 |
| `$ARGUMENTS[N]` | 0 ベースのインデックスで特定の引数にアクセスします（例：最初の引数の場合は `$ARGUMENTS[0]`）。 |
| `$N` | `$ARGUMENTS[N]` の短縮形（例：最初の引数の場合は `$0`、2 番目の引数の場合は `$1`）。 |
| `$name` | [`arguments`](#frontmatter-reference) フロントマターリストで宣言された名前付き引数。名前は順序で位置にマップされるため、`arguments: [issue, branch]` の場合、プレースホルダー `$issue` は最初の引数に展開され、`$branch` は 2 番目の引数に展開されます。 |
| `${CLAUDE_SESSION_ID}` | 現在のセッション ID。ログ、セッション固有のファイルの作成、またはスキル出力とセッションの相関付けに便利です。 |
| `${CLAUDE_EFFORT}` | 現在の努力レベル：`low`、`medium`、`high`、`xhigh`、または `max`。スキル指示をアクティブな努力設定に適応させるために使用します。 |
| `${CLAUDE_SKILL_DIR}` | スキルの `SKILL.md` ファイルを含むディレクトリ。プラグインスキルの場合、これはプラグインルートではなく、プラグイン内のスキルのサブディレクトリです。bash インジェクションコマンドでこれを使用して、現在の作業ディレクトリに関係なく、スキルにバンドルされたスクリプトまたはファイルを参照します。 |

インデックス付き引数はシェルスタイルのクォートを使用するため、複数単語の値をシングル引数として渡すためにクォートで囲みます。たとえば、`/my-skill "hello world" second` は `$0` を `hello world` に、`$1` を `second` に展開します。`$ARGUMENTS` プレースホルダーは常に、入力されたとおりの完全な引数文字列に展開されます。

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

### スキルコンテンツのライフサイクル

ユーザーまたは Claude がスキルを呼び出すと、レンダリングされた `SKILL.md` コンテンツは会話に単一のメッセージとして入力され、セッションの残りの間そこに留まります。Claude Code は後のターンでスキルファイルを再度読み込まないため、タスク全体を通じて適用すべきガイダンスを 1 回限りのステップではなく、スタンディング指示として記述します。

[自動コンパクション](/ja/how-claude-code-works#when-context-fills-up)は、トークン予算内で呼び出されたスキルを前方に運びます。会話が要約されてコンテキストを解放するとき、Claude Code は各スキルの最新の呼び出しを要約の後に再度アタッチし、最初の 5,000 トークンを保持します。再度アタッチされたスキルは 25,000 トークンの合計予算を共有します。Claude Code はこの予算を最近呼び出されたスキルから開始して埋めるため、セッション内で多くのスキルを呼び出した場合、古いスキルはコンパクション後に完全にドロップされる可能性があります。

スキルが最初の応答の後に動作に影響を与えるのを停止しているように見える場合、コンテンツは通常まだ存在し、モデルは他のツールまたはアプローチを選択しています。スキルの `description` と指示を強化して、モデルがそれを優先し続けるようにするか、[フック](/ja/hooks)を使用して動作を決定的に強制します。スキルが大きいか、その後に他のスキルを多く呼び出した場合、コンパクション後にそれを再度呼び出して、フルコンテンツを復元します。

### スキルのツールを事前承認する

`allowed-tools` フィールドは、スキルがアクティブな場合、リストされたツールの権限を付与するため、Claude はあなたに承認を求めることなくそれらを使用できます。これは利用可能なツールを制限しません。すべてのツールは呼び出し可能なままであり、[権限設定](/ja/permissions)は引き続き、リストされていないツールのツール承認を管理します。

プロジェクトの `.claude/skills/` ディレクトリにチェックインされたスキルの場合、`allowed-tools` はそのフォルダーのワークスペーストラストダイアログを受け入れた後に有効になります。これは `.claude/settings.json` の権限ルールと同じです。スキルが広範なツールアクセスを許可できるため、リポジトリを信頼する前にプロジェクトスキルを確認してください。

このスキルは、スキルを呼び出すときはいつでも、Claude が git コマンドを実行できるようにします：

```yaml
---
name: commit
description: Stage and commit the current changes
disable-model-invocation: true
allowed-tools: Bash(git add *) Bash(git commit *) Bash(git status *)
---
```

スキルが特定のツールを使用するのをブロックするには、代わりに[権限設定](/ja/permissions)に拒否ルールを追加します。

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

`/fix-issue 123` を実行すると、Claude は「Fix GitHub issue 123 following our coding standards...」を受け取ります。

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

複数行のコマンドの場合、インラインフォーム `` !`<command>` `` の代わりに、` ```! ` で開かれたフェンスコードブロックを使用します：

````markdown theme={null}
## Environment
```!
node --version
npm --version
git status --short
```
````

ユーザー、プロジェクト、プラグイン、または[追加ディレクトリ](#skills-from-additional-directories)ソースからのスキルとカスタムコマンドについて、この動作を無効にするには、[設定](/ja/settings)で `"disableSkillShellExecution": true` を設定します。各コマンドは `[shell command execution disabled by policy]` に置き換えられます。バンドルされたスキルと管理スキルは影響を受けません。この設定は[管理設定](/ja/permissions#managed-settings)で最も有用です。ユーザーはそれをオーバーライドできません。

スキルで深い推論をリクエストするには、スキルコンテンツのどこかに `ultrathink` を含めます。[ワンオフの深い推論に ultrathink を使用する](/ja/model-config#use-ultrathink-for-one-off-deep-reasoning)を参照してください。

### スキルをサブエージェントで実行する

スキルを分離して実行したい場合は、フロントマターに `context: fork` を追加します。スキルコンテンツはサブエージェントを駆動するプロンプトになります。会話履歴にアクセスできません。

`context: fork` は明示的な指示を含むスキルにのみ意味があります。スキルにタスクなしで「これらの API 規約を使用する」などのガイドラインが含まれている場合、サブエージェントはガイドラインを受け取りますが、実行可能なプロンプトがなく、意味のある出力なしで返されます。

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
2. サブエージェントはスキルコンテンツをプロンプト（「$ARGUMENTS を徹底的に調査...」）として受け取ります
3. `agent` フィールドは実行環境（モデル、ツール、権限）を決定します
4. 結果は要約され、メイン会話に返されます

`agent` フィールドは使用するサブエージェント設定を指定します。オプションには、組み込みエージェント（`Explore`、`Plan`、`general-purpose`）または `.claude/agents/` からのカスタムサブエージェントが含まれます。省略した場合、`general-purpose` を使用します。

### Claude のスキルアクセスを制限する

デフォルトでは、Claude は `disable-model-invocation: true` が設定されていないスキルを呼び出すことができます。`allowed-tools` を定義するスキルは、スキルがアクティブな場合、これらのツールへのアクセスを許可なしで Claude に付与します。[権限設定](/ja/permissions)は引き続き、他のすべてのツールのベースライン承認動作を管理します。`/init`、`/review`、`/security-review` などの組み込みコマンドも Skill ツールを通じて利用可能です。`/compact` などの他の組み込みコマンドはそうではありません。

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

### 設定からスキルの可視性をオーバーライドする

`skillOverrides` 設定は、スキル自体のフロントマターではなく、[設定](/ja/settings)からスキルの可視性を制御します。共有プロジェクトリポジトリにチェックインされたスキルや MCP サーバーによって提供されるスキルなど、SKILL.md を編集したくないスキルに使用します。`/skills` メニューはあなたのために書きます：スキルをハイライトして `Space` を押して状態をサイクルし、`Enter` を押して `.claude/settings.local.json` に保存します。

各キーはスキル名で、各値は 4 つの状態のいずれかです：

| 値 | Claude にリストされている | `/` メニューで |
| :- | :- | :- |
| `"on"` | 名前と説明 | はい |
| `"name-only"` | 名前のみ | はい |
| `"user-invocable-only"` | 非表示 | はい |
| `"off"` | 非表示 | 非表示 |

`skillOverrides` に存在しないスキルは `"on"` として扱われます。以下の例は 1 つのスキルを名前に折りたたみ、別のスキルを完全にオフにします：

```json
{
  "skillOverrides": {
    "legacy-context": "name-only",
    "deploy": "off"
  }
}
```

プラグインスキルは `skillOverrides` の影響を受けません。代わりに `/plugin` を通じてそれらを管理します。

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

`~/.claude/skills/codebase-visualizer/SKILL.md` に保存します。説明は Claude にこのスキルをいつアクティブにするかを伝え、指示は Claude にバンドルされたスクリプトを実行するよう伝えます。スクリプトパスは [`${CLAUDE_SKILL_DIR}`](#available-string-substitutions) を使用するため、スキルが個人、プロジェクト、またはプラグインレベルでインストールされているかどうかに関わらず、正しく解決されます：

````yaml theme={null}
---
name: codebase-visualizer
description: Generate an interactive collapsible tree visualization of your codebase. Use when exploring a new repo, understanding project structure, or identifying large files.
allowed-tools: Bash(python3 *)
---

# Codebase Visualizer

Generate an interactive HTML tree view that shows your project's file structure with collapsible directories.

## Usage

Run the visualization script from your project root:

```bash
python3 ${CLAUDE_SKILL_DIR}/scripts/visualize.py .
```

This creates `codebase-map.html` in the current directory and opens it in your default browser.

## What the visualization shows

- **Collapsible directories**: Click folders to expand/collapse
- **File sizes**: Displayed next to each file
- **Colors**: Different colors for different file types
- **Directory totals**: Shows aggregate size of each folder
````

`~/.claude/skills/codebase-visualizer/scripts/visualize.py` に保存します。このスクリプトはディレクトリツリーをスキャンし、以下を含む自己完結型の HTML ファイルを生成します：

- ファイル数、ディレクトリ数、合計サイズ、ファイルタイプ数を示す**サマリーサイドバー**
- コードベースをファイルタイプ別に分類する**棒グラフ**（サイズ別トップ 8）
- ディレクトリを展開および折りたたむことができる**折りたたみ可能なツリー**（色分けされたファイルタイプインジケーター付き）

スクリプトは Python 3 が必要ですが、組み込みライブラリのみを使用するため、インストールするパッケージはありません：

```python expandable
#!/usr/bin/env python3
"""Generate an interactive collapsible tree visualization of a codebase."""

import json
import sys
import webbrowser
from html import escape
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
      <h1>📁 {escape(data["name"])}</h1>
      <ul class="tree" id="root"></ul>
    </div>
  </div>
  <script>
    const data = {json.dumps(data)};
    const colors = {json.dumps(colors)};
    function fmt(b) {{ if (b < 1024) return b + ' B'; if (b < 1048576) return (b/1024).toFixed(1) + ' KB'; return (b/1048576).toFixed(1) + ' MB'; }}
    function esc(s) {{ return s.replace(/[&<>"']/g, c => ({{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}}[c])); }}
    function render(node, parent) {{
      if (node.children) {{
        const det = document.createElement('details');
        det.open = parent === document.getElementById('root');
        det.innerHTML = `<summary><span class="folder">📁 ${{esc(node.name)}}</span><span class="size">${{fmt(node.size)}}</span></summary>`;
        const ul = document.createElement('ul'); ul.className = 'tree';
        node.children.sort((a,b) => (b.children?1:0)-(a.children?1:0) || a.name.localeCompare(b.name));
        node.children.forEach(c => render(c, ul));
        det.appendChild(ul);
        const li = document.createElement('li'); li.appendChild(det); parent.appendChild(li);
      }} else {{
        const li = document.createElement('li'); li.className = 'file';
        li.innerHTML = `<span class="dot" style="background:${{colors[node.ext]||'#6b7280'}}"></span>${{esc(node.name)}}<span class="size">${{fmt(node.size)}}</span>`;
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
2. 手動呼び出しのみを希望する場合は、`disable-model-invocation: true` を追加します

### スキルの説明が短縮される

スキルの説明がコンテキストに読み込まれるため、Claude は利用可能なものを知っています。すべてのスキル名は常に含まれていますが、多くのスキルがある場合、説明は文字予算に合わせて短縮される可能性があり、Claude が一致するために必要なキーワードを削除できます。予算はモデルのコンテキストウィンドウの 1% でスケーリングされます。オーバーフローすると、最も呼び出しが少ないスキルの説明が最初に削除され、実際に使用するスキルは完全なテキストを保持します。`/doctor` を実行して、予算がオーバーフローしているかどうか、どのスキルが影響を受けているかを確認します。

予算を上げるには、[`skillListingBudgetFraction`](/ja/settings#available-settings) 設定（例：`0.02` = 2%）または `SLASH_COMMAND_TOOL_CHAR_BUDGET` 環境変数を固定文字数に設定します。他のスキルの予算を解放するには、[`skillOverrides`](#override-skill-visibility-from-settings) で低優先度のエントリを `"name-only"` に設定して、説明なしでリストアップします。ソースで `description` と `when_to_use` テキストをトリミングすることもできます。各エントリの組み合わせテキストは予算に関係なく 1,536 文字でキャップされているため、主要なユースケースを前置きしてください。キャップは [`maxSkillDescriptionChars`](/ja/settings#available-settings) で設定可能です。

## 関連リソース

- **[設定をデバッグする](/ja/debug-your-config)**：スキルが表示されない、またはトリガーされない理由を診断する
- **[サブエージェント](/ja/sub-agents)**：特化したエージェントにタスクを委任する
- **[プラグイン](/ja/plugins)**：他の拡張機能でスキルをパッケージ化して配布する
- **[フック](/ja/hooks)**：ツールイベント周辺のワークフローを自動化する
- **[メモリ](/ja/memory)**：永続的なコンテキストのための CLAUDE.md ファイルを管理する
- **[コマンド](/ja/commands)**：組み込みコマンドとバンドルされたスキルのリファレンス
- **[権限](/ja/permissions)**：ツールとスキルアクセスを制御する
