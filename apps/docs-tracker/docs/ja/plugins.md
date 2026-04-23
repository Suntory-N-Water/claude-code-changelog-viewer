---
title: plugins
source: https://code.claude.com/docs/ja/plugins.md
---

# プラグインを作成する

> スキル、エージェント、フック、MCP サーバーで Claude Code を拡張するカスタムプラグインを作成します。

プラグインを使用すると、Claude Code をカスタム機能で拡張でき、プロジェクトとチーム全体で共有できます。このガイドでは、スキル、エージェント、フック、MCP サーバーを使用して独自のプラグインを作成する方法について説明します。

既存のプラグインをインストールしたいですか？[プラグインを検出してインストールする](/ja/discover-plugins)を参照してください。完全な技術仕様については、[プラグインリファレンス](/ja/plugins-reference)を参照してください。

## プラグインとスタンドアロン設定を使い分ける

Claude Code では、カスタムスキル、エージェント、フックを追加する 2 つの方法をサポートしています。

| アプローチ | スキル名 | 最適な用途 |
| :- | :- | :- |
| **スタンドアロン**（`.claude/` ディレクトリ） | `/hello` | 個人的なワークフロー、プロジェクト固有のカスタマイズ、クイック実験 |
| **プラグイン**（`.claude-plugin/plugin.json` を含むディレクトリ） | `/plugin-name:hello` | チームメンバーとの共有、コミュニティへの配布、バージョン管理されたリリース、プロジェクト全体で再利用可能 |

**スタンドアロン設定を使用する場合**：

- 単一のプロジェクト用に Claude Code をカスタマイズしている
- 設定が個人的で共有する必要がない
- スキルやフックをパッケージ化する前に実験している
- `/hello` や `/deploy` のような短いスキル名が必要

**プラグインを使用する場合**：

- 機能をチームまたはコミュニティと共有したい
- 複数のプロジェクト全体で同じスキル/エージェントが必要
- 拡張機能のバージョン管理と簡単な更新が必要
- マーケットプレイスを通じて配布している
- `/my-plugin:hello` のような名前空間付きスキルで問題ない（名前空間はプラグイン間の競合を防ぎます）

