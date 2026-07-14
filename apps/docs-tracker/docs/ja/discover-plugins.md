---
title: discover-plugins
source: https://code.claude.com/docs/ja/discover-plugins.md
---

# マーケットプレイスから事前構築されたプラグインを発見してインストールする

> マーケットプレイスからプラグインを検索してインストールし、Claude Code を新しいスキル、エージェント、機能で拡張します。

プラグインは Claude Code をスキル、エージェント、フック、MCP サーバーで拡張します。プラグインマーケットプレイスは、これらの拡張機能を自分で構築することなく発見してインストールするのに役立つカタログです。

独自のマーケットプレイスを作成して配布したいですか？[プラグインマーケットプレイスを作成して配布する](/ja/plugin-marketplaces)を参照してください。

マーケットプレイスの仕組み

マーケットプレイスは、他の誰かが作成して共有したプラグインのカタログです。マーケットプレイスを使用するのは 2 段階のプロセスです：

これにより、カタログが Claude Code に登録され、利用可能なものを参照できるようになります。プラグインはまだインストールされていません。

カタログを参照して、必要なプラグインをインストールします。

アプリストアを追加するようなものと考えてください。ストアを追加するとそのコレクションを参照できるようになりますが、どのアプリをダウンロードするかは個別に選択します。

公式 Anthropic マーケットプレイス

