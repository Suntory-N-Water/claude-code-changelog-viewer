---
title: setup
source: https://code.claude.com/docs/ja/setup.md
---

# 高度なセットアップ

> Claude Code のシステム要件、プラットフォーム固有のインストール、バージョン管理、およびアンインストール。

このページでは、システム要件、プラットフォーム固有のインストール詳細、更新、およびアンインストールについて説明します。初回セッションのガイド付きウォークスルーについては、[クイックスタート](/ja/quickstart)を参照してください。ターミナルを使用したことがない場合は、[ターミナルガイド](/ja/terminal-guide)を参照してください。

システム要件

Claude Code は以下のプラットフォームと構成で実行されます。

- **オペレーティングシステム**:
  - macOS 13.0 以上
  - Windows 10 1809 以上または Windows Server 2019 以上
  - Ubuntu 20.04 以上
  - Debian 10 以上
  - Alpine Linux 3.19 以上
- **ハードウェア**: 4 GB 以上の RAM、x64 または ARM64 プロセッサ
- **ネットワーク**: インターネット接続が必要です。[ネットワーク構成](/ja/network-config#network-access-requirements)を参照してください。
- **シェル**: Bash、Zsh、PowerShell、または CMD。
- **場所**: [Anthropic サポート対象国](https://www.anthropic.com/supported-countries)

追加の依存関係

- **ripgrep**: 通常は Claude Code に含まれています。検索が失敗する場合は、[検索トラブルシューティング](/ja/troubleshooting#search-and-discovery-issues)を参照してください。

Claude Code をインストール

グラフィカルインターフェースをお好みですか？[Desktop app](/ja/desktop-quickstart)を使用すると、ターミナルなしで Claude Code を使用できます。[macOS](https://claude.ai/api/desktop/darwin/universal/dmg/latest/redirect?utm_source=claude_code\&utm_medium=docs)、[Windows](https://claude.com/download?utm_source=claude_code\&utm_medium=docs)、または[Linux](https://claude.com/download?utm_source=claude_code\&utm_medium=docs)でダウンロードしてください。

ターミナルは初めてですか？[ターミナルガイド](/ja/terminal-guide)で段階的な手順を参照してください。

To install Claude Code, use one of the following methods:

**macOS, Linux, WSL:**

```bash theme={null}
curl -fsSL https://claude.ai/install.sh | bash
```

**Windows PowerShell:**

```powershell theme={null}
irm https://claude.ai/install.ps1 | iex
```

**Windows CMD:**

```batch theme={null}
curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd
```

If you see `The token '&&' is not a valid statement separator`, you're in PowerShell, not CMD. If you see `'irm' is not recognized as an internal or external command`, you're in CMD, not PowerShell. Your prompt shows `PS C:\` when you're in PowerShell and `C:\` without the `PS` when you're in CMD.

If the install command fails with `syntax error near unexpected token '<'`, a `403`, or another curl error, see [Troubleshoot installation](/en/troubleshoot-install#find-your-error) to match the error to a fix and for alternative install methods.

[Git for Windows](https://git-scm.com/downloads/win) is recommended on native Windows so Claude Code can use the Bash tool. If Git for Windows is not installed, Claude Code uses PowerShell as the shell tool instead. WSL setups do not need Git for Windows.

Native installations automatically update in the background to keep you on the latest version.

```bash theme={null}
brew install --cask claude-code
```

Homebrew offers two casks. `claude-code` tracks the stable release channel, which is typically about a week behind and skips releases with major regressions. `claude-code@latest` tracks the latest channel and receives new versions as soon as they ship.

Homebrew installations do not auto-update. Run `brew upgrade claude-code` or `brew upgrade claude-code@latest`, depending on which cask you installed, to get the latest features and security fixes.

```powershell theme={null}
winget install Anthropic.ClaudeCode
```

WinGet installations do not auto-update. Run `winget upgrade Anthropic.ClaudeCode` periodically to get the latest features and security fixes.

You can also install with [apt, dnf, or apk](/en/setup#install-with-linux-package-managers) on Debian, Fedora, RHEL, and Alpine.

インストールが完了したら、作業するプロジェクトでターミナルを開き、Claude Code を起動します。

```bash
claude
```

インストール中に問題が発生した場合は、[インストールとログインのトラブルシューティング](/ja/troubleshoot-install)を参照してください。

Windows でのセットアップ

Claude Code をネイティブに Windows で実行することも、WSL 内で実行することもできます。プロジェクトの場所と必要な機能に基づいて選択してください。

| オプション | 必須 | [サンドボックス](/ja/sandboxing) | 使用時期 |
| - | - | - | - |
| ネイティブ Windows | なし；[Git for Windows](https://git-scm.com/downloads/win)はオプション | サポートされていません | Windows ネイティブプロジェクトとツール |
| WSL 2 | WSL 2 有効 | サポートされています | Linux ツールチェーンまたはサンドボックス化されたコマンド実行 |
| WSL 1 | WSL 1 有効 | サポートされていません | WSL 2 が利用できない場合 |

**オプション 1: ネイティブ Windows**

PowerShell または CMD からインストールコマンドを実行します。管理者として実行する必要はありません。[Git for Windows](https://git-scm.com/downloads/win)をインストールすることはオプションです。これにより Git Bash が提供され、[Bash ツール](/ja/tools-reference#bash-tool-behavior)が有効になります。

PowerShell または CMD からインストールするかどうかは、実行するインストールコマンドにのみ影響します。プロンプトは PowerShell では `PS C:\Users\YourName>` と表示され、CMD では `PS` なしで `C:\Users\YourName>` と表示されます。ターミナルが初めての場合は、[ターミナルガイド](/ja/terminal-guide#windows)で各ステップを説明しています。

インストール後、任意のターミナルから `claude` を起動します。

- **Git for Windows がない場合**、Claude Code は[PowerShell ツール](/ja/tools-reference#powershell-tool)経由でシェルコマンドを実行します。
- **Git for Windows がある場合**、Claude Code は[Bash ツール](/ja/tools-reference#bash-tool-behavior)に Git Bash を使用します。Claude Code が Git Bash を見つけられない場合は、[settings.json ファイル](/ja/settings)でパスを設定します。

  ```json theme={null}
  {
    "env": {
      "CLAUDE_CODE_GIT_BASH_PATH": "C:\\Program Files\\Git\\bin\\bash.exe"
    }
  }
  ```

Git for Windows がインストールされている場合、PowerShell ツールは Bash と並行して追加オプションとして段階的にロールアウトされています。オプトインするには `CLAUDE_CODE_USE_POWERSHELL_TOOL=1` を設定するか、オプトアウトするには `0` を設定します。セットアップと制限については、[PowerShell ツール](/ja/tools-reference#powershell-tool)を参照してください。

**オプション 2: WSL**

WSL ディストリビューションを開き、上記の[インストール手順](#install-claude-code)から Linux インストーラーを実行します。PowerShell または CMD からではなく、WSL ターミナル内で `claude` をインストールして起動します。

Alpine Linux と musl ベースのディストリビューション

Alpine およびその他の musl/uClibc ベースのディストリビューション上のネイティブインストーラーには、`libgcc`、`libstdc++`、および `ripgrep` が必要です。ディストリビューションのパッケージマネージャーを使用してこれらをインストールしてから、`USE_BUILTIN_RIPGREP=0` を設定します。

この例は Alpine で必要なパッケージをインストールします。

```bash
apk add libgcc libstdc++ ripgrep
```

次に、[`settings.json`](/ja/settings#available-settings)ファイルで `USE_BUILTIN_RIPGREP` を `0` に設定します。

```json
{
  "env": {
    "USE_BUILTIN_RIPGREP": "0"
  }
}
```

インストールを確認

インストール後、Claude Code が機能していることを確認します。

```bash
claude --version
```

これが `command not found` または別のエラーで失敗する場合は、[インストールとログインのトラブルシューティング](/ja/troubleshoot-install)を参照してください。

インストールと構成をより詳しく確認するには、[`claude doctor`](/ja/troubleshooting#get-more-help)を実行します。

```bash
claude doctor
```

認証

Claude Code には、Pro、Max、Team、Enterprise、または Console アカウントが必要です。無料の Claude.ai プランには Claude Code アクセスは含まれていません。[Amazon Bedrock](/ja/amazon-bedrock)、[Google Vertex AI](/ja/google-vertex-ai)、または[Microsoft Foundry](/ja/microsoft-foundry)などのサードパーティ API プロバイダーで Claude Code を使用することもできます。

インストール後、`claude` を実行してブラウザーのプロンプトに従ってログインします。すべてのアカウントタイプとチームセットアップオプションについては、[認証](/ja/authentication)を参照してください。

Claude Code を更新

ネイティブインストールは自動的にバックグラウンドで更新されます。[リリースチャネルを構成](#configure-release-channel)して、更新をすぐに受け取るか遅延安定スケジュールで受け取るかを制御することも、[自動更新を完全に無効にする](#disable-auto-updates)こともできます。Homebrew、WinGet、および[Linux パッケージマネージャー](#install-with-linux-package-managers)インストールは手動更新が必要です。

自動更新

Claude Code は起動時と実行中に定期的に更新をチェックします。更新はバックグラウンドでダウンロードおよびインストールされ、次に Claude Code を起動するときに有効になります。

`claude doctor` を実行して、最新の更新試行の結果を確認します。

npm グローバルインストールが npm グローバルディレクトリが書き込み可能でないため自動更新できない場合、Claude Code は起動時に 1 回限りの通知を表示し、`claude doctor` は利用可能な修正を一覧表示します。詳細については、[インストール中の権限エラー](/ja/troubleshoot-install#permission-errors-during-installation)を参照してください。

Homebrew、WinGet、apt、dnf、および apk インストールはデフォルトでは自動更新されません。Homebrew と WinGet でオプトインするには、以下を参照してください。Homebrew を手動でアップグレードするには、`brew upgrade claude-code` または `brew upgrade claude-code@latest` を実行します（インストールした cask によって異なります）。WinGet の場合は、`winget upgrade Anthropic.ClaudeCode` を実行します。Linux パッケージマネージャーの場合は、[Linux パッケージマネージャーでインストール](#install-with-linux-package-managers)のアップグレードコマンドを参照してください。

Claude Code が Homebrew または WinGet で自動的にアップグレードコマンドを実行するようにするには、[`CLAUDE_CODE_PACKAGE_MANAGER_AUTO_UPDATE`](/ja/env-vars)を `1` に設定します。Claude Code は新しいバージョンが利用可能な場合、バックグラウンドでアップグレードを実行し、成功時に再起動プロンプトを表示します。アップグレードは Claude Code パッケージのみを対象とし、インストール済みの他のソフトウェアには影響しません。

WinGet では、Claude Code の実行中にアップグレードが失敗する場合があります。これは Windows が実行可能ファイルをロックするためです。その場合、Claude Code は代わりに手動コマンドを表示します。apt、dnf、および apk は、これらのコマンドが昇格された権限を必要とするため、手動アップグレードが必要です。

**既知の問題**: Claude Code は、新しいバージョンがこれらのパッケージマネージャーで利用可能になる前に更新を通知する場合があります。アップグレードが失敗した場合は、しばらく待ってからもう一度試してください。

Homebrew はアップグレード後、古いバージョンをディスク上に保持します。`brew cleanup` を定期的に実行してディスク容量を回収します。

リリースチャネルを構成

`autoUpdatesChannel` 設定を使用して、Claude Code が自動更新と `claude update` に従うリリースチャネルを制御します。

- `"latest"`、デフォルト: リリースされるとすぐに新機能を受け取ります
- `"stable"`: 通常約 1 週間前のバージョンを使用し、大きな回帰を伴うリリースをスキップします

これを `/config` → **自動更新チャネル**経由で構成するか、[settings.json ファイル](/ja/settings)に追加します。

```json
{
  "autoUpdatesChannel": "stable"
}
```

エンタープライズデプロイメントの場合、[管理設定](/ja/permissions#managed-settings)を使用して、組織全体で一貫したリリースチャネルを適用できます。

Homebrew インストールは、この設定ではなく cask 名でチャネルを選択します。`claude-code` は安定版を追跡し、`claude-code@latest` は最新版を追跡します。

最小バージョンをピン留め

`minimumVersion` 設定は下限を確立します。バックグラウンド自動更新と `claude update` は、この値より下のバージョンのインストールを拒否するため、`"stable"` チャネルに移動しても、既に新しい `"latest"` ビルドを使用している場合はダウングレードされません。

`/config` 経由で `"latest"` から `"stable"` に切り替えると、現在のバージョンに留まるか、ダウングレードを許可するかを選択するよう求められます。留まることを選択すると、`minimumVersion` がそのバージョンに設定されます。`"latest"` に戻すと、それがクリアされます。

[settings.json ファイル](/ja/settings)に追加して、下限を明示的にピン留めします。

```json
{
  "autoUpdatesChannel": "stable",
  "minimumVersion": "2.1.100"
}
```

[管理設定](/ja/permissions#managed-settings)では、これはユーザーおよびプロジェクト設定がオーバーライドできない組織全体の最小値を適用します。

`minimumVersion` ピンは更新のみを制約します。Claude Code がバージョン範囲外で起動することを拒否するようにするには、代わりに管理設定の `requiredMinimumVersion` と `requiredMaximumVersion` を使用します。更新は `requiredMaximumVersion` の上限も尊重します。[利用可能な設定](/ja/settings#available-settings)を参照してください。

自動更新を無効にする

[`settings.json`](/ja/settings#available-settings)ファイルの `env` キーで `DISABLE_AUTOUPDATER` を `"1"` に設定します。

```json
{
  "env": {
    "DISABLE_AUTOUPDATER": "1"
  }
}
```

`DISABLE_AUTOUPDATER` はバックグラウンドチェックのみを停止します。`claude update` と `claude install` は引き続き機能します。手動更新を含むすべての更新パスをブロックするには、代わりに [`DISABLE_UPDATES`](/ja/env-vars)を設定します。独自のチャネルを通じて Claude Code を配布し、ユーザーが提供するバージョンに留まる必要がある場合に使用します。

手動で更新

次のバックグラウンドチェックを待たずに更新をすぐに適用するには、以下を実行します。

```bash
claude update
```

高度なインストールオプション

これらのオプションは、バージョンピニング、Linux パッケージマネージャー、npm、およびバイナリ整合性の検証用です。

特定のバージョンをインストール

ネイティブインストーラーは、特定のバージョン番号またはリリースチャネル（`latest` または `stable`）を受け入れます。インストール時に選択したチャネルが自動更新のデフォルトになります。詳細については、[リリースチャネルを構成](#configure-release-channel)を参照してください。

最新バージョンをインストールするには（デフォルト）:

```bash theme={null}
curl -fsSL https://claude.ai/install.sh | bash
```

```powershell theme={null}
irm https://claude.ai/install.ps1 | iex
```

```batch theme={null}
curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd
```

安定版をインストールするには:

```bash theme={null}
curl -fsSL https://claude.ai/install.sh | bash -s stable
```

```powershell theme={null}
& ([scriptblock]::Create((irm https://claude.ai/install.ps1))) stable
```

```batch theme={null}
curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd stable && del install.cmd
```

特定のバージョン番号をインストールするには:

```bash theme={null}
curl -fsSL https://claude.ai/install.sh | bash -s 2.1.89
```

```powershell theme={null}
& ([scriptblock]::Create((irm https://claude.ai/install.ps1))) 2.1.89
```

```batch theme={null}
curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd 2.1.89 && del install.cmd
```

Linux パッケージマネージャーでのインストール

Claude Code は署名付き apt、dnf、および apk リポジトリを公開しています。各リポジトリは 2 つのチャネルを提供します。`stable` は通常約 1 週間前のバージョンを提供し、大きな回帰を伴うリリースをスキップします。`latest` はリリースが出荷されるとすぐにすべてのリリースを提供します。以下のコマンドは `stable` チャネルを構成します。これはほとんどのユーザーに適しています。各タブは `latest` リポジトリ URL も表示します。パッケージマネージャーのインストールは Claude Code を通じて自動更新されません。更新は通常のシステムアップグレードワークフローを通じて提供されます。

すべてのリポジトリは [Claude Code リリース署名キー](#binary-integrity-and-code-signing)で署名されています。キーを信頼する前に、各タブで説明されているとおりに検証してください。

Debian および Ubuntu 用です。以下のコマンドは `stable` チャネルを構成します:

```bash theme={null}
sudo install -d -m 0755 /etc/apt/keyrings
sudo curl -fsSL https://downloads.claude.ai/keys/claude-code.asc \
  -o /etc/apt/keyrings/claude-code.asc
echo "deb [signed-by=/etc/apt/keyrings/claude-code.asc] https://downloads.claude.ai/claude-code/apt/stable stable main" \
  | sudo tee /etc/apt/sources.list.d/claude-code.list
sudo apt update
sudo apt install claude-code
```

代わりに `latest` チャネルを使用するには、URL パスとスイート名の両方が変わります。この `deb` 行を使用します:

```bash theme={null}
echo "deb [signed-by=/etc/apt/keyrings/claude-code.asc] https://downloads.claude.ai/claude-code/apt/latest latest main" \
  | sudo tee /etc/apt/sources.list.d/claude-code.list
```

信頼する前に GPG キーフィンガープリントを検証します。`gpg --show-keys /etc/apt/keyrings/claude-code.asc` は `31DD DE24 DDFA B679 F42D 7BD2 BAA9 29FF 1A7E CACE` を報告する必要があります。

後で更新するには、`sudo apt update && sudo apt upgrade claude-code` を実行します。

Fedora および RHEL 用です。以下のコマンドは `stable` チャネルを構成します:

```bash theme={null}
sudo tee /etc/yum.repos.d/claude-code.repo <<'EOF'
[claude-code]
name=Claude Code
baseurl=https://downloads.claude.ai/claude-code/rpm/stable
enabled=1
gpgcheck=1
gpgkey=https://downloads.claude.ai/keys/claude-code.asc
EOF
sudo dnf install claude-code
```

代わりに `latest` チャネルを使用するには、`baseurl` を `latest` リポジトリに設定します:

```ini theme={null}
baseurl=https://downloads.claude.ai/claude-code/rpm/latest
```

dnf は最初のインストール時にキーをダウンロードし、フィンガープリントを確認するよう求めます。受け入れる前に `31DD DE24 DDFA B679 F42D 7BD2 BAA9 29FF 1A7E CACE` と一致することを確認してください。

後で更新するには、`sudo dnf upgrade claude-code` を実行します。

Alpine Linux 用です。以下のコマンドは `stable` チャネルを構成します:

```sh theme={null}
wget -O /etc/apk/keys/claude-code.rsa.pub \
  https://downloads.claude.ai/keys/claude-code.rsa.pub
echo "https://downloads.claude.ai/claude-code/apk/stable" >> /etc/apk/repositories
apk add claude-code
```

`latest` チャネルに切り替えるには、`stable` リポジトリ行を削除し、`latest` リポジトリを追加します:

```sh theme={null}
sed -i '\|downloads.claude.ai/claude-code/apk/stable|d' /etc/apk/repositories
echo "https://downloads.claude.ai/claude-code/apk/latest" >> /etc/apk/repositories
```

`sha256sum /etc/apk/keys/claude-code.rsa.pub` でダウンロードされたキーを検証します。これは `395759c1f7449ef4cdef305a42e820f3c766d6090d142634ebdb049f113168b6` を報告する必要があります。

後で更新するには、`apk update && apk upgrade claude-code` を実行します。

npm でのインストール

Claude Code をグローバル npm パッケージとしてインストールすることもできます。v2.1.198 以降、npm パッケージには [Node.js 22 以上](https://nodejs.org/en/download)が必要です。古い Node.js バージョンでは、npm はインストール中に `EBADENGINE` 警告を出力するのではなく失敗します。インストールは完了し、パッケージがランタイムで Node.js を使用しないネイティブバイナリをダウンロードするため、`claude` は引き続き実行されます。

```bash
npm install -g @anthropic-ai/claude-code
```

npm パッケージは、スタンドアロンインストーラーと同じネイティブバイナリをインストールします。npm は `@anthropic-ai/claude-code-darwin-arm64` などのプラットフォーム固有のオプション依存関係を通じてバイナリをプルし、postinstall ステップがそれを所定の位置にリンクします。インストールされた `claude` バイナリ自体は Node を呼び出しません。

サポートされている npm インストールプラットフォームは `darwin-arm64`、`darwin-x64`、`linux-x64`、`linux-arm64`、`linux-x64-musl`、`linux-arm64-musl`、`win32-x64`、および `win32-arm64` です。パッケージマネージャーはオプション依存関係を許可する必要があります。インストール後にバイナリが見つからない場合は、[トラブルシューティング](/ja/troubleshoot-install#native-binary-not-found-after-npm-install)を参照してください。

npm インストールをアップグレードするには、`npm install -g @anthropic-ai/claude-code@latest` を実行します。`npm update -g` は避けてください。これは元のインストールからの semver 範囲を尊重し、最新リリースに移動しない可能性があります。

`sudo npm install -g` を使用しないでください。これはアクセス許可の問題とセキュリティリスクにつながる可能性があります。アクセス許可エラーが発生した場合は、[トラブルシューティングアクセス許可エラー](/ja/troubleshoot-install#permission-errors-during-installation)を参照してください。

バイナリ整合性とコード署名

各リリースは、すべてのプラットフォームバイナリの SHA256 チェックサムを含む `manifest.json` を公開します。マニフェストは Anthropic GPG キーで署名されているため、マニフェスト上の署名を検証することで、それが列挙するすべてのバイナリを推移的に検証します。

マニフェスト署名を検証

ステップ 1～3 には、`gpg` と `curl` を備えた POSIX シェルが必要です。Windows では、Git Bash または WSL で実行します。ステップ 4 には PowerShell オプションが含まれています。

リリース署名キーは固定 URL で公開されています。

```bash theme={null}
curl -fsSL https://downloads.claude.ai/keys/claude-code.asc | gpg --import
```

インポートされたキーのフィンガープリントを表示します。

```bash theme={null}
gpg --fingerprint security@anthropic.com
```

出力にこのフィンガープリントが含まれていることを確認します:

```text theme={null}
31DD DE24 DDFA B679 F42D  7BD2 BAA9 29FF 1A7E CACE
```

`VERSION` を検証するリリースに設定します。

```bash theme={null}
REPO=https://downloads.claude.ai/claude-code-releases
VERSION=2.1.89
curl -fsSLO "$REPO/$VERSION/manifest.json"
curl -fsSLO "$REPO/$VERSION/manifest.json.sig"
```

マニフェストに対して分離された署名を検証します。

```bash theme={null}
gpg --verify manifest.json.sig manifest.json
```

有効な結果は `Good signature from "Anthropic Claude Code Release Signing <security@anthropic.com>"` を報告します。

`gpg` は新しくインポートされたキーに対して `WARNING: This key is not certified with a trusted signature!` も出力します。これは予想されています。`Good signature` 行は暗号化チェックが成功したことを確認します。ステップ 1 のフィンガープリント比較はキー自体が本物であることを確認します。

ダウンロードしたバイナリの SHA256 チェックサムを `manifest.json` の `platforms.<platform>.checksum` の下にリストされている値と比較します。

```bash theme={null}
sha256sum claude
```

```bash theme={null}
shasum -a 256 claude
```

```powershell theme={null}
(Get-FileHash claude.exe -Algorithm SHA256).Hash.ToLower()
```

マニフェスト署名は `2.1.89` 以降のリリースで利用可能です。以前のリリースは分離された署名なしで `manifest.json` にチェックサムを公開します。

プラットフォームコード署名

署名付きマニフェストに加えて、個別のバイナリはサポートされている場所でプラットフォーム固有のコード署名を実行します。

- **macOS**: "Anthropic PBC" によって署名され、Apple によって公証されています。`codesign --verify --verbose ./claude` で検証します。
- **Windows**: "Anthropic, PBC" によって署名されています。`Get-AuthenticodeSignature .\claude.exe` で検証します。
- **Linux**: バイナリは個別にコード署名されていません。`claude-code-releases` バケットから直接ダウンロードするか、ネイティブインストーラーを使用する場合は、上記のマニフェスト署名で整合性を検証します。[apt、dnf、または apk](#install-with-linux-package-managers)でインストールする場合、パッケージマネージャーはリポジトリ署名キーを使用して署名を自動的に検証します。

Claude Code をアンインストール

Claude Code を削除するには、インストール方法の指示に従ってください。アンインストール後も `claude` が実行される場合は、2 番目のインストールまたは古いインストーラーからの残存シェルエイリアスがある可能性があります。[競合するインストールを確認](/ja/troubleshoot-install#check-for-conflicting-installations)を参照して、それを見つけて削除してください。

ネイティブインストール

Claude Code バイナリとバージョンファイルを削除します：

```bash theme={null}
rm -f ~/.local/bin/claude
rm -rf ~/.local/share/claude
```

```powershell theme={null}
Remove-Item -Path "$env:USERPROFILE\.local\bin\claude.exe" -Force
Remove-Item -Path "$env:USERPROFILE\.local\share\claude" -Recurse -Force
```

Homebrew インストール

インストールした Homebrew cask を削除します。安定版 cask をインストールした場合：

```bash
brew uninstall --cask claude-code
```

最新版 cask をインストールした場合：

```bash
brew uninstall --cask claude-code@latest
```

WinGet インストール

WinGet パッケージを削除します：

```powershell
winget uninstall Anthropic.ClaudeCode
```

apt / dnf / apk

パッケージとリポジトリ構成を削除します：

```bash theme={null}
sudo apt remove claude-code
sudo rm /etc/apt/sources.list.d/claude-code.list /etc/apt/keyrings/claude-code.asc
```

```bash theme={null}
sudo dnf remove claude-code
sudo rm /etc/yum.repos.d/claude-code.repo
```

```sh theme={null}
apk del claude-code
sed -i '\|downloads.claude.ai/claude-code/apk|d' /etc/apk/repositories
rm /etc/apk/keys/claude-code.rsa.pub
```

npm

グローバル npm パッケージを削除します：

```bash
npm uninstall -g @anthropic-ai/claude-code
```

構成ファイルを削除

構成ファイルを削除すると、すべての設定、許可されたツール、MCP サーバー構成、およびセッション履歴が削除されます。

VS Code 拡張機能、JetBrains プラグイン、および Desktop アプリも `~/.claude/` に書き込みます。それらのいずれかがまだインストールされている場合、ディレクトリは次回実行時に再作成されます。Claude Code を完全に削除するには、これらのファイルを削除する前に、[VS Code 拡張機能](/ja/vs-code#uninstall-the-extension)、JetBrains プラグイン、および Desktop アプリをアンインストールしてください。

Claude Code の設定とキャッシュされたデータを削除するには：

```bash theme={null}
# ユーザー設定と状態を削除
rm -rf ~/.claude
rm ~/.claude.json

# プロジェクト固有の設定を削除（プロジェクトディレクトリから実行）
rm -rf .claude
rm -f .mcp.json
```

```powershell theme={null}
# ユーザー設定と状態を削除
Remove-Item -Path "$env:USERPROFILE\.claude" -Recurse -Force
Remove-Item -Path "$env:USERPROFILE\.claude.json" -Force

# プロジェクト固有の設定を削除（プロジェクトディレクトリから実行）
Remove-Item -Path ".claude" -Recurse -Force
Remove-Item -Path ".mcp.json" -Force
```
