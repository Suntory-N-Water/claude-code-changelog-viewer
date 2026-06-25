---
title: best-practices
source: https://code.claude.com/docs/ja/best-practices.md
---

# Claude Code のベストプラクティス

> 環境設定から並列セッションでのスケーリングまで、Claude Code を最大限に活用するためのヒントとパターン。

Claude Code は agentic coding 環境です。質問に答えて待つチャットボットとは異なり、Claude Code はファイルを読み取り、コマンドを実行し、変更を加え、あなたが見守ったり、方向を変えたり、完全に任せたりしながら、自律的に問題を解決できます。

これはあなたの作業方法を変えます。自分でコードを書いて Claude にレビューしてもらう代わりに、やりたいことを説明すると Claude がそれをどのように構築するかを考え出します。Claude は探索し、計画し、実装します。

しかし、この自律性にも学習曲線があります。Claude は理解する必要がある特定の制約の中で動作します。

このガイドでは、Anthropic の内部チームと、様々なコードベース、言語、環境で Claude Code を使用しているエンジニアの間で効果的であることが証明されたパターンについて説明します。agentic ループがどのように機能するかについては、[Claude Code の仕組み](/ja/how-claude-code-works)を参照してください。

***

ほとんどのベストプラクティスは 1 つの制約に基づいています。Claude のコンテキストウィンドウはすぐにいっぱいになり、満杯になるにつれてパフォーマンスが低下します。

Claude のコンテキストウィンドウは、すべてのメッセージ、Claude が読み取ったすべてのファイル、およびすべてのコマンド出力を含む、会話全体を保持します。ただし、これはすぐにいっぱいになる可能性があります。単一のデバッグセッションまたはコードベース探索でも、数万のトークンを生成および消費する可能性があります。

