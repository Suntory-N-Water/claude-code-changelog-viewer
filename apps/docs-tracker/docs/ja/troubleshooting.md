---
title: troubleshooting
source: https://code.claude.com/docs/ja/troubleshooting.md
---

# トラブルシューティング

> Claude Code の高い CPU またはメモリ使用量、ハング、auto-compact スラッシング、検索の問題を修正し、その他の問題に対応する適切なページを見つけます。

このページでは、Claude Code が実行中のパフォーマンス、安定性、検索の問題について説明します。その他の問題については、問題が発生している場所に一致するページから始めてください：

| 症状 | 移動先 |
| :- | :- |
| `command not found`、インストール失敗、PATH の問題、`EACCES`、TLS エラー | [インストールとログインのトラブルシューティング](/ja/troubleshoot-install) |
| 更新またはインストールダウンロードが `The connection dropped while downloading the update` または `aborted` で失敗する | [エラーリファレンス](/ja/errors#the-connection-dropped-while-downloading-the-update) |
| ログインループ、OAuth エラー、`403 Forbidden`、「organization disabled」、Amazon Bedrock、Google Cloud の Agent Platform、または Microsoft Foundry 認証情報 | [インストールとログインのトラブルシューティング](/ja/troubleshoot-install#login-and-authentication) |
| 設定が適用されない、hooks が実行されない、MCP サーバーがロードされない | [設定をデバッグする](/ja/debug-your-config) |
| `API Error: 5xx`、`529 Overloaded`、`429`、リクエスト検証エラー | [エラーリファレンス](/ja/errors) |
| `model not found` または `you may not have access to it` | [エラーリファレンス](/ja/errors#there%E2%80%99s-an-issue-with-the-selected-model) |
| VS Code 拡張機能が接続されていない、または Claude を検出していない | [VS Code 統合](/ja/vs-code#fix-common-issues) |
| JetBrains プラグインまたは IDE が検出されない | [JetBrains 統合](/ja/jetbrains#troubleshooting) |
| CPU またはメモリ使用量が多い、応答が遅い、ハング、検索がファイルを見つけられない | [パフォーマンスと安定性](#performance-and-stability)（下記） |

どれが当てはまるかわからない場合は、Claude Code 内で `/doctor` を実行して、インストール、設定、拡張機能、コンテキスト使用量の自動チェックを実行してください。確認後に適用できる修正を提案します。`claude` がまったく起動しない場合は、代わりにシェルから `claude doctor` を実行してください。MCP サーバーのステータスを確認するには `/mcp` を実行してください。

パフォーマンスと安定性

これらのセクションでは、リソース使用量、応答性、検索動作に関連する問題について説明します。

CPU またはメモリ使用量が多い

Claude Code はほとんどの開発環境で動作するように設計されていますが、大規模なコードベースを処理する場合、かなりのリソースを消費する可能性があります。パフォーマンスの問題が発生している場合：

1. `/compact` を定期的に使用してコンテキストサイズを削減します
2. 主要なタスク間で Claude Code を閉じて再起動します
3. 大規模なビルドディレクトリを `.gitignore` ファイルに追加することを検討してください
4. [`claude --safe-mode`](/ja/cli-reference#cli-flags) で再起動して、プラグイン、MCP サーバー、またはフックが原因かどうかを確認します。セッション中のすべてのカスタマイズが無効になります。使用量が低下した場合は、[設定をデバッグする](/ja/debug-your-config#test-against-a-clean-configuration)を参照して、どれが原因かを特定します

これらのステップ後もメモリ使用量が高いままの場合は、`/heapdump` を実行して JavaScript ヒープスナップショットとメモリ分析を `~/Desktop` に書き込みます。Linux でデスクトップフォルダがない場合、ファイルはホームディレクトリに書き込まれます。

分析は常駐セットサイズ、JS ヒープ、配列バッファ、および説明されていないネイティブメモリを表示し、成長が JavaScript オブジェクトにあるか、ネイティブコードにあるかを識別するのに役立ちます。Chrome DevTools のメモリ → ロードで `.heapsnapshot` ファイルを開いて、リテイナーを検査します。メモリの問題を報告するときに両方のファイルを [GitHub](https://github.com/anthropics/claude-code/issues) に添付します。

自動コンパクションがスラッシングエラーで停止する

`Autocompact is thrashing: the context refilled to the limit...` が表示される場合、自動コンパクションは成功しましたが、ファイルまたはツール出力がコンテキストウィンドウを数回連続で満杯に戻しました。Claude Code は進捗を遂行していないループで API 呼び出しを無駄にするのを避けるために再試行を停止します。

回復するには：

1. Claude に、ファイル全体ではなく、特定の行範囲または関数など、より小さなチャンクで大きなファイルを読むよう依頼します
2. `/compact` を実行して、大きな出力を削除するフォーカスを使用します（例：`/compact keep only the plan and the diff`）
3. 大規模ファイルの作業を [subagent](/ja/sub-agents) に移動して、別のコンテキストウィンドウで実行されるようにします
4. 以前の会話がもう必要ない場合は `/clear` を実行します

コマンドがハングまたはフリーズする

Claude Code が応答しないように見える場合：

1. Ctrl+C を押して現在の操作をキャンセルしてみます
2. 応答しない場合は、ターミナルを閉じて再起動する必要があります

再起動してもカンバセーションは失われません。同じディレクトリで `claude --resume` を実行してセッションを再開してください。

エディタの統合ターミナルでのテキストの文字化けまたは破損

VS Code、Cursor、または Devin Desktop の統合ターミナルで Claude Code を実行する場合、文字がボックス、スミア、または間違ったグリフとしてレンダリングされる場合、ターミナルの GPU レンダラーが原因である可能性があります。Claude Code 内で `/terminal-setup` を実行して、`terminal.integrated.gpuAcceleration` を `"off"` に設定するか、エディタの設定で手動で設定してウィンドウをリロードします。[ターミナル設定](/ja/terminal-config)で、`/terminal-setup` が書き込む他の設定を参照してください。

検索と発見の問題

Search ツール、`@file` メンション、カスタムエージェント、またはカスタムスキルがファイルを見つけられない場合、バンドルされた `ripgrep` バイナリがシステムで実行されない可能性があります。プラットフォームの `ripgrep` パッケージをインストールして、Claude Code にそれを使用するよう指示します：

```bash theme={null}
brew install ripgrep
```

```bash theme={null}
sudo apt install ripgrep
```

```bash theme={null}
apk add ripgrep
```

```bash theme={null}
pacman -S ripgrep
```

```powershell theme={null}
winget install BurntSushi.ripgrep.MSVC
```

その後、[environment](/ja/env-vars) で `USE_BUILTIN_RIPGREP=0` を設定します。

WSL での遅い、または不完全な検索結果

[WSL でファイルシステム間で作業する場合](https://learn.microsoft.com/en-us/windows/wsl/filesystems)のディスク読み取りパフォーマンスペナルティにより、WSL で Claude Code を使用する場合、Search ツール使用時に予想より少ないマッチが返される可能性があります。検索は機能しますが、ネイティブファイルシステムより少ない結果を返します。

`claude doctor` はこの場合、Search を OK として表示します。

**解決策：**

1. **より具体的な検索を送信する**：検索するファイル数を減らすために、ディレクトリまたはファイルタイプを指定します：「auth-service パッケージで JWT 検証ロジックを検索」または「JS ファイルで md5 ハッシュの使用を見つける」。

2. **プロジェクトを Linux ファイルシステムに移動する**：可能であれば、プロジェクトが Windows ファイルシステム（`/mnt/c/`）ではなく Linux ファイルシステム（`/home/`）に配置されていることを確認します。

3. **ネイティブ Windows を使用する**：WSL ではなく Windows でネイティブに Claude Code を実行することを検討して、ファイルシステムのパフォーマンスを向上させます。

さらにヘルプを得る

ここで説明されていない問題が発生している場合：

1. `/doctor` を実行してセットアップをチェックし、`/mcp` を実行して MCP サーバーのステータスを確認します
2. Claude Code 内で `/feedback` コマンドを使用して、Anthropic に問題を直接報告します
3. [GitHub リポジトリ](https://github.com/anthropics/claude-code)で既知の問題を確認します
4. Claude に直接その機能と機能について質問します。Claude はドキュメントへの組み込みアクセスを持っています。
