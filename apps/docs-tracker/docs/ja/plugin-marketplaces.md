---
title: plugin-marketplaces
source: https://code.claude.com/docs/ja/plugin-marketplaces.md
---

# プラグインマーケットプレイスの作成と配布

> Claude Code 拡張機能を配布するためのプラグインマーケットプレイスを構築およびホストします。

**プラグインマーケットプレイス**は、他のユーザーにプラグインを配布できるカタログです。マーケットプレイスは、一元化された検出、バージョン追跡、自動更新、および複数のソースタイプ（Git リポジトリ、ローカルパスなど）のサポートを提供します。このガイドでは、チームやコミュニティとプラグインを共有するための独自のマーケットプレイスを作成する方法を説明します。

既存のマーケットプレイスからプラグインをインストールしたいですか？[既成プラグインの検出とインストール](/ja/discover-plugins)を参照してください。

概要

マーケットプレイスの作成と配布には、以下が含まれます。

1. **プラグインの作成**：skills、agents、hooks、MCP サーバー、または LSP サーバーを使用して 1 つ以上のプラグインを構築します。このガイドでは、配布するプラグインが既にあることを前提としています。プラグインの作成方法の詳細については、[プラグインの作成](/ja/plugins)を参照してください。
2. **マーケットプレイスファイルの作成**：プラグインとその場所を一覧表示する `marketplace.json` を定義します。[マーケットプレイスファイルの作成](#create-the-marketplace-file)を参照してください。
3. **マーケットプレイスのホスト**：GitHub、GitLab、または別の Git ホストにプッシュします。[マーケットプレイスのホストと配布](#host-and-distribute-marketplaces)を参照してください。
4. **ユーザーと共有**：ユーザーが `/plugin marketplace add` でマーケットプレイスを追加し、個別のプラグインをインストールします。[プラグインの検出とインストール](/ja/discover-plugins)を参照してください。

マーケットプレイスがライブになったら、リポジトリに変更をプッシュして更新できます。ユーザーは `/plugin marketplace update` でローカルコピーを更新します。

チュートリアル：ローカルマーケットプレイスの作成

この例では、1 つのプラグイン（コードレビュー用の `quality-review` skill）を含むマーケットプレイスを作成します。ディレクトリ構造を作成し、skill を追加し、プラグインマニフェストとマーケットプレイスカタログを作成してから、インストールしてテストします。

```bash theme={null}
mkdir -p my-marketplace/.claude-plugin
mkdir -p my-marketplace/plugins/quality-review-plugin/.claude-plugin
mkdir -p my-marketplace/plugins/quality-review-plugin/skills/quality-review
```

`quality-review` skill が何をするかを定義する `SKILL.md` ファイルを作成します。

```markdown my-marketplace/plugins/quality-review-plugin/skills/quality-review/SKILL.md theme={null}
---
description: Review code for bugs, security, and performance
---

Review the code I've selected or the recent changes for:
- Potential bugs or edge cases
- Security concerns
- Performance issues
- Readability improvements

Be concise and actionable.
```

プラグインを説明する `plugin.json` ファイルを作成します。マニフェストは `.claude-plugin/` ディレクトリに配置されます。

```json my-marketplace/plugins/quality-review-plugin/.claude-plugin/plugin.json theme={null}
{
  "name": "quality-review-plugin",
  "description": "Adds a quality-review skill for quick code reviews",
  "version": "1.0.0"
}
```

`version` を設定すると、ユーザーはこのフィールドを変更した場合にのみ更新を受け取ります。そのため、リリースのたびにバージョンを上げてください。`version` を省略し、このマーケットプレイスを git でホストする場合、すべてのコミットが自動的に新しいバージョンとしてカウントされます。[バージョン解決](#version-resolution-and-release-channels)を参照して、適切なアプローチを選択してください。

プラグインを一覧表示するマーケットプレイスカタログを作成します。

```json my-marketplace/.claude-plugin/marketplace.json theme={null}
{
  "name": "my-plugins",
  "owner": {
    "name": "Your Name"
  },
  "plugins": [
    {
      "name": "quality-review-plugin",
      "source": "./plugins/quality-review-plugin",
      "description": "Adds a quality-review skill for quick code reviews"
    }
  ]
}
```

マーケットプレイスを追加し、プラグインをインストールします。

```shell theme={null}
/plugin marketplace add ./my-marketplace
/plugin install quality-review-plugin@my-plugins
```

エディタでコードを選択し、新しい skill を実行します。プラグイン skill はプラグイン名でネームスペース化されます。

```shell theme={null}
/quality-review-plugin:quality-review
```

プラグインが実行できることの詳細（hooks、agents、MCP サーバー、LSP サーバーを含む）については、[プラグイン](/ja/plugins)を参照してください。

**プラグインのインストール方法**：ユーザーがプラグインをインストールすると、Claude Code はプラグインディレクトリをキャッシュロケーションにコピーします。これは、`../shared-utils` のようなパスを使用してプラグインディレクトリの外部のファイルを参照できないことを意味します。これらのファイルはコピーされないためです。

プラグイン間でファイルを共有する必要がある場合は、symlinks を使用します。詳細については、[プラグインキャッシングとファイル解決](/ja/plugins-reference#plugin-caching-and-file-resolution)を参照してください。

マーケットプレイスファイルの作成

リポジトリルートに `.claude-plugin/marketplace.json` を作成します。このファイルは、マーケットプレイスの名前、所有者情報、およびソースを含むプラグインのリストを定義します。

各プラグインエントリには、最低限 `name` と `source`（Claude Code がどこから取得するかを指定）が必要です。利用可能なすべてのフィールドについては、以下の[完全なスキーマ](#marketplace-schema)を参照してください。

```json
{
  "name": "company-tools",
  "owner": {
    "name": "DevTools Team",
    "email": "devtools@example.com"
  },
  "plugins": [
    {
      "name": "code-formatter",
      "source": "./plugins/formatter",
      "description": "Automatic code formatting on save",
      "version": "2.1.0",
      "author": {
        "name": "DevTools Team"
      }
    },
    {
      "name": "deployment-tools",
      "source": {
        "source": "github",
        "repo": "company/deploy-plugin"
      },
      "description": "Deployment automation tools"
    }
  ]
}
```

マーケットプレイススキーマ

必須フィールド

| フィールド | タイプ | 説明 | 例 |
| :- | :- | :- | :- |
| `name` | string | マーケットプレイス識別子（ケバブケース、スペースなし）。これは公開向けです。ユーザーはプラグインをインストールするときに表示されます（例：`/plugin install my-tool@your-marketplace`）。各ユーザーは、マーケットプレイス名ごとに 1 つのマーケットプレイスのみを登録できます。同じ名前の 2 番目のマーケットプレイスを追加すると、最初のマーケットプレイスが置き換わります。1 つのマーケットプレイス名の下に複数のプラグインを公開するには、すべてを [単一の `marketplace.json`](#create-the-marketplace-file) にリストします。 | `"acme-tools"` |
| `owner` | object | マーケットプレイスメンテナー情報（[以下のフィールドを参照](#owner-fields)） | |
| `plugins` | array | 利用可能なプラグインのリスト | 以下を参照 |

**予約名**：以下のマーケットプレイス名は Anthropic の公式使用のために予約されており、サードパーティのマーケットプレイスでは使用できません：`claude-code-marketplace`、`claude-code-plugins`、`claude-plugins-official`、`claude-plugins-community`、`claude-community`、`anthropic-marketplace`、`anthropic-plugins`、`agent-skills`、`anthropic-agent-skills`、`knowledge-work-plugins`、`life-sciences`、`claude-for-legal`、`claude-for-financial-services`、`financial-services-plugins`、`first-party-plugins`、`healthcare`。公式マーケットプレイスになりすましている名前（`official-claude-plugins` や `anthropic-plugins-v2` など）もブロックされています。これらの名前を予約することで、サードパーティのマーケットプレイスが Anthropic 公開ソースとして自らを提示することを防ぎます。

Claude Code は、マーケットプレイスを追加するときだけでなく、マーケットプレイスをロードするたびに予約名を再チェックします。これらの名前の 1 つの下に登録されていたマーケットプレイスが、その名前が予約されるようになると、ロードが停止し、[信頼できないソースから登録されている](/ja/errors#marketplace-is-registered-from-an-untrusted-source)ことを報告します。そのマーケットプレイスを削除し、公式 Anthropic ソースから再度追加してください。新しく予約された名前の影響を受けるサードパーティのマーケットプレイスは、別の名前の下で再度追加するとすぐにロードされます。v2.1.205 より前では、`first-party-plugins` と `healthcare` は予約されておらず、予約名の下に既に登録されているマーケットプレイスはロードされ続けていました。

所有者フィールド

| フィールド | タイプ | 必須 | 説明 |
| :- | :- | :- | :- |
| `name` | string | はい | メンテナーまたはチームの名前 |
| `email` | string | いいえ | メンテナーの連絡先メール |

オプションフィールド

| フィールド | タイプ | 説明 |
| :- | :- | :- |
| `$schema` | string | エディターのオートコンプリートと検証用の JSON Schema URL。Claude Code はロード時にこのフィールドを無視します。 |
| `description` | string | マーケットプレイスの簡潔な説明 |
| `version` | string | マーケットプレイスマニフェストバージョン |
| `metadata.pluginRoot` | string | 相対プラグインソースパスの前に付加される基本ディレクトリ（例：`"./plugins"` を使用すると、`"source": "./plugins/formatter"` の代わりに `"source": "formatter"` と記述できます） |
| `allowCrossMarketplaceDependenciesOn` | array | このマーケットプレイス内のプラグインが依存する可能性のある他のマーケットプレイス。ここにリストされていないマーケットプレイスからの依存関係はインストール時にブロックされます。[別のマーケットプレイスからプラグインに依存する](/ja/plugin-dependencies#depend-on-a-plugin-from-another-marketplace)を参照してください。 |
| `renames` | object | プラグインの以前の `name` から現在の名前へのマッピング、またはプラグインが削除された場合は `null`。マーケットプレイス内のエントリの名前を変更または削除するときに、既存ユーザーが自動的に移行できるようにします。[プラグインの名前変更または削除](#rename-or-remove-a-plugin)を参照してください。Claude Code v2.1.193 以降が必要です。 |

`description` と `version` は後方互換性のため `metadata` の下でも受け入れられます。

プラグインエントリ

`plugins` 配列内の各プラグインエントリは、プラグインとその場所を説明します。[プラグインマニフェストスキーマ](/ja/plugins-reference#plugin-manifest-schema)のフィールド（`description`、`version`、`author`、`commands`、`hooks` など）を含めることができます。さらに、これらのマーケットプレイス固有のフィールド：`source`、`category`、`tags`、`strict`、および `relevance` があります。

必須フィールド

| フィールド | タイプ | 説明 |
| :- | :- | :- |
| `name` | string | プラグイン識別子（ケバブケース、スペースなし）。これは公開向けです。ユーザーはインストール時に表示されます（例：`/plugin install my-plugin@marketplace`）。 |
| `source` | string\|object | プラグインを取得する場所（以下の[プラグインソース](#plugin-sources)を参照） |

オプションプラグインフィールド

**標準メタデータフィールド：**

| フィールド | タイプ | 説明 |
| :- | :- | :- |
| `displayName` | string | UI サーフェスに表示される人間が読める名前。省略された場合は `name` にフォールバックします。スペースと任意の大文字小文字を含めることができます。名前空間指定またはルックアップには使用されません。Claude Code v2.1.143 以降が必要です。 |
| `description` | string | プラグインの簡潔な説明 |
| `version` | string | プラグインバージョン。設定されている場合（ここまたは `plugin.json` で）、プラグインはこの文字列にピン留めされ、ユーザーは変更時にのみ更新を受け取ります。省略すると、git コミット SHA にフォールバックします。[バージョン解決](#version-resolution-and-release-channels)を参照してください。 |
| `author` | object | プラグイン作成者情報（`name` は必須、`email` はオプション） |
| `homepage` | string | プラグインホームページまたはドキュメント URL |
| `repository` | string | ソースコードリポジトリ URL |
| `license` | string | SPDX ライセンス識別子（例：MIT、Apache-2.0） |
| `keywords` | array | プラグイン検出と分類用のタグ |
| `category` | string | 整理用のプラグインカテゴリ |
| `tags` | array | 検索可能性用のタグ |
| `strict` | boolean | `plugin.json` がコンポーネント定義の権限であるかどうかを制御します（デフォルト：true）。以下の[厳密モード](#strict-mode)を参照してください。 |
| `relevance` | object | Claude Code がこのプラグインをユーザーに提案するタイミングを示すシグナル。管理者が管理設定でホワイトリストに登録したマーケットプレイスに対してのみ有効になります。[組織向けプラグインの推奨](/ja/plugin-relevance)を参照してください。Claude Code v2.1.152 以降が必要です。 |
| `defaultEnabled` | boolean | プラグインがインストール後に有効になるかどうか（デフォルト：true）。ユーザーがオプトインするまでプラグインを無効にしてインストールする場合は `false` に設定します。プラグインの `plugin.json` 内の同じフィールドより優先されます。[デフォルト有効化](/ja/plugins-reference#default-enablement)を参照してください。Claude Code v2.1.154 以降が必要です。 |

**コンポーネント設定フィールド：**

| フィールド | タイプ | 説明 |
| :- | :- | :- |
| `skills` | string\|array | `<name>/SKILL.md` を含む skill ディレクトリへのカスタムパス |
| `commands` | string\|array | フラットな `.md` skill ファイルまたはディレクトリへのカスタムパス |
| `agents` | string\|array | agent ファイルへのカスタムパス |
| `hooks` | string\|object | カスタム hooks 設定または hooks ファイルへのパス |
| `mcpServers` | string\|object | MCP サーバー設定または MCP 設定ファイルへのパス |
| `lspServers` | string\|object | LSP サーバー設定または LSP 設定ファイルへのパス |

プラグインソース

プラグインソースは、マーケットプレイスに一覧表示されている各個別プラグインを取得する場所を Claude Code に指示します。これらは `marketplace.json` 内の各プラグインエントリの `source` フィールドで設定されます。

Claude Code がプラグインをローカルマシンにクローンまたはダウンロードした後、プラグインは `~/.claude/plugins/cache` のローカルバージョン管理プラグインキャッシュにコピーされます。

| ソース | タイプ | フィールド | 注記 |
| - | - | - | - |
| 相対パス | `string`（例：`"./my-plugin"`） | なし | マーケットプレイスリポジトリ内のローカルディレクトリ。`./` で始まる必要があります。マーケットプレイスルートに相対的に解決されます。`.claude-plugin/` ディレクトリではありません |
| `github` | object | `repo`、`ref?`、`sha?` | |
| `url` | object | `url`、`ref?`、`sha?` | Git URL ソース |
| `git-subdir` | object | `url`、`path`、`ref?`、`sha?` | Git リポジトリ内のサブディレクトリ。帯域幅を最小化するためにスパースクローンします |
| `npm` | object | `package`、`version?`、`registry?` | `npm install` でインストール |

**マーケットプレイスソースとプラグインソース**：これらは異なる概念で、異なるものを制御します。

- **マーケットプレイスソース**：`marketplace.json` カタログ自体を取得する場所。ユーザーが `/plugin marketplace add` を実行するか、`extraKnownMarketplaces` 設定で設定されます。`ref`（ブランチ/タグ）をサポートしますが、`sha` はサポートしません。
- **プラグインソース**：マーケットプレイスに一覧表示されている個別プラグインを取得する場所。`marketplace.json` 内の各プラグインエントリの `source` フィールドで設定されます。`ref`（ブランチ/タグ）と `sha`（正確なコミット）の両方をサポートします。

例えば、`acme-corp/plugin-catalog`（マーケットプレイスソース）でホストされているマーケットプレイスは、`acme-corp/code-formatter`（プラグインソース）から取得されたプラグインを一覧表示できます。マーケットプレイスソースとプラグインソースは異なるリポジトリを指し、独立して固定されます。

以下の Git ベースのソースタイプは `github`、`url`、および `git-subdir` です。`ref` と `sha` の両方がそれらのいずれかに設定されている場合、`sha` が有効なピンです。Claude Code はピンされたコミットを直接取得してチェックアウトします。

GitHub、GitLab、Bitbucket を含むほとんどの Git ホストでは、ブランチまたは `ref` で指定されたタグが上流で削除されていても、コミットがリポジトリから到達可能である限り、インストールは成功します。AWS CodeCommit などの一部のサーバーは、SHA によるコミットの取得をサポートしていません。これらのサーバーでは、`ref` が存在し、ピンされたコミットがそこから到達可能である必要があります。

相対パス

同じリポジトリ内のプラグインの場合、`./` で始まるパスを使用します。

```json
{
  "name": "my-plugin",
  "source": "./plugins/my-plugin"
}
```

パスはマーケットプレイスルート（`.claude-plugin/` を含むディレクトリ）に相対的に解決されます。上記の例では、`./plugins/my-plugin` は `<repo>/plugins/my-plugin` を指します。`marketplace.json` は `<repo>/.claude-plugin/marketplace.json` に存在していても同じです。`../` を使用してマーケットプレイスルートの外を参照しないでください。

相対パスはマーケットプレイスのローカルコピーに対して解決されるため、ユーザーが Git ソースまたはローカルディレクトリからマーケットプレイスを追加する場合に機能します。ユーザーが `marketplace.json` ファイルへの直接 URL でマーケットプレイスを追加する場合、相対パスは解決されません。そのファイルのみがダウンロードされるためです。URL ベースの配布の場合は、GitHub、npm、または Git URL ソースを使用してください。詳細については、[トラブルシューティング](#plugins-with-relative-paths-fail-in-url-based-marketplaces)を参照してください。

GitHub リポジトリ

```json
{
  "name": "github-plugin",
  "source": {
    "source": "github",
    "repo": "owner/plugin-repo"
  }
}
```

特定のブランチ、タグ、またはコミットに固定できます。

```json
{
  "name": "github-plugin",
  "source": {
    "source": "github",
    "repo": "owner/plugin-repo",
    "ref": "v2.0.0",
    "sha": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0"
  }
}
```

| フィールド | タイプ | 説明 |
| :- | :- | :- |
| `repo` | string | 必須。`owner/repo` 形式の GitHub リポジトリ |
| `ref` | string | オプション。Git ブランチまたはタグ（デフォルトはリポジトリのデフォルトブランチ） |
| `sha` | string | オプション。完全な 40 文字の Git コミット SHA で正確なバージョンに固定 |

Git リポジトリ

```json
{
  "name": "git-plugin",
  "source": {
    "source": "url",
    "url": "https://gitlab.com/team/plugin.git"
  }
}
```

特定のブランチ、タグ、またはコミットに固定できます。

```json
{
  "name": "git-plugin",
  "source": {
    "source": "url",
    "url": "https://gitlab.com/team/plugin.git",
    "ref": "main",
    "sha": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0"
  }
}
```

| フィールド | タイプ | 説明 |
| :- | :- | :- |
| `url` | string | 必須。完全な Git リポジトリ URL（`https://` または `git@`）。`.git` サフィックスはオプションなので、Azure DevOps と AWS CodeCommit の URL（サフィックスなし）が機能します |
| `ref` | string | オプション。Git ブランチまたはタグ（デフォルトはリポジトリのデフォルトブランチ） |
| `sha` | string | オプション。完全な 40 文字の Git コミット SHA で正確なバージョンに固定 |

Git サブディレクトリ

`git-subdir` を使用して、Git リポジトリのサブディレクトリ内に存在するプラグインを指します。Claude Code はスパースな部分クローンを使用してサブディレクトリのみを取得し、大規模なモノレポの帯域幅を最小化します。

```json
{
  "name": "my-plugin",
  "source": {
    "source": "git-subdir",
    "url": "https://github.com/acme-corp/monorepo.git",
    "path": "tools/claude-plugin"
  }
}
```

特定のブランチ、タグ、またはコミットに固定できます。

```json
{
  "name": "my-plugin",
  "source": {
    "source": "git-subdir",
    "url": "https://github.com/acme-corp/monorepo.git",
    "path": "tools/claude-plugin",
    "ref": "v2.0.0",
    "sha": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0"
  }
}
```

`url` フィールドは、GitHub ショートハンド（`owner/repo`）または SSH URL（`git@github.com:owner/repo.git`）も受け入れます。

| フィールド | タイプ | 説明 |
| :- | :- | :- |
| `url` | string | 必須。Git リポジトリ URL、GitHub `owner/repo` ショートハンド、または SSH URL |
| `path` | string | 必須。プラグインを含むリポジトリ内のサブディレクトリパス（例：`"tools/claude-plugin"`） |
| `ref` | string | オプション。Git ブランチまたはタグ（デフォルトはリポジトリのデフォルトブランチ） |
| `sha` | string | オプション。完全な 40 文字の Git コミット SHA で正確なバージョンに固定 |

npm パッケージ

npm パッケージとして配布されるプラグインは、`npm install` を使用してインストールされます。これは、公開 npm レジストリまたはチームがホストするプライベートレジストリ上の任意のパッケージで機能します。

```json
{
  "name": "my-npm-plugin",
  "source": {
    "source": "npm",
    "package": "@acme/claude-plugin"
  }
}
```

特定のバージョンに固定するには、`version` フィールドを追加します。

```json
{
  "name": "my-npm-plugin",
  "source": {
    "source": "npm",
    "package": "@acme/claude-plugin",
    "version": "2.1.0"
  }
}
```

プライベートまたは内部レジストリからインストールするには、`registry` フィールドを追加します。

```json
{
  "name": "my-npm-plugin",
  "source": {
    "source": "npm",
    "package": "@acme/claude-plugin",
    "version": "^2.0.0",
    "registry": "https://npm.example.com"
  }
}
```

| フィールド | タイプ | 説明 |
| :- | :- | :- |
| `package` | string | 必須。パッケージ名またはスコープ付きパッケージ（例：`@org/plugin`） |
| `version` | string | オプション。バージョンまたはバージョン範囲（例：`2.1.0`、`^2.0.0`、`~1.5.0`） |
| `registry` | string | オプション。カスタム npm レジストリ URL。デフォルトはシステム npm レジストリ（通常は npmjs.org） |

高度なプラグインエントリ

この例は、commands、agents、hooks、MCP サーバーのカスタムパスを含む、多くのオプションフィールドを使用するプラグインエントリを示しています。

```json
{
  "name": "enterprise-tools",
  "source": {
    "source": "github",
    "repo": "company/enterprise-plugin"
  },
  "description": "Enterprise workflow automation tools",
  "version": "2.1.0",
  "author": {
    "name": "Enterprise Team",
    "email": "enterprise@example.com"
  },
  "homepage": "https://docs.example.com/plugins/enterprise-tools",
  "repository": "https://github.com/company/enterprise-plugin",
  "license": "MIT",
  "keywords": ["enterprise", "workflow", "automation"],
  "category": "productivity",
  "commands": [
    "./commands/core/",
    "./commands/enterprise/",
    "./commands/experimental/preview.md"
  ],
  "agents": ["./agents/security-reviewer.md", "./agents/compliance-checker.md"],
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/validate.sh"
          }
        ]
      }
    ]
  },
  "mcpServers": {
    "enterprise-db": {
      "command": "${CLAUDE_PLUGIN_ROOT}/servers/db-server",
      "args": ["--config", "${CLAUDE_PLUGIN_ROOT}/config.json"]
    }
  },
  "strict": false
}
```

注目すべき重要な点：

- **`commands` と `agents`**：複数のディレクトリまたは個別のファイルを指定できます。パスはプラグインルートに相対的です。
- **`${CLAUDE_PLUGIN_ROOT}`**：hooks と MCP サーバー設定でこの変数を使用して、プラグインのインストールディレクトリ内のファイルを参照します。プラグインはインストール時にキャッシュロケーションにコピーされるため、これは必要です。永続的なデータまたはプラグイン更新後も保持する必要がある状態については、代わりに [`${CLAUDE_PLUGIN_DATA}`](/ja/plugins-reference#persistent-data-directory) を使用します。
- **`strict: false`**：これが false に設定されているため、プラグインは独自の `plugin.json` を必要としません。マーケットプレイスエントリがすべてを定義します。以下の[厳密モード](#strict-mode)を参照してください。

デフォルトでは、プラグインの skills は、その `source` の下の `skills/` ディレクトリから読み込まれます。`skills` フィールドに一覧表示されているパスはそのスキャンに追加されます。

```json
"skills": ["./skills/", "./extra-skills/"]
```

複数のプラグインエントリがマーケットプレイスルート（`source: "./"` ）で 1 つの `skills/` フォルダを共有する場合、各エントリが独自の skills のみを読み込むように、特定のサブディレクトリを代わりに一覧表示します。

```json
"source": "./",
"skills": ["./skills/code-review", "./skills/docs"]
```

マーケットプレイスルート `source` を使用する場合、一覧表示されたパスはそのエントリの完全なセットであり、共有 `skills/` フォルダ内の他のディレクトリは読み込まれません。`./skills/` 自体またはプラグインルートを一覧表示すると、完全なスキャンが保持されます。一覧表示されたパスが存在しない場合、デフォルトスキャンが代わりに実行されます。

厳密モード

`strict` フィールドは、`plugin.json` がコンポーネント定義（skills、agents、hooks、MCP サーバー、出力スタイル）の権限であるかどうかを制御します。

| 値 | 動作 |
| :- | :- |
| `true`（デフォルト） | `plugin.json` が権限です。マーケットプレイスエントリは追加のコンポーネントで補足でき、両方のソースがマージされます。 |
| `false` | マーケットプレイスエントリが完全な定義です。プラグインに `plugin.json` があってコンポーネントを宣言している場合、それは競合であり、プラグインは読み込みに失敗します。 |

**各モードを使用する場合：**

- **`strict: true`**：プラグインは独自の `plugin.json` を持ち、独自のコンポーネントを管理します。マーケットプレイスエントリは上に追加の skills または hooks を追加できます。これはデフォルトで、ほとんどのプラグインで機能します。
- **`strict: false`**：マーケットプレイスオペレーターが完全に制御したい場合。プラグインリポジトリは生ファイルを提供し、マーケットプレイスエントリはそれらのファイルのどれが skills、agents、hooks などとして公開されるかを定義します。マーケットプレイスがプラグイン作成者の意図と異なる方法でプラグインのコンポーネントを再構成またはキュレートする場合に便利です。

マーケットプレイスのホストと配布

GitHub でホスト（推奨）

GitHub はマーケットプレイスをホストして配布するための推奨される方法です。

1. **リポジトリを作成**：マーケットプレイス用の新しいリポジトリを設定します
2. **マーケットプレイスファイルを追加**：プラグイン定義を含む `.claude-plugin/marketplace.json` を作成します
3. **チームと共有**：ユーザーが `/plugin marketplace add owner/repo` でマーケットプレイスを追加します

**メリット**：組み込みバージョン管理、問題追跡、チームコラボレーション機能。

他の Git サービスでホスト

GitLab、Bitbucket、自己ホスト型サーバーなど、任意の Git ホスティングサービスが機能します。ユーザーは完全なリポジトリ URL で追加します。

```shell
/plugin marketplace add https://gitlab.com/company/plugins.git
```

プライベートリポジトリ

Claude Code はプライベートリポジトリからプラグインをインストールすることをサポートしています。手動インストールと更新の場合、Claude Code は既存の Git 認証情報ヘルパーを使用するため、HTTPS アクセスは `gh auth login`、macOS キーチェーン、または `git-credential-store` 経由で機能し、ターミナルと同じように動作します。SSH アクセスは、ホストが既に `known_hosts` ファイルにあり、キーが `ssh-agent` に読み込まれている限り機能します。Claude Code はホストフィンガープリントとキーパスフレーズの対話的な SSH プロンプトを抑制するためです。

バックグラウンド自動更新は異なる方法で機能します。デフォルトでは、バックグラウンドリフレッシュは `git pull` の Git 認証情報ヘルパーを無効にするため、ヘルパーが設定されている場合でも、プルは HTTPS 経由でプライベートリポジトリに認証できません。SSH リモートは影響を受けません。`ssh-agent` に読み込まれたキーは、手動操作と同じ方法でバックグラウンドプルを認証します。バックグラウンドプルが失敗すると、Claude Code はマーケットプレイスをゼロから再クローンすることにフォールバックします。再クローンは保存された Git 認証情報を使用しますが、大規模なリポジトリでは[タイムアウトする可能性があります](#git-operations-time-out)ため、プライベートマーケットプレイスの自動更新は断続的に失敗する可能性があります。

2 つの設定により、プライベートマーケットプレイスは予測可能に動作します。

- `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE=1` を設定して、バックグラウンドプルが失敗したときに削除して再クローンする代わりに、既存のクローンを保持します。プラグインは最後に同期された状態から機能し続け、`/plugin marketplace update` での手動更新は引き続き認証情報でプルします。
- Git 認証情報ヘルパーを設定します。例えば GitHub の場合は `gh auth setup-git` を使用して、再クローンフォールバックがプロンプトなしで認証できるようにします。

環境に `GITHUB_TOKEN` などのプロバイダートークンを設定しても、それ自体ではバックグラウンド認証は有効になりません。トークンは設定された認証情報ヘルパー（例えば `gh` CLI のヘルパー）を通じてのみ有効になります。これは `GH_TOKEN` と `GITHUB_TOKEN` を読み込みます。

バックグラウンドプル自体が HTTPS 経由で認証するようにするには、グローバル Git URL リライトを設定します。リライトはトークンをリモート URL に埋め込むため、バックグラウンドプルが認証情報ヘルパーを無効にしても有効になり、成功したプルは再クローンフォールバックをスキップします。次の例は、マーケットプレイスリポジトリの URL をアクセストークンを含むようにリライトします。

```bash
git config --global url."https://x-access-token:YOUR_TOKEN@github.com/acme-corp/plugins".insteadOf "https://github.com/acme-corp/plugins"
```

リライトをマーケットプレイスリポジトリまたは組織パスにスコープします。ベースがホストのみのリライトは、マシン上のそのホストへのすべてのフェッチとプッシュに適用され、自分のリポジトリへのプッシュを含む通常の認証情報をオーバーライドします。

各プロバイダーはリライトされた URL で異なるユーザー名を期待し、同じパススコープがすべてのプロバイダーに適用されます。自己ホスト型サーバーの場合、ホスト名をサーバーのホスト名に置き換えます。

| プロバイダー | リライトされた URL フォーム |
| :- | :- |
| GitHub | `https://x-access-token:YOUR_TOKEN@github.com/acme-corp/plugins` |
| GitLab | `https://oauth2:YOUR_TOKEN@gitlab.com/acme-corp/plugins` |
| Bitbucket | `https://x-token-auth:YOUR_TOKEN@bitbucket.org/acme-corp/plugins` |

リライトはトークンを gitconfig にプレーンテキストで保存するため、マーケットプレイスリポジトリへの読み取り専用アクセス権を持つトークンを使用します。

CI/CD 環境では、プライベートリポジトリからプラグインをインストールする前に Git 認証情報ヘルパーを設定します。GitHub Actions では、マーケットプレイスリポジトリへの読み取りアクセス権を持つトークンを `GH_TOKEN` としてエクスポートしてから、`gh auth setup-git` を実行します。デフォルトワークフロートークンはワークフロー自身のリポジトリにのみアクセスできるため、別のリポジトリ内のプライベートマーケットプレイスには個人用アクセストークンまたはアプリトークンが必要です。パイプラインで設定されたグローバル URL リライトもバックグラウンドプルを直接認証します。

配布前にローカルでテスト

共有する前にマーケットプレイスをローカルでテストします。

```shell
/plugin marketplace add ./my-marketplace
/plugin install quality-review-plugin@my-plugins
```

add コマンドの完全な範囲（GitHub、Git URL、ローカルパス、リモート URL）については、[マーケットプレイスの追加](/ja/discover-plugins#add-marketplaces)を参照してください。

チーム向けマーケットプレイスの要求

リポジトリを設定して、チームメンバーがプロジェクトフォルダを信頼するときにマーケットプレイスをインストールするよう自動的に促されるようにできます。マーケットプレイスを `.claude/settings.json` に追加します。

```json
{
  "extraKnownMarketplaces": {
    "company-tools": {
      "source": {
        "source": "github",
        "repo": "your-org/claude-plugins"
      }
    }
  }
}
```

デフォルトで有効にするプラグインを指定することもできます。

```json
{
  "enabledPlugins": {
    "code-formatter@company-tools": true,
    "deployment-tools@company-tools": true
  }
}
```

完全な設定オプションについては、[プラグイン設定](/ja/settings#plugin-settings)を参照してください。

ローカル `directory` または `file` ソースを相対パスで使用する場合、パスはリポジトリのメインチェックアウトに対して解決されます。Git worktrees から Claude Code を実行する場合、パスはメインチェックアウトを指し続けるため、すべての worktrees は同じマーケットプレイスロケーションを共有します。マーケットプレイス状態は、プロジェクトごとではなく、ユーザーごとに 1 回 `~/.claude/plugins/known_marketplaces.json` に保存されます。

コンテナ用にプラグインを事前入力する

コンテナイメージと CI 環境の場合、ビルド時にプラグインディレクトリを事前入力して、Claude Code が実行時にクローンすることなく、マーケットプレイスとプラグインが既に利用可能な状態で起動するようにできます。`CLAUDE_CODE_PLUGIN_SEED_DIR` 環境変数をこのディレクトリを指すように設定します。

複数のシードディレクトリをレイヤーするには、Unix では `:` で、Windows では `;` でパスを区切ります。Claude Code は各ディレクトリを順番に検索し、特定のマーケットプレイスまたはプラグインキャッシュを含む最初のシードが優先されます。

シードディレクトリは `~/.claude/plugins` の構造をミラーリングします。

```
$CLAUDE_CODE_PLUGIN_SEED_DIR/
  known_marketplaces.json
  marketplaces/<name>/...
  cache/<marketplace>/<plugin>/<version>/...
```

シードディレクトリを構築するには、イメージビルド中に Claude Code を 1 回実行し、必要なプラグインをインストールしてから、結果の `~/.claude/plugins` ディレクトリをイメージにコピーして、`CLAUDE_CODE_PLUGIN_SEED_DIR` をそれを指すように設定します。

コピーステップをスキップするには、ビルド中に `CLAUDE_CODE_PLUGIN_CACHE_DIR` をターゲットシードパスに設定して、プラグインが直接そこにインストールされるようにします。

```bash
CLAUDE_CODE_PLUGIN_CACHE_DIR=/opt/claude-seed claude plugin marketplace add your-org/plugins
CLAUDE_CODE_PLUGIN_CACHE_DIR=/opt/claude-seed claude plugin install my-tool@your-plugins
```

その後、コンテナのランタイム環境で `CLAUDE_CODE_PLUGIN_SEED_DIR=/opt/claude-seed` を設定して、Claude Code が起動時にシードから読み込むようにします。

起動時に、Claude Code はシードの `known_marketplaces.json` にあるマーケットプレイスをプライマリ設定に登録し、`cache/` の下にあるプラグインキャッシュを再クローンせずに使用します。これは対話モードと `-p` フラグを使用した非対話モードの両方で機能します。

動作の詳細：

- **読み取り専用**：シードディレクトリは書き込まれません。読み取り専用ファイルシステムで git pull が失敗するため、シードマーケットプレイスの自動更新は無効になります。
- **シードエントリが優先**：シードで宣言されたマーケットプレイスは、起動時にユーザー設定の一致するエントリを上書きします。シードプラグインをオプトアウトするには、マーケットプレイスを削除するのではなく `/plugin disable` を使用します。
- **パス解決**：Claude Code はシードの JSON に保存されているパスを信頼するのではなく、実行時に `$CLAUDE_CODE_PLUGIN_SEED_DIR/marketplaces/<name>/` をプローブしてマーケットプレイスコンテンツを見つけます。これは、シードがビルド時と異なるパスにマウントされている場合でも、シードが正しく機能することを意味します。
- **変更がブロックされます**：シードで管理されているマーケットプレイスに対して `/plugin marketplace remove` または `/plugin marketplace update` を実行すると、管理者にシードイメージを更新するよう指示するガイダンスで失敗します。
- **設定と構成**：`extraKnownMarketplaces` または `enabledPlugins` がシードに既に存在するマーケットプレイスを宣言している場合、Claude Code はクローンする代わりにシードコピーを使用します。

管理マーケットプレイスの制限

プラグインソースを厳密に制御する必要がある組織の場合、管理者は管理設定の [`strictKnownMarketplaces`](/ja/settings#strictknownmarketplaces) 設定を使用して、ユーザーが追加できるプラグインマーケットプレイスを制限できます。また、単一実行のために CLI フラグをサイドロードするプラグイン、エージェント、MCP サーバーを拒否するには、[`disableSideloadFlags`](/ja/settings#available-settings) と組み合わせます。

`strictKnownMarketplaces` が管理設定で設定されている場合、制限動作は値によって異なります。

| 値 | 動作 |
| - | - |
| 未定義（デフォルト） | 制限なし。ユーザーは任意のマーケットプレイスを追加できます |
| 空配列 `[]` | 完全なロックダウン。ユーザーは新しいマーケットプレイスを追加できません |
| ソースのリスト | ユーザーはホワイトリストと正確に一致するマーケットプレイスのみを追加できます |

一般的な設定

すべてのマーケットプレイス追加を無効にする：

```json
{
  "strictKnownMarketplaces": []
}
```

特定のマーケットプレイスのみを許可する：

```json
{
  "strictKnownMarketplaces": [
    {
      "source": "github",
      "repo": "acme-corp/approved-plugins"
    },
    {
      "source": "github",
      "repo": "acme-corp/security-tools",
      "ref": "v2.0"
    },
    {
      "source": "url",
      "url": "https://plugins.example.com/marketplace.json"
    }
  ]
}
```

ホストの正規表現パターンマッチングを使用して、内部 Git サーバーからのすべてのマーケットプレイスを許可する。これは [GitHub Enterprise Server](/ja/github-enterprise-server#plugin-marketplaces-on-ghes) または自己ホスト型 GitLab インスタンスの推奨アプローチです。

```json
{
  "strictKnownMarketplaces": [
    {
      "source": "hostPattern",
      "hostPattern": "^github\\.example\\.com$"
    }
  ]
}
```

パスの正規表現パターンマッチングを使用して、特定のディレクトリからのファイルシステムベースのマーケットプレイスを許可する：

```json
{
  "strictKnownMarketplaces": [
    {
      "source": "pathPattern",
      "pathPattern": "^/opt/approved/"
    }
  ]
}
```

`pathPattern` として `".*"` を使用して、ネットワークソースを `hostPattern` で制御しながら、任意のファイルシステムパスを許可します。

`strictKnownMarketplaces` はユーザーが追加できるものを制限しますが、マーケットプレイスを自動的に登録しません。許可されたマーケットプレイスをユーザーが `/plugin marketplace add` を実行せずに自動的に利用可能にするには、同じ `managed-settings.json` で [`extraKnownMarketplaces`](/ja/settings#extraknownmarketplaces) と組み合わせます。[両方を一緒に使用する](/ja/settings#strictknownmarketplaces)を参照してください。

制限の仕組み

制限はネットワークまたはファイルシステム操作の前にチェックされます。チェックはマーケットプレイス追加時およびプラグインのインストール、更新、リフレッシュ、自動更新時に実行されます。マーケットプレイスがポリシー設定前に追加され、そのソースがホワイトリストと一致しなくなった場合、Claude Code はそこからプラグインをインストールまたは更新することを拒否します。同じ強制が `blockedMarketplaces` に適用されます。

ホワイトリストはほとんどのソースタイプに対して正確なマッチングを使用します。マーケットプレイスが許可されるには、指定されたすべてのフィールドが正確に一致する必要があります。

- GitHub ソースの場合：`repo` は必須で、ホワイトリストで指定されている場合は `ref` または `path` も一致する必要があります
- URL ソースの場合：完全な URL が正確に一致する必要があります
- `hostPattern` ソースの場合：マーケットプレイスホストが正規表現パターンと照合されます
- `pathPattern` ソースの場合：マーケットプレイスのファイルシステムパスが正規表現パターンと照合されます

正確なマッチングは URL を正規化しません。末尾のスラッシュ、`.git` サフィックス、または `ssh://` と `https://` の形式は異なる値として扱われます。組織のマーケットプレイスが複数の URL 形式でクローンできる場合、リテラル URL よりも `hostPattern` エントリを優先して、すべての形式が一致するようにします。

`strictKnownMarketplaces` は[管理設定](/ja/settings#settings-files)で設定されるため、個別のユーザーとプロジェクト設定はこれらの制限をオーバーライドできません。

完全な設定詳細（サポートされているすべてのソースタイプと `extraKnownMarketplaces` との比較を含む）については、[strictKnownMarketplaces リファレンス](/ja/settings#strictknownmarketplaces)を参照してください。

バージョン解決とリリースチャネル

プラグインバージョンはキャッシュパスと更新検出を決定します。解決されたバージョンがユーザーが既に持っているものと一致する場合、`/plugin update` と自動更新はプラグインをスキップします。

Claude Code はプラグインのバージョンを以下の最初のものから解決します。

1. プラグインの `plugin.json` の `version`
2. プラグインのマーケットプレイスエントリの `version`
3. プラグインのソースの Git コミット SHA

Git ベースのソースタイプ `github`、`url`、`git-subdir`、および Git ホスト型マーケットプレイス内の相対パスの場合、`version` を完全に省略でき、すべての新しいコミットが新しいバージョンとして扱われます。これは内部または積極的に開発されているプラグインの最も簡単なセットアップです。

`version` を設定するとプラグインがピンされます。`plugin.json` が `"version": "1.0.0"` を宣言している場合、その文字列を変更せずに新しいコミットをプッシュしても、Claude Code が同じバージョンを見て、キャッシュされたコピーを保持するため、既存のユーザーには何も起こりません。すべてのリリースでフィールドをバンプするか、コミット SHA を使用するために省略します。

`plugin.json` とマーケットプレイスエントリの両方で `version` を設定することを避けてください。`plugin.json` の値は常に無言で優先されるため、古いマニフェストバージョンが `marketplace.json` で設定したバージョンをマスクできます。

リリースチャネルの設定

プラグインの「安定」と「最新」リリースチャネルをサポートするには、同じリポジトリの異なる ref または SHA を指す 2 つのマーケットプレイスを設定できます。その後、[管理設定](/ja/settings#settings-files)を通じて 2 つのマーケットプレイスを異なるユーザーグループに割り当てることができます。

各チャネルは異なるバージョンに解決される必要があります。明示的なバージョンを使用する場合、`plugin.json` は各ピンされた ref で異なる `version` を宣言する必要があります。`version` を省略する場合、異なるコミット SHA が既にチャネルを区別しています。2 つの ref が同じバージョン文字列に解決される場合、Claude Code はそれらを同一として扱い、更新をスキップします。

例

```json
{
  "name": "stable-tools",
  "plugins": [
    {
      "name": "code-formatter",
      "source": {
        "source": "github",
        "repo": "acme-corp/code-formatter",
        "ref": "stable"
      }
    }
  ]
}
```

```json
{
  "name": "latest-tools",
  "plugins": [
    {
      "name": "code-formatter",
      "source": {
        "source": "github",
        "repo": "acme-corp/code-formatter",
        "ref": "latest"
      }
    }
  ]
}
```

チャネルをユーザーグループに割り当てる

管理設定を通じて各マーケットプレイスを適切なユーザーグループに割り当てます。例えば、安定グループは以下を受け取ります。

```json
{
  "extraKnownMarketplaces": {
    "stable-tools": {
      "source": {
        "source": "github",
        "repo": "acme-corp/stable-tools"
      }
    }
  }
}
```

早期アクセスグループは代わりに `latest-tools` を受け取ります。

```json
{
  "extraKnownMarketplaces": {
    "latest-tools": {
      "source": {
        "source": "github",
        "repo": "acme-corp/latest-tools"
      }
    }
  }
}
```

プラグイン依存関係バージョンをピンする

プラグインは依存関係を semver 範囲に制限して、依存関係の更新が依存プラグインを破壊しないようにできます。`{plugin-name}--v{version}` Git タグ規約、範囲構文、および同じ依存関係に対する複数の制約がどのように組み合わされるかについては、[プラグイン依存関係バージョンを制限する](/ja/plugin-dependencies)を参照してください。

プラグインの名前変更または削除

プラグインの `name` はその安定識別子です。ユーザーは `enabledPlugins`、`pluginConfigs`、および `/plugin install` コマンドでそれを参照するため、それを変更するとすべての既存インストールが破壊されます。UI に表示されるラベルを既存インストールを破壊することなく変更するには、[`displayName`](#optional-plugin-fields) を設定して `name` を変更しないままにします。

プラグインの `name` を変更する必要がある場合、または `plugins` 配列からプラグインを削除する場合は、既存ユーザーが `plugin-not-found` エラーを見る代わりに移行するように、トップレベルの `renames` エントリを追加します。自動移行には Claude Code v2.1.193 以降が必要です。各前の名前を現在の名前にマップするか、プラグインが存在しなくなった場合は `null` にマップします。次の例は `formatter` を `code-formatter` に名前変更し、`legacy-linter` が削除されたことを記録します。

```json
{
  "name": "acme-tools",
  "owner": { "name": "Acme" },
  "plugins": [
    { "name": "code-formatter", "source": "./plugins/code-formatter" }
  ],
  "renames": {
    "formatter": "code-formatter",
    "legacy-linter": null
  }
}
```

ユーザーが古い名前がまだ設定に含まれた状態で Claude Code を起動すると、Claude Code は `renames` マップに従います。

- エントリが新しい名前を指している場合、Claude Code はプラグインを新しい名前で読み込み、`Renamed to "code-formatter" in the "acme-tools" marketplace` などの 1 行の通知を表示します。その後、ユーザー、プロジェクト、ローカル設定スコープの `enabledPlugins` と `pluginConfigs` の両方で古いキーを新しいキーに書き直すため、通知は 1 回表示されます。
- `null` エントリの場合、Claude Code は古いキーを削除し、通知はプラグインがマーケットプレイスから削除されたことを報告します。
- 名前変更されたプラグインが `github` または `npm` などのリモートソースを使用する場合、Claude Code は名前変更後に `plugin-cache-miss` を報告し、ユーザーは新しい名前で取得するために 1 回 `/plugin install` を実行する必要があります。

`renames` を追加のみの履歴として扱う：すべてのユーザーが移行することを期待した後でも、古いエントリを所定の位置に保持します。Claude Code はチェーンに従うため、後で `code-formatter` を `formatter-pro` に名前変更する場合は、最初のエントリを編集するのではなく、2 番目のエントリを追加します。元の `formatter` がまだ有効になっているユーザーは、両方のエントリを通じて `formatter-pro` に解決されます。

マップを編集した後、`claude plugin validate .` を実行します。チェーンがサイクルを形成したり、`null` または `plugins` にリストされている名前で終了しないエントリを拒否します。

管理設定とポリシー設定は Claude Code に対して読み取り専用であるため、そこで有効になっているプラグインは自動的に書き直すことができません。名前変更されたプラグインは各セッションで読み込まれ続けますが、管理者が管理設定ファイルの `enabledPlugins` を新しい名前を使用するように更新するまで、名前変更通知は繰り返されます。同じことが `--add-dir` などの他の読み取り専用ソースを通じて有効になっているプラグインに適用されます。

以前のバージョンの Claude Code は `renames` フィールドを無視し、古い名前に対して `plugin-not-found` を報告します。

検証とテスト

共有する前にマーケットプレイスをテストします。

マーケットプレイス JSON 構文を検証します：

```bash
claude plugin validate .
```

または Claude Code 内から：

```shell
/plugin validate .
```

テスト用にマーケットプレイスを追加します：

```shell
/plugin marketplace add ./path/to/marketplace
```

すべてが機能することを確認するためにテストプラグインをインストールします：

```shell
/plugin install test-plugin@marketplace-name
```

完全なプラグインテストワークフローについては、[プラグインをローカルでテスト](/ja/plugins#test-your-plugins-locally)を参照してください。技術的なトラブルシューティングについては、[プラグインリファレンス](/ja/plugins-reference)を参照してください。

CLI からマーケットプレイスを管理する

Claude Code は、スクリプトと自動化のための非対話的な `claude plugin marketplace` サブコマンドを提供します。これらは、対話的なセッション内で利用可能な `/plugin marketplace` コマンドと同等です。

プラグインマーケットプレイス追加

GitHub リポジトリ、Git URL、リモート URL、またはローカルパスからマーケットプレイスを追加します。

```bash
claude plugin marketplace add <source> [options]
```

**引数：**

- `<source>`：GitHub `owner/repo` ショートハンド、Git URL、`marketplace.json` ファイルへのリモート URL、またはローカルディレクトリパス。ブランチまたはタグに固定するには、GitHub ショートハンドに `@ref` を追加するか、Git URL に `#ref` を追加します

URL はスキームを含める必要があります。Claude Code v2.1.196 以降、`gitlab.example.com/team/plugins` のようにスキームなしで入力されたホストは、無効な `owner/repo` ショートハンドとして拒否され、エラーメッセージは `https://` を追加するか、ローカルパスに `./` を使用するよう指示します。以前のバージョンでは、これを GitHub リポジトリパスとして誤読し、GitHub の見つからないエラーでクローン時に失敗します。

**オプション：**

| オプション | 説明 | デフォルト |
| :- | :- | :- |
| `--scope <scope>` | マーケットプレイスを宣言する場所：`user`、`project`、または `local`。[プラグインインストールスコープ](/ja/plugins-reference#plugin-installation-scopes)を参照してください | `user` |
| `--sparse <paths...>` | Git スパースチェックアウト経由で特定のディレクトリにチェックアウトを制限します。モノレポに便利です | |

GitHub から `owner/repo` ショートハンドを使用してマーケットプレイスを追加します。

```bash
claude plugin marketplace add acme-corp/claude-plugins
```

`@ref` を使用して特定のブランチまたはタグに固定します。

```bash
claude plugin marketplace add acme-corp/claude-plugins@v2.0
```

非 GitHub ホスト上の Git URL から追加します。

```bash
claude plugin marketplace add https://gitlab.example.com/team/plugins.git
```

`marketplace.json` ファイルを直接提供するリモート URL から追加します。

```bash
claude plugin marketplace add https://example.com/marketplace.json
```

テスト用にローカルディレクトリから追加します。

```bash
claude plugin marketplace add ./my-marketplace
```

マーケットプレイスをプロジェクトスコープで宣言して、`.claude/settings.json` 経由でチームと共有します。

```bash
claude plugin marketplace add acme-corp/claude-plugins --scope project
```

モノレポの場合、プラグインコンテンツを含むディレクトリにチェックアウトを制限します。

```bash
claude plugin marketplace add acme-corp/monorepo --sparse .claude-plugin plugins
```

プラグインマーケットプレイスリスト

設定されたすべてのマーケットプレイスをリストします。

```bash
claude plugin marketplace list [options]
```

**オプション：**

| オプション | 説明 |
| :- | :- |
| `--json` | JSON として出力 |

`--json` を使用すると、各エントリには `name`、`source`、およびソース固有のフィールドが含まれます：GitHub ソースの場合は `repo`、Git および URL ソースの場合は `url`、ローカルソースの場合は `path`。GitHub および Git ソースには、マーケットプレイスが固定されたブランチまたはタグで追加された場合、`ref` フィールドも含まれます。

プラグインマーケットプレイス削除

設定されたマーケットプレイスを削除します。エイリアス `rm` も受け入れられます。

```bash
claude plugin marketplace remove <name> [options]
```

**引数：**

- `<name>`：削除するマーケットプレイス名。`claude plugin marketplace list` で表示されます。これは渡したソースではなく、`marketplace.json` の `name` です

**オプション：**

| オプション | 説明 | デフォルト |
| :- | :- | :- |
| `--scope <scope>` | 削除を単一の設定スコープに制限します：`user`、`project`、または `local`。[プラグインインストールスコープ](/ja/plugins-reference#plugin-installation-scopes)を参照してください。省略した場合、宣言はすべての編集可能なスコープから削除されます。指定した場合、そのスコープの宣言のみが削除されます。マーケットプレイスが別のスコープで引き続き宣言されている場合、共有状態、キャッシュ、およびインストール済みプラグインデータは保持されます | （すべてのスコープ） |

マーケットプレイスを最後に残ったスコープから削除すると、そこからインストールしたプラグインもアンインストールされます。インストール済みプラグインを失わずにマーケットプレイスを更新するには、`claude plugin marketplace update` を使用してください。

プラグインマーケットプレイス更新

マーケットプレイスをソースから更新して、新しいプラグインとバージョン変更を取得します。

```bash
claude plugin marketplace update [name]
```

**引数：**

- `[name]`：更新するマーケットプレイス名。`claude plugin marketplace list` で表示されます。省略した場合はすべてのマーケットプレイスを更新します

`remove` と `update` の両方は、読み取り専用のシード管理マーケットプレイスに対して実行すると失敗します。すべてのマーケットプレイスを更新する場合、シード管理エントリはスキップされ、他のマーケットプレイスは引き続き更新されます。シード提供プラグインを変更するには、管理者にシードイメージを更新するよう依頼してください。[コンテナ用にプラグインを事前入力する](#pre-populate-plugins-for-containers)を参照してください。

トラブルシューティング

マーケットプレイスが読み込まれない

**症状**：マーケットプレイスを追加できない、またはそこからプラグインが表示されない

**解決策**：

- マーケットプレイス URL がアクセス可能であることを確認します
- `.claude-plugin/marketplace.json` が指定されたパスに存在することを確認します
- `claude plugin validate` または `/plugin validate` を使用して JSON 構文が有効であることを確認します。skill、agent、command frontmatter をチェックするには、各プラグインディレクトリに対してコマンドを実行します
- プライベートリポジトリの場合、アクセス権限があることを確認します

マーケットプレイス検証エラー

マーケットプレイスディレクトリから `claude plugin validate .` または `/plugin validate .` を実行して、問題をチェックします。マーケットプレイスディレクトリを指定した場合、バリデーターは `marketplace.json` のスキーマエラー、重複するプラグイン名、ソースパストラバーサルをチェックします。`source` がローカルパスである各エントリについて、そのプラグイン自体の `plugin.json` も検証し、エントリの `version` が `plugin.json` のものと一致しない場合に警告します。プラグインの `plugin.json` で見つかった問題には、エントリインデックスが接頭辞として付けられ、`plugins[2] plugin.json →` の形式になります。

Claude Code v2.1.196 以降、エントリごとのパスは以下も含みます：

- `source` が `.` であるプラグイン
- `marketplace.json` が `.claude-plugin` ディレクトリの外にある場合に実行され、ソースをファイル自体のディレクトリに対して解決します
- ファイルの別の部分にスキーマエラーがある場合でも、各エントリの問題を報告します

以前のバージョンではマーケットプレイスルートのプラグインをスキップし、`.claude-plugin/marketplace.json` からのみ下降します。

個別のプラグインの `plugin.json` およびその skill、agent、command、hook ファイルを検証するには、プラグインディレクトリ自体に対してコマンドを実行します。例えば `claude plugin validate ./plugins/my-plugin`。一般的なエラー：

| エラー | 原因 | 解決策 |
| :- | :- | :- |
| `File not found: .claude-plugin/marketplace.json` | マニフェストが見つかりません | 必須フィールドを含む `.claude-plugin/marketplace.json` を作成します |
| `Invalid JSON syntax: Unexpected token...` | marketplace.json の JSON 構文エラー | コンマの欠落、余分なコンマ、または引用符なしの文字列をチェックします |
| `Duplicate plugin name "x" found in marketplace` | 2 つのプラグインが同じ名前を共有しています | 各プラグインに一意の `name` 値を指定します |
| `plugins[0].source: Path contains ".."` | ソースパスに `..` が含まれています | マーケットプレイスルートに相対的なパスを使用し、`..` なしで使用します。[相対パス](#relative-paths)を参照してください |
| `YAML frontmatter failed to parse: ...` | skill、agent、またはコマンドファイルの YAML が無効です | frontmatter ブロックの YAML 構文を修正します。実行時にこのファイルはメタデータなしで読み込まれます。プラグインディレクトリを検証する場合のみ報告されます |
| `Invalid JSON syntax: ...`（hooks.json） | 不正な形式の `hooks/hooks.json` | JSON 構文を修正します。不正な形式の `hooks/hooks.json` はプラグイン全体の読み込みを防ぎます。プラグインディレクトリを検証する場合のみ報告されます |

**警告**（ブロッキングなし）：

- `Marketplace has no plugins defined`：`plugins` 配列に少なくとも 1 つのプラグインを追加します
- `No marketplace description provided`：ユーザーがマーケットプレイスを理解するのに役立つように、トップレベルの `description` を追加します
- `Plugin name "x" is not kebab-case`：プラグイン名に大文字、スペース、または特殊文字が含まれています。小文字、数字、ハイフンのみに名前を変更します（例：`my-plugin`）。Claude Code は他の形式を受け入れますが、claude.ai マーケットプレイス同期はそれらを拒否します。

プラグインインストール失敗

**症状**：マーケットプレイスは表示されますが、プラグインインストールが失敗します

**解決策**：

- プラグインソース URL がアクセス可能であることを確認します
- プラグインディレクトリに必須ファイルが含まれていることを確認します
- GitHub ソースの場合、リポジトリが公開されているか、アクセス権限があることを確認します
- プラグインソースを手動でクローン/ダウンロードしてテストします
- ソースが `ref` と `sha` の両方をピンしている場合、削除されたアップストリームブランチまたはタグはほとんどの Git ホスト（GitHub、GitLab、Bitbucket を含む）でインストールをブロックしません。AWS CodeCommit などの SHA でコミットをフェッチすることをサポートしないサーバーでは、`ref` が存在する必要があり、ピンされたコミットがそこから到達可能である必要があります。インストールが失敗し続ける場合は、ピンされたコミットがリポジトリに存在することを確認します

プライベートリポジトリ認証が失敗する

**症状**：プライベートリポジトリからプラグインをインストールするときに認証エラーが発生します

**解決策**：

手動インストールと更新の場合：

- Git プロバイダーで認証されていることを確認します（例：GitHub の場合は `gh auth status` を実行）
- 認証情報ヘルパーが正しく設定されていることを確認します：`git config --global credential.helper`
- リポジトリを手動でクローンして、認証情報が機能することを確認します

バックグラウンド自動更新の場合：

- デフォルトでは、バックグラウンド更新は pull の git 認証情報ヘルパーを無効にするため、pull は HTTPS 経由で認証できません。`ssh-agent` に読み込まれたキーを持つ SSH リモートは引き続き認証します。失敗した pull は、保存された認証情報を使用するが大規模なリポジトリでタイムアウトする可能性がある、スクラッチからの再クローンをトリガーします
- `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE=1` を設定して、バックグラウンド pull が失敗したときに既存のクローンを保持します
- git 認証情報ヘルパー（例：`gh auth setup-git`）を設定して、再クローンフォールバックが認証できるようにします
- 大規模なリポジトリで再クローンがタイムアウトする場合は、[`CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS`](#git-operations-time-out)で制限を増やします
- バックグラウンド pull が直接認証するように、マーケットプレイスリポジトリにスコープされた [git URL 書き換え](#private-repositories)を設定します
- または、認証情報を使用する `/plugin marketplace update <name>` でプライベートマーケットプレイスを手動で更新します

オフライン環境でマーケットプレイス更新が失敗する

**症状**：マーケットプレイス `git pull` がバックグラウンドで失敗し、Claude Code が成功できない再クローンを繰り返し試みます。

**原因**：デフォルトでは、`git pull` が失敗すると、Claude Code はスクラッチから再クローンを試みます。オフラインまたはエアギャップ環境では、再クローンが同じ方法で失敗し、その後の前のキャッシュの復元はベストエフォートです。更新はスタートアップ後にバックグラウンドで実行されるため、スタートアップを遅延させませんが、各セッションは失敗した試みを繰り返し、各 git 操作は [120 秒のタイムアウト](#git-operations-time-out)を待つことができます。

**解決策**：`CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE=1` を設定して、pull が失敗したときに再クローン試行をスキップし、既存のキャッシュを使用し続けます：

```bash
export CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE=1
```

この変数を設定すると、Claude Code は `git pull` 失敗時に古いマーケットプレイスクローンを保持し、最後の既知の良好な状態を使用し続けます。リポジトリに到達できないオフライン展開の場合は、代わりに [`CLAUDE_CODE_PLUGIN_SEED_DIR`](#pre-populate-plugins-for-containers) を使用してビルド時にプラグインディレクトリを事前入力します。

Git 操作がタイムアウトする

**症状**：プラグインインストールまたはマーケットプレイス更新が「Git clone timed out after 120s」または「Git pull timed out after 120s」などのタイムアウトエラーで失敗します。

**原因**：Claude Code は、プラグインリポジトリのクローンやマーケットプレイス更新のプルを含む、すべての Git 操作に 120 秒のタイムアウトを使用します。大規模なリポジトリまたは遅いネットワーク接続がこの制限を超える可能性があります。

**解決策**：`CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS` 環境変数を使用してタイムアウトを増やします。値はミリ秒単位です：

```bash
export CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS=300000  # 5 分
```

相対パスを持つプラグインが URL ベースのマーケットプレイスで失敗する

**症状**：URL（`https://example.com/marketplace.json` など）経由でマーケットプレイスを追加しましたが、`"./plugins/my-plugin"` のような相対パスソースを持つプラグインが「path not found」エラーでインストールに失敗します。

**原因**：URL ベースのマーケットプレイスは `marketplace.json` ファイル自体のみをダウンロードします。サーバーからプラグインファイルをダウンロードしません。マーケットプレイスエントリの相対パスは、ダウンロードされなかったリモートサーバー上のファイルを参照します。

**解決策**：

- **外部ソースを使用**：プラグインエントリを相対パスの代わりに GitHub、npm、または Git URL ソースを使用するように変更します：
  ```json theme={null}
  { "name": "my-plugin", "source": { "source": "github", "repo": "owner/repo" } }
  ```
- **Git ベースのマーケットプレイスを使用**：マーケットプレイスを Git リポジトリでホストし、Git URL で追加します。Git ベースのマーケットプレイスはリポジトリ全体をクローンするため、相対パスが正しく機能します。

インストール後にファイルが見つからない

**症状**：プラグインはインストールされますが、ファイルへの参照が失敗します。特に、プラグインディレクトリの外部のファイル

**原因**：プラグインはインプレイスで使用されるのではなく、キャッシュディレクトリにコピーされます。プラグインディレクトリの外部のファイルを参照するパス（`../shared-utils` など）は、それらのファイルがコピーされないため機能しません。

**解決策**：symlinks とディレクトリ再構成を含む回避策については、[プラグインキャッシングとファイル解決](/ja/plugins-reference#plugin-caching-and-file-resolution)を参照してください。

追加のデバッグツールと一般的な問題については、[デバッグと開発ツール](/ja/plugins-reference#debugging-and-development-tools)を参照してください。

関連項目

- [既成プラグインの検出とインストール](/ja/discover-plugins) - 既存のマーケットプレイスからプラグインをインストール
- [プラグイン](/ja/plugins) - 独自のプラグインの作成
- [プラグインリファレンス](/ja/plugins-reference) - 完全な技術仕様とスキーマ
- [プラグイン設定](/ja/settings#plugin-settings) - プラグイン設定オプション
- [strictKnownMarketplaces リファレンス](/ja/settings#strictknownmarketplaces) - 管理マーケットプレイス制限