公式 Anthropic マーケットプレイス（`claude-plugins-official`）は Claude Code を起動すると自動的に利用可能になります。`/plugin` を実行して **Discover** タブに移動し、利用可能なものを参照するか、[claude.com/plugins](https://claude.com/plugins)でカタログを表示してください。

公式マーケットプレイスからプラグインをインストールするには、`/plugin install <name>@claude-plugins-official` を使用します。たとえば、GitHub 統合をインストールするには：

```shell
/plugin install github@claude-plugins-official
```

Claude Code がプラグインがどのマーケットプレイスにも見つからないと報告する場合、マーケットプレイスが見つからないか古い可能性があります。`/plugin marketplace update claude-plugins-official` を実行して更新するか、まだ追加していない場合は `/plugin marketplace add anthropics/claude-plugins-official` を実行してください。その後、インストールを再試行してください。

公式マーケットプレイスは Anthropic によって管理されており、掲載は Anthropic の裁量です。アプリ内送信フォームはプラグインを[コミュニティマーケットプレイス](#community-marketplace)に追加します。公式マーケットプレイスには追加されません。プラグインを独立して配布するには、[独自のマーケットプレイスを作成](/ja/plugin-marketplaces)してユーザーと共有してください。

公式マーケットプレイスには、プラグインのいくつかのカテゴリが含まれています：

コード インテリジェンス

コード インテリジェンス プラグインは Claude Code の組み込み LSP ツールを有効にし、Claude が定義にジャンプしたり、参照を見つけたり、編集直後に型エラーを確認したりできるようにします。これらのプラグインは [Language Server Protocol](https://microsoft.github.io/language-server-protocol/) 接続を構成します。これは VS Code のコード インテリジェンスを強化する同じテクノロジーです。

これらのプラグインでは、言語サーバーバイナリがシステムにインストールされている必要があります。言語サーバーが既にインストールされている場合、プロジェクトを開くと Claude は対応するプラグインをインストールするよう促す場合があります。

| 言語 | プラグイン | 必要なバイナリ |
| :- | :- | :- |
| C/C++ | `clangd-lsp` | `clangd` |
| C# | `csharp-lsp` | `csharp-ls` |
| Go | `gopls-lsp` | `gopls` |
| Java | `jdtls-lsp` | `jdtls` |
| Kotlin | `kotlin-lsp` | `kotlin-language-server` |
| Lua | `lua-lsp` | `lua-language-server` |
| PHP | `php-lsp` | `intelephense` |
| Python | `pyright-lsp` | `pyright-langserver` |
| Rust | `rust-analyzer-lsp` | `rust-analyzer` |
| Swift | `swift-lsp` | `sourcekit-lsp` |
| TypeScript | `typescript-lsp` | `typescript-language-server` |

[他の言語用に独自の LSP プラグインを作成](/ja/plugins-reference#lsp-servers)することもできます。

プラグインをインストール後に `/plugin` Errors タブに `Executable not found in $PATH` が表示される場合は、上記の表から必要なバイナリをインストールしてください。

コード インテリジェンス プラグインから Claude が得られるもの

コード インテリジェンス プラグインがインストールされ、その言語サーバーバイナリが利用可能になると、Claude は 2 つの機能を得られます：

- **自動診断**: Claude が行うすべてのファイル編集後、言語サーバーは変更を分析し、エラーと警告を自動的に報告します。Claude はコンパイラやリンターを実行することなく、型エラー、不足しているインポート、構文の問題を確認します。Claude がエラーを導入した場合、それに気付いて同じターンで問題を修正します。これはプラグインをインストール以外の設定は必要ありません。「diagnostics found」インジケーターが表示されたときに **Ctrl+O** を押すと、診断をインラインで確認できます。
- **コード ナビゲーション**: Claude は言語サーバーを使用して定義にジャンプしたり、参照を見つけたり、ホバーで型情報を取得したり、シンボルをリストしたり、実装を見つけたり、呼び出し階層をトレースしたりできます。これらの操作により、Claude は grep ベースの検索よりも正確なナビゲーションが可能になりますが、言語と環境によって可用性が異なる場合があります。

問題が発生した場合は、[コード インテリジェンスのトラブルシューティング](#code-intelligence-issues)を参照してください。

外部統合

これらのプラグインは事前構成された [MCP サーバー](/ja/mcp)をバンドルしているため、手動セットアップなしで Claude を外部サービスに接続できます：

- **ソース管理**: `github`、`gitlab`
- **プロジェクト管理**: `atlassian`（Jira/Confluence）、`asana`、`linear`、`notion`
- **デザイン**: `figma`
- **インフラストラクチャ**: `vercel`、`firebase`、`supabase`
- **コミュニケーション**: `slack`
- **監視**: `sentry`

自動セキュリティレビュー

`security-guidance` プラグインは Claude が行う各変更を一般的な脆弱性についてレビューし、Claude に見つかったものを修正するよう指示します。[Claude がコードを書く際にセキュリティの問題をキャッチする](/ja/security-guidance)を参照して、何をチェックするか、プロジェクト固有のルールを追加する方法を確認してください。

開発ワークフロー

一般的な開発タスク用のスキルとエージェントを追加するプラグイン：

- **commit-commands**: コミット、プッシュ、PR 作成を含む Git コミット ワークフロー
- **pr-review-toolkit**: プルリクエストをレビューするための特化したエージェント
- **agent-sdk-dev**: Claude Agent SDK で構築するためのツール
- **plugin-dev**: 独自のプラグインを作成するためのツールキット

出力スタイル

Claude の応答方法をカスタマイズします：

- **explanatory-output-style**: 実装の選択に関する教育的な洞察
- **learning-output-style**: スキル構築のためのインタラクティブな学習モード

コミュニティ マーケットプレイス

[`anthropics/claude-plugins-community`](https://github.com/anthropics/claude-plugins-community)のコミュニティ マーケットプレイスは、Anthropic の自動検証とセキュリティ スクリーニングに合格したサードパーティ プラグインをホストしています。各プラグインはカタログ内の特定のコミット SHA に固定されています。公式マーケットプレイスとは異なり、手動で追加します：

```shell
/plugin marketplace add anthropics/claude-plugins-community
```

その後、`claude-community` マーケットプレイス名を使用してプラグインをインストールします：

```shell
/plugin install <plugin-name>@claude-community
```

独自のプラグインをコミュニティ マーケットプレイスに送信するには、プラグイン作成ガイドの[プラグインをコミュニティ マーケットプレイスに送信する](/ja/plugins#submit-your-plugin-to-the-community-marketplace)を参照してください。

試してみる: デモマーケットプレイスを追加する

Anthropic は、プラグインシステムで何が可能かを示す例プラグインを含む [デモプラグインマーケットプレイス](https://github.com/anthropics/claude-code/tree/main/plugins)（`claude-code-plugins`）も管理しています。公式マーケットプレイスとは異なり、このマーケットプレイスは手動で追加する必要があります。

Claude Code 内から、`anthropics/claude-code` マーケットプレイスの `plugin marketplace add` コマンドを実行します：

```shell theme={null}
/plugin marketplace add anthropics/claude-code
```

これにより、マーケットプレイスカタログがダウンロードされ、そのプラグインが利用可能になります。

`/plugin` を実行してプラグインマネージャーを開きます。これにより、**Tab**（または後方に移動するには **Shift+Tab**）を使用して循環できる 4 つのタブを持つタブ付きインターフェースが開きます：

- **Discover**: すべてのマーケットプレイスから利用可能なプラグインを参照
- **Installed**: インストール済みプラグインを表示および管理
- **Marketplaces**: 追加したマーケットプレイスを追加、削除、または更新
- **Errors**: プラグイン読み込みエラーを表示

**Discover** タブに移動して、追加したばかりのマーケットプレイスからプラグインを確認してください。管理者が [`pluginSuggestionMarketplaces`](/ja/settings#available-settings) マネージド設定を通じてマーケットプレイスをホワイトリストに登録している場合、現在の作業ディレクトリに関連するとマークされたプラグインは、**suggested for this directory** ラベル付きで上部に固定されます。

プラグインを選択してその詳細を表示します。詳細ペインには、プラグインに含まれるもの、およびそのコストが表示されます：

- **Context cost** の推定値。毎ターン [コンテキストウィンドウ](/ja/features-overview#understand-context-costs) にプラグインが追加するトークン数を確認できます（Claude Code v2.1.143 以降）
- プラグインの **Last updated** 日付（v2.1.144 以降）
- プラグインのコマンド、エージェント、スキル、フック、MCP および LSP サーバーをリストアップする **Will install** セクション。インストール前に正確に何が追加されるかを確認できます（v2.1.145 以降）

インストールスコープを選択します：

- **User scope**: すべてのプロジェクト全体で自分用にインストール
- **Project scope**: このリポジトリのすべてのコラボレーター用にインストール
- **Local scope**: このリポジトリ内で自分用にのみインストール

たとえば、**commit-commands**（git ワークフロースキルを追加するプラグイン）を選択して、ユーザースコープにインストールします。

コマンドラインから直接インストールすることもできます：

```shell theme={null}
/plugin install commit-commands@claude-code-plugins
```

スコープの詳細については、[構成スコープ](/ja/settings#configuration-scopes)を参照してください。

インストール後、`/reload-plugins` を実行してプラグインをアクティブ化します。プラグインスキルはプラグイン名でネームスペース化されているため、**commit-commands** は `/commit-commands:commit` のようなスキルを提供します。

ファイルに変更を加えて、以下を実行して試してみてください：

```shell theme={null}
/commit-commands:commit
```

これにより、変更がステージされ、コミットメッセージが生成され、コミットが作成されます。

各プラグインは異なる方法で機能します。**Discover** タブのプラグインの詳細を確認して、提供されるコマンドとスキルを確認するか、使用方法のガイダンスについてそのホームページにアクセスしてください。

このガイドの残りの部分では、マーケットプレイスを追加し、プラグインをインストールし、構成を管理するすべての方法について説明します。

マーケットプレイスを追加する

`/plugin marketplace add` コマンドを使用して、異なるソースからマーケットプレイスを追加します。

**ショートカット**: `/plugin marketplace` の代わりに `/plugin market` を使用でき、`remove` の代わりに `rm` を使用できます。

- **GitHub リポジトリ**: `owner/repo` 形式（例：`anthropics/claude-code`）
- **Git URL**: 任意の git リポジトリ URL（GitLab、Bitbucket、自己ホスト）
- **ローカル パス**: ディレクトリまたは `marketplace.json` ファイルへの直接パス
- **リモート URL**: ホストされた `marketplace.json` ファイルへの直接 URL

GitHub から追加する

`.claude-plugin/marketplace.json` ファイルを含む GitHub リポジトリを `owner/repo` 形式を使用して追加します。ここで `owner` は GitHub ユーザー名または組織で、`repo` はリポジトリ名です。

たとえば、`anthropics/claude-code` は `anthropics` が所有する `claude-code` リポジトリを指します：

```shell
/plugin marketplace add anthropics/claude-code
```

他の Git ホストから追加する

完全な URL を提供することで、任意の git リポジトリを追加します。これは GitLab、Bitbucket、自己ホスト サーバーを含む任意の Git ホストで機能します。`.git` サフィックスを含めて、Claude Code がリポジトリをクローンするようにしてください。URL をホストされた `marketplace.json` ファイルへの直接リンクとして扱うのではなく。

`https://` プレフィックスも含めてください。Claude Code v2.1.196 以降は、`gitlab.com/company/plugins.git` のようにプレフィックスなしで入力されたホストを無効な GitHub `owner/repo` ショートハンドとして拒否し、エラーメッセージでプレフィックスを追加するよう指示します。以前のバージョンでは、これを GitHub リポジトリパスとして誤読し、クローン時に失敗します。

HTTPS を使用する場合：

```shell
/plugin marketplace add https://gitlab.com/company/plugins.git
```

SSH を使用する場合：

```shell
/plugin marketplace add git@gitlab.com:company/plugins.git
```

特定のブランチまたはタグを追加するには、`#` の後に ref を追加します：

```shell
/plugin marketplace add https://gitlab.com/company/plugins.git#v1.0.0
```

ローカル パスから追加する

`.claude-plugin/marketplace.json` ファイルを含むローカル ディレクトリを追加します：

```shell
/plugin marketplace add ./my-marketplace
```

`marketplace.json` ファイルへの直接パスを追加することもできます：

```shell
/plugin marketplace add ./path/to/marketplace.json
```

リモート URL から追加する

URL 経由でリモート `marketplace.json` ファイルを追加します：

```shell
/plugin marketplace add https://example.com/marketplace.json
```

URL ベースのマーケットプレイスは、Git ベースのマーケットプレイスと比べていくつかの制限があります。プラグインをインストールするときに「path not found」エラーが発生した場合は、[トラブルシューティング](/ja/plugin-marketplaces#plugins-with-relative-paths-fail-in-url-based-marketplaces)を参照してください。

プラグインをインストールする

マーケットプレイスを追加したら、プラグインを直接インストールできます：

```shell
/plugin install plugin-name@marketplace-name
```

このコマンドはそのプラグインの詳細を開き、[インストール スコープ](/ja/settings#configuration-scopes)を選択できます。`/plugin` を実行して **Discover** タブに移動し、プラグインで **Enter** を押すと、同じ選択肢が表示されます：

- **User scope**（デフォルト）: すべてのプロジェクト全体で自分用にインストール
- **Project scope**: このリポジトリのすべてのコラボレーター用にインストール（`.claude/settings.json` に追加）
- **Local scope**: このリポジトリ内で自分用にのみインストール（コラボレーターと共有されない）

インタラクティブなステップなしでインストールするには、[`claude plugin install`](/ja/plugins-reference#plugin-install) シェル コマンドを使用します。このコマンドはユーザー スコープにインストールします。`--scope` を渡さない限り、ユーザー スコープにインストールされます。

**managed** スコープのプラグインも表示される場合があります。これらは管理者が[管理設定](/ja/settings#settings-files)経由でインストールしたもので、変更することはできません。

プラグインをインストールする前に、それを信頼していることを確認してください。Anthropic はプラグインに含まれる MCP サーバー、ファイル、またはその他のソフトウェアを制御せず、意図したとおりに機能することを確認できません。詳細については、各プラグインのホームページを確認してください。

インストール済みプラグインを管理する

`/plugin` を実行して **Installed** タブに移動し、プラグインを表示、有効化、無効化、またはアンインストールします。リストはスコープでグループ化され、問題が最初に表示されるようにソートされます。読み込みエラーまたは未解決の依存関係を持つプラグインが上部に表示され、その後にお気に入りが続き、無効化されたプラグインは下部の折りたたまれたヘッダーの後ろに折りたたまれます。

リストから以下を実行できます：

- `f` を押して、選択したプラグインをお気に入りに追加またはお気に入りから削除
- 入力してプラグイン名または説明でフィルタリング
- Enter を押してプラグインの詳細ビューを開き、有効化、無効化、またはアンインストール

プロジェクトの `.claude/settings.json` が有効化しているプラグインをアンインストールすると、どのスコープを意図しているかを尋ねます。自分だけのために無効化する場合は、`.claude/settings.local.json` にオーバーライドを書き込み、プラグインはプロジェクトにインストールされたままになります。または、すべてのユーザーのためにアンインストールする場合は、共有の `.claude/settings.json` から削除されます。Claude Code v2.1.203 以降が必要です。v2.1.203 より前では、ダイアログはローカル無効化のみを提供していました。

詳細ビューには、プラグインが提供するコンポーネントが表示されます。コマンド、skills、agents、hooks、MCP サーバー、LSP サーバーです。同じインベントリは、コマンドラインから `claude plugin details` で利用できます。

**Installed** タブは、マーケットプレイスから自分でインストールしたが、少なくとも 2 週間以上、かつ少なくとも 10 セッション以上にわたって使用していないプラグインも収集し、**Not used recently** ヘッダーの下に表示します。詳細ビューには、各プラグインの **Last used** 行が表示されます。これらを使用して、もう使用していないが、それでもスタートアップとコンテキストコストを追加しているプラグインを見つけ、無効化またはアンインストールできます。Claude Code v2.1.187 以降が必要です。

2 種類のプラグインは、未使用として一覧表示されることはありません：

- 組織が管理するプラグイン、または `--plugin-dir` で読み込むプラグイン
- テーマ、出力スタイル、モニター、またはワークフローを提供するプラグイン。これらは追跡する呼び出しなしで価値を提供するため

**Not used recently** ヘッダーと **Last used** 行は、組織が [`strictKnownMarketplaces`](/ja/settings#strictknownmarketplaces) でマーケットプレイスを制限している場合、両方とも非表示になります。

プラグインの [言語サーバー](/ja/plugins#add-lsp-servers-to-your-plugin) は、診断を提供するか、コード ナビゲーション リクエストに応答するときに使用済みとしてカウントされます。そのため、LSP プラグインのサーバーがセッションでアクティブな場合、未使用として一覧表示されません。v2.1.203 より前では、言語サーバー アクティビティを使用としてカウントできなかったため、LSP サーバーを提供するプラグインはグループ全体から除外されていました。これはテーマと出力スタイル プラグインと同じ方法です。

依存関係を宣言するプラグインをインストールすると、インストール出力には、それと共に自動インストールされた依存関係が一覧表示されます。

直接コマンドでプラグインを管理することもできます。

メニューを開かずにインストール済みプラグインを一覧表示します：

```shell
/plugin list
```

`--enabled` または `--disabled` を渡して、その状態のプラグインのみを表示します。

プラグインをアンインストールせずに無効化します：

```shell
/plugin disable plugin-name@marketplace-name
```

無効化されたプラグインを再度有効化します：

```shell
/plugin enable plugin-name@marketplace-name
```

これらの識別子では、`plugin-name` は [マーケットプレイスエントリ](/ja/plugin-marketplaces#plugin-entries) の `name` であり、プラグイン自体の `plugin.json` の `name` と異なる場合があります。

Claude Code v2.1.195 以降では、`/plugin` インターフェイスの **Enable** と **Disable** は、2 つの名前が異なるプラグインに対して機能し、`/plugin enable` と `/plugin disable` はどちらの名前でも受け入れます。以前のバージョンでそのようなプラグインを無効化すると、Claude Code は `already disabled` を報告し、有効なままにします。

プラグインを完全に削除します：

```shell
/plugin uninstall plugin-name@marketplace-name
```

`--scope` オプションを使用すると、CLI コマンドで特定のスコープをターゲットにできます：

```shell
claude plugin install formatter@your-org --scope project
claude plugin uninstall formatter@your-org --scope project
```

プラグインの変更をリスタートなしで適用する

セッション中にプラグインをインストール、有効化、または無効化すると、`/reload-plugins` を実行してすべての変更をリスタートなしで取得します：

```shell
/reload-plugins
```

Claude Code はすべてのアクティブなプラグインをリロードし、プラグイン、skills、agents、hooks、プラグイン MCP サーバー、プラグイン LSP サーバーのカウントを表示します。

リロードには次のリクエストでトークンコストがあります。新しくロードされたコンポーネントは会話に追加されたコンテンツで自身を発表し、既存の履歴はプロンプトキャッシュから読み込まれたままです。MCP サーバーを提供するプラグインは、そのツールが [tool search](/ja/mcp#scale-with-mcp-tool-search) によって遅延されていない場合、より多くのコストがかかります。変更はキャッシュを無効にし、次のリクエストは会話全体を再度読み込みます。その場合、`/reload-plugins` は警告を表示し、リロードを適用しません。`--force` を渡して、とにかく適用します。詳細については、[プラグインの有効化または無効化](/ja/prompt-caching#enabling-or-disabling-a-plugin) を参照してください。

マーケットプレイスを管理する

インタラクティブな `/plugin` インターフェースまたは CLI コマンドを使用してマーケットプレイスを管理できます。

インタラクティブ インターフェースを使用する

`/plugin` を実行して **Marketplaces** タブに移動して、以下を実行します：

- 追加したすべてのマーケットプレイスをそのソースとステータスで表示
- 新しいマーケットプレイスを追加
- マーケットプレイス リストを更新して最新のプラグインを取得
- 不要になったマーケットプレイスを削除

CLI コマンドを使用する

直接コマンドでマーケットプレイスを管理することもできます。

構成されたすべてのマーケットプレイスをリストします：

```shell
/plugin marketplace list
```

マーケットプレイスからプラグイン リストを更新します：

```shell
/plugin marketplace update marketplace-name
```

マーケットプレイスを削除します：

```shell
/plugin marketplace remove marketplace-name
```

マーケットプレイスを削除すると、そこからインストールしたプラグインがアンインストールされます。

自動更新を構成する

Claude Code はスタートアップ時にマーケットプレイスとそのインストール済みプラグインをバックグラウンドで自動的に更新できます。マーケットプレイスで自動更新が有効になっている場合、Claude Code はマーケットプレイス データを更新し、インストール済みプラグインを最新バージョンに更新します。プラグインが更新された場合、`/reload-plugins` を実行するよう促すメッセージが表示されます。

UI を通じて個別のマーケットプレイスの自動更新を切り替えます：

1. `/plugin` を実行してプラグイン マネージャーを開く
2. **Marketplaces** を選択
3. リストからマーケットプレイスを選択
4. **Enable auto-update** または **Disable auto-update** を選択

公式 Anthropic マーケットプレイスはデフォルトで自動更新が有効になっています。サードパーティおよびローカル開発マーケットプレイスはデフォルトで自動更新が無効になっています。

管理者は、マネージド設定で各 [`extraKnownMarketplaces`](/ja/settings#extraknownmarketplaces) エントリに `"autoUpdate": true` を設定して、各ユーザーが切り替える必要なく、組織マーケットプレイスの自動更新を有効にすることもできます。

Claude Code とすべてのプラグインの両方のすべての自動更新を完全に無効化するには、`DISABLE_AUTOUPDATER` 環境変数を設定します。詳細については、[自動更新](/ja/setup#auto-updates)を参照してください。

Claude Code の自動更新を無効化しながらプラグイン自動更新を有効化したままにするには、`DISABLE_AUTOUPDATER` と共に `FORCE_AUTOUPDATE_PLUGINS=1` を設定します：

```bash
export DISABLE_AUTOUPDATER=1
export FORCE_AUTOUPDATE_PLUGINS=1
```

これは Claude Code の更新を手動で管理したいが、プラグイン更新を自動的に受け取りたい場合に便利です。

チーム マーケットプレイスを構成する

チーム管理者は、`.claude/settings.json` にマーケットプレイス構成を追加することで、プロジェクトの自動マーケットプレイス インストールを設定できます。チーム メンバーがリポジトリ フォルダを信頼すると、Claude Code はこれらのマーケットプレイスとプラグインをインストールするよう促します。

Claude Code v2.1.195 以降、このインストール ステップはプラグインを読み込むすべてのパスに適用されます。プロジェクトの `.claude/settings.json` のみで有効にされ、GitHub リポジトリや npm パッケージなどの外部ソースから提供されるプラグインは、チーム メンバーがインストールするまで読み込まれません。それまでの間、Claude Code はプラグインがインストールされていないと報告し、実行する `claude plugin install` コマンドを表示します。

プロジェクトの `.claude/settings.json` に `extraKnownMarketplaces` を追加します：

```json
{
  "extraKnownMarketplaces": {
    "my-team-tools": {
      "source": {
        "source": "github",
        "repo": "your-org/claude-plugins"
      }
    }
  }
}
```

`extraKnownMarketplaces` と `enabledPlugins` を含む完全な構成オプションについては、[プラグイン設定](/ja/settings#plugin-settings)を参照してください。

セキュリティ

プラグインとマーケットプレイスは、ユーザー権限でマシン上で任意のコードを実行できる、非常に信頼されたコンポーネントです。信頼できるソースからのみプラグインをインストールし、マーケットプレイスを追加してください。組織は、[管理マーケットプレイス制限](/ja/plugin-marketplaces#managed-marketplace-restrictions)を使用してユーザーが追加できるマーケットプレイスを制限できます。

トラブルシューティング

/plugin コマンドが認識されない

「unknown command」が表示されるか、`/plugin` コマンドが表示されない場合：

1. **バージョンを確認する**: `claude --version` を実行して、インストールされているものを確認します。
2. **Claude Code を更新する**:
   - **Homebrew**: `brew upgrade claude-code`、または `brew upgrade claude-code@latest` をインストールした場合は `brew upgrade claude-code@latest`
   - **npm**: `npm install -g @anthropic-ai/claude-code@latest`
   - **ネイティブ インストーラー**: [セットアップ](/ja/setup)からインストール コマンドを再実行します。
3. **Claude Code を再起動する**: 更新後、ターミナルを再起動して `claude` を再度実行します。

一般的な問題

- **マーケットプレイスが読み込まれない**: URL がアクセス可能であり、`.claude-plugin/marketplace.json` がパスに存在することを確認してください。
- **プラグイン インストール エラー**: プラグイン ソース URL がアクセス可能であり、リポジトリが公開されている、またはアクセス権があることを確認してください。
- **インストール後にファイルが見つからない**: プラグインはキャッシュにコピーされるため、プラグイン ディレクトリ外のファイルを参照するパスは機能しません。
- **プラグイン スキルが表示されない**: `rm -rf ~/.claude/plugins/cache` でキャッシュをクリアし、Claude Code を再起動して、プラグインを再度インストールしてください。

詳細なトラブルシューティングとソリューションについては、マーケットプレイス ガイドの [トラブルシューティング](/ja/plugin-marketplaces#troubleshooting)を参照してください。デバッグ ツールについては、[デバッグと開発ツール](/ja/plugins-reference#debugging-and-development-tools)を参照してください。

コード インテリジェンスの問題

- **言語サーバーが起動しない**: バイナリがインストールされており、`$PATH` で利用可能であることを確認してください。詳細については、`/plugin` Errors タブを確認してください。
- **メモリ使用量が多い**: `rust-analyzer` や `pyright` などの言語サーバーは、大規模なプロジェクトで大量のメモリを消費する可能性があります。メモリの問題が発生した場合は、`/plugin disable <plugin-name>` でプラグインを無効化し、代わりに Claude の組み込み検索ツールを使用してください。
- **モノレポでの誤検知診断**: ワークスペースが正しく構成されていない場合、言語サーバーは内部パッケージの未解決インポート エラーを報告する可能性があります。これらはコードを編集する Claude の能力に影響しません。

次のステップ

- **独自のプラグインを構築する**: スキル、エージェント、フックを作成するには、[プラグイン](/ja/plugins)を参照してください。
- **マーケットプレイスを作成する**: チームまたはコミュニティにプラグインを配布するには、[プラグイン マーケットプレイスを作成](/ja/plugin-marketplaces)を参照してください。
- **技術リファレンス**: 完全な仕様については、[プラグイン リファレンス](/ja/plugins-reference)を参照してください。