LLM のパフォーマンスはコンテキストが満杯になるにつれて低下するため、これは重要です。コンテキストウィンドウがいっぱいになると、Claude は以前の指示を「忘れる」か、より多くの間違いを犯す可能性があります。コンテキストウィンドウは管理する最も重要なリソースです。セッションがどのように満杯になるかを実際に確認するには、スタートアップで何が読み込まれるか、各ファイル読み取りのコストについての[インタラクティブなウォークスルー](/ja/context-window)を参照してください。[カスタムステータスライン](/ja/statusline)でコンテキスト使用量を継続的に追跡し、トークン使用量を削減するための戦略については[トークン使用量を削減](/ja/costs#reduce-token-usage)を参照してください。

***

Claude に自分の作業を検証する方法を与える

Claude が実行できるチェックを与えてください。テスト、ビルド、比較するスクリーンショットです。これは、あなたが見守るセッションと、あなたが立ち去ることができるセッションの違いです。

Claude は、作業が完了したように見えるときに停止します。実行できるチェックがないと、「完了したように見える」が唯一の利用可能なシグナルであり、あなたが検証ループになります。すべての間違いはあなたがそれに気付くのを待ちます。Claude が実行できるパスまたはフェイルを生成するものを与えると、ループは自動的に閉じます。Claude は作業を行い、チェックを実行し、結果を読み、チェックが合格するまで反復します。

チェックは、会話で Claude が読むことができるシグナルを返すものです。テストスイート、ビルド終了コード、リンター、出力を固定値と比較するスクリプト、またはデザインと比較される[ブラウザスクリーンショット](/ja/chrome)です。

| 戦略 | 前 | 後 |
| - | - | - |
| **検証基準を提供する** | *「メールアドレスを検証する関数を実装する」* | *「validateEmail 関数を書く。テストケースの例：[user@example.com](mailto:user@example.com) は true、invalid は false、[user@.com](mailto:user@.com) は false。実装後にテストを実行する」* |
| **UI の変更を視覚的に検証する** | *「ダッシュボードをより良く見えるようにする」* | *「\[スクリーンショットを貼り付け] このデザインを実装する。結果のスクリーンショットを撮り、元のものと比較する。違いをリストアップして修正する」* |
| **症状ではなく根本原因に対処する** | *「ビルドが失敗している」* | *「ビルドがこのエラーで失敗している：\[エラーを貼り付け]。修正して、ビルドが成功することを確認する。根本原因に対処し、エラーを抑制しない」* |

チェックが存在したら、停止をどの程度厳しくゲートするかを決定します。

- **1 つのプロンプトで**：Claude にチェックを実行し、同じメッセージ内で反復するよう求めます。上記の表のように。
- **セッション全体で**：チェックを[`/goal` 条件](/ja/goal)として設定します。別の評価者がすべてのターンの後に再度チェックし、Claude はそれが保持されるまで作業を続けます。
- **決定論的ゲートとして**：[Stop hook](/ja/hooks#stop) がスクリプトとしてチェックを実行し、合格するまでターンが終了するのをブロックします。Claude Code はフックをオーバーライドし、8 回連続でブロックされた後、ターンを終了します。
- **第二の意見によって**：[検証サブエージェント](/ja/sub-agents)または[動的ワークフロー](/ja/workflows)が独自の調査結果をチェックし、新しいモデルが結果を反論しようとするため、作業を行っているエージェントがそれを採点しているわけではありません。

各ステップは、セットアップと注意をトレードオフします。プロンプト版は今日、任意のタスクで機能します。`/goal` と Stop hook 版は、あなたなしで無人実行が正しく完了できるようにするものです。

Claude に成功を主張するのではなく、証拠を示すよう指示してください。テスト出力、実行したコマンドとその戻り値、または結果のスクリーンショットです。証拠を確認することは、検証を自分で再実行するよりも高速であり、監視していなかったセッションでも機能します。

***

最初に探索し、次に計画し、その後コーディングする

研究と計画を実装から分離して、間違った問題を解決することを避けます。

Claude が直接コーディングにジャンプさせると、間違った問題を解決するコードが生成される可能性があります。[Plan Mode](/ja/permission-modes#analyze-before-you-edit-with-plan-mode) を使用して、探索を実行から分離します。

推奨されるワークフローには 4 つのフェーズがあります。

Plan Mode に入ります。Claude はファイルを読み取り、変更を加えずに質問に答えます。

```txt claude (plan mode) theme={null}
read /src/auth and understand how we handle sessions and login.
also look at how we manage environment variables for secrets.
```

Claude に詳細な実装計画を作成するよう依頼します。

```txt claude (plan mode) theme={null}
I want to add Google OAuth. What files need to change?
What's the session flow? Create a plan.
```

`Ctrl+G` を押して、Claude が進む前に、テキストエディタで計画を開いて直接編集します。

Plan Mode を終了し、Claude にコーディングさせ、計画に対して検証します。

```txt claude (default mode) theme={null}
implement the OAuth flow from your plan. write tests for the
callback handler, run the test suite and fix any failures.
```

Claude に説明的なメッセージでコミットし、PR を作成するよう依頼します。

```txt claude (default mode) theme={null}
commit with a descriptive message and open a PR
```

Plan Mode は便利ですが、オーバーヘッドも追加します。

スコープが明確で修正が小さいタスク（タイプミスの修正、ログ行の追加、変数の名前変更など）の場合は、Claude に直接実行するよう依頼します。

計画は、アプローチについて不確実な場合、変更が複数のファイルを変更する場合、または変更されるコードに不慣れな場合に最も役立ちます。差分を 1 文で説明できる場合は、計画をスキップします。

***

プロンプトで具体的なコンテキストを提供する

指示がより正確であるほど、必要な修正が少なくなります。

Claude は意図を推測できますが、あなたの心を読むことはできません。特定のファイルを参照し、制約を述べ、例のパターンを指摘します。

| 戦略 | 前 | 後 |
| - | - | - |
| **タスクをスコープする。** どのファイル、どのシナリオ、テスト設定を指定します。 | *「foo.py のテストを追加する」* | *「ユーザーがログアウトしているエッジケースをカバーする foo.py のテストを書く。モックを避ける。」* |
| **ソースを指摘する。** Claude を質問に答えることができるソースに向けます。 | *「ExecutionFactory がこんなに奇妙な API を持っているのはなぜですか？」* | *「ExecutionFactory の git 履歴を調べて、その API がどのようになったかを要約する」* |
| **既存のパターンを参照する。** Claude をコードベースのパターンに向けます。 | *「カレンダーウィジェットを追加する」* | *「ホームページで既存のウィジェットがどのように実装されているかを見て、パターンを理解する。HotDogWidget.php は良い例です。パターンに従って、ユーザーが月を選択し、前後にページネーションして年を選択できる新しいカレンダーウィジェットを実装する。コードベースで既に使用されているもの以外のライブラリを使用せずにゼロから構築する。」* |
| **症状を説明する。** 症状、可能性のある場所、「修正」の外観を提供します。 | *「ログインバグを修正する」* | *「ユーザーはセッションタイムアウト後にログインが失敗すると報告しています。src/auth/ の認証フロー、特にトークン更新を確認します。問題を再現する失敗するテストを書き、修正する」* |

曖昧なプロンプトは、探索していて方向転換を余裕を持ってできるときに役立つことがあります。「このファイルで何を改善しますか？」のようなプロンプトは、あなたが尋ねることを考えなかったことを表面化させることができます。

リッチコンテンツを提供する

`@` を使用してファイルを参照したり、スクリーンショット/画像を貼り付けたり、データを直接パイプしたりします。

Claude にリッチデータを提供するにはいくつかの方法があります。

- **`@` でファイルを参照する** コードがどこにあるかを説明する代わりに。Claude は応答する前にファイルを読み取ります。
- **画像を直接貼り付ける**。画像をコピー/貼り付けまたはドラッグアンドドロップしてプロンプトに入れます。
- **ドキュメントと API リファレンスの URL を指定する**。`/permissions` を使用して、頻繁に使用されるドメインをホワイトリストに登録します。
- **データをパイプする** `cat error.log | claude` を実行してファイルの内容を直接送信します。
- **Claude に必要なものを取得させる**。Bash コマンド、MCP ツール、またはファイルを読み取ることを使用して、Claude 自身がコンテキストをプルするよう指示します。

***

環境を設定する

いくつかのセットアップステップにより、Claude Code はすべてのセッション全体で大幅に効果的になります。拡張機能の完全な概要と各機能をいつ使用するかについては、[Claude Code を拡張](/ja/features-overview)を参照してください。

効果的な CLAUDE.md を書く

`/init` を実行して、現在のプロジェクト構造に基づいてスターター CLAUDE.md ファイルを生成し、時間をかけて改善します。

CLAUDE.md は Claude がすべての会話の開始時に読む特別なファイルです。Bash コマンド、コードスタイル、ワークフロールールを含めます。これにより、Claude はコードだけからは推測できない永続的なコンテキストを取得します。

`/init` コマンドはコードベースを分析してビルドシステム、テストフレームワーク、コードパターンを検出し、改善するための堅牢な基盤を提供します。

CLAUDE.md ファイルに必須の形式はありませんが、短く人間が読める状態に保ちます。例えば：

```markdown CLAUDE.md theme={null}
# Code style
- Use ES modules (import/export) syntax, not CommonJS (require)
- Destructure imports when possible (eg. import { foo } from 'bar')

# Workflow
- Be sure to typecheck when you're done making a series of code changes
- Prefer running single tests, and not the whole test suite, for performance
```

CLAUDE.md はすべてのセッションで読み込まれるため、広く適用されるもののみを含めます。ドメイン知識またはときどきのみ関連するワークフローについては、代わりに [skills](/ja/skills) を使用します。Claude はそれらをオンデマンドで読み込み、すべての会話を膨らませることなく使用します。

簡潔に保ちます。各行について、次のように尋ねます。*「これを削除すると Claude が間違いを犯しますか？」* そうでない場合は、削除します。膨らんだ CLAUDE.md ファイルは Claude があなたの実際の指示を無視するようにします。

| ✅ 含める | ❌ 除外する |
| - | - |
| Claude が推測できない Bash コマンド | Claude がコードを読むことで理解できるもの |
| デフォルトと異なるコードスタイルルール | Claude が既に知っている標準言語規約 |
| テスト指示と推奨テストランナー | 詳細な API ドキュメント（代わりにドキュメントにリンク） |
| リポジトリのエチケット（ブランチ命名、PR 規約） | 頻繁に変わる情報 |
| プロジェクト固有のアーキテクチャ決定 | 長い説明またはチュートリアル |
| 開発者環境の癖（必須環境変数） | ファイルごとのコードベースの説明 |
| 一般的な落とし穴または明白でない動作 | 「きれいなコードを書く」のような自明なプラクティス |

Claude が CLAUDE.md にルールがあるにもかかわらず、あなたが望まないことをし続ける場合、ファイルはおそらく長すぎて、ルールが失われています。Claude が CLAUDE.md で答えられている質問をあなたに尋ねる場合、フレーズが曖昧かもしれません。CLAUDE.md をコードのように扱う：物事がうまくいかないときにレビューし、定期的に削除し、Claude の動作が実際に変わるかどうかを観察することで変更をテストします。

`@path/to/import` 構文を使用して追加ファイルをインポートすることで、指示を調整できます。

```markdown CLAUDE.md theme={null}
See @README.md for project overview and @package.json for available npm commands.

# Additional Instructions
- Git workflow: @docs/git-instructions.md
- Personal overrides: @~/.claude/my-project-instructions.md
```

CLAUDE.md ファイルはいくつかの場所に配置できます。

- **ホームフォルダ（`~/.claude/CLAUDE.md`）**：すべての Claude セッションに適用されます
- **プロジェクトルート（`./CLAUDE.md`）**：git にチェックインしてチームと共有します
- **プロジェクトルート（`./CLAUDE.local.md`）**：個人的なプロジェクト固有のメモ；このファイルを `.gitignore` に追加して、チームと共有しないようにします
- **親ディレクトリ**：`root/CLAUDE.md` と `root/foo/CLAUDE.md` の両方が自動的にプルされるモノレポに役立ちます
- **子ディレクトリ**：Claude はそれらのディレクトリ内のファイルを操作するときに、子 CLAUDE.md ファイルをオンデマンドでプルします

パーミッションを設定する

[auto mode](/ja/permission-modes#eliminate-prompts-with-auto-mode) を使用して分類器に承認を処理させるか、`/permissions` を使用して特定のコマンドをホワイトリストに登録するか、`/sandbox` を使用して OS レベルの分離を行います。各方法は中断を減らしながら制御を保ちます。

デフォルトでは、Claude Code はシステムを変更する可能性のあるアクション（ファイル書き込み、Bash コマンド、MCP ツールなど）の許可をリクエストします。これは安全ですが、面倒です。10 回目の承認後、あなたは本当にレビューしていません。クリックしているだけです。これらの中断を減らすには 3 つの方法があります。

- **Auto mode**：別の分類器モデルがコマンドをレビューし、スコープエスカレーション、未知のインフラストラクチャ、または敵対的なコンテンツ駆動のアクションのみをブロックします。タスクの一般的な方向を信頼しているが、すべてのステップをクリックしたくない場合に最適です
- **パーミッションホワイトリスト**：安全であることがわかっているツール（`npm run lint` や `git commit` など）を許可します
- **サンドボックス**：OS レベルの分離を有効にして、ファイルシステムとネットワークアクセスを制限し、Claude が定義された境界内でより自由に動作できるようにします

[パーミッションモード](/ja/permission-modes)、[パーミッションルール](/ja/permissions)、[サンドボックス](/ja/sandboxing)の詳細をお読みください。

CLI ツールを使用する

Claude Code に `gh`、`aws`、`gcloud`、`sentry-cli` などの CLI ツールを使用して外部サービスと対話するよう指示します。

CLI ツールは外部サービスと対話する最もコンテキスト効率的な方法です。GitHub を使用する場合は、`gh` CLI をインストールします。Claude は問題の作成、プルリクエストのオープン、コメントの読み取りにそれを使用する方法を知っています。`gh` がなければ、Claude は GitHub API を使用できますが、認証されていないリクエストはしばしばレート制限に達します。

Claude は、それが既に知らない CLI ツールを学ぶのにも効果的です。`Use 'foo-cli-tool --help' to learn about foo tool, then use it to solve A, B, C.` のようなプロンプトを試してください。

MCP サーバーを接続する

`claude mcp add` を実行して、Notion、Figma、またはデータベースなどの外部ツールを接続します。

[MCP サーバー](/ja/mcp)を使用すると、Claude に問題トラッカーから機能を実装したり、データベースをクエリしたり、監視データを分析したり、Figma からデザインを統合したり、ワークフローを自動化したりするよう依頼できます。

フックを設定する

例外なしで毎回発生する必要があるアクションにはフックを使用します。

[フック](/ja/hooks-guide)は Claude のワークフロー内の特定のポイントで自動的にスクリプトを実行します。CLAUDE.md の指示とは異なり、フックは決定論的であり、アクションが発生することを保証します。

Claude はあなたのためにフックを書くことができます。*「すべてのファイル編集後に eslint を実行するフックを書く」* または *「migrations フォルダへの書き込みをブロックするフックを書く」* のようなプロンプトを試してください。`.claude/settings.json` を直接編集してフックを設定し、`/hooks` を実行して設定されているものを参照します。

スキルを作成する

`.claude/skills/` に `SKILL.md` ファイルを作成して、Claude にドメイン知識と再利用可能なワークフローを提供します。

[スキル](/ja/skills)は、プロジェクト、チーム、またはドメイン固有の情報で Claude の知識を拡張します。Claude は関連するときに自動的にそれらを適用するか、`/skill-name` で直接呼び出すことができます。

`.claude/skills/` にディレクトリと `SKILL.md` を追加してスキルを作成します。

```markdown .claude/skills/api-conventions/SKILL.md theme={null}
---
name: api-conventions
description: REST API design conventions for our services
---
# API Conventions
- Use kebab-case for URL paths
- Use camelCase for JSON properties
- Always include pagination for list endpoints
- Version APIs in the URL path (/v1/, /v2/)
```

スキルは、直接呼び出す再利用可能なワークフローを定義することもできます。

```markdown .claude/skills/fix-issue/SKILL.md theme={null}
---
name: fix-issue
description: Fix a GitHub issue
disable-model-invocation: true
---
Analyze and fix the GitHub issue: $ARGUMENTS.

1. Use `gh issue view` to get the issue details
2. Understand the problem described in the issue
3. Search the codebase for relevant files
4. Implement the necessary changes to fix the issue
5. Write and run tests to verify the fix
6. Ensure code passes linting and type checking
7. Create a descriptive commit message
8. Push and create a PR
```

`/fix-issue 1234` を実行して呼び出します。副作用のあるワークフローで、手動でトリガーしたい場合は `disable-model-invocation: true` を使用します。

カスタムサブエージェントを作成する

`.claude/agents/` に特化したアシスタントを定義して、Claude が分離されたタスクに委譲できるようにします。

[サブエージェント](/ja/sub-agents)は独自のコンテキストと独自の許可されたツールセットで実行されます。メインの会話を乱さずに、多くのファイルを読み取ったり、特化した焦点が必要なタスクに役立ちます。

```markdown .claude/agents/security-reviewer.md theme={null}
---
name: security-reviewer
description: Reviews code for security vulnerabilities
tools: Read, Grep, Glob, Bash
model: opus
---
You are a senior security engineer. Review code for:
- Injection vulnerabilities (SQL, XSS, command injection)
- Authentication and authorization flaws
- Secrets or credentials in code
- Insecure data handling

Provide specific line references and suggested fixes.
```

Claude に明示的にサブエージェントを使用するよう指示します。*「サブエージェントを使用してこのコードをセキュリティの問題についてレビューする。」*

プラグインをインストールする

`/plugin` を実行してマーケットプレイスを参照します。プラグインは設定なしでスキル、ツール、統合を追加します。

[プラグイン](/ja/plugins)は、コミュニティと Anthropic からの単一のインストール可能なユニットにスキル、フック、サブエージェント、MCP サーバーをバンドルします。型付き言語を使用する場合は、[コード インテリジェンス プラグイン](/ja/discover-plugins#code-intelligence)をインストールして、Claude に正確なシンボルナビゲーションと編集後の自動エラー検出を提供します。

スキル、サブエージェント、フック、MCP の選択に関するガイダンスについては、[Claude Code を拡張](/ja/features-overview#match-features-to-your-goal)を参照してください。

***

効果的にコミュニケーションする

Claude Code との通信方法は、結果の品質に大きく影響します。

コードベースの質問をする

シニアエンジニアに尋ねるような質問を Claude にしてください。

新しいコードベースにオンボーディングするときは、Claude Code を学習と探索に使用します。別のエンジニアに尋ねるのと同じ種類の質問を Claude に尋ねることができます。

- ロギングはどのように機能しますか？
- 新しい API エンドポイントを作成するにはどうすればよいですか？
- `foo.rs` の 134 行目の `async move { ... }` は何をしていますか？
- `CustomerOnboardingFlowImpl` はどのエッジケースを処理しますか？
- このコードが 333 行目で `bar()` の代わりに `foo()` を呼び出すのはなぜですか？

Claude Code をこのように使用することは、効果的なオンボーディングワークフローであり、ラップアップ時間を改善し、他のエンジニアの負荷を軽減します。特別なプロンプトは必要ありません。直接質問してください。

Claude にあなたにインタビューさせる

より大きな機能については、Claude に最初にあなたにインタビューさせます。最小限のプロンプトで開始し、Claude に `AskUserQuestion` ツールを使用してあなたにインタビューするよう依頼します。

Claude は、技術的な実装、UI/UX、エッジケース、トレードオフなど、あなたがまだ考えていないことについて質問します。

```text
I want to build [brief description]. Interview me in detail using the AskUserQuestion tool.

Ask about technical implementation, UI/UX, edge cases, concerns, and tradeoffs. Don't ask obvious questions, dig into the hard parts I might not have considered.

Keep interviewing until we've covered everything, then write a complete spec to SPEC.md.
```

仕様が完成したら、新しいセッションを開始して実行します。新しいセッションはクリーンなコンテキストを持ち、実装に完全に焦点を当てており、参照する書かれた仕様があります。

最も有用な仕様は自己完結型です。関連するファイルとインターフェースに名前を付け、スコープ外のものを述べ、機能が機能することを証明するエンドツーエンド検証ステップで終わります。仕様を正確にするのに費やした時間は、実装を見守るのに費やした時間よりも多くの見返りがあります。

***

セッションを管理する

会話は永続的で可逆的です。これを有利に使用してください。

早期かつ頻繁に方向転換する

Claude が軌道を外れていることに気付いたらすぐに修正してください。

最良の結果は、タイトなフィードバックループから生まれます。Claude は時々最初の試みで問題を完全に解決しますが、それを迅速に修正することは一般的により良い解決策をより速く生成します。

- **`Esc`**：`Esc` キーで Claude の途中のアクションを停止します。コンテキストは保持されるため、リダイレクトできます。
- **`Esc + Esc` または `/rewind`**：`Esc` を 2 回押すか `/rewind` を実行して、巻き戻しメニューを開き、以前の会話とコード状態を復元するか、選択したメッセージから要約します。
- **`"Undo that"`**：Claude に変更を元に戻すよう依頼します。
- **`/clear`**：関連のないタスク間でコンテキストをリセットします。関連のないコンテキストを持つ長いセッションはパフォーマンスを低下させる可能性があります。

1 つのセッションで同じ問題について Claude を 2 回以上修正した場合、コンテキストは失敗したアプローチで乱雑です。`/clear` を実行し、学んだことを組み込んだより具体的なプロンプトで新しく開始します。より良いプロンプトを持つクリーンなセッションは、ほぼ常に蓄積された修正を持つ長いセッションを上回ります。

コンテキストを積極的に管理する

関連のないタスク間で `/clear` を実行してコンテキストをリセットします。

Claude Code はコンテキスト制限に近づくと会話履歴を自動的にコンパクトにします。これにより、重要なコードと決定を保持しながらスペースを解放します。

長いセッション中に、Claude のコンテキストウィンドウは関連のない会話、ファイルの内容、コマンドで満杯になる可能性があります。これはパフォーマンスを低下させ、時々 Claude を気を散らすことができます。

- タスク間で頻繁に `/clear` を使用してコンテキストウィンドウを完全にリセットします
- 自動コンパクションがトリガーされると、Claude は最も重要なもの（コードパターン、ファイル状態、主要な決定を含む）を要約します
- より多くの制御のために、`/compact <instructions>` を実行します。例えば `/compact Focus on the API changes`
- 会話の一部のみをコンパクトするには、`Esc + Esc` または `/rewind` を使用し、メッセージチェックポイントを選択し、**ここから要約** または **ここまで要約** を選択します。最初のものはそのポイント以降のメッセージを凝縮し、以前のコンテキストは保持されます。2 番目のものは以前のメッセージを凝縮し、最近のものは完全に保持されます。[復元と要約](/ja/checkpointing#restore-vs-summarize)を参照してください。
- CLAUDE.md でコンパクション動作をカスタマイズします。`"When compacting, always preserve the full list of modified files and any test commands"` のような指示を使用して、重要なコンテキストが要約を生き残ることを確認します
- 会話履歴に入らない簡単な質問については、[`/btw`](/ja/interactive-mode#side-questions-with-%2Fbtw) を使用します。答えは却下可能なオーバーレイに表示され、会話履歴に入らないため、コンテキストを増やさずに詳細をチェックできます。

調査にサブエージェントを使用する

`"use subagents to investigate X"` で研究を委譲します。彼らは別のコンテキストで探索し、実装のためにメインの会話をクリーンに保ちます。

コンテキストが基本的な制約であるため、サブエージェントは利用可能な最も強力なツールの 1 つです。Claude がコードベースを研究するとき、多くのファイルを読み取り、すべてがコンテキストを消費します。サブエージェントは別のコンテキストウィンドウで実行され、要約を報告します。

```text
Use subagents to investigate how our authentication system handles token
refresh, and whether we have any existing OAuth utilities I should reuse.
```

サブエージェントはコードベースを探索し、関連するファイルを読み取り、メインの会話を乱さずにすべての調査結果を報告します。

Claude が何かを実装した後、検証にサブエージェントを使用することもできます。

```text
use a subagent to review this code for edge cases
```

チェックポイントで巻き戻す

送信するすべてのプロンプトはチェックポイントを作成します。以前のチェックポイントに会話、コード、またはその両方を復元できます。

Claude は変更前に自動的にファイルをスナップショットするため、チェックポイントはそれらを復元できます。`Escape` をダブルタップするか `/rewind` を実行して、巻き戻しメニューを開きます。会話のみを復元したり、コードのみを復元したり、両方を復元したり、選択したメッセージから要約したりできます。詳細については、[チェックポイント](/ja/checkpointing)を参照してください。

すべての動きを慎重に計画する代わりに、Claude に何か危険なことを試すよう指示できます。うまくいかない場合は、巻き戻して別のアプローチを試してください。チェックポイントはセッション全体で保持されるため、ターミナルを閉じても後で巻き戻すことができます。

チェックポイントは Claude が行った変更のみを追跡します。外部プロセスではありません。これは git の代替ではありません。

会話を再開する

`/rename` でセッションに名前を付け、ブランチのように扱います。各ワークストリームは独自の永続的なコンテキストを取得します。

Claude Code は会話をローカルに保存するため、タスクが複数のセッションにまたがる場合、コンテキストを再度説明する必要はありません。`claude --continue` を実行して最新のセッションを選択するか、`claude --resume` を実行してリストから選択します。`oauth-migration` などの説明的な名前でセッションに名前を付けて、後で見つけやすくします。[セッションを管理](/ja/sessions)を参照して、再開、ブランチ、命名制御の完全なセットを確認してください。

***

自動化とスケール

1 つの Claude で効果的になったら、並列セッション、非対話型モード、ファンアウトパターンで出力を乗算します。

これまでのすべては、1 人の人間、1 つの Claude、1 つの会話を想定しています。しかし、Claude Code は水平にスケールします。このセクションのテクニックは、より多くのことを成し遂げる方法を示しています。

非対話型モードを実行する

CI、プリコミットフック、またはスクリプトで `claude -p "prompt"` を使用します。ストリーミング JSON 出力の場合は `--output-format stream-json --verbose` を追加します。

`claude -p "your prompt"` を使用すると、セッションなしで Claude を非対話的に実行できます。[非対話型モード](/ja/headless)は、Claude を CI パイプライン、プリコミットフック、または自動化されたワークフローに統合する方法です。出力形式を使用すると、結果をプログラムで解析できます。プレーンテキスト、JSON、またはストリーミング JSON です。

```bash
# One-off queries
claude -p "Explain what this project does"

# Structured output for scripts
claude -p "List all API endpoints" --output-format json

# Streaming for real-time processing
claude -p "Analyze this log file" --output-format stream-json --verbose
```

複数の Claude セッションを実行する

複数の Claude セッションを並列で実行して、開発を高速化し、分離された実験を実行するか、複雑なワークフローを開始します。

自分で行いたい調整の量に合わせて、並列アプローチを選択します。

- [Worktrees](/ja/worktrees)：分離された git チェックアウトで個別の CLI セッションを実行して、編集が衝突しないようにします
- [デスクトップアプリ](/ja/desktop#work-in-parallel-with-sessions)：複数のローカルセッションを視覚的に管理します。各セッションは独自の worktree にあります
- [Web 上の Claude Code](/ja/claude-code-on-the-web)：Anthropic が管理するクラウドインフラストラクチャで分離された VM で実行します
- [エージェントチーム](/ja/agent-teams)：共有タスク、メッセージング、チームリーダーを備えた複数のセッションの自動調整

作業を並列化することを超えて、複数のセッションは品質に焦点を当てたワークフローを有効にします。新しいコンテキストは、Claude がちょうど書いたコードに偏らないため、コードレビューを改善します。

例えば、Writer/Reviewer パターンを使用します。

| セッション A（ライター） | セッション B（レビュアー） |
| - | - |
| `Implement a rate limiter for our API endpoints` | |
| | `Review the rate limiter implementation in @src/middleware/rateLimiter.ts. Look for edge cases, race conditions, and consistency with our existing middleware patterns.` |
| `Here's the review feedback: [Session B output]. Address these issues.` | |

テストで同様のことを行うことができます。1 つの Claude にテストを書かせ、別の Claude にそれらを渡すコードを書かせます。

ファイル全体にファンアウトする

各タスクに対して `claude -p` を呼び出すループを実行します。バッチ操作のスコープパーミッションに `--allowedTools` を使用します。

大規模な移行または分析の場合、多くの並列 Claude 呼び出し全体で作業を配布できます。

Claude に移行が必要なすべてのファイルをリストさせます（例えば、`list all 2,000 Python files that need migrating`）

```bash theme={null}
for file in $(cat files.txt); do
  claude -p "Migrate $file from React to Vue. Return OK or FAIL." \
    --allowedTools "Edit,Bash(git commit *)"
done
```

最初の 2～3 ファイルで何が悪いかに基づいてプロンプトを改善し、完全なセットで実行します。`--allowedTools` フラグは Claude が何ができるかを制限します。これは無人で実行しているときに重要です。

Claude を既存のデータ/処理パイプラインに統合することもできます。

```bash
claude -p "<your prompt>" --output-format json | your_command
```

開発中は `--verbose` を使用し、本番環境ではオフにします。

auto mode で自律的に実行する

無中断の実行とバックグラウンドのセーフティチェックについては、[auto mode](/ja/permission-modes#eliminate-prompts-with-auto-mode) を使用します。分類器モデルはコマンドを実行前にレビューし、スコープエスカレーション、未知のインフラストラクチャ、敵対的なコンテンツ駆動のアクションをブロックしながら、ルーチンワークをプロンプトなしで進めさせます。

```bash
claude --permission-mode auto -p "fix all lint errors"
```

非対話型実行で `-p` フラグを使用する場合、分類器が繰り返しアクションをブロックするとき、フォールバックするユーザーがいないため、auto mode は中止します。[auto mode がフォールバックするとき](/ja/permission-modes#when-auto-mode-falls-back)のしきい値を参照してください。

敵対的なレビューステップを追加する

タスクが完了したと見なす前に、サブエージェントに新しいコンテキストで diff をレビューさせ、ギャップを報告させます。

Claude が無人で作業する期間が長いほど、作業が完了したと見なす前に独立したチェックが重要になります。新しい[サブエージェント](/ja/sub-agents)コンテキストで実行されるレビュアーは、diff と提供されたクライテリアのみを見て、変更を生成した推論は見ないため、独自の条件で結果を評価します。

正確性チェックの場合、バンドルされた [`/code-review` スキル](/ja/commands)を実行します。これは新しいサブエージェントで現在の diff をバグについてレビューし、検出結果をセッションに返します。代わりに diff をプランに対してチェックするには、レビュープロンプトを自分で作成します。チェックする作業、チェック対象のプラン、および検出結果として何がカウントされるかを名前付けします。

```text
Use a subagent to review the rate limiter diff against PLAN.md. Check that
every requirement is implemented, the listed edge cases have tests, and
nothing outside the task's scope changed. Report gaps, not style preferences.
```

レビュアーはサブエージェントとして実行されるため、実装セッションはギャップを直接受け取り、ウィンドウ間で検出結果をコピーすることなく、それらを修正して再レビューできます。より長い自律実行の場合、[エージェントチーム](/ja/agent-teams)は、スポットチェックされた検出結果を記録しながら、多くのタスク全体でこのループを続けることができます。

ギャップを見つけるようにプロンプトされたレビュアーは、作業が健全であっても、通常はいくつかを報告します。それはそれが求められたことだからです。すべての検出結果を追求することは、過度なエンジニアリングにつながります。追加の抽象化レイヤー、防御的なコード、および発生できないケースのテストです。レビュアーに、正確性または記載された要件に影響するギャップのみをフラグ付けするよう指示し、残りはオプションとして扱います。

***

一般的な失敗パターンを避ける

これらは一般的な間違いです。早期に認識することで時間を節約できます。

- **キッチンシンクセッション。** 1 つのタスクで開始し、関連のないことを Claude に尋ねてから、最初のタスクに戻ります。コンテキストは関連のない情報でいっぱいです。
  > **修正**：関連のないタスク間で `/clear` を実行します。
- **何度も修正する。** Claude が何か間違ったことをし、修正し、まだ間違っています。修正します。コンテキストは失敗したアプローチで乱雑です。
  > **修正**：2 回の失敗した修正の後、`/clear` を実行し、学んだことを組み込んだより良い初期プロンプトを書きます。
- **過度に指定された CLAUDE.md。** CLAUDE.md が長すぎる場合、Claude は重要なルールがノイズに失われるため、半分を無視します。
  > **修正**：容赦なく削除します。Claude が指示なしで既に何かを正しく行う場合、削除するか、フックに変換します。
- **信頼してから検証するギャップ。** Claude はもっともらしく見える実装を生成しますが、エッジケースを処理しません。
  > **修正**：常に検証を提供します（テスト、スクリプト、スクリーンショット）。検証できない場合は、出荷しないでください。
- **無限探索。** スコープなしで何かを「調査」するよう Claude に依頼します。Claude は数百のファイルを読み取り、コンテキストを満たします。
  > **修正**：調査を狭くスコープするか、サブエージェントを使用して、探索がメインコンテキストを消費しないようにします。

***

直感を開発する

このガイドのパターンは固定されていません。それらはすべての状況で一般的にうまく機能する出発点ですが、すべての状況に最適ではない可能性があります。

時々、あなたは 1 つの複雑な問題に深く入り込んでいて、履歴が価値があるため、コンテキストを蓄積させるべきです。時々、タスクが探索的であるため、計画をスキップして Claude にそれを理解させるべきです。時々、曖昧なプロンプトは、Claude が問題をどのように解釈するかを制約する前に見たいため、正確です。

何が機能するかに注意を払います。Claude が素晴らしい出力を生成するとき、あなたが何をしたかに注意してください。プロンプト構造、提供したコンテキスト、あなたがいたモード。Claude が苦労するとき、なぜ尋ねてください。コンテキストがノイズが多すぎましたか？プロンプトが曖昧すぎましたか？タスクが 1 回のパスには大きすぎましたか？

時間をかけて、ガイドが捉えることができない直感を開発します。具体的にするべき時と開放的にするべき時、計画すべき時と探索すべき時、コンテキストをクリアすべき時と蓄積させるべき時を知ります。

関連リソース

- [Claude Code の仕組み](/ja/how-claude-code-works)：agentic ループ、ツール、コンテキスト管理
- [Claude Code を拡張](/ja/features-overview)：スキル、フック、MCP、サブエージェント、プラグイン
- [一般的なワークフロー](/ja/common-workflows)：デバッグ、テスト、PR などのステップバイステップレシピ
- [CLAUDE.md](/ja/memory)：プロジェクト規約と永続的なコンテキストを保存する
