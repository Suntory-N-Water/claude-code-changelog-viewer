---
title: troubleshooting
source: https://code.claude.com/docs/ja/troubleshooting.md
---

# トラブルシューティング

> Claude Code のインストールと使用に関する一般的な問題の解決策を見つけます。

## インストール問題のトラブルシューティング

ターミナルを完全にスキップしたい場合は、[Claude Code デスクトップアプリ](/ja/desktop-quickstart)を使用して、グラフィカルインターフェイスを通じて Claude Code をインストールおよび使用できます。[macOS](https://claude.ai/api/desktop/darwin/universal/dmg/latest/redirect?utm_source=claude_code\&utm_medium=docs)または[Windows](https://claude.com/download?utm_source=claude_code\&utm_medium=docs)用にダウンロードして、コマンドラインセットアップなしでコーディングを開始します。

表示されているエラーメッセージまたは症状を見つけます：

| 表示内容 | 解決策 |
| :- | :- |
| `command not found: claude` または `'claude' is not recognized` | [PATH を修正する](#command-not-found-claude-after-installation) |
| `syntax error near unexpected token '<'` | [インストールスクリプトが HTML を返す](#install-script-returns-html-instead-of-a-shell-script) |
| `curl: (56) Failure writing output to destination` | [スクリプトをダウンロードしてから実行する](#curl-56-failure-writing-output-to-destination) |
| Linux でのインストール中に `Killed` | [低メモリサーバーにスワップスペースを追加する](#install-killed-on-low-memory-linux-servers) |
| `TLS connect error` または `SSL/TLS secure channel` | [CA 証明書を更新する](#tls-or-ssl-connection-errors) |
| `Failed to fetch version` またはダウンロードサーバーに到達できない | [ネットワークとプロキシ設定を確認する](#check-network-connectivity) |
| `irm is not recognized` または `&& is not valid` | [シェルに適切なコマンドを使用する](#windows-wrong-install-command) |
| `'bash' is not recognized as the name of a cmdlet` | [Windows インストーラーコマンドを使用する](#windows-wrong-install-command) |
| `Claude Code on Windows requires either Git for Windows (for bash) or PowerShell` | [シェルをインストールする](#windows-claude-code-on-windows-requires-either-git-for-windows-for-bash-or-powershell) |
| `Claude Code does not support 32-bit Windows` | [Windows PowerShell を開く（x86 エントリではなく）](#windows-claude-code-does-not-support-32-bit-windows) |
| `Error loading shared library` | [システムに適切なバイナリバリアントをインストールする](#linux-wrong-binary-variant-installed-musl/glibc-mismatch) |
| Linux での `Illegal instruction` | [アーキテクチャの不一致](#illegal-instruction-on-linux) |
| macOS での `dyld: cannot load`、`dyld: Symbol not found`、または `Abort trap` | [バイナリの互換性](#dyld-cannot-load-on-macos) |
| `Invoke-Expression: Missing argument in parameter list` | [インストールスクリプトが HTML を返す](#install-script-returns-html-instead-of-a-shell-script) |
| `App unavailable in region` | Claude Code はお客様の国では利用できません。[サポートされている国](https://www.anthropic.com/supported-countries)を参照してください。 |
| `unable to get local issuer certificate` | [企業 CA 証明書を設定する](#tls-or-ssl-connection-errors) |
| `OAuth error` または `403 Forbidden` | [認証を修正する](#authentication-issues) |
| `API Error: 500`、`529 Overloaded`、`429`、またはその他の上記にリストされていない 4xx および 5xx エラー | [エラーリファレンス](/ja/errors)を参照してください |

問題がリストに記載されていない場合は、これらの診断手順を実行してください。

## インストール問題のデバッグ

### ネットワーク接続を確認する

インストーラーは `downloads.claude.ai` からダウンロードします。到達可能であることを確認します：

```bash
curl -sI https://downloads.claude.ai
```

これが失敗する場合、ネットワークが接続をブロックしている可能性があります。一般的な原因：

- `downloads.claude.ai` をブロックしている企業ファイアウォールまたはプロキシ
- 地域的なネットワーク制限：VPN または別のネットワークを試してください
- TLS/SSL の問題：システムの CA 証明書を更新するか、`HTTPS_PROXY` が設定されているかどうかを確認してください

企業プロキシの背後にいる場合は、インストール前に `HTTPS_PROXY` と `HTTP_PROXY` をプロキシのアドレスに設定します。プロキシ URL がわからない場合は IT チームに問い合わせるか、ブラウザのプロキシ設定を確認してください。

この例は両方のプロキシ変数を設定してから、プロキシを通じてインストーラーを実行します：

```bash
export HTTP_PROXY=http://proxy.example.com:8080
export HTTPS_PROXY=http://proxy.example.com:8080
curl -fsSL https://claude.ai/install.sh | bash
```

### PATH を確認する

インストールが成功しましたが、`claude` を実行するときに `command not found` または `not recognized` エラーが表示される場合、インストールディレクトリが PATH に含まれていません。シェルは PATH にリストされているディレクトリ内のプログラムを検索し、インストーラーは macOS/Linux では `~/.local/bin/claude` に、Windows では `%USERPROFILE%\.local\bin\claude.exe` に `claude` を配置します。

PATH にインストールディレクトリが含まれているかどうかを確認するには、PATH エントリをリストして `local/bin` でフィルタリングします：

```bash theme={null}
echo $PATH | tr ':' '\n' | grep local/bin
```

出力がない場合、ディレクトリが見つかりません。シェル設定に追加します：

```bash theme={null}
# Zsh（macOS デフォルト）
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Bash（Linux デフォルト）
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

または、ターミナルを閉じて再度開きます。

修正が機能したことを確認します：

```bash theme={null}
claude --version
```

```powershell theme={null}
$env:PATH -split ';' | Select-String 'local\\bin'
```

出力がない場合、インストールディレクトリをユーザー PATH に追加します：

```powershell theme={null}
$currentPath = [Environment]::GetEnvironmentVariable('PATH', 'User')
[Environment]::SetEnvironmentVariable('PATH', "$currentPath;$env:USERPROFILE\.local\bin", 'User')
```

変更を有効にするためにターミナルを再起動します。

修正が機能したことを確認します：

```powershell theme={null}
claude --version
```

```batch theme={null}
echo %PATH% | findstr /i "local\bin"
```

出力がない場合、システム設定を開き、環境変数に移動して、`%USERPROFILE%\.local\bin` をユーザー PATH 変数に追加します。ターミナルを再起動します。

修正が機能したことを確認します：

```batch theme={null}
claude --version
```

### 競合するインストールを確認する

複数の Claude Code インストールはバージョンの不一致または予期しない動作を引き起こす可能性があります。インストールされているものを確認します：

PATH に見つかったすべての `claude` バイナリをリストします：

```bash theme={null}
which -a claude
```

ネイティブインストーラーと npm バージョンが存在するかどうかを確認します：

```bash theme={null}
ls -la ~/.local/bin/claude
```

```bash theme={null}
ls -la ~/.claude/local/
```

```bash theme={null}
npm -g ls @anthropic-ai/claude-code 2>/dev/null
```

```powershell theme={null}
where.exe claude
Test-Path "$env:LOCALAPPDATA\Claude Code\claude.exe"
```

複数のインストールが見つかった場合は、1 つだけを保持します。`~/.local/bin/claude` でのネイティブインストールが推奨されます。余分なインストールを削除します：

npm グローバルインストールをアンインストールします：

```bash
npm uninstall -g @anthropic-ai/claude-code
```

macOS で Homebrew インストールを削除します（`claude-code@latest` をインストールした場合はそれを使用します）：

```bash
brew uninstall --cask claude-code
```

### ディレクトリのアクセス許可を確認する

インストーラーは `~/.local/bin/` と `~/.claude/` への書き込みアクセスが必要です。インストールがアクセス許可エラーで失敗する場合、これらのディレクトリが書き込み可能かどうかを確認します：

```bash
test -w ~/.local/bin && echo "writable" || echo "not writable"
test -w ~/.claude && echo "writable" || echo "not writable"
```

いずれかのディレクトリが書き込み可能でない場合、インストールディレクトリを作成してユーザーを所有者として設定します：

```bash
sudo mkdir -p ~/.local/bin
sudo chown -R $(whoami) ~/.local
```

### バイナリが機能することを確認する

`claude` がインストールされているがスタートアップでクラッシュまたはハングする場合、これらのチェックを実行して原因を絞り込みます。

バイナリが存在し、実行可能であることを確認します：

```bash
ls -la $(which claude)
```

Linux では、不足している共有ライブラリを確認します。`ldd` が不足しているライブラリを表示する場合、システムパッケージをインストールする必要があります。Alpine Linux およびその他の musl ベースのディストリビューションについては、[Alpine Linux セットアップ](/ja/setup#alpine-linux-and-musl-based-distributions)を参照してください。

```bash
ldd $(which claude) | grep "not found"
```

バイナリが実行できることを確認するための簡単なサニティチェックを実行します：

```bash
claude --version
```

## 一般的なインストール問題

これらは最も頻繁に発生するインストール問題とその解決策です。

### インストールスクリプトがシェルスクリプトではなく HTML を返す

インストールコマンドを実行すると、次のいずれかのエラーが表示される場合があります：

```text
bash: line 1: syntax error near unexpected token `<'
bash: line 1: `<!DOCTYPE html>'
```

PowerShell では、同じ問題は次のように表示されます：

```text
Invoke-Expression: Missing argument in parameter list.
```

これは、インストール URL がインストールスクリプトではなく HTML ページを返したことを意味します。HTML ページに「App unavailable in region」と表示されている場合、Claude Code はお客様の国では利用できません。[サポートされている国](https://www.anthropic.com/supported-countries)を参照してください。

それ以外の場合、これはネットワークの問題、地域的なルーティング、または一時的なサービス中断が原因で発生する可能性があります。

**解決策：**

1. **別のインストール方法を使用する**：

   macOS または Linux では、Homebrew 経由でインストールします：

   ```bash theme={null}
   brew install --cask claude-code
   ```

   Windows では、WinGet 経由でインストールします：

   ```powershell theme={null}
   winget install Anthropic.ClaudeCode
   ```

2. **数分後に再試行する**：問題は一時的なことが多いです。待ってから元のコマンドを再度試してください。

### インストール後の `command not found: claude`

インストールが完了しましたが、`claude` が機能しません。正確なエラーはプラットフォームによって異なります：

| プラットフォーム | エラーメッセージ |
| :- | :- |
| macOS | `zsh: command not found: claude` |
| Linux | `bash: claude: command not found` |
| Windows CMD | `'claude' is not recognized as an internal or external command` |
| PowerShell | `claude : The term 'claude' is not recognized as the name of a cmdlet` |

これは、インストールディレクトリがシェルの検索パスに含まれていないことを意味します。各プラットフォームの修正については、[PATH を確認する](#verify-your-path)を参照してください。

### `curl: (56) Failure writing output to destination`

`curl ... | bash` コマンドはスクリプトをダウンロードし、パイプ（`|`）を使用して Bash に直接実行するために渡します。このエラーは、スクリプトのダウンロードが完了する前に接続が切断されたことを意味します。一般的な原因には、ネットワーク中断、ダウンロードがストリーム中にブロックされた、またはシステムリソースの制限が含まれます。

**解決策：**

1. **ネットワークの安定性を確認する**：Claude Code バイナリは `downloads.claude.ai` でホストされています。到達可能であることをテストします：
   ```bash theme={null}
   curl -fsSL https://downloads.claude.ai -o /dev/null
   ```
   コマンドが静かに完了する場合、接続は問題なく、問題は一時的である可能性があります。インストールコマンドを再試行してください。エラーが表示される場合、ネットワークがダウンロードをブロックしている可能性があります。

2. **別のインストール方法を試す**：

   macOS または Linux：

   ```bash theme={null}
   brew install --cask claude-code
   ```

   Windows：

   ```powershell theme={null}
   winget install Anthropic.ClaudeCode
   ```

### TLS または SSL 接続エラー

`curl: (35) TLS connect error`、`schannel: next InitializeSecurityContext failed`、または PowerShell の `Could not establish trust relationship for the SSL/TLS secure channel` などのエラーは、TLS ハンドシェイク失敗を示します。

**解決策：**

1. **システム CA 証明書を更新する**：

   Ubuntu/Debian：

   ```bash theme={null}
   sudo apt-get update && sudo apt-get install ca-certificates
   ```

   macOS（Homebrew 経由）：

   ```bash theme={null}
   brew install ca-certificates
   ```

2. **Windows では、インストーラーを実行する前に PowerShell で TLS 1.2 を有効にする**：
   ```powershell theme={null}
   [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
   irm https://claude.ai/install.ps1 | iex
   ```

3. **プロキシまたはファイアウォールの干渉を確認する**：TLS 検査を実行する企業プロキシは、`unable to get local issuer certificate` を含むこれらのエラーを引き起こす可能性があります。`NODE_EXTRA_CA_CERTS` を企業 CA 証明書バンドルに設定します：
   ```bash theme={null}
   export NODE_EXTRA_CA_CERTS=/path/to/corporate-ca.pem
   ```
   証明書ファイルがない場合は IT チームに問い合わせてください。直接接続でも試して、プロキシが原因であることを確認できます。

4. **Windows では、証明書失効確認をバイパスする**（`CRYPT_E_NO_REVOCATION_CHECK (0x80092012)` または `CRYPT_E_REVOCATION_OFFLINE (0x80092013)` が表示される場合）。これらは curl がサーバーに到達したが、ネットワークが証明書失効確認をブロックしていることを意味します。これは企業ファイアウォールの背後で一般的です。インストールコマンドに `--ssl-revoke-best-effort` を追加します：
   ```bat theme={null}
   curl --ssl-revoke-best-effort -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd
   ```
   または、`winget install Anthropic.ClaudeCode` でインストールします。これは curl を完全に回避します。

### `Failed to fetch version from downloads.claude.ai`

インストーラーがダウンロードサーバーに到達できませんでした。これは通常、`downloads.claude.ai` がネットワークでブロックされていることを意味します。

**解決策：**

1. **接続を直接テストする**：
   ```bash theme={null}
   curl -sI https://downloads.claude.ai
   ```

2. **プロキシの背後にいる場合**、`HTTPS_PROXY` を設定して、インストーラーがそれを通じてルーティングできるようにします。詳細については、[プロキシ設定](/ja/network-config#proxy-configuration)を参照してください。
   ```bash theme={null}
   export HTTPS_PROXY=http://proxy.example.com:8080
   curl -fsSL https://claude.ai/install.sh | bash
   ```

3. **制限されたネットワーク上にいる場合**、別のネットワークまたは VPN を試すか、別のインストール方法を使用します：

   macOS または Linux：

   ```bash theme={null}
   brew install --cask claude-code
   ```

   Windows：

   ```powershell theme={null}
   winget install Anthropic.ClaudeCode
   ```

### Windows：間違ったインストールコマンド

`'irm' is not recognized`、`The token '&&' is not valid`、または `'bash' is not recognized as the name of a cmdlet` が表示される場合、別のシェルまたはオペレーティングシステムのインストールコマンドをコピーしました。

- **`irm` が認識されない**：CMD にいて、PowerShell にいません。2 つのオプションがあります：

  スタートメニューで「PowerShell」を検索して PowerShell を開き、元のインストールコマンドを実行します：

  ```powershell theme={null}
  irm https://claude.ai/install.ps1 | iex
  ```

  または CMD に留まり、代わりに CMD インストーラーを使用します：

  ```batch theme={null}
  curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd
  ```

- **`&&` が有効でない**：PowerShell にいますが、CMD インストーラーコマンドを実行しました。PowerShell インストーラーを使用します：
  ```powershell theme={null}
  irm https://claude.ai/install.ps1 | iex
  ```

- **`bash` が認識されない**：Windows で macOS/Linux インストーラーを実行しました。代わりに PowerShell インストーラーを使用します：
  ```powershell theme={null}
  irm https://claude.ai/install.ps1 | iex
  ```

### 低メモリ Linux サーバーでのインストール中に Killed

VPS またはクラウドインスタンスでインストール中に `Killed` が表示される場合：

```text
Setting up Claude Code...
Installing Claude Code native build latest...
bash: line 142: 34803 Killed    "$binary_path" install ${TARGET:+"$TARGET"}
```

Linux OOM キラーがプロセスを終了しました。システムがメモリ不足になったためです。Claude Code には少なくとも 4 GB の利用可能な RAM が必要です。

**解決策：**

1. **RAM が限られている場合はスワップスペースを追加する**。スワップはディスク領域をオーバーフロー メモリとして使用し、物理 RAM が少ない場合でもインストールを完了できます。

   2 GB スワップファイルを作成して有効にします：

   ```bash theme={null}
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   ```

   その後、インストールを再試行します：

   ```bash theme={null}
   curl -fsSL https://claude.ai/install.sh | bash
   ```

2. **インストール前に他のプロセスを閉じて**メモリを解放します。

3. **可能であれば、より大きなインスタンスを使用する**。Claude Code には少なくとも 4 GB の RAM が必要です。

### Docker でのインストールハング

Docker コンテナに Claude Code をインストールする場合、ルートとして `/` にインストールするとハングが発生する可能性があります。

**解決策：**

1. **インストーラーを実行する前に作業ディレクトリを設定する**。`/` から実行すると、インストーラーはファイルシステム全体をスキャンし、メモリ使用量が過剰になります。`WORKDIR` を設定すると、スキャンが小さなディレクトリに制限されます：
   ```dockerfile theme={null}
   WORKDIR /tmp
   RUN curl -fsSL https://claude.ai/install.sh | bash
   ```

2. **Docker メモリ制限を増やす**（Docker Desktop を使用している場合）：
   ```bash theme={null}
   docker build --memory=4g .
   ```

### Windows：Claude Desktop が `claude` CLI コマンドをオーバーライドする

古いバージョンの Claude Desktop をインストールした場合、`WindowsApps` ディレクトリに `Claude.exe` を登録して、Claude Code CLI よりも PATH の優先度を高くする可能性があります。`claude` を実行すると、CLI ではなくデスクトップアプリが開きます。

Claude Desktop を最新バージョンに更新して、この問題を修正します。

### Windows：「Claude Code on Windows requires either Git for Windows (for bash) or PowerShell」

ネイティブ Windows の Claude Code には、少なくとも 1 つのシェルが必要です：Bash 用の[Git for Windows](https://git-scm.com/downloads/win)、または PowerShell。どちらも見つからない場合、このエラーは起動時に表示されます。PowerShell のみが見つかった場合、Claude Code は Bash ではなく PowerShell ツールを使用します。

**どちらもインストールされていない場合**、1 つをインストールします：

- Git for Windows：[git-scm.com/downloads/win](https://git-scm.com/downloads/win)からダウンロードします。セットアップ中に「Add to PATH」を選択します。インストール後、ターミナルを再起動します。
- PowerShell 7：[aka.ms/powershell](https://aka.ms/powershell)からダウンロードします。

**Git が既にインストールされている**が Claude Code がそれを見つけられない場合は、[settings.json ファイル](/ja/settings)でパスを設定します：

```json
{
  "env": {
    "CLAUDE_CODE_GIT_BASH_PATH": "C:\\Program Files\\Git\\bin\\bash.exe"
  }
}
```

Git が別の場所にインストールされている場合は、PowerShell で `where.exe git` を実行してパスを見つけ、そのディレクトリから `bin\bash.exe` パスを使用します。

### Windows：Claude Code は 32 ビット Windows をサポートしていません

Windows スタートメニューには 2 つの PowerShell エントリが含まれています：`Windows PowerShell` と `Windows PowerShell (x86)`。x86 エントリは 32 ビットプロセスとして実行され、64 ビットマシンでもこのエラーをトリガーします。どちらの場合かを確認するには、エラーを生成したのと同じウィンドウで以下を実行します：

```powershell
[Environment]::Is64BitOperatingSystem
```

これが `True` を出力する場合、オペレーティングシステムは問題ありません。ウィンドウを閉じて、x86 サフィックスなしで `Windows PowerShell` を開き、インストールコマンドを再度実行します。

これが `False` を出力する場合、32 ビット版の Windows を使用しています。Claude Code には 64 ビットオペレーティングシステムが必要です。[システム要件](/ja/setup#system-requirements)を参照してください。

### Linux：インストールされた間違ったバイナリバリアント（musl/glibc の不一致）

インストール後に `libstdc++.so.6` または `libgcc_s.so.1` などの不足している共有ライブラリに関するエラーが表示される場合、インストーラーはシステムに対して間違ったバイナリバリアントをダウンロードした可能性があります。

```text
Error loading shared library libstdc++.so.6: No such file or directory
```

これは、musl クロスコンパイルパッケージがインストールされている glibc ベースのシステムで発生する可能性があり、インストーラーがシステムを musl として誤検出します。

**解決策：**

1. **システムが使用している libc を確認する**：
   ```bash theme={null}
   ldd /bin/ls | head -1
   ```
   `linux-vdso.so` または `/lib/x86_64-linux-gnu/` への参照が表示される場合、glibc を使用しています。`musl` が表示される場合、musl を使用しています。

2. **glibc を使用しているが musl バイナリを取得した場合**、インストールを削除して再インストールします。`https://downloads.claude.ai/claude-code-releases/{VERSION}/manifest.json` のマニフェストを使用して正しいバイナリを手動でダウンロードすることもできます。`ldd /bin/ls` と `ls /lib/libc.musl*` の出力を含む[GitHub issue](https://github.com/anthropics/claude-code/issues)を提出してください。

3. **実際に musl を使用している場合**（Alpine Linux）、必要なパッケージをインストールします：
   ```bash theme={null}
   apk add libgcc libstdc++ ripgrep
   ```

### Linux での `Illegal instruction`

インストーラーが OOM `Killed` メッセージではなく `Illegal instruction` を出力する場合、ダウンロードされたバイナリが CPU アーキテクチャと一致しません。これは、ARM サーバーが x86 バイナリを受け取った場合、または必要な命令セットがない古い CPU で一般的に発生します。

```text
bash: line 142: 2238232 Illegal instruction    "$binary_path" install ${TARGET:+"$TARGET"}
```

**解決策：**

1. **アーキテクチャを確認する**：
   ```bash theme={null}
   uname -m
   ```
   `x86_64` は 64 ビット Intel/AMD を意味し、`aarch64` は ARM64 を意味します。バイナリが一致しない場合は、出力を含む[GitHub issue](https://github.com/anthropics/claude-code/issues)を提出してください。

2. **アーキテクチャの問題が解決されている間、別のインストール方法を試す**：
   ```bash theme={null}
   brew install --cask claude-code
   ```

### macOS での `dyld: cannot load`

インストール中に `dyld: cannot load`、`dyld: Symbol not found`、または `Abort trap: 6` が表示される場合、バイナリは macOS バージョンまたはハードウェアと互換性がありません。

```text
dyld: cannot load 'claude-2.1.42-darwin-x64' (load command 0x80000034 is unknown)
Abort trap: 6
```

`libicucore` を参照する `Symbol not found` エラーは、macOS バージョンがバイナリがサポートしているバージョンより古いことを示します：

```text
dyld: Symbol not found: _ubrk_clone
  Referenced from: claude-darwin-x64 (which was built for Mac OS X 13.0)
  Expected in: /usr/lib/libicucore.A.dylib
```

**解決策：**

1. **macOS バージョンを確認する**：Claude Code には macOS 13.0 以降が必要です。Apple メニューを開き、「このマックについて」を選択してバージョンを確認します。

2. **古いバージョンを使用している場合は macOS を更新する**。バイナリは古い macOS バージョンがサポートしていないロードコマンドを使用しています。

3. **別のインストール方法として Homebrew を試す**：
   ```bash theme={null}
   brew install --cask claude-code
   ```

### Windows インストール問題：WSL でのエラー

WSL で次の問題が発生する可能性があります：

**OS/プラットフォーム検出の問題**：インストール中にエラーが発生する場合、WSL は Windows `npm` を使用している可能性があります。試してください：

- インストール前に `npm config set os linux` を実行する
- `npm install -g @anthropic-ai/claude-code --force --no-os-check` でインストールする。`sudo` を使用しないでください。

**Node が見つからないエラー**：`claude` を実行するときに `exec: node: not found` が表示される場合、WSL 環境は Windows インストールの Node.js を使用している可能性があります。`which npm` と `which node` で確認できます。これらは `/usr/` で始まる Linux パスではなく `/mnt/c/` を指す必要があります。これを修正するには、Linux ディストリビューションのパッケージマネージャーまたは[`nvm`](https://github.com/nvm-sh/nvm)経由で Node をインストールしてみてください。

**nvm バージョンの競合**：WSL と Windows の両方に nvm がインストールされている場合、WSL で Node バージョンを切り替えるときにバージョンの競合が発生する可能性があります。これは WSL がデフォルトで Windows PATH をインポートするため、Windows nvm/npm が WSL インストールより優先されるためです。

この問題は以下で識別できます：

- `which npm` と `which node` を実行する - `/mnt/c/` で始まる Windows パスを指す場合、Windows バージョンが使用されています
- WSL で nvm を使用してノードバージョンを切り替えた後、機能が破損する

この問題を解決するには、Linux PATH を修正して、Linux ノード/npm バージョンが優先されるようにします：

**主要な解決策：nvm がシェルに適切にロードされていることを確認する**

最も一般的な原因は、nvm が非対話型シェルにロードされていないことです。シェル設定ファイル（`~/.bashrc`、`~/.zshrc` など）に以下を追加します：

```bash
# nvm が存在する場合はロードする
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
```

または現在のセッションで直接実行します：

```bash
source ~/.nvm/nvm.sh
```

**代替案：PATH の順序を調整する**

nvm が適切にロードされているが Windows パスがまだ優先される場合、シェル設定で Linux パスを PATH の先頭に明示的に追加できます：

```bash
export PATH="$HOME/.nvm/versions/node/$(node -v)/bin:$PATH"
```

`appendWindowsPath = false` で Windows PATH インポートを無効にすることは避けてください。これは WSL から Windows 実行可能ファイルを呼び出す機能を破壊します。同様に、Windows 開発に使用する場合は Windows から Node.js をアンインストールすることは避けてください。

### WSL2 サンドボックスセットアップ

[サンドボックス](/ja/sandboxing)は WSL2 でサポートされていますが、追加のパッケージをインストールする必要があります。`/sandbox` を実行するときに `bubblewrap` または `socat` が見つからないというエラーが表示される場合は、依存関係をインストールします：

```bash theme={null}
sudo apt-get install bubblewrap socat
```

```bash theme={null}
sudo dnf install bubblewrap socat
```

WSL1 はサンドボックスをサポートしていません。「Sandboxing requires WSL2」が表示される場合は、WSL2 にアップグレードするか、サンドボックスなしで Claude Code を実行する必要があります。

サンドボックス化されたコマンドは `cmd.exe`、`powershell.exe`、または `/mnt/c/` の下の実行可能ファイルなどの Windows バイナリを起動できません。WSL はこれらを Unix ソケット経由で Windows ホストに渡しますが、サンドボックスはこれをブロックします。コマンドが Windows バイナリを呼び出す必要がある場合は、[`excludedCommands`](/ja/settings#sandbox-settings)に追加して、サンドボックスの外で実行されるようにします。

### インストール中のアクセス許可エラー

ネイティブインストーラーがアクセス許可エラーで失敗する場合、ターゲットディレクトリが書き込み可能でない可能性があります。[ディレクトリのアクセス許可を確認する](#check-directory-permissions)を参照してください。

以前に npm でインストールしており、npm 固有のアクセス許可エラーが発生している場合は、ネイティブインストーラーに切り替えます：

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

### npm インストール後にネイティブバイナリが見つからない

`@anthropic-ai/claude-code` npm パッケージは、`@anthropic-ai/claude-code-darwin-arm64` などのプラットフォーム固有のオプション依存関係を通じてネイティブバイナリを取得します。インストール後に `claude` を実行すると `Could not find native binary package "@anthropic-ai/claude-code-<platform>"` が出力される場合は、次の原因を確認してください：

- **オプション依存関係が無効になっている。** npm インストールコマンドから `--omit=optional` を削除し、pnpm から `--no-optional` を削除し、yarn から `--ignore-optional` を削除し、`.npmrc` が `optional=false` を設定していないことを確認してから、再インストールします。ネイティブバイナリはオプション依存関係としてのみ配信されるため、スキップされた場合は JavaScript フォールバックはありません。
- **サポートされていないプラットフォーム。** プリビルドバイナリは `darwin-arm64`、`darwin-x64`、`linux-x64`、`linux-arm64`、`linux-x64-musl`、`linux-arm64-musl`、`win32-x64`、および `win32-arm64` に対して公開されています。Claude Code は他のプラットフォーム用のバイナリを出荷しません。[システム要件](/ja/setup#system-requirements)を参照してください。
- **企業 npm ミラーがプラットフォームパッケージを欠落している。** レジストリが、メタパッケージに加えて 8 つの `@anthropic-ai/claude-code-*` プラットフォームパッケージすべてをミラーしていることを確認してください。

`--ignore-scripts` でインストールすると、このエラーはトリガーされません。バイナリを所定の位置にリンクする postinstall ステップがスキップされるため、Claude Code は各起動時にプラットフォームバイナリを検索して生成するラッパーにフォールバックします。これは機能しますが、より遅く起動します。スクリプトを有効にして再インストールして、直接実行します。

## アクセス許可と認証

これらのセクションでは、ログイン失敗、トークンの問題、およびアクセス許可プロンプトの動作に対処します。

### 繰り返されるアクセス許可プロンプト

同じコマンドを繰り返し承認する必要がある場合は、`/permissions` コマンドを使用して、特定のツールが承認なしで実行されるようにできます。[アクセス許可ドキュメント](/ja/permissions#manage-permissions)を参照してください。

### 認証の問題

認証の問題が発生している場合：

1. `/logout` を実行して完全にサインアウトします
2. Claude Code を閉じます
3. `claude` で再起動して、認証プロセスを再度完了します

ブラウザがログイン中に自動的に開かない場合は、`c` を押して OAuth URL をクリップボードにコピーし、手動でブラウザに貼り付けます。

### OAuth エラー：無効なコード

`OAuth error: Invalid code. Please make sure the full code was copied` が表示される場合、ログインコードが期限切れになったか、コピー貼り付け中に切り詰められました。

**解決策：**

- Enter キーを押して再試行し、ブラウザが開いた後すぐにログインを完了します
- ブラウザが自動的に開かない場合は、`c` を入力して完全な URL をコピーします
- リモート/SSH セッションを使用している場合、ブラウザが間違ったマシンで開く可能性があります。ターミナルに表示されている URL をコピーして、ローカルブラウザで開きます。

### ログイン後の 403 Forbidden

ログイン後に `API Error: 403 {"error":{"type":"forbidden","message":"Request not allowed"}}` が表示される場合：

- **Claude Pro/Max ユーザー**：[claude.ai/settings](https://claude.ai/settings)でサブスクリプションがアクティブであることを確認します
- **Console ユーザー**：管理者によって「Claude Code」または「Developer」ロールが割り当てられていることを確認します
- **プロキシの背後**：企業プロキシは API リクエストに干渉する可能性があります。[ネットワーク設定](/ja/network-config)でプロキシセットアップを参照してください。

### モデルが見つからないか、アクセスできない

`There's an issue with the selected model (...). It may not exist or you may not have access to it` が表示される場合、API は設定されたモデル名を拒否しました。

一般的な原因：

- `--model` に渡されたモデル名のタイプミス
- 設定に保存された古いまたは非推奨のモデル ID
- そのモデルへのアクセス権がない API キー

[優先順位順](/ja/model-config#setting-your-model)でモデルが設定されている場所を確認します：

- `--model` フラグ
- `ANTHROPIC_MODEL` 環境変数
- `.claude/settings.local.json` の `model` フィールド
- プロジェクトの `.claude/settings.json` の `model` フィールド
- `~/.claude/settings.json` の `model` フィールド

古い値をクリアするには、設定から `model` フィールドを削除するか、`ANTHROPIC_MODEL` を設定解除します。Claude Code はアカウントのデフォルトモデルにフォールバックします。

アカウントで利用可能なモデルを参照するには、`claude` を対話的に開始して `/model` を実行してピッカーを開きます。Vertex AI デプロイメントについては、[Vertex AI トラブルシューティングセクション](/ja/google-vertex-ai#troubleshooting)を参照してください。

### この組織はアクティブなサブスクリプションで無効になっています

アクティブな Claude サブスクリプションがあるにもかかわらず `API Error: 400 ... "This organization has been disabled"` が表示される場合、`ANTHROPIC_API_KEY` 環境変数がサブスクリプションをオーバーライドしています。これは、前の雇用主またはプロジェクトからの古い API キーがシェルプロファイルに設定されている場合に一般的に発生します。

`ANTHROPIC_API_KEY` が存在し、承認されている場合、Claude Code はサブスクリプションの OAuth 認証情報ではなくそのキーを使用します。非対話型モード（`-p`）では、キーが存在する場合は常に使用されます。[認証の優先順位](/ja/authentication#authentication-precedence)で完全な解決順序を参照してください。

代わりにサブスクリプションを使用するには、環境変数を設定解除し、シェルプロファイルから削除します：

```bash
unset ANTHROPIC_API_KEY
claude
```

`~/.zshrc`、`~/.bashrc`、または `~/.profile` で `export ANTHROPIC_API_KEY=...` 行を確認して削除し、変更を永続的にします。Claude Code 内で `/status` を実行して、どの認証方法がアクティブであるかを確認します。

### WSL2 での OAuth ログイン失敗

WSL2 でのブラウザベースのログインは、WSL が Windows ブラウザを開くことができない場合に失敗する可能性があります。`BROWSER` 環境変数を設定します：

```bash
export BROWSER="/mnt/c/Program Files/Google/Chrome/Application/chrome.exe"
claude
```

または URL を手動でコピーします：ログインプロンプトが表示されたら、`c` を押して OAuth URL をコピーし、Windows ブラウザに貼り付けます。

### ログインしていないか、トークンの期限切れ

Claude Code がセッション後に再度ログインするよう求める場合、OAuth トークンが期限切れになった可能性があります。

`/login` を実行して再認証します。これが頻繁に発生する場合は、システムクロックが正確であることを確認してください。トークン検証は正確なタイムスタンプに依存しています。

macOS では、Keychain がロックされているか、パスワードがアカウントパスワードと同期していない場合、ログインが失敗することもあります。これにより、Claude Code が認証情報を保存できなくなります。`claude doctor` を実行して Keychain アクセスを確認します。Keychain を手動でロック解除するには、`security unlock-keychain ~/Library/Keychains/login.keychain-db` を実行します。ロック解除が役に立たない場合は、Keychain Access を開き、`login` キーチェーンを選択して、編集 > キーチェーン「login」のパスワードを変更を選択して、アカウントパスワードと再同期します。

## 設定ファイルの場所

Claude Code は複数の場所に設定を保存します：

| ファイル | 目的 |
| :- | :- |
| `~/.claude/settings.json` | ユーザー設定（アクセス許可、フック、モデルオーバーライド） |
| `.claude/settings.json` | プロジェクト設定（ソース管理にチェックイン） |
| `.claude/settings.local.json` | ローカルプロジェクト設定（コミットされない） |
| `~/.claude.json` | グローバル状態（テーマ、OAuth、MCP サーバー） |
| `.mcp.json` | プロジェクト MCP サーバー（ソース管理にチェックイン） |
| `managed-mcp.json` | [管理対象 MCP サーバー](/ja/mcp#managed-mcp-configuration) |
| 管理対象設定 | [管理対象設定](/ja/settings#settings-files)（サーバー管理、MDM/OS レベルのポリシー、またはファイルベース） |

Windows では、`~` はユーザーホームディレクトリ（`C:\Users\YourName` など）を指します。

これらのファイルの設定の詳細については、[設定](/ja/settings)と[MCP](/ja/mcp)を参照してください。

### 設定をリセットする

Claude Code をデフォルト設定にリセットするには、設定ファイルを削除できます：

```bash
# すべてのユーザー設定と状態をリセット
rm ~/.claude.json
rm -rf ~/.claude/

# プロジェクト固有の設定をリセット
rm -rf .claude/
rm .mcp.json
```

これにより、すべての設定、MCP サーバー設定、およびセッション履歴が削除されます。

## パフォーマンスと安定性

これらのセクションでは、リソース使用量、応答性、および検索動作に関連する問題について説明します。

### CPU またはメモリ使用量が多い

Claude Code はほとんどの開発環境で動作するように設計されていますが、大規模なコードベースを処理する場合、かなりのリソースを消費する可能性があります。パフォーマンスの問題が発生している場合：

1. `/compact` を定期的に使用してコンテキストサイズを削減します
2. 主要なタスク間で Claude Code を閉じて再起動します
3. 大規模なビルドディレクトリを `.gitignore` ファイルに追加することを検討してください

メモリ使用量がこれらのステップ後も高いままの場合は、`/heapdump` を実行して JavaScript ヒープスナップショットとメモリ分析を `~/Desktop` に書き込みます。分析は常駐セットサイズ、JS ヒープ、配列バッファ、および説明されていないネイティブメモリを表示し、成長が JavaScript オブジェクトにあるか、ネイティブコードにあるかを識別するのに役立ちます。Chrome DevTools のメモリ → ロードで `.heapsnapshot` ファイルを開いて、リテイナーを検査します。メモリの問題を報告するときに両方のファイルを [GitHub](https://github.com/anthropics/claude-code/issues) に添付します。

### 自動コンパクションがスラッシング エラーで停止する

`Autocompact is thrashing: the context refilled to the limit...` が表示される場合、自動コンパクションは成功しましたが、ファイルまたはツール出力がコンテキストウィンドウを数回連続で満杯に戻しました。Claude Code は進捗を遂行していないループで API 呼び出しを無駄にするのを避けるために再試行を停止します。

回復するには：

1. Claude に、ファイル全体ではなく、特定の行範囲または関数など、より小さなチャンクで大きなファイルを読むよう依頼します
2. `/compact` を実行して、大きな出力を削除するフォーカスを使用します（例：`/compact keep only the plan and the diff`）
3. 大規模ファイルの作業を[サブエージェント](/ja/sub-agents)に移動して、別のコンテキストウィンドウで実行されるようにします
4. 以前の会話がもう必要ない場合は `/clear` を実行します

### コマンドがハングまたはフリーズする

Claude Code が応答しないように見える場合：

1. Ctrl+C を押して現在の操作をキャンセルしてみます
2. 応答しない場合は、ターミナルを閉じて再起動する必要があります

### 検索と発見の問題

Search ツール、`@file` メンション、カスタムエージェント、およびカスタムスキルが機能していない場合は、システム `ripgrep` をインストールします：

```bash
# macOS（Homebrew）  
brew install ripgrep

# Windows（winget）
winget install BurntSushi.ripgrep.MSVC

# Ubuntu/Debian
sudo apt install ripgrep

# Alpine Linux
apk add ripgrep

# Arch Linux
pacman -S ripgrep
```

その後、[環境](/ja/env-vars)で `USE_BUILTIN_RIPGREP=0` を設定します。

### WSL での遅い、または不完全な検索結果

[WSL でファイルシステム間で作業する場合](https://learn.microsoft.com/en-us/windows/wsl/filesystems)のディスク読み取りパフォーマンスペナルティにより、WSL で Claude Code を使用する場合、Search ツール使用時に予想より少ないマッチが返される可能性があります。検索は機能しますが、ネイティブファイルシステムより少ない結果を返します。

この場合、`/doctor` は Search を OK として表示します。

**解決策：**

1. **より具体的な検索を送信する**：検索するファイル数を減らすために、ディレクトリまたはファイルタイプを指定します：「auth-service パッケージで JWT 検証ロジックを検索」または「JS ファイルで md5 ハッシュの使用を見つける」。

2. **プロジェクトを Linux ファイルシステムに移動する**：可能であれば、プロジェクトが Windows ファイルシステム（`/mnt/c/`）ではなく Linux ファイルシステム（`/home/`）に配置されていることを確認します。

3. **ネイティブ Windows を使用する**：WSL ではなく Windows でネイティブに Claude Code を実行することを検討して、ファイルシステムのパフォーマンスを向上させます。

## IDE 統合の問題

Claude Code が IDE に接続しない場合、または IDE ターミナル内で予期しない動作をする場合は、以下の解決策を試してください。

### WSL2 で JetBrains IDE が検出されない

WSL2 で Claude Code を使用していて、JetBrains IDE を使用している場合、「No available IDEs detected」エラーが表示される場合、これは WSL2 のネットワーク設定または Windows ファイアウォールが接続をブロックしている可能性があります。

#### WSL2 ネットワークモード

WSL2 はデフォルトで NAT ネットワークを使用し、IDE 検出を妨げる可能性があります。2 つのオプションがあります：

**オプション 1：Windows ファイアウォールを設定する**（推奨）

1. WSL2 IP アドレスを見つけます：
   ```bash theme={null}
   wsl hostname -I
   # 出力例：172.21.123.45
   ```

2. 管理者として PowerShell を開き、ファイアウォールルールを作成します：
   ```powershell theme={null}
   New-NetFirewallRule -DisplayName "Allow WSL2 Internal Traffic" -Direction Inbound -Protocol TCP -Action Allow -RemoteAddress 172.21.0.0/16 -LocalAddress 172.21.0.0/16
   ```
   ステップ 1 の WSL2 サブネットに基づいて IP 範囲を調整します。

3. IDE と Claude Code の両方を再起動します

**オプション 2：ミラーリングネットワークに切り替える**

Windows ユーザーディレクトリの `.wslconfig` に追加します：

```ini
[wsl2]
networkingMode=mirrored
```

その後、PowerShell から `wsl --shutdown` で WSL を再起動します。

これらのネットワーク問題は WSL2 にのみ影響します。WSL1 はホストのネットワークを直接使用し、これらの設定は必要ありません。

JetBrains の追加設定のヒントについては、[JetBrains IDE ガイド](/ja/jetbrains#plugin-settings)を参照してください。

### Windows IDE 統合の問題を報告する

Windows で IDE 統合の問題が発生している場合は、次の情報を含む[issue を作成](https://github.com/anthropics/claude-code/issues)してください：

- 環境タイプ：ネイティブ Windows（Git Bash）または WSL1/WSL2
- WSL ネットワークモード（該当する場合）：NAT またはミラーリング
- IDE 名とバージョン
- Claude Code 拡張機能/プラグインバージョン
- シェルタイプ：Bash、Zsh、PowerShell など

### JetBrains IDE ターミナルで Escape キーが機能しない

Claude Code を JetBrains ターミナルで使用していて、`Esc` キーがエージェントを中断しない場合、これは JetBrains のデフォルトショートカットとのキーバインディングの競合が原因である可能性があります。

この問題を修正するには：

1. 設定 → ツール → ターミナルに移動します
2. 次のいずれかを実行します：
   - 「Move focus to the editor with Escape」をオフにするか、
   - 「Configure terminal keybindings」をクリックして「Switch focus to Editor」ショートカットを削除します
3. 変更を適用します

これにより、`Esc` キーが Claude Code 操作を適切に中断できるようになります。

## Markdown フォーマットの問題

Claude Code は、コードフェンスに言語タグがない Markdown ファイルを生成することがあります。これは GitHub、エディター、およびドキュメントツールでの構文強調表示と読みやすさに影響します。

### コードブロックに言語タグがない

生成された Markdown で次のようなコードブロックに気付いた場合：

````markdown theme={null}
```
function example() {
  return "hello";
}
```
````

適切にタグ付けされたブロックの代わりに：

````markdown theme={null}
```javascript
function example() {
  return "hello";
}
```
````

**解決策：**

1. **Claude に言語タグを追加するよう依頼する**：「このマークダウンファイルのすべてのコードブロックに適切な言語タグを追加してください」とリクエストします。

2. **編集後の自動フォーマットフックを使用する**：言語タグがないコードブロックを検出して追加するための自動フォーマットフックを設定します。[編集後のコード自動フォーマット](/ja/hooks-guide#auto-format-code-after-edits)の例を参照してください。

3. **手動検証**：Markdown ファイルを生成した後、適切なコードブロックフォーマットを確認し、必要に応じて修正をリクエストします。

### 一貫性のないスペースとフォーマット

生成された Markdown に過度な空行または一貫性のないスペースがある場合：

**解決策：**

1. **フォーマット修正をリクエストする**：Claude に「このマークダウンファイルのスペースとフォーマットの問題を修正してください」とリクエストします。

2. **フォーマットツールを使用する**：`prettier` またはカスタムフォーマットスクリプトなどの Markdown フォーマッターを実行するフックを設定します。

3. **フォーマット設定を指定する**：プロンプトまたはプロジェクト[メモリ](/ja/memory)ファイルにフォーマット要件を含めます。

### Markdown フォーマットの問題を減らす

フォーマットの問題を最小化するには：

- **リクエストで明示的にする**：「言語タグ付きコードブロック付きの適切にフォーマットされた Markdown」を要求します
- **プロジェクト規約を使用する**：[`CLAUDE.md`](/ja/memory)で推奨される Markdown スタイルを文書化します
- **検証フックを設定する**：一般的なフォーマットの問題を自動的に検証および修正するための後処理フックを使用します

## さらにヘルプを得る

ここで説明されていない問題が発生している場合：

1. [エラーリファレンス](/ja/errors)で `API Error: 5xx`、`529 Overloaded`、`429`、およびセッション中に表示されるリクエスト検証エラーを参照してください
2. Claude Code 内で `/feedback` コマンドを使用して、Anthropic に問題を直接報告します
3. [GitHub リポジトリ](https://github.com/anthropics/claude-code)で既知の問題を確認します
4. `/doctor` を実行して問題を診断します。以下をチェックします：
   - インストールタイプ、バージョン、および検索機能
   - 自動更新ステータスと利用可能なバージョン
   - 無効な設定ファイル（不正な形式の JSON、不正な型）
   - MCP サーバー設定エラー（複数のスコープで同じサーバー名が異なるエンドポイントで定義されている場合を含む）
   - キーバインディング設定の問題
   - コンテキスト使用量の警告（大規模な CLAUDE.md ファイル、高い MCP トークン使用量、到達不可能なアクセス許可ルール）
   - プラグインとエージェントのロードエラー
5. Claude に直接その機能と機能について質問します - Claude はドキュメントへの組み込みアクセスを持っています