`.claude/` でスタンドアロン設定を使用してクイック反復を行い、共有する準備ができたら[既存の設定をプラグインに変換](#convert-existing-configurations-to-plugins)してください。

## クイックスタート

このクイックスタートでは、カスタムスキルを使用してプラグインを作成する手順を説明します。マニフェスト（プラグインを定義する設定ファイル）を作成し、スキルを追加して、`--plugin-dir` フラグを使用してローカルでテストします。

### 前提条件

- Claude Code [インストール済みで認証済み](/ja/quickstart#step-1-install-claude-code)

`/plugin` コマンドが表示されない場合は、Claude Code を最新バージョンに更新してください。アップグレード手順については、[トラブルシューティング](/ja/troubleshooting)を参照してください。

### 最初のプラグインを作成する

すべてのプラグインは、マニフェストとスキル、エージェント、またはフックを含む独自のディレクトリに存在します。今すぐ作成してください。

```bash theme={null}
mkdir my-first-plugin
```

`.claude-plugin/plugin.json` のマニフェストファイルは、プラグインの ID（名前、説明、バージョン）を定義します。Claude Code はこのメタデータを使用して、プラグインマネージャーにプラグインを表示します。

プラグインフォルダ内に `.claude-plugin` ディレクトリを作成します。

```bash theme={null}
mkdir my-first-plugin/.claude-plugin
```

次に、このコンテンツで `my-first-plugin/.claude-plugin/plugin.json` を作成します。

```json my-first-plugin/.claude-plugin/plugin.json theme={null}
{
  "name": "my-first-plugin",
  "description": "A greeting plugin to learn the basics",
  "version": "1.0.0",
  "author": {
    "name": "Your Name"
  }
}
```

| フィールド | 目的 |
| :- | :- |
| `name` | 一意の識別子とスキル名前空間。スキルにはこれが接頭辞として付きます（例：`/my-first-plugin:hello`）。 |
| `description` | プラグインマネージャーでプラグインを参照またはインストールするときに表示されます。 |
| `version` | オプション。設定されている場合、ユーザーはこのフィールドをバンプしたときにのみ更新を受け取ります。省略され、プラグインが git 経由で配布される場合、コミット SHA が使用され、すべてのコミットが新しいバージョンとしてカウントされます。[バージョン管理](/ja/plugins-reference#version-management)を参照してください。 |
| `author` | オプション。属性に役立ちます。 |

`homepage`、`repository`、`license` などの追加フィールドについては、[完全なマニフェストスキーマ](/ja/plugins-reference#plugin-manifest-schema)を参照してください。

スキルは `skills/` ディレクトリに存在します。各スキルは `SKILL.md` ファイルを含むフォルダです。フォルダ名がスキル名になり、プラグインの名前空間が接頭辞として付きます（`my-first-plugin` という名前のプラグイン内の `hello/` は `/my-first-plugin:hello` を作成します）。

プラグインフォルダ内にスキルディレクトリを作成します。

```bash theme={null}
mkdir -p my-first-plugin/skills/hello
```

次に、このコンテンツで `my-first-plugin/skills/hello/SKILL.md` を作成します。

```markdown my-first-plugin/skills/hello/SKILL.md theme={null}
---
description: Greet the user with a friendly message
disable-model-invocation: true
---

Greet the user warmly and ask how you can help them today.
```

`--plugin-dir` フラグを使用して Claude Code を実行し、プラグインを読み込みます。

```bash theme={null}
claude --plugin-dir ./my-first-plugin
```

Claude Code が起動したら、新しいスキルを試してください。

```shell theme={null}
/my-first-plugin:hello
```

Claude がグリーティングで応答します。`/help` を実行して、プラグイン名前空間の下にリストされたスキルを確認してください。

**名前空間を使う理由は？** プラグインスキルは常に名前空間が付きます（`/my-first-plugin:hello` など）。複数のプラグインが同じ名前のスキルを持つ場合の競合を防ぐためです。

名前空間プレフィックスを変更するには、`plugin.json` の `name` フィールドを更新してください。

`$ARGUMENTS` プレースホルダーを使用してユーザー入力をキャプチャすることで、スキルを動的にします。

`SKILL.md` ファイルを更新します。

```markdown my-first-plugin/skills/hello/SKILL.md theme={null}
---
description: Greet the user with a personalized message
---

# Hello Skill

Greet the user named "$ARGUMENTS" warmly and ask how you can help them today. Make the greeting personal and encouraging.
```

`/reload-plugins` を実行して変更を反映させ、スキルを名前で試してください。

```shell theme={null}
/my-first-plugin:hello Alex
```

Claude があなたを名前で挨拶します。スキルに引数を渡す方法の詳細については、[スキル](/ja/skills#pass-arguments-to-skills)を参照してください。

これらの主要なコンポーネントを使用してプラグインを正常に作成およびテストしました。

- **プラグインマニフェスト**（`.claude-plugin/plugin.json`）：プラグインのメタデータを説明します
- **スキルディレクトリ**（`skills/`）：カスタムスキルを含みます
- **スキル引数**（`$ARGUMENTS`）：動的な動作のためにユーザー入力をキャプチャします

`--plugin-dir` フラグは開発とテストに役立ちます。プラグインを他のユーザーと共有する準備ができたら、[プラグインマーケットプレイスを作成して配布する](/ja/plugin-marketplaces)を参照してください。

## プラグイン構造の概要

スキルを使用してプラグインを作成しましたが、プラグインにはさらに多くの機能を含めることができます。カスタムエージェント、フック、MCP サーバー、LSP サーバー、バックグラウンドモニターです。

**よくある間違い**：`commands/`、`agents/`、`skills/`、`hooks/` を `.claude-plugin/` ディレクトリ内に配置しないでください。`plugin.json` のみが `.claude-plugin/` 内に入ります。他のすべてのディレクトリはプラグインルートレベルにある必要があります。

| ディレクトリ | 場所 | 目的 |
| :- | :- | :- |
| `.claude-plugin/` | プラグインルート | `plugin.json` マニフェストを含みます（コンポーネントがデフォルトの場所を使用する場合はオプション） |
| `skills/` | プラグインルート | `<name>/SKILL.md` ディレクトリとしてのスキル |
| `commands/` | プラグインルート | フラットな Markdown ファイルとしてのスキル。新しいプラグインには `skills/` を使用してください |
| `agents/` | プラグインルート | カスタムエージェント定義 |
| `hooks/` | プラグインルート | `hooks.json` のイベントハンドラー |
| `.mcp.json` | プラグインルート | MCP サーバー設定 |
| `.lsp.json` | プラグインルート | コード インテリジェンス用の LSP サーバー設定 |
| `monitors/` | プラグインルート | `monitors.json` のバックグラウンドモニター設定 |
| `bin/` | プラグインルート | プラグインが有効になっている間に Bash ツールの `PATH` に追加される実行可能ファイル |
| `settings.json` | プラグインルート | プラグインが有効になったときに適用されるデフォルト[設定](/ja/settings) |

**次のステップ**：さらに多くの機能を追加する準備ができましたか？[より複雑なプラグインを開発する](#develop-more-complex-plugins)にジャンプして、エージェント、フック、MCP サーバー、LSP サーバーを追加してください。すべてのプラグインコンポーネントの完全な技術仕様については、[プラグインリファレンス](/ja/plugins-reference)を参照してください。

## より複雑なプラグインを開発する

基本的なプラグインに慣れたら、より高度な拡張機能を作成できます。

### プラグインにスキルを追加する

プラグインには、Claude の機能を拡張する[エージェントスキル](/ja/skills)を含めることができます。スキルはモデル呼び出し型です。Claude はタスクコンテキストに基づいて自動的にそれらを使用します。

プラグインルートに `skills/` ディレクトリを追加し、`SKILL.md` ファイルを含むスキルフォルダを追加します。

```text
my-plugin/
├── .claude-plugin/
│   └── plugin.json
└── skills/
    └── code-review/
        └── SKILL.md
```

各 `SKILL.md` には YAML フロントマターと指示が含まれます。Claude がスキルをいつ使用するかを知るように `description` を含めてください。

```yaml
---
description: Reviews code for best practices and potential issues. Use when reviewing code, checking PRs, or analyzing code quality.
---

When reviewing code, check for:
1. Code organization and structure
2. Error handling
3. Security concerns
4. Test coverage
```

プラグインをインストールした後、`/reload-plugins` を実行してスキルを読み込みます。段階的な開示とツール制限を含む完全なスキル作成ガイダンスについては、[エージェントスキル](/ja/skills)を参照してください。

### プラグインに LSP サーバーを追加する

TypeScript、Python、Rust などの一般的な言語については、公式マーケットプレイスから事前構築された LSP プラグインをインストールしてください。既に対応されていない言語のサポートが必要な場合にのみ、カスタム LSP プラグインを作成してください。

LSP（Language Server Protocol）プラグインは Claude にリアルタイムコード インテリジェンスを提供します。公式 LSP プラグインがない言語をサポートする必要がある場合は、プラグインに `.lsp.json` ファイルを追加することで、独自のプラグインを作成できます。

```json .lsp.json theme={null}
{
  "go": {
    "command": "gopls",
    "args": ["serve"],
    "extensionToLanguage": {
      ".go": "go"
    }
  }
}
```

プラグインをインストールするユーザーは、言語サーバーバイナリをマシンにインストールしておく必要があります。

完全な LSP 設定オプションについては、[LSP サーバー](/ja/plugins-reference#lsp-servers)を参照してください。

### プラグインでバックグラウンドモニターを追加する

バックグラウンドモニターを使用すると、プラグインはログ、ファイル、または外部ステータスをバックグラウンドで監視し、イベントが到着したときに Claude に通知できます。Claude Code はプラグインがアクティブな場合、各モニターを自動的に開始するため、Claude にモニターの開始を指示する必要はありません。

プラグインルートに `monitors/monitors.json` ファイルを追加し、モニターエントリの配列を含めます。

```json monitors/monitors.json theme={null}
[
  {
    "name": "error-log",
    "command": "tail -F ./logs/error.log",
    "description": "Application error log"
  }
]
```

`command` からの各 stdout 行は、セッション中に Claude への通知として配信されます。`when` トリガーと変数置換を含む完全なスキーマについては、[モニター](/ja/plugins-reference#monitors)を参照してください。

### プラグインでデフォルト設定を配布する

プラグインは、プラグインルートに `settings.json` ファイルを含めて、プラグインが有効になったときにデフォルト設定を適用できます。現在、`agent` と `subagentStatusLine` キーのみがサポートされています。

`agent` を設定すると、プラグインの[カスタムエージェント](/ja/sub-agents)の 1 つがメインスレッドとしてアクティブになり、そのシステムプロンプト、ツール制限、モデルが適用されます。これにより、プラグインは有効になったときに Claude Code の動作方法をデフォルトで変更できます。

```json settings.json theme={null}
{
  "agent": "security-reviewer"
}
```

この例は、プラグインの `agents/` ディレクトリで定義された `security-reviewer` エージェントをアクティブにします。`settings.json` の設定は、`plugin.json` で宣言された `settings` よりも優先されます。不明なキーは無視されます。

### 複雑なプラグインを整理する

多くのコンポーネントを持つプラグインの場合、ディレクトリ構造を機能別に整理してください。完全なディレクトリレイアウトと整理パターンについては、[プラグインディレクトリ構造](/ja/plugins-reference#plugin-directory-structure)を参照してください。

### プラグインをローカルでテストする

開発中にプラグインをテストするには、`--plugin-dir` フラグを使用してください。これにより、インストールを必要とせずにプラグインが直接読み込まれます。

```bash
claude --plugin-dir ./my-plugin
```

`--plugin-dir` プラグインがインストール済みのマーケットプレイスプラグインと同じ名前を持つ場合、そのセッション中はローカルコピーが優先されます。これにより、最初にアンインストールしなくても、既にインストール済みのプラグインへの変更をテストできます。マネージド設定によって強制的に有効にされたマーケットプレイスプラグインは唯一の例外であり、オーバーライドできません。

プラグインに変更を加えると、`/reload-plugins` を実行して再起動せずに更新を反映させます。これにより、プラグイン、スキル、エージェント、フック、プラグイン MCP サーバー、プラグイン LSP サーバーが再読み込みされます。プラグインコンポーネントをテストします。

- `/plugin-name:skill-name` でスキルを試す
- `/agents` でエージェントが表示されることを確認する
- フックが期待どおりに機能することを確認する

フラグを複数回指定することで、複数のプラグインを一度に読み込むことができます。

```bash theme={null}
claude --plugin-dir ./plugin-one --plugin-dir ./plugin-two
```

### プラグインの問題をデバッグする

プラグインが期待どおりに機能しない場合：

1. **構造を確認する**：ディレクトリが `.claude-plugin/` 内ではなく、プラグインルートにあることを確認してください
2. **コンポーネントを個別にテストする**：各スキル、エージェント、フックを個別に確認してください
3. **検証とデバッグツールを使用する**：CLI コマンドとトラブルシューティング技術については、[デバッグと開発ツール](/ja/plugins-reference#debugging-and-development-tools)を参照してください

### プラグインを共有する

プラグインを共有する準備ができたら：

1. **ドキュメントを追加する**：インストールと使用方法の指示を含む `README.md` を含めます
2. **バージョン管理戦略を選択する**：明示的な `version` を設定するか、git コミット SHA に依存するかを決定してください。[バージョン管理](/ja/plugins-reference#version-management)を参照してください
3. **マーケットプレイスを作成または使用する**：[プラグインマーケットプレイス](/ja/plugin-marketplaces)を通じて配布してインストールします
4. **他のユーザーでテストする**：より広い配布の前に、チームメンバーにプラグインをテストしてもらいます

プラグインがマーケットプレイスに登録されたら、他のユーザーは[プラグインを検出してインストールする](/ja/discover-plugins)の指示を使用してインストールできます。

### プラグインを公式マーケットプレイスに送信する

プラグインを公式 Anthropic マーケットプレイスに送信するには、アプリ内送信フォームの 1 つを使用してください。

- **Claude.ai**：[claude.ai/settings/plugins/submit](https://claude.ai/settings/plugins/submit)
- **Console**：[platform.claude.com/plugins/submit](https://platform.claude.com/plugins/submit)

プラグインが登録されたら、独自の CLI で Claude Code ユーザーにインストールを促すことができます。[CLI からプラグインを推奨する](/ja/plugin-hints)を参照してください。

完全な技術仕様、デバッグ技術、配布戦略については、[プラグインリファレンス](/ja/plugins-reference)を参照してください。

## 既存の設定をプラグインに変換する

`.claude/` ディレクトリにスキルまたはフックが既にある場合は、それらをプラグインに変換して、より簡単に共有および配布できます。

### 移行手順

新しいプラグインディレクトリを作成します。

```bash theme={null}
mkdir -p my-plugin/.claude-plugin
```

`my-plugin/.claude-plugin/plugin.json` にマニフェストファイルを作成します。

```json my-plugin/.claude-plugin/plugin.json theme={null}
{
  "name": "my-plugin",
  "description": "Migrated from standalone configuration",
  "version": "1.0.0"
}
```

既存の設定をプラグインディレクトリにコピーします。

```bash theme={null}
# Copy commands
cp -r .claude/commands my-plugin/

# Copy agents (if any)
cp -r .claude/agents my-plugin/

# Copy skills (if any)
cp -r .claude/skills my-plugin/
```

設定にフックがある場合は、フックディレクトリを作成します。

```bash theme={null}
mkdir my-plugin/hooks
```

`my-plugin/hooks/hooks.json` をフック設定で作成します。`.claude/settings.json` または `settings.local.json` から `hooks` オブジェクトをコピーします。形式は同じです。コマンドはフック入力を stdin で JSON として受け取るため、`jq` を使用してファイルパスを抽出します。

```json my-plugin/hooks/hooks.json theme={null}
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [{ "type": "command", "command": "jq -r '.tool_input.file_path' | xargs npm run lint:fix" }]
      }
    ]
  }
}
```

プラグインを読み込んで、すべてが機能することを確認します。

```bash theme={null}
claude --plugin-dir ./my-plugin
```

各コンポーネントをテストします。コマンドを実行し、`/agents` にエージェントが表示されることを確認し、フックが正しくトリガーされることを確認します。

### 移行時の変更点

| スタンドアロン（`.claude/`） | プラグイン |
| :- | :- |
| 1 つのプロジェクトでのみ利用可能 | マーケットプレイス経由で共有可能 |
| `.claude/commands/` 内のファイル | `plugin-name/commands/` 内のファイル |
| `settings.json` のフック | `hooks/hooks.json` のフック |
| 共有するには手動でコピーする必要がある | `/plugin install` でインストール |

移行後、重複を避けるために `.claude/` から元のファイルを削除できます。読み込まれたときは、プラグインバージョンが優先されます。

## 次のステップ

Claude Code のプラグインシステムを理解したので、異なる目標のための推奨パスを以下に示します。

### プラグインユーザー向け

- [プラグインを検出してインストールする](/ja/discover-plugins)：マーケットプレイスを参照してプラグインをインストール
- [チームマーケットプレイスを設定する](/ja/discover-plugins#configure-team-marketplaces)：チーム用のリポジトリレベルプラグインを設定

### プラグイン開発者向け

- [マーケットプレイスを作成して配布する](/ja/plugin-marketplaces)：プラグインをパッケージ化して共有
- [プラグインリファレンス](/ja/plugins-reference)：完全な技術仕様
- 特定のプラグインコンポーネントをさらに詳しく調べる：
  - [スキル](/ja/skills)：スキル開発の詳細
  - [サブエージェント](/ja/sub-agents)：エージェント設定と機能
  - [フック](/ja/hooks)：イベント処理と自動化
  - [MCP](/ja/mcp)：外部ツール統合
