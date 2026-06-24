---
title: claude-code-on-the-web
source: https://code.claude.com/docs/ja/claude-code-on-the-web.md
---

# ウェブ上の Claude Code を使用する

> Anthropic のサンドボックスでクラウド環境、セットアップスクリプト、ネットワークアクセス、Docker を設定します。`--remote` と `--teleport` を使用してウェブとターミナル間でセッションを移動します。

ウェブ上の Claude Code は Pro、Max、Team ユーザー、およびプレミアムシートまたは Chat + Claude Code シートを持つ Enterprise ユーザーを対象としたリサーチプレビュー段階です。

ウェブ上の Claude Code は [claude.ai/code](https://claude.ai/code) の Anthropic 管理クラウドインフラストラクチャでタスクを実行します。セッションはブラウザを閉じても保持され、Claude モバイルアプリから監視できます。

ウェブ上の Claude Code は初めてですか？[はじめに](/ja/web-quickstart)から始めて、GitHub アカウントを接続し、最初のタスクを送信してください。

このページでは以下をカバーしています：

- [GitHub 認証オプション](#github-authentication-options)：GitHub を接続する 2 つの方法
- [クラウド環境](#the-cloud-environment)：どの設定が引き継がれるか、どのツールがインストールされているか、環境を設定する方法
- [セットアップスクリプト](#setup-scripts)と依存関係管理
- [ネットワークアクセス](#network-access)：レベル、プロキシ、デフォルト許可リスト
- [`--remote` と `--teleport` を使用してウェブとターミナル間でタスクを移動](#move-tasks-between-web-and-terminal)
- [セッションの操作](#work-with-sessions)：確認、共有、アーカイブ、削除
- [プルリクエストの自動修正](#auto-fix-pull-requests)：CI 失敗とレビューコメントに自動的に応答
- [セキュリティと分離](#security-and-isolation)：セッションの分離方法
- [制限事項](#limitations)：レート制限とプラットフォーム制限

GitHub 認証オプション

クラウドセッションはコードをクローンしてブランチをプッシュするために GitHub リポジトリへのアクセスが必要です。2 つの方法でアクセスを許可できます：

| 方法 | 仕組み | 最適な用途 |
| :- | :- | :- |
| **GitHub App** | [ウェブオンボーディング](/ja/web-quickstart)中に Claude GitHub App を認可します。 | ブラウザオンボーディング；[Auto-fix](#auto-fix-pull-requests) を希望するチーム |
| **`/web-setup`** | ターミナルで `/web-setup` を実行して、ローカル `gh` CLI トークンを Claude アカウントに同期します。 | すでに `gh` を使用している個別開発者 |

どちらの方法でも、クラウドセッションは Claude GitHub App がインストールされているリポジトリだけでなく、接続している GitHub アカウントが見ることができるすべてのリポジトリにアクセスできます。App インストールは [Auto-fix](#auto-fix-pull-requests) の PR webhook を有効にします；これはセッションレベルのアクセス制御ではありません。クラウドセッションからチームが到達できるリポジトリを制限するには、GitHub 自体でアクセスを制限してください。たとえば、接続している GitHub アカウントのチームまたはリポジトリメンバーシップを制限することで実現できます。

どちらの方法でも機能します。[`/schedule`](/ja/routines) は両方の形式のアクセスをチェックし、どちらも設定されていない場合は `/web-setup` を実行するよう促します。[ターミナルから接続](/ja/web-quickstart#connect-from-your-terminal)で `/web-setup` のウォークスルーを参照してください。

GitHub App は [Auto-fix](#auto-fix-pull-requests) に必須です。これは App を使用して PR webhook を受け取ります。`/web-setup` で接続し、後で Auto-fix が必要な場合は、それらのリポジトリに App をインストールします。

Team および Enterprise 管理者は [claude.ai/admin-settings/claude-code](https://claude.ai/admin-settings/claude-code) の Quick web setup トグルで `/web-setup` を無効にできます。

[Zero Data Retention](/ja/zero-data-retention) が有効な組織は `/web-setup` またはその他のクラウドセッション機能を使用できません。

クラウド環境

各セッションはリポジトリがクローンされた新しい Anthropic 管理 VM で実行されます。このセクションではセッション開始時に利用可能なものと、それをカスタマイズする方法をカバーしています。

クラウドセッションで利用可能なもの

クラウドセッションはリポジトリの新しいクローンから開始されます。リポジトリにコミットされたものはすべて利用可能です。自分のマシンにのみインストールまたは設定したものは利用できません。組織のポリシーは [サーバー管理設定](/ja/server-managed-settings)を通じて別途到着します。

| | クラウドセッションで利用可能 | 理由 |
| :- | :- | :- |
| リポジトリの `CLAUDE.md` | はい | クローンの一部 |
| リポジトリの `.claude/settings.json` フック | はい | クローンの一部 |
| リポジトリの `.mcp.json` MCP サーバー | はい | クローンの一部 |
| リポジトリの `.claude/rules/` | はい | クローンの一部 |
| リポジトリの `.claude/skills/`、`.claude/agents/`、`.claude/commands/` | はい | クローンの一部 |
| `.claude/settings.json` で宣言されたプラグイン | はい | 宣言した[マーケットプレイス](/ja/plugin-marketplaces)からセッション開始時にインストールされます。マーケットプレイスソースに到達するためにはネットワークアクセスが必要です |
| 組織の[サーバー管理設定](/ja/server-managed-settings) | はい | セッション開始時に Anthropic のサーバーから取得されます。クラウドセッションで `availableModels` がどのように適用されるかについては [Surface coverage](/ja/model-config#surface-coverage) を参照してください。MDM または管理設定ファイルを通じてデバイスにデプロイされた設定は、セッションが Anthropic 管理 VM で実行されるため適用されません |
| ユーザー `~/.claude/CLAUDE.md` | いいえ | マシンに存在し、リポジトリには存在しません |
| ユーザー `~/.claude/skills/`、`~/.claude/agents/`、`~/.claude/commands/` | いいえ | マシンに存在し、リポジトリには存在しません。代わりにリポジトリの `.claude/` ディレクトリにコミットしてください。claude.ai で有効にしたスキルはクラウドセッションに自動的にロードされます |
| ユーザー設定でのみ有効なプラグイン | いいえ | ユーザースコープの `enabledPlugins` は `~/.claude/settings.json` に存在します。代わりにリポジトリの `.claude/settings.json` で宣言してください |
| `claude mcp add` で追加した MCP サーバー | いいえ | これらはローカルユーザー設定に書き込まれ、リポジトリには書き込まれません。代わりに [`.mcp.json`](/ja/mcp#project-scope) でサーバーを宣言してください |
| 静的 API トークンと認証情報 | いいえ | 専用シークレットストアはまだ存在しません。以下を参照してください |
| AWS SSO のようなインタラクティブ認証 | いいえ | サポートされていません。SSO はクラウドセッションで実行できないブラウザベースのログインが必要です |

クラウドセッションで設定を利用可能にするには、リポジトリにコミットしてください。組織のポリシーは [サーバー管理設定](/ja/server-managed-settings)を通じて別途到着します。専用シークレットストアはまだ利用できません。環境変数とセットアップスクリプトの両方は環境設定に保存され、その環境を編集できる誰もが見ることができます。クラウドセッションでシークレットが必要な場合は、その可視性を念頭に置いて環境変数として追加してください。

インストール済みツール

クラウドセッションには一般的な言語ランタイム、ビルドツール、データベースがプリインストールされています。以下の表はカテゴリ別に含まれるものをまとめています。

| カテゴリ | 含まれるもの |
| :- | :- |
| **Python** | pip、poetry、uv、black、mypy、pytest、ruff を備えた Python 3.x |
| **Node.js** | nvm 経由の 20、21、22、npm、yarn、pnpm、bun¹、eslint、prettier、chromedriver |
| **Ruby** | gem、bundler、rbenv を備えた 3.1、3.2、3.3 |
| **PHP** | Composer を備えた 8.4 |
| **Java** | Maven と Gradle を備えた OpenJDK 21 |
| **Go** | モジュールサポート付きの最新安定版 |
| **Rust** | rustc と cargo |
| **C/C++** | GCC、Clang、cmake、ninja、conan |
| **Docker** | docker、dockerd、docker compose |
| **データベース** | PostgreSQL 16、Redis 7.0 |
| **ユーティリティ** | git、jq、yq、ripgrep、tmux、vim、nano |

¹ Bun はインストールされていますが、パッケージ取得に関して既知の[プロキシ互換性の問題](#install-dependencies-with-a-sessionstart-hook)があります。

正確なバージョンについては、Claude にクラウドセッションで `check-tools` を実行するよう依頼してください。このコマンドはクラウドセッションにのみ存在します。

GitHub の問題とプルリクエストを操作する

クラウドセッションには、Claude がセットアップなしで問題を読み取り、プルリクエストをリストし、diff を取得し、コメントを投稿できる組み込み GitHub ツールが含まれています。これらのツールは [GitHub プロキシ](#github-proxy)を通じて認証され、[GitHub 認証オプション](#github-authentication-options)で設定した方法を使用するため、トークンはコンテナに入りません。

`gh` CLI はプリインストールされていません。組み込みツールがカバーしていない `gh` コマンド（`gh release` や `gh workflow run` など）が必要な場合は、自分でインストールして認証してください：

[セットアップスクリプト](#setup-scripts)に `apt update && apt install -y gh` を追加します。

[環境設定](#configure-your-environment)に GitHub 個人アクセストークンを持つ `GH_TOKEN` 環境変数を追加します。`gh` は `GH_TOKEN` を自動的に読み取るため、`gh auth login` ステップは不要です。

セッションに出力をリンク

各クラウドセッションは claude.ai 上にトランスクリプト URL を持ち、セッションは `CLAUDE_CODE_REMOTE_SESSION_ID` 環境変数から独自の ID を読み取ることができます。これを使用して、PR 本文、コミットメッセージ、Slack 投稿、または生成されたレポートに追跡可能なリンクを配置し、レビュアーがそれを生成した実行を開くことができます。

v2.1.179 以降、Claude がウェブセッションで作成するコミットには `Claude-Session: <url>` git トレーラーが含まれ、PR 本文にはセッション URL が独立した行に含まれます。v2.1.182 以降、[`attribution.sessionUrl`](/ja/settings#attribution-settings)を `false` に設定してトレーラーと PR 本文リンクを省略できます。

コミットまたは PR 以外のもの（Claude が投稿する Slack メッセージやそれが書き込むレポートファイルなど）にセッションリンクを含めるには、Claude に次のコマンドを実行させ、その出力を使用してください。このコマンドは環境変数の値の `cse_` プレフィックスをトランスクリプト URL が期待する `session_` プレフィックスに変換します：

```bash
echo "https://claude.ai/code/${CLAUDE_CODE_REMOTE_SESSION_ID/#cse_/session_}"
```

テストを実行し、サービスを開始し、パッケージを追加

Claude はタスクに取り組む際にテストを実行します。プロンプトで依頼してください。例えば「fix the failing tests in `tests/`」または「run pytest after each change」。pytest、jest、cargo test などのテストランナーはプリインストールされているため、すぐに機能します。

PostgreSQL と Redis はプリインストールされていますがデフォルトでは実行されていません。セッション中に Claude に各を開始するよう依頼してください：

```bash
service postgresql start
```

```bash
service redis-server start
```

Docker はコンテナ化されたサービスを実行するために利用可能です。Claude に `docker compose up` を実行してプロジェクトのサービスを開始するよう依頼してください。イメージをプルするためのネットワークアクセスは環境の[アクセスレベル](#access-levels)に従い、[信頼できるデフォルト](#default-allowed-domains)には Docker Hub およびその他の一般的なレジストリが含まれます。

イメージが大きいか遅い場合は、[セットアップスクリプト](#setup-scripts)に `docker compose pull` または `docker compose build` を追加してください。プルされたイメージは[キャッシュされた環境](#environment-caching)に保存されるため、各新しいセッションはディスク上にそれらを持っています。キャッシュはファイルのみを保存し、実行中のプロセスは保存しないため、Claude は各セッションでコンテナを開始します。

プリインストールされていないパッケージを追加するには、[セットアップスクリプト](#setup-scripts)を使用してください。スクリプトの出力は[キャッシュされ](#environment-caching)、そこにインストールしたパッケージはすべてのセッションの開始時に利用可能で、毎回再インストールする必要はありません。セッション中に Claude にパッケージをインストールするよう依頼することもできますが、それらのインストールは他のセッションに引き継がれません。

リソース制限

クラウドセッションは時間とともに変わる可能性のある概算リソース上限で実行されます：

- 4 vCPU
- 16 GB RAM
- 30 GB ディスク

大規模なビルドジョブやメモリ集約的なテストなど、大幅により多くのメモリを必要とするタスクは失敗するか終了される可能性があります。これらの制限を超えるワークロードについては、[Remote Control](/ja/remote-control)を使用して独自のハードウェアで Claude Code を実行してください。

環境を設定

環境は[ネットワークアクセス](#network-access)、環境変数、セッション開始前に実行される[セットアップスクリプト](#setup-scripts)を制御します。設定なしで利用可能なものについては [Installed tools](#installed-tools) を参照してください。ウェブインターフェースまたはターミナルから環境を管理できます：

| アクション | 方法 |
| :- | :- |
| 環境を追加 | 現在の環境を選択して環境セレクターを開き、**Add environment** を選択します。ダイアログには名前、ネットワークアクセスレベル、環境変数、セットアップスクリプトが含まれます。 |
| 環境を編集 | クラウドアイコンを選択して現在の環境の名前を表示し、セレクターを開き、環境にマウスを合わせて、右側に表示される設定アイコンをクリックします。 |
| 環境をアーカイブ | 環境を編集用に開き、**Archive** を選択します。アーカイブされた環境はセレクターから非表示になりますが、既存のセッションは実行を続けます。 |
| `--remote` のデフォルトを設定 | ターミナルで `/remote-env` を実行します。単一の環境がある場合、このコマンドは現在の設定を表示します。`/remote-env` はデフォルトのみを選択します。ウェブインターフェースから環境を追加、編集、アーカイブします。 |

環境変数は `.env` 形式を使用し、1 行に 1 つの `KEY=value` ペアです。値を引用符で囲まないでください。引用符は値の一部として保存されるためです。

```text
NODE_ENV=development
LOG_LEVEL=debug
DATABASE_URL=postgres://localhost:5432/myapp
```

セットアップスクリプト

セットアップスクリプトは新しいクラウドセッションが開始されるときに実行される Bash スクリプトで、Claude Code が起動する前に実行されます。セットアップスクリプトを使用して依存関係をインストールし、ツールを設定するか、セッションが必要とするプリインストールされていないものを取得します。

スクリプトは Ubuntu 24.04 でルートとして実行されるため、`apt install` とほとんどの言語パッケージマネージャーが機能します。

セットアップスクリプトを追加するには、環境設定ダイアログを開き、**Setup script** フィールドにスクリプトを入力します。

この例はプリインストールされていない `gh` CLI をインストールします：

```bash
#!/bin/bash
apt update && apt install -y gh
```

スクリプトがゼロ以外で終了する場合、セッションは開始に失敗します。不安定なインストール失敗でセッションをブロックするのを避けるために、重要でないコマンドに `|| true` を追加します。

スクリプトの総実行時間を約 5 分以下に保つため、[環境キャッシュ](#environment-caching)を構築できます。`&` と `wait` を使用して独立したインストールを並列で実行します。単一のダウンロードが 5 分の制限に収まらない場合は、バックグラウンドで起動する [SessionStart フック](#setup-scripts-vs-sessionstart-hooks)に移動します。

パッケージをインストールするセットアップスクリプトはレジストリに到達するためにネットワークアクセスが必要です。デフォルトの **Trusted** ネットワークアクセスは npm、PyPI、RubyGems、crates.io を含む[一般的なパッケージレジストリ](#default-allowed-domains)への接続を許可します。環境が **None** ネットワークアクセスを使用する場合、スクリプトはパッケージのインストールに失敗します。

環境キャッシング

セットアップスクリプトは環境でセッションを開始するときに初めて実行されます。完了後、Anthropic はファイルシステムをスナップショットし、そのスナップショットを後のセッションの開始点として再利用します。新しいセッションはディスク上に依存関係、ツール、Docker イメージを既に持っており、セットアップスクリプトステップはスキップされます。これにより、スクリプトが大規模なツールチェーンをインストールするか、コンテナイメージをプルする場合でも、スタートアップは高速に保たれます。

キャッシュはファイルをキャプチャし、実行中のプロセスはキャプチャしません。セットアップスクリプトがディスクに書き込むものはすべて引き継がれます。開始するサービスまたはコンテナは引き継がれないため、Claude に依頼するか、[SessionStart フック](#setup-scripts-vs-sessionstart-hooks)を使用してセッションごとにそれらを開始してください。

環境のセットアップスクリプトまたは許可されたネットワークホストを変更するとき、およびキャッシュが約 7 日後に有効期限に達するときに、セットアップスクリプトが再度実行されてキャッシュが再構築されます。既存のセッションを再開することはセットアップスクリプトを再実行しません。

キャッシングを有効にするか、スナップショットを自分で管理する必要はありません。

セットアップスクリプト対 SessionStart フック

クラウドが必要とするがラップトップがすでに持っているもの（言語ランタイムや CLI ツールなど）をインストールするにはセットアップスクリプトを使用します。クラウドとローカルの両方で実行する必要があるプロジェクトセットアップ（`npm install` など）には [SessionStart フック](/ja/hooks#sessionstart)を使用します。

どちらもセッションの開始時に実行されますが、異なる場所に属しています：

| | セットアップスクリプト | SessionStart フック |
| - | - | - |
| 添付先 | クラウド環境 | リポジトリ |
| 設定場所 | クラウド環境 UI | リポジトリの `.claude/settings.json` |
| 実行 | Claude Code が起動する前、[キャッシュされた環境](#environment-caching)が利用できない場合のみ | Claude Code が起動した後、再開を含むすべてのセッション |
| スコープ | クラウド環境のみ | ローカルとクラウド両方 |

SessionStart フックはローカルのユーザーレベル `~/.claude/settings.json` でも定義できますが、ユーザーレベルの設定はクラウドセッションに引き継がれません。クラウドでは、リポジトリとお客様の組織の[サーバー管理設定](/ja/server-managed-settings)からフックが取得されます。

SessionStart フックで依存関係をインストール

クラウドセッションのみで依存関係をインストールするには、リポジトリの `.claude/settings.json` に SessionStart フックを追加します：

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/scripts/install_pkgs.sh"
          }
        ]
      }
    ]
  }
}
```

`scripts/install_pkgs.sh` にスクリプトを作成し、`chmod +x` で実行可能にします。`CLAUDE_CODE_REMOTE` 環境変数はクラウドセッションで `true` に設定されるため、ローカル実行をスキップするために使用できます：

```bash
#!/bin/bash

if [ "$CLAUDE_CODE_REMOTE" != "true" ]; then
  exit 0
fi

npm install
pip install -r requirements.txt
exit 0
```

SessionStart フックはクラウドセッションでいくつかの制限があります：

- **クラウドのみのスコープなし**：フックはローカルとクラウドセッションの両方で実行されます。ローカル実行をスキップするには、上記のようにスクリプトで `CLAUDE_CODE_REMOTE` 環境変数をチェックします。
- **ネットワークアクセスが必要**：インストールコマンドはパッケージレジストリに到達する必要があります。環境が **None** ネットワークアクセスを使用する場合、これらのフックは失敗します。**Trusted** の下の[デフォルト許可リスト](#default-allowed-domains)は npm、PyPI、RubyGems、crates.io をカバーしています。
- **プロキシ互換性**：すべてのアウトバウンドトラフィックは[セキュリティプロキシ](#security-proxy)を通じて渡されます。一部のパッケージマネージャーはこのプロキシで正しく機能しません。Bun は既知の例です。
- **スタートアップレイテンシーを追加**：フックはセッションが開始または再開されるたびに実行されます。依存関係が既に存在するかどうかを確認してから再インストールすることで、インストールスクリプトを高速に保ちます。

後続の Bash コマンドの環境変数を永続化するには、`$CLAUDE_ENV_FILE` のファイルに書き込みます。詳細については [SessionStart フック](/ja/hooks#sessionstart)を参照してください。

カスタム Docker イメージで基本イメージを置き換えることはまだサポートされていません。[提供されたイメージ](#installed-tools)の上にセットアップスクリプトを使用して必要なものをインストールするか、`docker compose` を使用して Claude と一緒にイメージをコンテナとして実行してください。

ネットワークアクセス

ネットワークアクセスはクラウド環境からのアウトバウンド接続を制御します。各環境は 1 つのアクセスレベルを指定し、カスタム許可ドメインで拡張できます。デフォルトは **Trusted** で、パッケージレジストリおよび他の[許可リストドメイン](#default-allowed-domains)を許可します。

環境のネットワークアクセスを変更するには、[編集用に開き](#configure-your-environment)、ダイアログで **Network access** セレクターを使用します。個別の Environments ページはありません。クラウドアイコンはクラウドセッションを開始するか、[ルーチン](/ja/routines#environments-and-network-access)を設定する場所に表示されます。

MCP コネクタトラフィックは Anthropic のサーバーを通じてルーティングされるため、セッションまたはルーチンで有効にするコネクタは **Allowed domains** に追加しなくても機能します。コネクタはセッションごとまたはルーチンごとに設定されます。Claude が到達できるツールを制限するために、不要なものを削除します。これは [Security and isolation](#security-and-isolation) の下で記載されている同じ Anthropic バウンドチャネルに依存しています。

アクセスレベル

環境を作成または編集するときにアクセスレベルを選択します：

| レベル | アウトバウンド接続 |
| :- | :- |
| **None** | アウトバウンドネットワークアクセスなし |
| **Trusted** | [許可リストドメイン](#default-allowed-domains)のみ：パッケージレジストリ、GitHub、クラウド SDK |
| **Full** | 任意のドメイン |
| **Custom** | 独自の許可リスト、オプションでデフォルトを含む |

GitHub 操作は[別のプロキシ](#github-proxy)を使用し、この設定から独立しています。

特定のドメインを許可

Trusted リストにないドメインを許可するには、環境のネットワークアクセス設定で **Custom** を選択します。**Allowed domains** フィールドが表示されます。1 行に 1 つのドメインを入力します：

```text
api.example.com
*.internal.example.com
registry.example.com
```

ワイルドカードサブドメインマッチングに `*.` を使用します。**Also include default list of common package managers** をチェックして [Trusted ドメイン](#default-allowed-domains)をカスタムエントリと一緒に保つか、リストしたものだけを許可するためにチェックを外します。

GitHub プロキシ

セキュリティのため、すべての GitHub 操作は、すべての git インタラクションを透過的に処理する専用プロキシサービスを通じて行われます。サンドボックス内では、git クライアントはカスタムビルトのスコープ付き認証情報を使用して認証します。このプロキシは：

- GitHub 認証をセキュアに管理します：git クライアントはサンドボックス内のスコープ付き認証情報を使用し、プロキシはそれを検証して実際の GitHub 認証トークンに変換します
- 安全性のため git push 操作を現在のワーキングブランチに制限します
- セキュリティ境界を維持しながらシームレスなクローン、フェッチ、PR 操作を有効にします

セキュリティプロキシ

環境はセキュリティと不正使用防止のため HTTP/HTTPS ネットワークプロキシの背後で実行されます。すべてのアウトバウンドインターネットトラフィックはこのプロキシを通じて渡され、以下を提供します：

- 悪意のあるリクエストに対する保護
- レート制限と不正使用防止
- 強化されたセキュリティのためのコンテンツフィルタリング
- リクエストされたホスト名の DNS レベル監査証跡

デフォルト許可ドメイン

**Trusted** ネットワークアクセスを使用する場合、以下のドメインはデフォルトで許可されます。`*` でマークされたドメインはワイルドカードサブドメインマッチングを示すため、`*.gcr.io` は `gcr.io` のすべてのサブドメインを許可します。

- api.anthropic.com
- statsig.anthropic.com
- docs.claude.com
- platform.claude.com
- code.claude.com
- claude.ai

* github.com
* [www.github.com](http://www.github.com)
* api.github.com
* npm.pkg.github.com
* raw\.githubusercontent.com
* pkg-npm.githubusercontent.com
* objects.githubusercontent.com
* release-assets.githubusercontent.com
* codeload.github.com
* avatars.githubusercontent.com
* camo.githubusercontent.com
* gist.github.com
* gitlab.com
* [www.gitlab.com](http://www.gitlab.com)
* registry.gitlab.com
* bitbucket.org
* [www.bitbucket.org](http://www.bitbucket.org)
* api.bitbucket.org

- registry-1.docker.io
- auth.docker.io
- index.docker.io
- hub.docker.com
- [www.docker.com](http://www.docker.com)
- production.cloudflare.docker.com
- download.docker.com
- gcr.io
- \*.gcr.io
- ghcr.io
- mcr.microsoft.com
- \*.data.mcr.microsoft.com
- public.ecr.aws

* cloud.google.com
* accounts.google.com
* gcloud.google.com
* \*.googleapis.com
* storage.googleapis.com
* compute.googleapis.com
* container.googleapis.com
* azure.com
* portal.azure.com
* microsoft.com
* [www.microsoft.com](http://www.microsoft.com)
* \*.microsoftonline.com
* packages.microsoft.com
* dotnet.microsoft.com
* dot.net
* visualstudio.com
* dev.azure.com
* \*.amazonaws.com
* \*.api.aws
* oracle.com
* [www.oracle.com](http://www.oracle.com)
* java.com
* [www.java.com](http://www.java.com)
* java.net
* [www.java.net](http://www.java.net)
* download.oracle.com
* yum.oracle.com

- registry.npmjs.org
- [www.npmjs.com](http://www.npmjs.com)
- [www.npmjs.org](http://www.npmjs.org)
- npmjs.com
- npmjs.org
- yarnpkg.com
- registry.yarnpkg.com

* pypi.org
* [www.pypi.org](http://www.pypi.org)
* files.pythonhosted.org
* pythonhosted.org
* test.pypi.org
* pypi.python.org
* pypa.io
* [www.pypa.io](http://www.pypa.io)

- rubygems.org
- [www.rubygems.org](http://www.rubygems.org)
- api.rubygems.org
- index.rubygems.org
- ruby-lang.org
- [www.ruby-lang.org](http://www.ruby-lang.org)
- rubyforge.org
- [www.rubyforge.org](http://www.rubyforge.org)
- rubyonrails.org
- [www.rubyonrails.org](http://www.rubyonrails.org)
- rvm.io
- get.rvm.io

* crates.io
* [www.crates.io](http://www.crates.io)
* index.crates.io
* static.crates.io
* rustup.rs
* static.rust-lang.org
* [www.rust-lang.org](http://www.rust-lang.org)

- proxy.golang.org
- sum.golang.org
- index.golang.org
- golang.org
- [www.golang.org](http://www.golang.org)
- goproxy.io
- pkg.go.dev

* maven.org
* repo.maven.org
* central.maven.org
* repo1.maven.org
* repo.maven.apache.org
* jcenter.bintray.com
* gradle.org
* [www.gradle.org](http://www.gradle.org)
* services.gradle.org
* plugins.gradle.org
* kotlinlang.org
* [www.kotlinlang.org](http://www.kotlinlang.org)
* spring.io
* repo.spring.io

- packagist.org（PHP Composer）
- [www.packagist.org](http://www.packagist.org)
- repo.packagist.org
- nuget.org（.NET NuGet）
- [www.nuget.org](http://www.nuget.org)
- api.nuget.org
- pub.dev（Dart/Flutter）
- api.pub.dev
- hex.pm（Elixir/Erlang）
- [www.hex.pm](http://www.hex.pm)
- cpan.org（Perl CPAN）
- [www.cpan.org](http://www.cpan.org)
- metacpan.org
- [www.metacpan.org](http://www.metacpan.org)
- api.metacpan.org
- cocoapods.org（iOS/macOS）
- [www.cocoapods.org](http://www.cocoapods.org)
- cdn.cocoapods.org
- haskell.org
- [www.haskell.org](http://www.haskell.org)
- hackage.haskell.org
- swift.org
- [www.swift.org](http://www.swift.org)

* archive.ubuntu.com
* security.ubuntu.com
* ubuntu.com
* [www.ubuntu.com](http://www.ubuntu.com)
* \*.ubuntu.com
* ppa.launchpad.net
* launchpad.net
* [www.launchpad.net](http://www.launchpad.net)
* \*.nixos.org

- dl.k8s.io（Kubernetes）
- pkgs.k8s.io
- k8s.io
- [www.k8s.io](http://www.k8s.io)
- releases.hashicorp.com（HashiCorp）
- apt.releases.hashicorp.com
- rpm.releases.hashicorp.com
- archive.releases.hashicorp.com
- hashicorp.com
- [www.hashicorp.com](http://www.hashicorp.com)
- repo.anaconda.com（Anaconda/Conda）
- conda.anaconda.org
- anaconda.org
- [www.anaconda.com](http://www.anaconda.com)
- anaconda.com
- continuum.io
- apache.org（Apache）
- [www.apache.org](http://www.apache.org)
- archive.apache.org
- downloads.apache.org
- eclipse.org（Eclipse）
- [www.eclipse.org](http://www.eclipse.org)
- download.eclipse.org
- nodejs.org（Node.js）
- [www.nodejs.org](http://www.nodejs.org)
- developer.apple.com
- developer.android.com
- pkg.stainless.com
- binaries.prisma.sh

* statsig.com
* [www.statsig.com](http://www.statsig.com)
* api.statsig.com
* sentry.io
* \*.sentry.io
* downloads.sentry-cdn.com
* http-intake.logs.datadoghq.com
* \*.datadoghq.com
* \*.datadoghq.eu
* api.honeycomb.io

- sourceforge.net
- \*.sourceforge.net
- packagecloud.io
- \*.packagecloud.io
- fonts.googleapis.com
- fonts.gstatic.com

* json-schema.org
* [www.json-schema.org](http://www.json-schema.org)
* json.schemastore.org
* [www.schemastore.org](http://www.schemastore.org)

- \*.modelcontextprotocol.io

ウェブとターミナル間でタスクを移動

これらのワークフローには [Claude Code CLI](/ja/quickstart) が同じ claude.ai アカウントにサインインしている必要があります。ターミナルから新しいクラウドセッションを開始するか、クラウドセッションをターミナルにプルしてローカルで続行できます。クラウドセッションはラップトップを閉じても保持され、Claude モバイルアプリを含む任意の場所から監視できます。

CLI からのセッションハンドオフは一方向です：`--teleport` でクラウドセッションをターミナルにプルできますが、既存のターミナルセッションをウェブにプッシュすることはできません。`--remote` フラグは現在のリポジトリの新しいクラウドセッションを作成します。[Desktop アプリ](/ja/desktop#continue-in-another-surface)は別のサーフェスに送信できる Continue in メニューを提供します。

ターミナルからウェブへ

`--remote` フラグを使用してコマンドラインからクラウドセッションを開始します：

```bash
claude --remote "Fix the authentication bug in src/auth/login.ts"
```

これにより claude.ai 上に新しいクラウドセッションが作成されます。セッションは現在のディレクトリの GitHub リモートを現在のブランチでクローンするため、VM は GitHub からクローンするため、ローカルコミットがある場合は最初にプッシュしてください。`--remote` は一度に 1 つのリポジトリで機能します。タスクはクラウドで実行され、ローカルで作業を続行できます。

`--remote` はクラウドセッションを作成します。`--remote-control` は無関係です：ウェブから監視するためにローカル CLI セッションを公開します。[Remote Control](/ja/remote-control)を参照してください。

Claude Code CLI で `/tasks` を使用して進捗をチェックするか、claude.ai または Claude モバイルアプリでセッションを開いて直接対話します。そこから Claude を操舵し、フィードバックを提供するか、他のすべての会話と同じように質問に答えることができます。

クラウドタスクのヒント

**ローカルで計画し、リモートで実行する**：複雑なタスクの場合、Claude をプランモードで開始してアプローチについて協力し、その後ウェブに作業を送信します：

```bash
claude --permission-mode plan
```

プランモードでは、Claude はファイルを読み取り、コマンドを実行して探索し、ソースコードを編集せずにプランを提案します。計画に満足したら、リポジトリにプランを保存し、コミットしてプッシュし、クラウド VM がそれをクローンできるようにします。その後、自律実行のためにクラウドセッションを開始します：

```bash
claude --remote "Execute the migration plan in docs/migration-plan.md"
```

このパターンにより、戦略を制御しながら Claude がクラウドで自律的に実行できます。

**クラウドで ultraplan を使用してプランを作成**：ウェブセッション自体でプランを起案およびレビューするには、[ultraplan](/ja/ultraplan)を使用します。Claude はウェブ上の Claude Code でプランを生成し、作業を続行し、ブラウザでセクションにコメントし、リモートで実行するか、プランをターミナルに送り返すことを選択します。

**タスクを並列で実行**：各 `--remote` コマンドは独立して実行される独自のクラウドセッションを作成します。複数のタスクを開始でき、すべて別々のセッションで同時に実行されます：

```bash
claude --remote "Fix the flaky test in auth.spec.ts"
claude --remote "Update the API documentation"
claude --remote "Refactor the logger to use structured output"
```

Claude Code CLI で `/tasks` を使用してすべてのセッションを監視します。セッションが完了したら、ウェブインターフェースから PR を作成するか、[セッションをテレポート](#from-web-to-terminal)してターミナルで作業を続行できます。

GitHub なしでローカルリポジトリを送信

GitHub に接続されていないリポジトリから `claude --remote` を実行する場合、Claude Code はローカルリポジトリをバンドルしてクラウドセッションに直接アップロードします。バンドルにはすべてのブランチ全体のリポジトリ履歴と、追跡されたファイルへのコミットされていない変更が含まれます。

GitHub アクセスが利用できない場合、このフォールバックは自動的にアクティブになります。GitHub が接続されている場合でも強制するには、`CCR_FORCE_BUNDLE=1` を設定します：

```bash
CCR_FORCE_BUNDLE=1 claude --remote "Run the test suite and fix any failures"
```

バンドルされたリポジトリはこれらの制限を満たす必要があります：

- ディレクトリは少なくとも 1 つのコミットを持つ git リポジトリである必要があります
- バンドルされたリポジトリは 100 MB 未満である必要があります。より大きなリポジトリは現在のブランチのみをバンドルすることにフォールバックし、その後ワーキングツリーの単一の圧縮スナップショットにフォールバックし、スナップショットがまだ大きすぎる場合のみ失敗します
- 追跡されていないファイルは含まれません。クラウドセッションが見るべきファイルで `git add` を実行します
- バンドルから作成されたセッションは、[GitHub 認証](#github-authentication-options)も設定されていない限り、リモートにプッシュバックできません

ウェブからターミナルへ

以下のいずれかを使用してクラウドセッションをターミナルにプルします：

- **`--teleport` を使用**：コマンドラインから `claude --teleport` を実行してインタラクティブセッションピッカーを表示するか、`claude --teleport <session-id>` を実行して特定のセッションを直接再開します。コミットされていない変更がある場合は、最初にそれらをスタッシュするよう求められます。
- **`/teleport` を使用**：既存の CLI セッション内で `/teleport`（または `/tp`）を実行して、Claude Code を再起動せずに同じセッションピッカーを開きます。
- **`/tasks` から**：`/tasks` を実行してバックグラウンドセッションを表示し、`t` を押してセッションにテレポートします
- **ウェブインターフェースから**：**Open in CLI** を選択してターミナルに貼り付けられるコマンドをコピーします

セッションをテレポートすると、Claude は正しいリポジトリにいることを確認し、クラウドセッションからブランチをフェッチしてチェックアウトし、完全な会話履歴をターミナルに読み込みます。

`--teleport` は `--resume` とは異なります。`--resume` はこのマシンのローカル履歴から会話を再開し、クラウドセッションをリストしません。`--teleport` はクラウドセッションとそのブランチをプルします。

テレポート要件

テレポートはセッションを再開する前にこれらの要件をチェックします。要件が満たされていない場合は、エラーが表示されるか、問題を解決するよう求められます。

| 要件 | 詳細 |
| - | - |
| クリーンな git 状態 | 作業ディレクトリにコミットされていない変更がないことが必要です。テレポートは必要に応じて変更をスタッシュするよう求めます。 |
| 正しいリポジトリ | フォークではなく、同じリポジトリのチェックアウトから `--teleport` を実行する必要があります。 |
| ブランチが利用可能 | クラウドセッションからのブランチがリモートにプッシュされている必要があります。テレポートは自動的にフェッチしてチェックアウトします。 |
| 同じアカウント | クラウドセッションで使用された同じ claude.ai アカウントに認証される必要があります。 |

`--teleport` が利用できない

テレポートには claude.ai サブスクリプション認証が必要です。API キー、Bedrock、Vertex AI、または Microsoft Foundry 経由で認証されている場合は、代わりに claude.ai アカウントでサインインするために `/login` を実行してください。claude.ai 経由で既にサインインしており、`--teleport` がまだ利用できない場合は、組織がクラウドセッションを無効にしている可能性があります。

セッションの操作

セッションは claude.ai/code のサイドバーに表示されます。そこから変更を確認し、チームメイトと共有し、完了した作業をアーカイブするか、セッションを永続的に削除できます。

コンテキストを管理

クラウドセッションは[組み込みコマンド](/ja/commands)をサポートしており、テキスト出力を生成します。`/model` や `/config` のようなインタラクティブターミナルピッカーを開くコマンドは利用できません。

コンテキスト管理の場合：

| コマンド | クラウドセッションで機能 | 注記 |
| :- | :- | :- |
| `/compact` | はい | 会話を要約してコンテキストを解放します。`/compact keep the test output` のようなオプションのフォーカス指示を受け入れます |
| `/context` | はい | 現在コンテキストウィンドウにあるものを表示します |
| `/clear` | いいえ | サイドバーから新しいセッションを開始します |

自動圧縮はコンテキストウィンドウが容量に近づくと自動的に実行されます。より早くトリガーするには、[環境変数](#configure-your-environment)で [`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`](/ja/env-vars)を設定します。例えば、`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=70` はウィンドウがほぼいっぱいになるまで待つのではなく、70% 容量で圧縮します。圧縮計算の有効なウィンドウサイズを変更するには、[`CLAUDE_CODE_AUTO_COMPACT_WINDOW`](/ja/env-vars)を使用します。

[Subagents](/ja/sub-agents)はローカルと同じように機能します。Claude は Task ツールでそれらをスポーンして、研究または並列作業を別のコンテキストウィンドウにオフロードし、メイン会話を軽くすることができます。リポジトリの `.claude/agents/` で定義された Subagents は自動的にピックアップされます。[Agent teams](/ja/agent-teams)はデフォルトでオフですが、[環境変数](#configure-your-environment)に `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` を追加することで有効にできます。

変更を確認

各セッションは追加および削除された行数を示す diff インジケーター（例：`+42 -18`）を表示します。それを選択して diff ビューを開き、特定の行にインラインコメントを残し、次のメッセージで Claude に送信します。PR 作成を含む完全なウォークスルーについては [Review and iterate](/ja/web-quickstart#review-and-iterate)を参照してください。Claude が PR の CI 失敗とレビューコメントを自動的に監視するようにするには、[プルリクエストの自動修正](#auto-fix-pull-requests)を参照してください。

セッションを共有

セッションを共有するには、以下のアカウントタイプに従ってその可視性を切り替えます。その後、セッションリンクをそのまま共有します。受信者はリンクを開くと最新の状態を表示しますが、ビューはリアルタイムで更新されません。

Enterprise または Team アカウントから共有

Enterprise および Team アカウントの場合、2 つの可視性オプションは **Private** と **Team** です。Team 可視性により、セッションは claude.ai 組織の他のメンバーに表示されます。リポジトリアクセス検証はデフォルトで有効になっており、受信者のアカウントに接続された GitHub アカウントに基づいています。アカウントの表示名はアクセス権を持つすべての受信者に表示されます。[Claude in Slack](/ja/slack)セッションは自動的に Team 可視性で共有されます。

Max または Pro アカウントから共有

Max および Pro アカウントの場合、2 つの可視性オプションは **Private** と **Public** です。Public 可視性により、セッションは claude.ai にログインしているすべてのユーザーに表示されます。

共有する前にセッションで機密コンテンツを確認してください。セッションにはプライベート GitHub リポジトリのコードと認証情報が含まれる可能性があります。リポジトリアクセス検証はデフォルトで有効になっていません。

受信者がリポジトリアクセスを持つことを要求するか、共有セッションから名前を非表示にするには、Settings > Claude Code > Sharing settings に移動します。

セッションをアーカイブ

セッションをアーカイブしてセッションリストを整理できます。アーカイブされたセッションはデフォルトのセッションリストから非表示になりますが、アーカイブされたセッションをフィルタリングして表示できます。

セッションをアーカイブするには、サイドバーのセッションにマウスを合わせてアーカイブアイコンを選択します。

セッションを削除

セッションを削除すると、セッションとそのデータが永続的に削除されます。このアクションは取り消せません。セッションは 2 つの方法で削除できます：

- **サイドバーから**：アーカイブされたセッションをフィルタリングし、削除するセッションにマウスを合わせて削除アイコンを選択します
- **セッションメニューから**：セッションを開き、セッションタイトルの横のドロップダウンを選択し、**Delete** を選択します

セッションが削除される前に確認するよう求められます。

プルリクエストの自動修正

Claude はプルリクエストを監視し、CI 失敗とレビューコメントに自動的に応答できます。Claude は PR の GitHub アクティビティをサブスクライブし、チェックが失敗するかレビュアーがコメントを残すと、Claude は調査し、明確な場合は修正をプッシュします。

Auto-fix には Claude GitHub App がリポジトリにインストールされている必要があります。まだインストールしていない場合は、[GitHub App ページ](https://github.com/apps/claude)からインストールするか、[セットアップ](/ja/web-quickstart#connect-github-and-create-an-environment)中にプロンプトが表示されたときにインストールします。

PR がどこから来たか、どのデバイスを使用しているかに応じて、auto-fix をオンにするにはいくつかの方法があります：

- **ウェブ上の Claude Code で作成された PR**：CI ステータスバーを開き、**Auto-fix** を選択します
- **ターミナルから**：PR のブランチにいる間に [`/autofix-pr`](/ja/commands)を実行します。Claude Code は `gh` で開いている PR を検出し、ウェブセッションをスポーンし、1 ステップで auto-fix をオンにします
- **モバイルアプリから**：Claude に PR を auto-fix するよう指示します。例えば「watch this PR and fix any CI failures or review comments」
- **既存の PR**：PR URL をセッションに貼り付けて、Claude に auto-fix するよう指示します

Auto-fix は PR ごとのトグルです。監視を停止するには、ウェブセッションで CI ステータスバーを開き、**Auto-fix** トグルをクリアするか、Claude に PR の監視を停止するよう指示します。

Claude が PR アクティビティにどのように応答するか

auto-fix がアクティブな場合、Claude は新しいレビューコメントと CI チェック失敗を含む PR の GitHub イベントを受け取ります。各イベントについて、Claude は調査して進め方を決定します：

- **明確な修正**：Claude が修正に確信があり、以前の指示と矛盾しない場合、Claude は変更を加え、プッシュし、セッションで何が行われたかを説明します
- **曖昧なリクエスト**：レビュアーのコメントが複数の方法で解釈される可能性がある場合、または建築的に重要なものが含まれている場合、Claude は行動する前にあなたに尋ねます
- **重複または無アクション イベント**：イベントが重複している場合、または変更が不要な場合、Claude はセッションでそれを記録して続行します

ベースブランチが進み、マージコンフリクトが作成されるときに GitHub は webhook を発行しないため、auto-fix は単独でコンフリクトに反応することはできません。コンフリクトを解決するには、セッションを開き、Claude にリベースするよう依頼してください。

Claude は PR を解決する際に GitHub のレビューコメントスレッドに返信する場合があります。これらの返信はあなたの GitHub アカウントを使用して投稿されるため、あなたのユーザー名の下に表示されますが、各返信は Claude Code から来たものとしてラベル付けされるため、レビュアーはそれがエージェントによって書かれたものであり、あなたが直接書いたものではないことを知っています。

リポジトリが Atlantis、Terraform Cloud、または `issue_comment` イベントで実行されるカスタム GitHub Actions などのコメントトリガー自動化を使用する場合、Claude の返信がそれらのワークフローをトリガーする可能性があることに注意してください。auto-fix を有効にする前にリポジトリの自動化を確認し、PR コメントがインフラストラクチャをデプロイするか特権操作を実行できるリポジトリでは auto-fix を無効にすることを検討してください。

セキュリティと分離

各クラウドセッションはいくつかのレイヤーを通じてマシンおよび他のセッションから分離されます：

- **分離された仮想マシン**：各セッションは分離された Anthropic 管理 VM で実行されます
- **ネットワークアクセス制御**：ネットワークアクセスはデフォルトで制限され、無効にできます。ネットワークアクセスを無効にして実行する場合、Claude Code は Anthropic API と通信できます。これにより VM からデータが出ることを許可する可能性があります。
- **認証情報保護**：git 認証情報や署名キーなどの機密認証情報はサンドボックス内の Claude Code と一緒にありません。認証はスコープ付き認証情報を使用するセキュアプロキシを通じて処理されます。
- **セキュアな分析**：コードは PR を作成する前に分離された VM 内で分析および変更されます

トラブルシューティング

`API Error: 500`、`529 Overloaded`、`429`、または `Prompt is too long` などの会話に表示される実行時 API エラーについては、[エラーリファレンス](/ja/errors)を参照してください。これらのエラーとその修正は CLI および Desktop アプリと共有されます。以下のセクションはクラウドセッションに固有の問題をカバーしています。

セッション作成に失敗

新しいセッションが `Session creation failed` で開始に失敗するか、プロビジョニングで停止する場合、Claude Code はクラウド環境を割り当てることができませんでした。

- [status.claude.com](https://status.claude.com) でクラウドセッションインシデントを確認してください
- 1 分後に再試行してください。容量はオンデマンドでプロビジョニングされます
- リポジトリが到達可能であることを確認してください。接続している GitHub アカウントは、Claude GitHub App 認可またはオンデマンドで `/web-setup` 経由で同期された `gh` トークンのいずれかを通じて、GitHub 上のリポジトリへのアクセス権を持つ必要があります。リポジトリに App をインストールする必要はありません。[GitHub 認証オプション](#github-authentication-options)を参照してください。

Remote Control セッションの有効期限切れまたはアクセス拒否

`--teleport` はクラウドセッションが使用する同じ Remote Control セッションインフラストラクチャを通じて接続するため、認証およびセッション有効期限エラーは Remote Control の表現で表示されます。`Remote Control session expired` または `Access denied` が表示される場合があります。接続トークンは短命で、アカウントにスコープされています。

- ローカルで `/login` を実行して認証情報をリフレッシュし、再接続してください
- セッションを所有する同じアカウントにサインインしていることを確認してください
- `Remote Control may not be available for this organization` が表示される場合、管理者がプランのクラウドセッションを有効にしていません

環境の有効期限切れ

クラウドセッションは非アクティブ期間後に停止し、基盤となる環境は回収されます。ローカルターミナルから、これは `Could not resume session ... its environment has expired. Creating a fresh session instead.` として表示されます。ウェブでは、セッションはセッションリストで期限切れとしてマークされます。

[claude.ai/code](https://claude.ai/code) からセッションを再度開いて、会話履歴が復元された新しい環境をプロビジョニングしてください。

制限事項

クラウドセッションをワークフローに依存させる前に、これらの制約を考慮してください：

- **レート制限**：ウェブ上の Claude Code はアカウント内のすべての他の Claude および Claude Code 使用とレート制限を共有します。複数のタスクを並列で実行すると、レート制限をより多く消費します。クラウド VM に対する個別のコンピュート料金はありません。
- **リポジトリ認証**：ウェブからローカルにセッションを移動できるのは、同じアカウントに認証されている場合のみです
- **プラットフォーム制限**：リポジトリのクローンとプルリクエストの作成には GitHub が必要です。自己ホスト型の [GitHub Enterprise Server](/ja/github-enterprise-server) インスタンスは Team および Enterprise プランでサポートされています。GitLab、Bitbucket、およびその他の非 GitHub リポジトリは[ローカルバンドル](#send-local-repositories-without-github)としてクラウドセッションに送信できますが、セッションはリモートに結果をプッシュバックできません
- **組織 IP 許可リスト**：クラウドセッションは Anthropic 管理インフラストラクチャから Anthropic API を呼び出すため、ネットワークからではありません。組織が [IP 許可リスト](https://support.claude.com/en/articles/13200993-restrict-access-to-claude-with-ip-allowlisting)を有効にしている場合、すべてのクラウドセッションは認証エラーで失敗します。同じことが [Code Review](/ja/code-review) および [Routines](/ja/routines)に適用されます。[Anthropic サポート](https://support.claude.com/)に連絡して、Anthropic ホスト型サービスを組織の IP 許可リストから除外してください。

関連リソース

- [Ultraplan](/ja/ultraplan)：クラウドセッションでプランを起案し、ブラウザで確認
- [Ultrareview](/ja/ultrareview)：クラウドサンドボックスで深いマルチエージェントコードレビューを実行
- [Routines](/ja/routines)：スケジュール、API 呼び出し、または GitHub イベントに応答して作業を自動化
- [フック設定](/ja/hooks)：セッションライフサイクルイベントでスクリプトを実行
- [設定リファレンス](/ja/settings)：すべての設定オプション
- [セキュリティ](/ja/security)：分離保証とデータ処理
- [データ使用](/ja/data-usage)：Anthropic がクラウドセッションから保持するもの
- [Claude Tag](https://claude.com/docs/claude-tag/overview)：Slack で実行される組織管理の @Claude で、同じクラウド環境で動作
