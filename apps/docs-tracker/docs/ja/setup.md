---
title: setup
source: https://code.claude.com/docs/ja/setup.md
---

# 高度なセットアップ

> Claude Code のシステム要件、プラットフォーム固有のインストール、バージョン管理、およびアンインストール。

このページでは、システム要件、プラットフォーム固有のインストール詳細、更新、およびアンインストールについて説明します。初回セッションのガイド付きウォークスルーについては、[クイックスタート](/ja/quickstart)を参照してください。ターミナルを使用したことがない場合は、[ターミナルガイド](/ja/terminal-guide)を参照してください。

## システム要件

Claude Code は以下のプラットフォームと構成で実行されます。

- **オペレーティングシステム**:
  - macOS 13.0 以上
  - Windows 10 1809 以上または Windows Server 2019 以上
  - Ubuntu 20.04 以上
  - Debian 10 以上
  - Alpine Linux 3.19 以上
- **ハードウェア**: 4 GB 以上の RAM、x64 または ARM64 プロセッサ
- **ネットワーク**: インターネット接続が必要です。[ネットワーク構成](/ja/network-config#network-access-requirements)を参照してください。
- **シェル**: Bash、Zsh、PowerShell、または CMD。Windows ネイティブセットアップには [Git for Windows](https://git-scm.com/downloads/win)が必要です。WSL セットアップは不要です。
- **場所**: [Anthropic サポート対象国](https://www.anthropic.com/supported-countries)

### 追加の依存関係

- **ripgrep**: 通常は Claude Code に含まれています。検索が失敗する場合は、[検索トラブルシューティング](/ja/troubleshooting#search-and-discovery-issues)を参照してください。

## Claude Code をインストール

グラフィカルインターフェースをお好みですか？[Desktop app](/ja/desktop-quickstart)を使用すると、ターミナルなしで Claude Code を使用できます。[macOS](https://claude.ai/api/desktop/darwin/universal/dmg/latest/redirect?utm_source=claude_code\&utm_medium=docs)または[Windows](https://claude.com/download?utm_source=claude_code\&utm_medium=docs)でダウンロードしてください。

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

**Native Windows setups require [Git for Windows](https://git-scm.com/downloads/win).** Install it first if you don't have it. WSL setups do not need it.

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

インストールが完了したら、作業するプロジェクトでターミナルを開き、Claude Code を起動します。

```bash
claude
```

インストール中に問題が発生した場合は、[トラブルシューティングガイド](/ja/troubleshooting)を参照してください。

### Windows でのセットアップ

Claude Code をネイティブに Windows で実行することも、WSL 内で実行することもできます。プロジェクトの場所と必要な機能に基づいて選択してください。

| オプション | 必須 | [サンドボックス](/ja/sandboxing) | 使用時期 |
| - | - | - | - |
| ネイティブ Windows | [Git for Windows](https://git-scm.com/downloads/win) | サポートされていません | Windows ネイティブプロジェクトとツール |
| WSL 2 | WSL 2 有効 | サポートされています | Linux ツールチェーンまたはサンドボックス化されたコマンド実行 |
| WSL 1 | WSL 1 有効 | サポートされていません | WSL 2 が利用できない場合 |

**オプション 1: Git Bash を使用したネイティブ Windows**

[Git for Windows](https://git-scm.com/downloads/win)をインストールしてから、PowerShell または CMD からインストールコマンドを実行します。管理者として実行する必要はありません。

PowerShell または CMD からインストールするかどうかは、実行するインストールコマンドにのみ影響します。プロンプトは PowerShell では `PS C:\Users\YourName>` と表示され、CMD では `PS` なしで `C:\Users\YourName>` と表示されます。ターミナルが初めての場合は、[ターミナルガイド](/ja/terminal-guide#windows)で各ステップを説明しています。

インストール後、PowerShell、CMD、または Git Bash から `claude` を起動します。Claude Code は、起動元に関係なく、内部的に Git Bash を使用してコマンドを実行します。Claude Code が Git Bash インストールを見つけられない場合は、[settings.json ファイル](/ja/settings)でパスを設定します。

```json
{
  "env": {
    "CLAUDE_CODE_GIT_BASH_PATH": "C:\\Program Files\\Git\\bin\\bash.exe"
  }
}
```

Claude Code は Windows でネイティブに PowerShell を実行することもできます（オプトインプレビュー）。セットアップと制限については、[PowerShell ツール](/ja/tools-reference#powershell-tool)を参照してください。

**オプション 2: WSL**

WSL ディストリビューションを開き、上記の[インストール手順](#install-claude-code)から Linux インストーラーを実行します。PowerShell または CMD からではなく、WSL ターミナル内で `claude` をインストールして起動します。

### Alpine Linux と musl ベースのディストリビューション

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

## インストールを確認

インストール後、Claude Code が機能していることを確認します。

```bash
claude --version
```

インストールと構成をより詳しく確認するには、[`claude doctor`](/ja/troubleshooting#get-more-help)を実行します。

```bash
claude doctor
```

## 認証

Claude Code には、Pro、Max、Team、Enterprise、または Console アカウントが必要です。無料の Claude.ai プランには Claude Code アクセスは含まれていません。[Amazon Bedrock](/ja/amazon-bedrock)、[Google Vertex AI](/ja/google-vertex-ai)、または[Microsoft Foundry](/ja/microsoft-foundry)などのサードパーティ API プロバイダーで Claude Code を使用することもできます。

インストール後、`claude` を実行してブラウザーのプロンプトに従ってログインします。すべてのアカウントタイプとチームセットアップオプションについては、[認証](/ja/authentication)を参照してください。

## Claude Code を更新

ネイティブインストールは自動的にバックグラウンドで更新されます。[リリースチャネルを構成](#configure-release-channel)して、更新をすぐに受け取るか遅延安定スケジュールで受け取るかを制御することも、[自動更新を完全に無効にする](#disable-auto-updates)こともできます。Homebrew および WinGet インストールは手動更新が必要です。

### 自動更新

Claude Code は起動時と実行中に定期的に更新をチェックします。更新はバックグラウンドでダウンロードおよびインストールされ、次に Claude Code を起動するときに有効になります。

Homebrew および WinGet インストールは自動更新されません。Homebrew の場合は、`brew upgrade claude-code` または `brew upgrade claude-code@latest` を実行します（インストールした cask によって異なります）。WinGet の場合は、`winget upgrade Anthropic.ClaudeCode` を実行します。

**既知の問題**: Claude Code は、新しいバージョンがこれらのパッケージマネージャーで利用可能になる前に更新を通知する場合があります。アップグレードが失敗した場合は、しばらく待ってからもう一度試してください。

Homebrew はアップグレード後、古いバージョンをディスク上に保持します。`brew cleanup` を定期的に実行してディスク容量を回収します。

### リリースチャネルを構成

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

### 自動更新を無効にする

[`settings.json`](/ja/settings#available-settings)ファイルの `env` キーで `DISABLE_AUTOUPDATER` を `"1"` に設定します。

```json
{
  "env": {
    "DISABLE_AUTOUPDATER": "1"
  }
}
```

### 手動で更新

次のバックグラウンドチェックを待たずに更新をすぐに適用するには、以下を実行します。

```bash
claude update
```

## 高度なインストールオプション

これらのオプションは、バージョンピニング、npm からの移行、およびバイナリ整合性の検証用です。

### 特定のバージョンをインストール

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

### 非推奨の npm インストール

npm インストールは非推奨です。ネイティブインストーラーはより高速で、依存関係が不要で、バックグラウンドで自動更新されます。可能な場合は[ネイティブインストール](#install-claude-code)方法を使用してください。

#### npm からネイティブへの移行

以前に npm で Claude Code をインストールした場合は、ネイティブインストーラーに切り替えます。

```bash
# ネイティブバイナリをインストール
curl -fsSL https://claude.ai/install.sh | bash

# 古い npm インストールを削除
npm uninstall -g @anthropic-ai/claude-code
```

既存の npm インストールから `claude install` を実行して、ネイティブバイナリを並行してインストールしてから、npm バージョンを削除することもできます。

#### npm でインストール

互換性上の理由で npm インストールが必要な場合は、[Node.js 18 以上](https://nodejs.org/en/download)がインストールされている必要があります。パッケージをグローバルにインストールします。

```bash
npm install -g @anthropic-ai/claude-code
```

`sudo npm install -g` を使用しないでください。これはアクセス許可の問題とセキュリティリスクにつながる可能性があります。アクセス許可エラーが発生した場合は、[トラブルシューティングアクセス許可エラー](/ja/troubleshooting#permission-errors-during-installation)を参照してください。

### バイナリ整合性とコード署名

各リリースは、すべてのプラットフォームバイナリの SHA256 チェックサムを含む `manifest.json` を公開します。マニフェストは Anthropic GPG キーで署名されているため、マニフェスト上の署名を検証することで、それが列挙するすべてのバイナリを推移的に検証します。

#### マニフェスト署名を検証

ステップ 1～3 には、`gpg` と `curl` を備えた POSIX シェルが必要です。Windows では、Git Bash または WSL で実行します。ステップ 4 には PowerShell オプションが含まれています。

リリース署名キーは固定 URL で公開されています。

```bash theme={null}
curl -fsSL https://downloads.claude.ai/keys/claude-code.asc | gpg --import
```

インポートされたキーのフィンガープリントを表示します。

```bash theme={null}
gpg --fingerprint security@anthropic.com
```

出力にこのフィンガープリントが含まれていることを確認します。

```text theme={null}
31DD DE24 DDFA B679 F42D  7BD2 BAA9 29FF 1A7E CACE
```

`VERSION` を検証するリリースに設定します。

```bash theme={null}
REPO=https://storage.googleapis.com/claude-code-dist-86c565f3-f756-42ad-8dfa-d59b1c096819/claude-code-releases
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

#### プラットフォームコード署名

署名付きマニフェストに加えて、個別のバイナリはサポートされている場所でプラットフォーム固有のコード署名を実行します。

- **macOS**: "Anthropic PBC" によって署名され、Apple によって公証されています。`codesign --verify --verbose ./claude` で検証します。
- **Windows**: "Anthropic, PBC" によって署名されています。`Get-AuthenticodeSignature .\claude.exe` で検証します。
- **Linux**: 上記のマニフェスト署名を使用して整合性を検証します。Linux バイナリは個別にコード署名されていません。

## Claude Code をアンインストール

Claude Code を削除するには、インストール方法の指示に従います。

### ネイティブインストール

Claude Code バイナリとバージョンファイルを削除します。

```bash theme={null}
rm -f ~/.local/bin/claude
rm -rf ~/.local/share/claude
```

```powershell theme={null}
Remove-Item -Path "$env:USERPROFILE\.local\bin\claude.exe" -Force
Remove-Item -Path "$env:USERPROFILE\.local\share\claude" -Recurse -Force
```

### Homebrew インストール

インストールした Homebrew cask を削除します。安定版 cask をインストールした場合:

```bash
brew uninstall --cask claude-code
```

最新版 cask をインストールした場合:

```bash
brew uninstall --cask claude-code@latest
```

### WinGet インストール

WinGet パッケージを削除します。

```powershell
winget uninstall Anthropic.ClaudeCode
```

### npm

グローバル npm パッケージを削除します。

```bash
npm uninstall -g @anthropic-ai/claude-code
```

### 構成ファイルを削除

構成ファイルを削除すると、すべての設定、許可されたツール、MCP サーバー構成、およびセッション履歴が削除されます。

VS Code 拡張機能、JetBrains プラグイン、および Desktop アプリも `~/.claude/` に書き込みます。それらのいずれかがまだインストールされている場合、ディレクトリは次回実行時に再作成されます。Claude Code を完全に削除するには、これらのファイルを削除する前に、[VS Code 拡張機能](/ja/vs-code#uninstall-the-extension)、JetBrains プラグイン、および Desktop アプリをアンインストールしてください。

Claude Code の設定とキャッシュされたデータを削除するには:

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
