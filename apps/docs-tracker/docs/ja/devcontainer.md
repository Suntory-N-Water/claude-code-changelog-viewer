---
title: devcontainer
source: https://code.claude.com/docs/ja/devcontainer.md
---

# 開発コンテナ

> チーム全体で一貫した分離環境を実現するため、開発コンテナ内で Claude Code を実行します。

[開発コンテナ](https://containers.dev/)（dev container）を使用すると、チームのすべてのエンジニアが実行できる同一の分離環境を定義できます。Claude Code がそのコンテナにインストールされている場合、Claude が実行するコマンドはホストマシンではなくコンテナ内で実行され、プロジェクトファイルへの編集はローカルリポジトリに表示されます。

このページでは、[開発コンテナに Claude Code をインストール](#add-claude-code-to-your-dev-container)する方法と、その後の設定トピックについて説明します。各トピックは独立しているため、必要な設定に合わせてジャンプしてください：

- [再構築時に認証と設定を保持する](#persist-authentication-and-settings-across-rebuilds)
- [組織ポリシーを適用する](#enforce-organization-policy)
- [ネットワークエグレスを制限する](#restrict-network-egress)
- [権限プロンプトなしで実行する](#run-without-permission-prompts)

開発コンテナは実質的な保護を提供していますが、すべての攻撃に完全に耐性のあるシステムはありません。
`--dangerously-skip-permissions` で実行する場合、開発コンテナは、[`~/.claude`](/ja/claude-directory) に保存されている Claude Code の認証情報を含む、コンテナ内でアクセス可能なものを悪意のあるプロジェクトが流出させることを防ぎません。
信頼できるリポジトリで開発する場合にのみ開発コンテナを使用し、Claude のアクティビティを監視してください。
`~/.ssh` やクラウド認証情報ファイルなどのホストシークレットをコンテナにマウントすることは避け、リポジトリスコープまたは短期間有効なトークンを使用してください。

開発コンテナは Docker コンテナとして実行され、マシン上または GitHub Codespaces などのクラウドホスト上で実行されます。Dev Containers 仕様をサポートするエディタ（VS Code、GitHub Codespaces、JetBrains IDE、Cursor など）がそのコンテナに接続します。通常どおりエディタでファイルを参照および編集しますが、統合ターミナル、言語サーバー、ビルドツールはすべてホストではなくコンテナ内で実行されます。プレーン Vim などの開発コンテナをサポートしていないエディタはこのワークフローの対象外です。

Claude Code はコンテナ内で実行されるため、プロジェクトのツールチェーンの残りの部分と同じファイル、依存関係、ツールが表示されます。VS Code では、[Claude Code 拡張機能パネル](/ja/vs-code)を使用するか、統合ターミナルで `claude` を実行できます。どちらもコンテナ内で実行され、同じ `~/.claude` 設定を共有します。

開発コンテナに Claude Code を追加する

Claude Code は、[Claude Code Dev Container Feature](https://github.com/anthropics/devcontainer-features/tree/main/src/claude-code) を通じて任意の開発コンテナにインストールされます。

設定は、VS Code、GitHub Codespaces、JetBrains IDE など、Dev Containers 仕様をサポートするあらゆるツールで機能します。以下の手順では、例として VS Code を使用しています。

VS Code または Codespaces でコンテナを開くと、機能は Claude Code VS Code 拡張機能も追加します。他のエディタはその部分を無視します。

開発コンテナが初めてですか？[VS Code Dev Containers チュートリアル](https://code.visualstudio.com/docs/devcontainers/tutorial)では、Docker、拡張機能、最初のコンテナを開く方法について説明しています。ファイアウォールと永続ボリュームを備えた、より完全な強化例については、[リファレンスコンテナを試す](#try-the-reference-container)を参照してください。

以下をリポジトリの `.devcontainer/devcontainer.json` として保存するか、既存ファイルに `features` ブロックを追加します。

末尾のバージョンタグ（`:1.0` など）は、Claude Code リリースではなく、機能のインストールスクリプトをピン留めします。機能は最新の Claude Code をインストールし、Claude Code はデフォルトでコンテナ内で自動更新されます。

CLI バージョンをピン留めするか、自動更新を無効にするには、[組織ポリシーを適用する](#enforce-organization-policy)を参照してください。

```json .devcontainer/devcontainer.json theme={null}
{
  "image": "mcr.microsoft.com/devcontainers/base:ubuntu",
  "features": {
    "ghcr.io/anthropics/devcontainer-features/claude-code:1.0": {}
  }
}
```

`image` 行をプロジェクトのベースイメージに置き換えるか、既存ファイルが Dockerfile を使用している場合は削除します。

Mac では `Cmd+Shift+P`、Windows と Linux では `Ctrl+Shift+P` で VS Code コマンドパレットを開き、**Dev Containers: Rebuild Container** を実行します。

他のツールについては、そのツールの再構築アクション（[GitHub Codespaces での再構築](https://docs.github.com/en/codespaces/developing-in-a-codespace/rebuilding-the-container-in-a-codespace)、[Dev Containers CLI](https://github.com/devcontainers/cli)、または IDE の開発コンテナドキュメント）に従ってください。

再構築されたコンテナでターミナルを開き、`claude` を実行して、認証プロンプトに従います。

認証プロンプトで表示される内容は、プロバイダーによって異なります：

- **Anthropic**：Claude または Anthropic Console アカウントでブラウザ経由でサインイン
- **[Amazon Bedrock、Google Vertex AI、または Microsoft Foundry](/ja/third-party-integrations)**：Claude Code はクラウドプロバイダーの認証情報を使用し、ブラウザプロンプトはありません

クラウドプロバイダーの場合、ホストから認証情報ファイルをマウントするのではなく、`containerEnv`、Codespaces シークレット、またはクラウドのワークロード ID を通じて認証情報をコンテナに渡します。Claude Code が読み取る認証情報チェーンについては、[Amazon Bedrock](/ja/amazon-bedrock)、[Google Vertex AI](/ja/google-vertex-ai)、または [Microsoft Foundry](/ja/microsoft-foundry) を参照してください。

どのパスが組織に適しているかを決定するには、[API プロバイダーを選択する](/ja/admin-setup#choose-your-api-provider)を参照してください。

ブラウザサインインが完了しても、コールバックがコンテナに到達しない場合は、ブラウザに表示されているコードをコピーして、ターミナルの `Paste code here if prompted` プロンプトに貼り付けます。これは、エディタのポート転送が localhost コールバックをルーティングしない場合に発生する可能性があります。

再構築時に認証と設定を保持する

デフォルトでは、コンテナのホームディレクトリは再構築時に破棄されるため、エンジニアは毎回サインインし直す必要があります。Claude Code は認証トークン、ユーザー設定、セッション履歴を [`~/.claude`](/ja/claude-directory) に保存します。そのパスに名前付きボリュームをマウントして、再構築時にこの状態を保持します。

以下の例は、`node` ユーザーのホームディレクトリにボリュームをマウントします：

```json devcontainer.json theme={null}
"mounts": [
  "source=claude-code-config,target=/home/node/.claude,type=volume"
]
```

`/home/node` をコンテナの `remoteUser` のホームディレクトリに置き換えます。ボリュームを `~/.claude` 以外の場所にマウントする場合は、[`CLAUDE_CONFIG_DIR`](/ja/env-vars) をマウントパスに設定して、Claude Code がそこで読み書きするようにします。

プロジェクトごとに状態を分離して、すべてのリポジトリ間で 1 つのボリュームを共有しないようにするには、ソース名に `${devcontainerId}` 変数を含めます。[リファレンス設定](https://github.com/anthropics/claude-code/blob/main/.devcontainer/devcontainer.json)はこの目的で `source=claude-code-config-${devcontainerId}` を使用しています。

GitHub Codespaces では、`~/.claude` は codespace の停止と開始の間で保持されますが、コンテナを再構築するときはまだクリアされるため、上記のボリュームマウントがそこにも適用されます。codespace 間で認証を実行するには、[Codespaces シークレット](https://docs.github.com/en/codespaces/managing-your-codespaces/managing-your-account-specific-secrets-for-github-codespaces)として `ANTHROPIC_API_KEY` または [`claude setup-token`](/ja/authentication#generate-a-long-lived-token) からの `CLAUDE_CODE_OAUTH_TOKEN` を保存します。Codespaces はシークレットを自動的にコンテナ内の環境変数として利用可能にします。

組織ポリシーを適用する

開発コンテナは、同じイメージと設定がすべてのエンジニアのマシンで実行されるため、組織ポリシーを適用するのに便利な場所です。

Claude Code は Linux で `/etc/claude-code/managed-settings.json` を読み取り、[設定階層](/ja/settings#how-scopes-interact)で最高の優先度で適用するため、そこの値はエンジニアが `~/.claude` またはプロジェクトの `.claude/` ディレクトリで設定したものをオーバーライドします。Dockerfile からファイルをコピーして配置します：

```dockerfile Dockerfile
RUN mkdir -p /etc/claude-code
COPY managed-settings.json /etc/claude-code/managed-settings.json
```

Dockerfile はリポジトリに存在するため、書き込みアクセス権を持つ誰でもこのステップを変更または削除できます。エンジニアがリポジトリファイルを編集してバイパスできないポリシーについては、[サーバー管理設定](/ja/server-managed-settings)または MDM を通じて管理設定を配信します。利用可能なキーと他の配信パスについては、[管理設定ファイル](/ja/settings#settings-files)を参照してください。

コンテナ内のすべての Claude Code セッションに適用される[環境変数](/ja/env-vars)を設定するには、`devcontainer.json` の `containerEnv` に追加します。以下の例は、テレメトリとエラーレポートをオプトアウトし、Claude Code がインストール後に自動更新されるのを防ぎます：

```json devcontainer.json theme={null}
"containerEnv": {
  "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
  "DISABLE_AUTOUPDATER": "1"
}
```

Dev Container Feature は常に最新の Claude Code リリースをインストールします。再現可能なビルドのために特定の Claude Code バージョンをピン留めするには、機能を使用する代わりに Dockerfile から `npm install -g @anthropic-ai/claude-code@X.Y.Z` でインストールし、上記のように `DISABLE_AUTOUPDATER` を設定します。

権限ルール、ツール制限、MCP サーバーアローリストを含むポリシーコントロールの完全なリストについては、[組織向けに Claude Code をセットアップする](/ja/admin-setup)を参照してください。

[MCP サーバー](/ja/mcp)をコンテナ内で利用可能にするには、リポジトリルートの `.mcp.json` ファイルで[プロジェクトスコープ](/ja/mcp#mcp-installation-scopes)で定義して、開発コンテナ設定と一緒にチェックインします。ローカル stdio サーバーが依存するバイナリを Dockerfile にインストールし、リモートサーバードメインをネットワークアローリストに追加します。

ネットワークエグレスを制限する

コンテナのアウトバウンドトラフィックを Claude Code が必要とするドメインのみに制限できます。推論と認証ドメインについては[ネットワークアクセス要件](/ja/network-config#network-access-requirements)を参照し、オプションのテレメトリとエラーレポート接続およびそれらを無効にする方法については[テレメトリサービス](/ja/data-usage#telemetry-services)を参照してください。

リファレンスコンテナには、Claude Code と開発ツールが必要とするドメイン以外のすべてのアウトバウンドトラフィックをブロックする [`init-firewall.sh`](https://github.com/anthropics/claude-code/blob/main/.devcontainer/init-firewall.sh) スクリプトが含まれています。コンテナ内でファイアウォールを実行するには追加の権限が必要なため、リファレンスは `runArgs` を通じて `NET_ADMIN` と `NET_RAW` 機能を追加します。ファイアウォールスクリプトとこれらの機能は Claude Code 自体には必須ではありません。これらを除外して、代わりに独自のネットワークコントロールに依存することができます。

権限プロンプトなしで実行する

コンテナは Claude Code を非ルートユーザーとして実行し、コマンド実行をコンテナに限定するため、無人操作のために `--dangerously-skip-permissions` を渡すことができます。CLI はルートとして起動された場合、このフラグを拒否するため、`remoteUser` が非ルートアカウントに設定されていることを確認します。

権限プロンプトをスキップすると、実行前にツール呼び出しを確認する機会が失われます。Claude はバインドマウントされたワークスペース内のあらゆるファイルを変更でき、これはホストに直接表示され、コンテナのネットワークポリシーが許可するものに到達できます。このフラグを上記の[ネットワークエグレス制限](#restrict-network-egress)と組み合わせて、バイパスされたセッションが到達できるものを制限します。

安全チェックを無効にせずにプロンプトを減らしたい場合は、代わりに[自動モード](/ja/permission-modes#eliminate-prompts-with-auto-mode)を検討してください。これは、実行前にアクションを確認するための分類器を備えています。エンジニアが `--dangerously-skip-permissions` をまったく使用できないようにするには、[管理設定](/ja/settings#permission-settings)で `permissions.disableBypassPermissionsMode` を `"disable"` に設定します。

リファレンスコンテナを試す

[`anthropics/claude-code`](https://github.com/anthropics/claude-code/tree/main/.devcontainer) リポジトリには、CLI、エグレスファイアウォール、永続ボリューム、Zsh ベースのシェルを組み合わせた開発コンテナの例が含まれています。これは、保守されたベースイメージではなく、動作する例として提供されています。独自の設定に適用する前に、ピースがどのように組み合わさるかを確認するために使用してください。

VS Code と [Dev Containers 拡張機能](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)をインストールします。

[Claude Code リポジトリ](https://github.com/anthropics/claude-code)をクローンして、VS Code で開きます。

プロンプトが表示されたら、**Reopen in Container** をクリックするか、コマンドパレットから **Dev Containers: Reopen in Container** を実行します。

コンテナのビルドが完了したら、`` Ctrl+` `` でターミナルを開き、`claude` を実行してサインインし、最初のセッションを開始します。

この設定を独自のプロジェクトで使用するには、`.devcontainer/` ディレクトリをリポジトリにコピーして、ツールチェーン用に Dockerfile を調整するか、[開発コンテナに Claude Code を追加する](#add-claude-code-to-your-dev-container)に戻って、既に持っている設定に機能のみを追加します。

リファレンス設定は 3 つのファイルで構成されています。機能を通じて独自の開発コンテナに Claude Code を追加する場合、これらは必須ではありませんが、ピースを組み合わせる 1 つの方法を示しています。

| ファイル | 目的 |
| - | - |
| [`devcontainer.json`](https://github.com/anthropics/claude-code/blob/main/.devcontainer/devcontainer.json) | ボリュームマウント、`runArgs` 機能、VS Code 拡張機能、`containerEnv` |
| [`Dockerfile`](https://github.com/anthropics/claude-code/blob/main/.devcontainer/Dockerfile) | ベースイメージ、開発ツール、Claude Code インストール |
| [`init-firewall.sh`](https://github.com/anthropics/claude-code/blob/main/.devcontainer/init-firewall.sh) | 許可されたドメイン以外のすべてのアウトバウンドネットワークトラフィックをブロック |

次のステップ

Claude Code が開発コンテナで実行されたら、以下のページは組織ロールアウトの残りの部分をカバーしています。認証パスの選択、リポジトリ外での管理ポリシーの配信、使用状況の監視、Claude Code が保存および送信するものの理解です。

- [組織向けに Claude Code をセットアップする](/ja/admin-setup)：認証プロバイダーを選択し、ポリシーがデバイスに到達する方法を決定し、ロールアウトを計画します
- [サーバー管理設定](/ja/server-managed-settings)：Claude.ai 管理コンソールから管理ポリシーを配信して、エンジニアがリポジトリファイルを編集してバイパスできないようにします
- [使用状況の監視と監査アクティビティ](/ja/monitoring-usage)：OpenTelemetry メトリクスをエクスポートして、チームが実行しているものを確認します
- [ネットワークアクセス要件](/ja/network-config#network-access-requirements)：プロキシとファイアウォール用の完全なドメインアローリスト
- [テレメトリサービスとオプトアウト](/ja/data-usage#telemetry-services)：Claude Code がデフォルトで送信するもの、およびそれを無効にする環境変数
- [`.claude` ディレクトリを探索する](/ja/claude-directory)：ボリュームマウントが保持するもの（認証情報、設定、セッション履歴を含む）
- [サンドボックス環境](/ja/sandbox-environments)：開発コンテナと組み込み Bash サンドボックス、カスタムコンテナ、VM を比較します
- [セキュリティモデル](/ja/security)：Claude Code の権限システム、サンドボックス、プロンプトインジェクション保護がどのように組み合わさるか
- [権限モード](/ja/permission-modes)：プランモードから自動モードからバイパスまでの完全な範囲、および各モードを使用する場合
