---
title: permissions
source: https://code.claude.com/docs/ja/permissions.md
---

# 権限を設定する

> きめ細かい権限ルール、モード、管理ポリシーを使用して、Claude Code がアクセスして実行できる内容を制御します。

Claude Code は、エージェントが実行できることと実行できないことを正確に指定できるようにするため、きめ細かい権限をサポートしています。権限設定はバージョン管理にチェックインでき、組織内のすべての開発者に配布できるほか、個々の開発者がカスタマイズできます。

権限システム

Claude Code は、パワーと安全性のバランスを取るために、段階的な権限システムを使用しています。

| ツールタイプ | 例 | 承認が必要 | 「はい、今後は聞かない」の動作 |
| :- | :- | :- | :- |
| 読み取り専用 | ファイル読み取り、Grep | いいえ、[作業ディレクトリと追加ディレクトリ](#working-directories)内 | N/A |
| Bash コマンド | シェル実行 | はい、[読み取り専用コマンド](#read-only-commands)の組み込みセットを除く | プロジェクトディレクトリとコマンドごとに永続的 |
| ファイル変更 | Edit/Write ファイル | はい | セッション終了まで |

Bash または PowerShell の権限プロンプトで、`Ctrl+E` を押すと、コマンドの説明が表示されます。説明には、コマンドが何をするのか、Claude がそれを実行する理由、何が問題になる可能性があるかが含まれ、**低リスク**、**中リスク**、または**高リスク**とラベル付けされています。Claude Code は、毎回のプロンプトではなく、`Ctrl+E` を押したときのみ、コマンドと Claude 自身の呼び出しの説明をモデルに送信して説明を生成します。説明を表示してもコマンドは実行されません。`Ctrl+E` をもう一度押すと説明が非表示になります。

ショートカットをオフにするには、`~/.claude.json` の [`permissionExplainerEnabled`](/ja/settings#global-config-settings) を `false` に設定します。

権限を管理する

`/permissions` を使用して、Claude Code のツール権限を表示および管理できます。この UI は、すべての権限ルールと、それらが取得される `settings.json` ファイルをリストします。

- **Allow** ルールは、Claude Code が手動承認なしで指定されたツールを使用できるようにします。
- **Ask** ルールは、Claude Code が指定されたツールを使用しようとするたびに確認を促します。
- **Deny** ルールは、Claude Code が指定されたツールを使用することを防止します。

ルールは順序で評価されます。deny、ask、allow の順です。その順序での最初のマッチがアウトカムを決定し、ルールの特異性は順序を変更しません。`Bash(aws *)` のような広い deny ルールは、`Bash(aws s3 ls)` のようなより狭い allow ルールにもマッチする呼び出しを含む、マッチするすべての呼び出しをブロックするため、deny ルールはアローリスト例外を含むことはできません。ask と allow の間にも同じ優先順位が適用されます。マッチする ask ルールは、同じ呼び出しにマッチするより具体的な allow ルールがある場合でも、プロンプトを表示します。

Deny ルールは、ツール名を指定するか、ツール内のパターンをスコープするかによって異なる動作をします。`Bash` のようなベアツール名は、ツールを Claude のコンテキストから完全に削除するため、Claude はそれを見ることはありません。`Bash(rm *)` のようなスコープ付きルールは、ツールを利用可能なままにし、Claude が試みたときにマッチする呼び出しをブロックします。

権限ルールは Claude Code によって実装されており、モデルによってではありません。プロンプトまたは `CLAUDE.md` の指示は、Claude が何をしようとするかを形作りますが、Claude Code が許可する内容は変わりません。アクセスを付与または取り消すには、`/permissions`、ここで説明されているルール、[permission mode](/ja/permission-modes)、または [PreToolUse hook](#extend-permissions-with-hooks) を使用してください。

権限モード

Claude Code は、ツール呼び出しの承認方法を制御するいくつかの権限モードをサポートしています。[権限モード](/ja/permission-modes)を参照して、各モードをいつ使用するかを確認してください。[設定ファイル](/ja/settings#settings-files)で `defaultMode` を設定します。

| モード | 説明 |
| :- | :- |
| `default` | 標準動作：各ツールの最初の使用時に権限を促します。CLI、VS Code と JetBrains 拡張機能、およびデスクトップアプリでは「Manual」とラベル付けされており、Claude Code は `manual` をエイリアスとして受け入れます。ラベルとエイリアスには Claude Code v2.1.200 以降が必要です。デスクトップアプリのラベルは CLI バージョンに依存しません |
| `acceptEdits` | ファイル編集と一般的なファイルシステムコマンド（`mkdir`、`touch`、`mv`、`cp` など）を、作業ディレクトリまたは `additionalDirectories` 内のパスに対して自動的に受け入れます |
| `plan` | Claude はファイルを読み取り、読み取り専用シェルコマンドを実行して探索しますが、ソースファイルを編集しません。CLI および VS Code 拡張機能では Plan とラベル付けされています |
| `auto` | バックグラウンド安全チェック付きでツール呼び出しを自動承認し、アクションがリクエストと一致することを確認します |
| `dontAsk` | `/permissions` または `permissions.allow` ルールで事前に承認されていない限り、ツールを自動的に拒否します。`AskUserQuestion`、[組織が `ask` に設定したコネクタツール](/ja/mcp#organization-controls-on-connector-tools)、および [`requiresUserInteraction`](/ja/mcp#require-approval-for-a-specific-tool) とマークされた MCP ツールは、許可していても拒否されます |
| `bypassPermissions` | 権限プロンプトをスキップします。ただし、明示的な `ask` ルール、[組織が `ask` に設定したコネクタツール](/ja/mcp#organization-controls-on-connector-tools)、および [`requiresUserInteraction`](/ja/mcp#require-approval-for-a-specific-tool) とマークされた MCP ツールで強制されたプロンプトは除きます。`rm -rf /` などのルートおよびホームディレクトリの削除も、回路遮断器として引き続きプロンプトを表示します |

`bypassPermissions` モードは権限プロンプトをスキップします。`.git`、`.config/git`、`.claude`、`.vscode`、`.idea`、`.husky`、`.cargo`、`.devcontainer`、`.yarn`、`.mvn` への書き込みを含みます。このモードは、Claude Code が損害を引き起こせないコンテナや VM などの隔離された環境でのみ使用してください。

このモードではいくつかのプロンプトが引き続き表示されます。明示的な `ask` ルール、[組織が `ask` に設定したコネクタツール](/ja/mcp#organization-controls-on-connector-tools)、および [`requiresUserInteraction`](/ja/mcp#require-approval-for-a-specific-tool) とマークされた MCP ツールは引き続きプロンプトを表示します。`rm -rf /` や `rm -rf ~` などのファイルシステムルートまたはホームディレクトリを対象とした削除も、モデルエラーに対する回路遮断器として引き続きプロンプトを表示します。これには、コマンドが `$(...)` またはバッククォートを使用したコマンド置換、または `<(...)` を使用したプロセス置換を含む場合も含まれます。v2.1.208 より前では、`rm -rf ~` として独自のコマンドとして入力された単純な形式のみがプロンプトを表示していました。置換を通じて削除に到達したコマンドはプロンプトを表示していませんでした。

`bypassPermissions` または `auto` モードが使用されるのを防ぐには、任意の[設定ファイル](/ja/settings#settings-files)で `permissions.disableBypassPermissionsMode` または `permissions.disableAutoMode` を `"disable"` に設定します。これらは、オーバーライドできない[管理設定](#managed-settings)で最も有用です。

権限ルール構文

権限ルールは、`Tool` または `Tool(specifier)` の形式に従います。

ツールのすべての使用をマッチさせる

ツールのすべての使用をマッチさせるには、括弧なしでツール名を使用します。

| ルール | 効果 |
| :- | :- |
| `Bash` | すべての Bash コマンドをマッチさせます |
| `WebFetch` | すべてのウェブフェッチリクエストをマッチさせます |
| `Read` | すべてのファイル読み取りをマッチさせます |

`Bash(*)` は `Bash` と同等で、すべての Bash コマンドをマッチさせます。拒否ルールとして、両方の形式は Claude のコンテキストからツールを削除します。

細かい制御のためにスペシファイアを使用する

括弧内にスペシファイアを追加して、特定のツール使用をマッチさせます。

| ルール | 効果 |
| :- | :- |
| `Bash(npm run build)` | 正確なコマンド `npm run build` をマッチさせます |
| `Read(./.env)` | 現在のディレクトリの `.env` ファイルを読み取ることをマッチさせます |
| `WebFetch(domain:example.com)` | example.com へのフェッチリクエストをマッチさせます |

入力パラメータでマッチさせる

拒否ルールと確認ルールは、`Tool(param:value)` を使用して任意のツール上のトップレベル入力パラメータをマッチさせることができます。ルールは Claude がそのパラメータをその正確な値に設定してツールを呼び出すときにマッチします。1 つのパラメータ値に対する許可ルールは、その呼び出しが全体的に安全であることを確立しないため、許可ルールは各ツール独自のスペシファイア構文を使用し続けます。これはツールが受け入れるスカラーパラメータで機能します。

| ルール | マッチ |
| :- | :- |
| `Agent(model:opus)` | Opus モデルティアをリクエストする Agent 呼び出し |
| `Agent(isolation:worktree)` | git worktree をリクエストする Agent 呼び出し |
| `Bash(run_in_background:true)` | バックグラウンドで実行される Bash 呼び出し |

パラメータマッチングは以下のルールに従います。

- パラメータ名は Agent ツール上の `model` など、ツールの入力の直接フィールドである必要があります。オブジェクトまたは配列内にネストされたフィールドはマッチ可能ではありません
- 各ルールは 1 つのパラメータに名前を付けます。`model` と `isolation` の両方でゲートするには、1 つのルールで組み合わせるのではなく、`Agent(model:opus)` と `Agent(isolation:worktree)` の 2 つのルールを記述します
- 値は `*` をワイルドカードとしてサポートし、任意の文字シーケンスにマッチするため、`Agent(isolation:*)` は任意の明示的な isolation 値にマッチします。`*` がない場合、マッチは正確です
- モデルが省略するパラメータは決してマッチしないため、`Agent(model:*)` は `model` が設定されていない呼び出しにはマッチしません
- 値は Claude が送信するリテラル入力と比較され、正規化の前です。`Agent(model:opus)` は別名 `opus` にマッチしますが、完全なモデル ID にはマッチしません。[`--verbose`](/ja/cli-reference) で実行して、各ツール呼び出しの正確なパラメータ名と値を確認してください
- コロンの周りのホワイトスペースは無視されます

ツールが独自の正規化ルールでマッチするフィールドはこの方法ではマッチ可能ではありません。Bash と PowerShell の `command`、Read、Edit、Write の `file_path`、Grep と Glob の `path`、NotebookEdit の `notebook_path`、WebFetch の `url` です。`Bash(command:rm *)` のようなルールはコンパウンドコマンドでバイパス可能であるため、Claude Code はそれを無視し、スタートアップ警告を発行します。代わりに `Bash(rm *)`、`Read(./path)`、または `WebFetch(domain:host)` を使用してください。

ワイルドカードパターン

Bash ルールは `*` を使用したグロブパターンをサポートしています。ワイルドカードはコマンド内の任意の位置に表示できます。この設定により、npm および git commit コマンドが許可され、git push がブロックされます。

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run *)",
      "Bash(git commit *)",
      "Bash(git * main)",
      "Bash(* --version)",
      "Bash(* --help *)"
    ],
    "deny": [
      "Bash(git push *)"
    ]
  }
}
```

`*` の前のスペースは重要です。`Bash(ls *)` は `ls -la` にマッチしますが `lsof` にはマッチしません。一方、`Bash(ls*)` は両方にマッチします。`:*` サフィックスは末尾のワイルドカードを記述する同等の方法であるため、`Bash(ls:*)` は `Bash(ls *)` と同じコマンドをマッチさせます。

権限ダイアログは、コマンドプレフィックスに対して「はい、今後は聞かない」を選択すると、スペース区切り形式を書き込みます。`:*` 形式はパターンの末尾でのみ認識されます。`Bash(git:* push)` のようなパターンでは、コロンはリテラル文字として扱われ、git コマンドにはマッチしません。

ツール名ワイルドカード

拒否ルールと確認ルールは、ツール名の位置でもグロブパターンを受け入れます。パターンはツール名全体にマッチする必要があります。`"*"` はすべてのツールにマッチし、`"mcp__*"` はすべてのサーバー全体のすべての MCP ツールにマッチします。ベアネーム glob 拒否ルールでマッチしたツールは Claude のコンテキストから削除されます。これはベアツール名と同じです。この設定はすべての MCP ツールを拒否します。

```json
{
  "permissions": {
    "deny": [
      "mcp__*"
    ]
  }
}
```

許可ルールは、リテラル `mcp__<server>__` プレフィックスの後でのみツール名 glob を受け入れます。サーバーセグメントは glob フリーである必要があるため、ルールは設定した特定のサーバーに名前を付けます。`mcp__puppeteer__*` は `puppeteer` サーバーからのすべてのツールにマッチし、`mcp__github__get_*` はその `get_` ツールにマッチします。`"*"`、`"B*"`、または `"mcp__*"` などのアンカーなし許可 glob は警告とともにスキップされ、自動承認されません。

ツール名がマッチしない既知のツールを持つ拒否ルールまたは確認ルールは、タイプミスをキャッチするためにスタートアップ警告を生成します。`_` または `*` を含むツール名はチェックから除外されます。

トランスクリプトと権限ダイアログに表示されるツールのラベルは、その正規名と異なる場合があります。たとえば、トランスクリプトで `Stop Task` というラベルが付いているツールの正規名は `TaskStop` です。権限ルールと [hook マッチャー](/ja/hooks) は正規名のみをマッチさせるため、`Stop Task` として記述されたルールはマッチしません。拒否ルールと確認ルールの場合、上記のスタートアップ警告がミスマッチをキャッチします。[ツール参照](/ja/tools-reference) に記載されている正規名を使用してください。

ツール固有の権限ルール

Bash

Bash 権限ルールは `*` を使用したワイルドカードマッチングをサポートしています。ワイルドカードは、開始、中央、終了を含むコマンド内の任意の位置に表示できます。

- `Bash(npm run build)` は正確な Bash コマンド `npm run build` をマッチさせます
- `Bash(npm run test *)` は `npm run test` で始まる Bash コマンドをマッチさせます
- `Bash(npm *)` は `npm ` で始まるコマンドをマッチさせます
- `Bash(* install)` は ` install` で終わるコマンドをマッチさせます
- `Bash(git * main)` は `git checkout main` や `git log --oneline main` などのコマンドをマッチさせます

単一の `*` は、スペースを含む任意の文字シーケンスをマッチさせるため、1 つのワイルドカードで複数の引数にまたがることができます。`Bash(git *)` は `git log --oneline --all` をマッチさせ、`Bash(git * main)` は `git push origin main` および `git merge main` をマッチさせます。

`*` が末尾にスペース付きで表示される場合（`Bash(ls *)` など）、単語境界を強制し、プレフィックスの後にスペースまたは文字列の終わりが続く必要があります。たとえば、`Bash(ls *)` は `ls -la` にマッチしますが `lsof` にはマッチしません。対照的に、スペースなしの `Bash(ls*)` は、単語境界制約がないため、`ls -la` と `lsof` の両方にマッチします。

複合コマンド

Claude Code はシェルオペレータを認識しているため、`Bash(safe-cmd *)` のようなルールは、`safe-cmd && other-cmd` コマンドを実行する権限を与えません。認識されるコマンド区切り文字は `&&`、`||`、`;`、`|`、`|&`、`&`、および改行です。ルールは各サブコマンドを独立して個別にマッチさせる必要があります。

「はい、今後は聞かない」で複合コマンドを承認すると、Claude Code は複合文字列全体の単一ルールではなく、承認が必要な各サブコマンドの個別ルールを保存します。たとえば、`git status && npm test` を承認すると、`npm test` のルールが保存されるため、将来の `npm test` 呼び出しは `&&` の前に何があるかに関係なく認識されます。`cd` をサブディレクトリに移動するようなサブコマンドは、そのパスの独自の Read ルールを生成します。単一の複合コマンドに対して最大 5 つのルールが保存される場合があります。

プロセスラッパー

Bash ルールをマッチさせる前に、Claude Code は固定されたプロセスラッパーセットをストリップするため、`Bash(npm test *)` のようなルールは `timeout 30 npm test` もマッチさせます。認識されるラッパーは `timeout`、`time`、`nice`、`nohup`、`stdbuf` です。

ベア `xargs` もストリップされるため、`Bash(grep *)` は `xargs grep pattern` をマッチさせます。ストリップは `xargs` にフラグがない場合にのみ適用されます。`xargs -n1 grep pattern` のような呼び出しは `xargs` コマンドとしてマッチされるため、内部コマンド用に記述されたルールはそれをカバーしません。

このラッパーリストは組み込まれており、設定不可能です。`direnv exec`、`devbox run`、`mise exec`、`npx`、`docker exec` などの開発環境ランナーはリストに含まれていません。これらのツールは引数をコマンドとして実行するため、`Bash(devbox run *)` のようなルールは `run` の後に続くものをマッチさせます。これには `devbox run rm -rf .` が含まれます。環境ランナー内での作業を承認するには、ランナーと内部コマンドの両方を含む特定のルールを記述します。例えば `Bash(devbox run npm test)`。許可する内部コマンドごとに 1 つのルールを追加します。

`watch`、`setsid`、`ionice`、`flock` などの Exec ラッパーは常にプロンプトを表示し、`Bash(watch *)` のようなプレフィックスルールで自動承認することはできません。同じことが `-exec` または `-delete` を使用する `find` にも適用されます。`Bash(find *)` ルールはこれらの形式をカバーしません。特定の呼び出しを承認するには、完全なコマンド文字列の正確一致ルールを記述します。

読み取り専用コマンド

Claude Code は、Bash コマンドの組み込みセットを読み取り専用として認識し、すべてのモードで権限プロンプトなしで実行します。これには `ls`、`cat`、`echo`、`pwd`、`head`、`tail`、`grep`、`find`、`wc`、`which`、`diff`、`stat`、`du`、`cd`、および `git` の読み取り専用形式が含まれます。セットは設定不可能です。これらのコマンドの 1 つにプロンプトを要求するには、それに対して `ask` または `deny` ルールを追加します。

すべてのフラグが読み取り専用であるコマンドに対しては、引用符なしのグロブパターンが許可されるため、`ls *.ts` および `wc -l src/*.py` はプロンプトなしで実行されます。`find`、`sort`、`sed`、`git` などの書き込み可能または実行可能なフラグを持つコマンドは、グロブが `-delete` のようなフラグに展開される可能性があるため、引用符なしのグロブが存在する場合でもプロンプトを表示します。

作業ディレクトリまたは[追加ディレクトリ](#working-directories)内のパスへの `cd` も読み取り専用です。`cd packages/api && ls` のような複合コマンドは、各部分が独立して適格である場合、プロンプトなしで実行されます。複合コマンドで `cd` と `git` を組み合わせると、`cd` が異なるディレクトリに変更される場合、プロンプトが表示されます。これは、新しいディレクトリで `git` を実行するとそのディレクトリのフックを実行できるためです。ターゲットが現在の作業ディレクトリに解決される `cd` は、操作なしであり、このプロンプトをトリガーしません。

複合コマンドで `cd` と出力リダイレクトを組み合わせると、Claude Code が `cd` 実行後にリダイレクトターゲットが解決するディレクトリを判定できない場合、プロンプトが表示されます。唯一のリダイレクトターゲットが `/dev/null` であるコマンド（`cd app; grep -r pattern . 2>/dev/null` など）は、`/dev/null` は作業ディレクトリに依存しないため、このプロンプトをトリガーしません。v2.1.207 より前では、`cd` を含む複合コマンドは `/dev/null` への唯一のターゲットを含むものを含む、任意の出力リダイレクトに対してプロンプトを表示していました。

コマンド引数を制約しようとする Bash 権限パターンは脆弱です。たとえば、`Bash(curl http://github.com/ *)` は curl を GitHub URL に制限することを意図していますが、次のようなバリエーションにはマッチしません。

- URL の前のオプション：`curl -X GET http://github.com/...`
- 異なるプロトコル：`curl https://github.com/...`
- リダイレクト：`curl -L http://bit.ly/xyz`（GitHub にリダイレクト）
- 変数：`URL=http://github.com && curl $URL`
- 余分なスペース：`curl  http://github.com`

より信頼性の高い URL フィルタリングについては、以下を検討してください。

- **Bash ネットワークツールを制限する**：deny ルールを使用して `curl`、`wget` などのコマンドをブロックし、許可されたドメインに対して `WebFetch(domain:github.com)` 権限で WebFetch ツールを使用します
- **PreToolUse フックを使用する**：Bash コマンドの URL を検証し、許可されていないドメインをブロックするフックを実装します
- **CLAUDE.md ガイダンスを追加する**：`CLAUDE.md` で許可された curl パターンについて説明します。これは Claude が試みることを形作りますが、境界を強制しないため、上記のオプションの 1 つと組み合わせてください

WebFetch のみを使用しても、ネットワークアクセスは防止されません。Bash が許可されている場合、Claude は `curl`、`wget` または他のツールを使用して任意の URL に到達できます。

PowerShell

PowerShell 権限ルールは Bash ルールと同じ形式を使用しています。`*` を使用したワイルドカードは任意の位置でマッチし、`:*` サフィックスは末尾の ` *` と同等であり、ベア `PowerShell` または `PowerShell(*)` はすべてのコマンドをマッチさせます。この設定により、`Get-ChildItem` および `git commit` コマンドが許可され、`Remove-Item` がブロックされます。

```json
{
  "permissions": {
    "allow": [
      "PowerShell(Get-ChildItem *)",
      "PowerShell(git commit *)"
    ],
    "deny": [
      "PowerShell(Remove-Item *)"
    ]
  }
}
```

一般的なエイリアスはマッチング前に正規化されます。コマンドレット名用に記述されたルールはそのエイリアスもマッチさせるため、`PowerShell(Get-ChildItem *)` は `gci`、`ls`、`dir` もマッチさせます。マッチングは大文字と小文字を区別しません。

Claude Code は PowerShell AST を解析し、複合コマンド内の各コマンドを独立してチェックします。パイプオペレータ `|`、ステートメント区切り文字 `;`、および PowerShell 7 以降のチェーンオペレータ `&&` と `||` は複合コマンドをサブコマンドに分割します。複合コマンドが許可されるには、ルールがすべてのサブコマンドをマッチさせる必要があります。

Read と Edit

`Edit` ルールは、ファイルを編集するすべての組み込みツールに適用されます。Claude は、Grep や Glob などのファイルを読み取るすべての組み込みツールに `Read` ルールを適用するためにベストエフォートを試みます。また、プロンプト内の `@file` メンションや、接続された [IDE](/ja/vs-code#the-built-in-ide-mcp-server) が Claude と共有する選択およびオープンファイルコンテキストにも適用します。

`Read` deny ルールは、同じパスの [Edit ツール](/ja/errors#file-is-covered-by-a-read-deny-rule)もブロックします。これには新しいファイルの作成も含まれます。Write と NotebookEdit はカバーされないため、ツールが変更できないパスに対して `Edit` deny ルールを追加してください。Claude Code v2.1.208 以降が必要です。

Read と Edit deny ルールは Claude の組み込みファイルツールと、Bash で Claude Code が認識するファイルコマンド（`cat`、`head`、`tail`、`sed` など）に適用されます。これらは、Python または Node スクリプトがファイルを自分で開くような、ファイルを間接的に読み書きする任意のサブプロセスには適用されません。パスへのすべてのプロセスのアクセスをブロックする OS レベルの強制については、[サンドボックスを有効にしてください](/ja/sandboxing)。

Read と Edit ルールの両方は、[gitignore](https://git-scm.com/docs/gitignore) 仕様に従い、4 つの異なるパターンタイプがあります。

| パターン | 意味 | 例 | マッチ |
| - | - | - | - |
| `//path` | ファイルシステムルートからの**絶対**パス | `Read(//Users/alice/secrets/**)` | `/Users/alice/secrets/**` |
| `~/path` | **ホーム**ディレクトリからのパス | `Read(~/Documents/*.pdf)` | `/Users/alice/Documents/*.pdf` |
| `/path` | 設定ソースからの相対パス | `Edit(/src/**/*.ts)` | `<project root>/src/**/*.ts` in project settings |
| `path` または `./path` | **現在のディレクトリからの相対**パス | `Read(*.env)` | `<cwd>/*.env` |

`/Users/alice/file` のようなパターンは絶対パスではありません。単一の先頭スラッシュは設定ソースにアンカーされており、ファイルシステムルートではありません。絶対パスには `//Users/alice/file` を使用してください。

`/path` パターンは、それを定義する設定ファイルに関連付けられたディレクトリにアンカーされるため、同じルールは配置場所に応じて異なる場所にマッチします。

| ルール定義場所 | `/path` の解決先 |
| :- | :- |
| `.claude/settings.json` などのプロジェクトまたはローカル設定 | `<project root>/path` |
| `~/.claude/settings.json` のユーザー設定 | `~/.claude/path` |
| `--settings <file>` で渡されたファイル | `<directory of file>/path` |
| CLI フラグ、`/permissions`、またはセッションルール | `<original cwd>/path` |

`Read(/secrets/**)` のような deny ルールをユーザー設定で記述すると、プロジェクト内の `secrets` ディレクトリではなく、`~/.claude/secrets/**` をブロックします。すべてのプロジェクト内に適用されるユーザー設定でルールを記述するには、`//` 絶対パスまたは `~/` ホーム相対パスを使用してください。

Windows では、パスはマッチング前に POSIX 形式に正規化されます。`C:\Users\alice` は `/c/Users/alice` になるため、`//c/**/.env` を使用してそのドライブ上の `.env` ファイルをマッチさせます。すべてのドライブ全体でマッチさせるには、`//**/.env` を使用します。

例：

- `Edit(/docs/**)`: `<project>/docs/` での編集（`/docs/` ではなく、`<project>/.claude/docs/` でもありません）
- `Read(~/.zshrc)`: ホームディレクトリの `.zshrc` を読み取ります
- `Edit(//tmp/scratch.txt)`: 絶対パス `/tmp/scratch.txt` を編集します
- `Read(src/**)`: `<current-directory>/src/` から読み取ります

ルールはそのアンカーの下のファイルのみをマッチさせるため、アンカーは deny ルールがどこまで到達するかを決定します。ベアファイル名は gitignore セマンティクスに従い、任意の深さでマッチするため、`Read(.env)` と `Read(**/.env)` は同等です。

| Deny ルール | ブロック | ブロックしない |
| - | - | - |
| `Read(.env)` または `Read(**/.env)` | 現在のディレクトリ以下の任意の `.env` | 親ディレクトリまたは別のプロジェクト内の `.env` |
| `Read(//**/.env)` | ファイルシステム上の任意の場所の `.env` | なし。ルールはファイルシステムルートにアンカーされています |

gitignore パターンでは、`*` は単一のディレクトリ内のファイルをマッチさせ、`**` はディレクトリ全体で再帰的にマッチさせます。すべてのファイルアクセスを許可するには、括弧なしでツール名を使用します。`Read`、`Edit`、または `Write`。

「はい、今後は聞かない」でファイルパスを承認すると、Claude Code は `[`、`]`、`*` などの gitignore パターン文字をそのパスでエスケープするため、生成されたルールは承認したリテラルパスのみをマッチさせます。自分で記述したルールはエスケープされません。v2.1.202 より前では、Claude Code はパスをエスケープなしで保存していたため、`[2024-06] Reports` という名前のディレクトリの生成されたルールは、独自のパスをマッチさせできなかったり、意図しない兄弟ディレクトリをマッチさせたりする可能性がありました。

Claude がシンボリックリンクにアクセスするとき、権限ルールは 2 つのパスをチェックします。シンボリックリンク自体と、それが解決するファイルです。Allow ルールと deny ルールはそのペアを異なる方法で扱います。allow ルールはプロンプトにフォールバックし、deny ルールは完全にブロックします。

- **Allow ルール**：シンボリックリンクパスとそのターゲットの両方がマッチする場合にのみ適用されます。許可されたディレクトリ内のシンボリックリンクがそれの外を指している場合でも、プロンプトが表示されます。
- **Deny ルール**：シンボリックリンクパスまたはそのターゲットのいずれかがマッチする場合に適用されます。拒否されたファイルを指すシンボリックリンク自体が拒否されます。

たとえば、`Read(./project/**)` が許可され、`Read(~/.ssh/**)` が拒否されている場合、`./project/key` にあるシンボリックリンクが `~/.ssh/id_rsa` を指している場合、ターゲットが allow ルールに失敗し、deny ルールにマッチするため、ブロックされます。

WebFetch

WebFetch ルールは `domain:` プレフィックスを使用し、リクエストされた URL のホスト名に対してマッチします。マッチングは大文字と小文字を区別せず、`*` ワイルドカードをサポートし、ルールとホスト名の両方から末尾の `.` をストリップするため、`example.com.` と `example.com` は同じものとして扱われます。

- `WebFetch(domain:example.com)` は `example.com` へのリクエストをマッチさせます
- `WebFetch(domain:*.example.com)` は `api.example.com` や `a.b.example.com` などの任意の深さのサブドメインをマッチさせますが、`example.com` 自体はマッチさせません
- `WebFetch(domain:*)` はすべてのドメインをマッチさせ、ベア `WebFetch` ルールと同等です

先頭の `*.` または全体パターンとしてのみ、`*` は `.` を越えてマッチします。それ以外の場所では、ワイルドカードは 2 つのドット間のテキストのみをマッチさせます。`WebFetch(domain:example.*)` は `example.org` にマッチします。ここで `*` は `org` になりますが、`example.evil.com` にはマッチしません。ここで `*` は `evil.com` になり、ドットを越えます。これにより、末尾のワイルドカードが攻撃者が登録できるドメインをマッチさせるのを防ぎます。

MCP

MCP ルールは、Claude Code で設定されたサーバー名を使用し、オプションでそのサーバーからのツールの名前が続きます。

- `mcp__puppeteer` は `puppeteer` サーバーによって提供されるツールをマッチさせます
- `mcp__puppeteer__*` ワイルドカード構文を使用し、`puppeteer` サーバーからのすべてのツールもマッチさせます
- `mcp__puppeteer__puppeteer_navigate` は `puppeteer` サーバーによって提供される `puppeteer_navigate` ツールをマッチさせます

組織が [claude.ai コネクタ](/ja/mcp#organization-controls-on-connector-tools)ツールを `ask` に設定している場合、そのツールの allow ルールは有効になりません。Claude Code は `auto` および `bypassPermissions` モードでも、すべての呼び出しでプロンプトを表示します。プロンプトを表示しない `dontAsk` モードでは、Claude Code は代わりに呼び出しを拒否します。コネクタツールは `mcp__claude_ai_<server>__<tool>` として表示されます。

Agent（subagents）

`Agent(AgentName)` ルールを使用して、Claude が使用できる [subagents](/ja/sub-agents) を制御します。

- `Agent(Explore)` は Explore subagent をマッチさせます
- `Agent(Plan)` は Plan subagent をマッチさせます
- `Agent(my-custom-agent)` は `my-custom-agent` という名前のカスタム subagent をマッチさせます

これらのルールを設定の `deny` 配列に追加するか、`--disallowedTools` CLI フラグを使用して特定のエージェントを無効にします。Explore エージェントを無効にするには：

```json
{
  "permissions": {
    "deny": ["Agent(Explore)"]
  }
}
```

Cd

`Cd` ルールは、[`/cd` コマンド](/ja/commands)がセッションを移動できるディレクトリを制御します。`Cd` はモデル呼び出し可能なツールではありません。Claude はそれを呼び出すことはできず、ルールは自分で `/cd` を実行する場合にのみ適用されます。

ベア `Cd` deny ルールは `/cd` を完全に無効にします。`Cd(<path-pattern>)` deny ルールはマッチするターゲットをブロックします。Deny ルールはターゲットのすべてのスペルをチェックします。これには、それが解決する各シンボリックリンクホップが含まれるため、1 つのパス用に記述されたルールは、それに解決するターゲットもブロックします。

任意の `Cd` allow ルールを追加すると、`/cd` をホワイトリストモードに切り替えます。解決されたターゲットディレクトリは、allow ルールの 1 つにマッチする必要があります。そうでない場合、`/cd` は拒否します。`Cd` ルールが設定されていない場合、`/cd` はデフォルト動作を保持し、見慣れないディレクトリを信頼するようにプロンプトを表示します。

パスパターンは [Read と Edit ルール](#read-and-edit)から `//`、`~/`、`/` アンカーを共有しますが、マッチングはディレクトリパス全体にアンカーされます。gitignore スタイルではなく、`*` は正確に 1 つのパスセグメントをマッチさせ、`**` はセグメント全体でマッチさせます。末尾の `/**` はその名前付きルートもマッチさせます。

| ルール | マッチ | マッチしない |
| - | - | - |
| `Cd(~/code/*)` | `~/code/app` | `~/code/app/src`、`~/code` |
| `Cd(~/code/**)` | `~/code` およびその下のディレクトリ | `~/code` の外のディレクトリ |
| `Cd(**/node_modules)` | 任意の深さの任意の `node_modules` ディレクトリ | `node_modules/pkg` |

フックで権限を拡張する

[Claude Code フック](/ja/hooks-guide)は、実行時に権限評価を実行するカスタムシェルコマンドを登録する方法を提供します。Claude Code がツール呼び出しを行うと、PreToolUse フックは権限プロンプトの前に実行されます。フック出力はツール呼び出しを拒否し、プロンプトを強制し、またはプロンプトをスキップしてコールを続行させることができます。

フック決定は権限ルールをバイパスしません。Claude Code は deny ルールと ask ルールを、フックが何を返すかに関係なく評価します。マッチする deny ルールはコールをブロックし、マッチする ask ルールはフックが `"allow"` または `"ask"` を返した場合でもプロンプトを表示します。これは、[権限を管理する](#manage-permissions)で説明されている deny 優先の優先順位を保持し、管理設定で設定された deny ルールを含みます。

コネクタツール（[組織が `ask` に設定](/ja/mcp#organization-controls-on-connector-tools)）と MCP ツール（[`requiresUserInteraction` でマーク](/ja/mcp#require-approval-for-a-specific-tool)）も、フックが `"allow"` を返した場合でもプロンプトを表示します。

ブロッキングフックは allow ルールよりも優先されます。終了コード 2 で終了するフックは、権限ルールが評価される前にツール呼び出しを停止するため、allow ルールがコールを許可する場合でもブロックが適用されます。プロンプトなしですべての Bash コマンドを実行し、ブロックしたい少数のコマンドを除外するには、allow リストに `"Bash"` を追加し、それらの特定のコマンドを拒否する PreToolUse フックを登録します。適応できるフックスクリプトについては、[保護されたファイルへの編集をブロックする](/ja/hooks-guide#block-edits-to-protected-files)を参照してください。

作業ディレクトリ

デフォルトでは、Claude は起動されたディレクトリ内のファイルにアクセスできます。このアクセスを拡張できます。

- **起動時**：`--add-dir <path>` CLI 引数を使用します
- **セッション中**：`/add-dir` コマンドを使用します
- **永続的な設定**：[設定ファイル](/ja/settings#settings-files)の `additionalDirectories` に追加します

追加ディレクトリ内のファイルは、元の作業ディレクトリと同じ権限ルールに従います。プロンプトなしで読み取り可能になり、ファイル編集権限は現在の権限モードに従います。

macOS のバックグラウンドセッションでは、セッションホストは `~/Desktop`、`~/Documents`、`~/Downloads` などの保護されたフォルダへのアクセスをターミナルとは別に要求します。Claude がそこでファイルを読み取りまたは書き込む必要がある場合、`Operation not permitted` で読み取りが失敗する場合は、[バックグラウンドセッションにフォルダアクセスを許可する方法](/ja/agent-view#background-sessions-cant-read-desktop-documents-or-downloads-on-macos)を参照してください。

セッションの主要な作業ディレクトリを別のディレクトリを追加する代わりに変更するには、[`/cd`](/ja/commands)を使用します。`/cd` コマンドには Claude Code v2.1.169 以降が必要です。`/add-dir` とは異なり、セッションを再配置します。新しいディレクトリの `CLAUDE.md` が読み込まれ、`--resume` はそこからセッションを検出します。

追加ディレクトリはファイルアクセスを許可し、設定ではありません

ディレクトリを追加すると、Claude がファイルを読み取りおよび編集できる場所が拡張されます。そのディレクトリを完全な設定ルートにはしません。ほとんどの `.claude/` 設定は追加ディレクトリから検出されませんが、いくつかのタイプは例外として読み込まれます。

これらの例外は、`--add-dir` フラグまたは `/add-dir` コマンドで追加されたディレクトリにのみ適用されます。設定ファイルの `permissions.additionalDirectories` にリストされているディレクトリは、ファイルアクセスのみを許可し、以下の設定は読み込みません。

次の設定タイプは `--add-dir` ディレクトリから読み込まれます。

| 設定 | `--add-dir` から読み込まれます |
| :- | :- |
| `.claude/skills/` の [Skills](/ja/skills) | はい、ライブリロード付き |
| `.claude/agents/` の [Subagents](/ja/sub-agents) | はい |
| `.claude/settings.json` および `.claude/settings.local.json` の [Settings](/ja/settings) | `enabledPlugins` および `extraKnownMarketplaces` キーのみ |
| [CLAUDE.md](/ja/memory) ファイル、`.claude/rules/`、および `CLAUDE.local.md` | `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1` が設定されている場合のみ。`CLAUDE.local.md` はさらに `local` 設定ソースが必要です。これはデフォルトで有効になっています |

コマンドおよび出力スタイルは、現在の作業ディレクトリとその親、`~/.claude/` のユーザーディレクトリ、および管理設定から検出されます。Hooks およびその他の `settings.json` キーは、現在の作業ディレクトリの `.claude/` フォルダから親ディレクトリへのフォールバックなしで読み込まれ、ユーザーの `~/.claude/settings.json` および管理設定と共に読み込まれます。その設定をプロジェクト全体で共有するには、次のいずれかのアプローチを使用します。

- **ユーザーレベルの設定**：`~/.claude/agents/`、`~/.claude/output-styles/`、または `~/.claude/settings.json` にファイルを配置して、すべてのプロジェクトで利用可能にします
- **プラグイン**：設定を [プラグイン](/ja/plugins)としてパッケージ化および配布し、チームがインストールできるようにします
- **設定ディレクトリから起動する**：使用する `.claude/` 設定を含むディレクトリから Claude Code を実行します

権限がサンドボックスとどのように相互作用するか

権限と[サンドボックス](/ja/sandboxing)は、補完的なセキュリティレイヤーです。

- **権限**は、Claude Code が使用できるツール、およびアクセスできるファイルまたはドメインを制御します。すべてのツール（Bash、Read、Edit、WebFetch、MCP など）に適用されます。
- **サンドボックス**は、Bash ツールのファイルシステムとネットワークアクセスを制限する OS レベルの強制を提供します。Bash コマンドとその子プロセスにのみ適用されます。

防御を深くするために両方を使用します。

- 権限 deny ルールは、Claude が制限されたリソースへのアクセスを試みることさえ防止します
- サンドボックス制限は、プロンプトインジェクションが Claude の意思決定をバイパスしても、Bash コマンドが定義された境界外のリソースに到達することを防止します
- サンドボックス内のファイルシステム制限は、[`sandbox.filesystem`](/ja/sandboxing) 設定と Read および Edit deny ルールを組み合わせます。両方が最終的なサンドボックス境界にマージされます
- ネットワーク制限は、WebFetch 権限ルールとサンドボックスの `allowedDomains` および `deniedDomains` リストを組み合わせます

サンドボックスが `autoAllowBashIfSandboxed: true` で有効になっている場合（デフォルト）、サンドボックス化された Bash コマンドは、権限に bare `Bash` ask ルール、または[同等の `Bash(*)` 形式](#match-all-uses-of-a-tool)が含まれている場合でもプロンプトなしで実行されます。サンドボックス境界は、そのツール全体のプロンプトの代わりになります。これらのチェックは引き続き適用されます。

- `Bash(git push *)` のようなコンテンツスコープ ask ルールは、引き続きプロンプトを強制します
- 明示的な deny ルールは引き続き適用されます
- `/`、ホームディレクトリ、またはその他の重要なシステムパスをターゲットとする `rm` または `rmdir` コマンドは、引き続きプロンプトをトリガーします

除外されたコマンドなど、サンドボックス化されて実行されないコマンドは、通常どおり bare `Bash` ask ルールを尊重します。[サンドボックスモード](/ja/sandboxing#sandbox-modes)を参照して、この動作を変更してください。

管理設定

Claude Code 設定の一元的な制御が必要な組織の場合、管理者はユーザーまたはプロジェクト設定でオーバーライドできない管理設定をデプロイできます。これらのポリシー設定は通常の設定ファイルと同じ形式に従い、MDM/OS レベルのポリシー、管理設定ファイル、[サーバー管理設定](/ja/server-managed-settings)、または自己ホスト型の[Claude apps gateway](/ja/claude-apps-gateway)を通じて配信できます。配信メカニズムとファイルの場所については、[設定ファイル](/ja/settings#settings-files)を参照してください。

管理のみの設定

以下の設定は管理設定からのみ読み込まれます。ユーザーまたはプロジェクト設定ファイルに配置しても効果がありません。

| 設定 | 説明 |
| :- | :- |
| `allowAllClaudeAiMcps` | `true` の場合、claude.ai コネクタはデプロイされた `managed-mcp.json` と並行して読み込まれ、その排他的な制御によって抑制されません。[管理 MCP 設定](/ja/managed-mcp)を参照してください |
| `allowedChannelPlugins` | メッセージをプッシュできるチャネルプラグインのホワイトリスト。設定されている場合、デフォルトの Anthropic ホワイトリストを置き換えます。`channelsEnabled: true` が必要です。[チャネルプラグインの実行を制限する](/ja/channels#restrict-which-channel-plugins-can-run)を参照してください |
| `allowManagedHooksOnly` | `true` の場合、管理フック、SDK フック、および管理設定 `enabledPlugins` で強制有効にされたプラグインからのフックのみが読み込まれます。ユーザー、プロジェクト、およびその他すべてのプラグインフックはブロックされます |
| `allowManagedMcpServersOnly` | `true` の場合、管理設定からの `allowedMcpServers` のみが尊重されます。`deniedMcpServers` はすべてのソースからマージされます。[管理 MCP 設定](/ja/managed-mcp)を参照してください |
| `allowManagedPermissionRulesOnly` | `true` の場合、ユーザーおよびプロジェクト設定が `allow`、`ask`、または `deny` 権限ルールを定義することを防止します。管理設定のルールのみが適用されます。MCP サーバーのホワイトリストには影響しません。その場合は、`allowManagedMcpServersOnly` を設定してください |
| `blockedMarketplaces` | マーケットプレイスソースのブロックリスト。ブロックされたソースはダウンロード前にチェックされるため、ファイルシステムに触れることはありません。[管理マーケットプレイス制限](/ja/plugin-marketplaces#managed-marketplace-restrictions)を参照してください |
| `channelsEnabled` | 組織の[チャネル](/ja/channels)を許可します。各プランのデフォルトについては、[エンタープライズコントロール](/ja/channels#enterprise-controls)を参照してください |
| `disableSideloadFlags` | `--plugin-dir`、`--plugin-url`、`--agents`、および `--mcp-config` CLI フラグをスタートアップで拒否します。これがない場合、ユーザーはこれらのフラグを渡すことで、単一の実行に対して `strictKnownMarketplaces` をバイパスできます。[`disableSideloadFlags`](/ja/settings#available-settings)を参照してください。Claude Code v2.1.193 以降が必要です |
| `forceRemoteSettingsRefresh` | `true` の場合、リモート管理設定が新しく取得されるまで CLI 起動をブロックし、取得に失敗した場合は終了します。[フェイルクローズ強制](/ja/server-managed-settings#enforce-fail-closed-startup)を参照してください |
| `pluginTrustMessage` | インストール前に表示されるプラグイン信頼警告に追加されるカスタムメッセージ |
| `sandbox.filesystem.allowManagedReadPathsOnly` | `true` の場合、管理設定からの `filesystem.allowRead` パスのみが尊重されます。`denyRead` はすべてのソースからマージされます |
| `sandbox.network.allowManagedDomainsOnly` | `true` の場合、管理設定からの `allowedDomains` と `WebFetch(domain:...)` allow ルールのみが尊重されます。許可されていないドメインはユーザーに促すことなく自動的にブロックされます。拒否されたドメインはすべてのソースからマージされます |
| `strictKnownMarketplaces` | ユーザーが追加およびインストールできるプラグインマーケットプレイスソースを制御します。[管理マーケットプレイス制限](/ja/plugin-marketplaces#managed-marketplace-restrictions)を参照してください |
| `strictPluginOnlyCustomization` | ユーザーおよびプロジェクトソースからのスキル、エージェント、フック、および MCP サーバーをブロックして、プラグインまたは管理設定からのみ取得できるようにします。`true` は 4 つすべてのサーフェスをロックします。`["skills", "hooks"]` などの配列は、指定されたものだけをロックします。[`strictPluginOnlyCustomization`](/ja/settings#strictpluginonlycustomization)を参照してください |
| `wslInheritsWindowsSettings` | Windows HKLM レジストリキーまたは `C:\Program Files\ClaudeCode\managed-settings.json` で `true` の場合、WSL は `/etc/claude-code` に加えて Windows ポリシーチェーンから管理設定を読み込みます。[設定ファイル](/ja/settings#settings-files)を参照してください |

`disableBypassPermissionsMode` は通常、組織ポリシーを強制するために管理設定に配置されますが、任意のスコープから機能します。ユーザーは独自の設定で設定して、自分自身をバイパスモードからロックアウトできます。

Team および Enterprise プランでは、Owner が [Claude Code 管理設定](https://claude.ai/admin-settings/claude-code)で[リモートコントロール](/ja/remote-control)と[ウェブセッション](/ja/claude-code-on-the-web)を組織全体で有効または無効にします。リモートコントロールは、[`disableRemoteControl`](/ja/settings#available-settings)設定でデバイスごとに無効にすることもできます。ウェブセッションにはデバイスごとの管理設定キーはありません。

設定の優先順位

権限ルールは、他のすべての Claude Code 設定と同じ[設定優先順位](/ja/settings#settings-precedence)に従います。

1. **管理設定**：コマンドライン引数を含む他のレベルでオーバーライドできません
2. **コマンドライン引数**：一時的なセッションオーバーライド
3. **ローカルプロジェクト設定**（`.claude/settings.local.json`）
4. **共有プロジェクト設定**（`.claude/settings.json`）
5. **ユーザー設定**（`~/.claude/settings.json`）

ツールがいずれかのレベルで拒否されている場合、他のレベルはそれを許可できません。たとえば、管理設定の deny は `--allowedTools` でオーバーライドできず、`--disallowedTools` は管理設定が定義する内容を超えて制限を追加できます。

設定スコープ全体でも同じことが当てはまります。ユーザー設定で権限が許可されており、プロジェクト設定で拒否されている場合、拒否ルールがそれをブロックします。逆も同様です。ユーザーレベルの deny がプロジェクトレベルの allow をブロックします。これは、任意のスコープからの deny ルールが allow ルールの前に評価されるためです。

埋め込みホストは、[`parentSettingsBehavior`](/ja/settings#settings-precedence)が `"merge"` に設定されている場合、SDK の `managedSettings` オプションを介して追加の管理ポリシーを提供できます。埋め込み元の値はポリシーを厳しくできますが、緩和することはできません。

プロジェクトの許可ルールとワークスペーストラスト

プロジェクトの `.claude/settings.json` 内の `permissions.allow` ルールと `permissions.additionalDirectories` エントリは機能を付与するため、Claude Code はそのワークスペースの[ワークスペーストラストダイアログ](/ja/security#additional-safeguards)を受け入れた後にのみ適用します。それまでの間、Claude Code はルールを読み込みますが適用しません。トラストダイアログには、フォルダが付与する許可ルールと追加ディレクトリが表示されるため、受け入れる前に確認できます。`deny` ルールと `ask` ルールは制限のみを行うため、影響を受けません。

Claude Code はワークスペーストを git リポジトリルートをキーとして保存するか、リポジトリ外の場合は Claude Code を起動したディレクトリをキーとして保存します。ホームディレクトリから起動した場合、トラストは現在のセッションのみ保持され、ディスクに書き込まれません。[追加のセーフガード](/ja/security#additional-safeguards)に関する注記を参照してください。親ディレクトリを信頼しても、ネストされたプロジェクトの許可ルールは適用されません。

`.claude/settings.local.json` はあなた自身のファイルであるため、ワークスペーストラストチェックは通常適用されません。リポジトリが git にコミットされている場合や `.claude` がシンボリックリンクである場合など、リポジトリがファイルを提供できる場合、その許可ルールと追加ディレクトリはプロジェクト設定と同様にトラストチェックを通ります。

Claude Code は git を実行してリポジトリがファイルを提供したかどうかを確認し、その確認は受け入れたトラストダイアログでカバーされているフォルダ、またはそのいずれかの親ディレクトリでのみ実行されます。まだ信頼していないフォルダでの対話的セッションでは、`.claude/settings.local.json` の許可ルールと追加ディレクトリはプロジェクト設定と同様にトラストチェックを通ります。ただし、以下で説明されているように、セッションが独自の設定ホームで実行される場合を除き、ダイアログを受け入れるまでです。以下の 2 つの例外のうち、設定ホーム例外のみがダイアログの前に適用されます。これは git を実行する必要がないためです。ディレクトリが git リポジトリ内にないことを判定するには、同じ git チェックを使用するため、フォルダをカバーするトラストダイアログが受け入れられると、リポジトリ内にない例外が有効になります。v2.1.207 より前では、追跡されていない `.claude/settings.local.json` はダイアログを受け入れる前にそのフォルダで許可ルールを適用していました。

`.claude/settings.local.json` の許可ルールと追加ディレクトリは、2 つのケースではワークスペーストラストなしで適用されます。

- Claude Code を起動したディレクトリが git リポジトリ内にない。
- セッションがあなた自身の設定ホームで実行される。つまり、ホームディレクトリ、または `.claude` サブディレクトリを [`CLAUDE_CONFIG_DIR`](/ja/env-vars) として設定したディレクトリ。

どちらの場合も、ファイルはリポジトリが提供できるものではなく、あなたが作成したものです。リポジトリにコミットされた `.claude/settings.local.json` は依然としてワークスペーストラストが必要です。バージョン 2.1.196 から 2.1.199 では、これらのワークスペースでファイルをリポジトリ提供と見なし、その許可ルールを無視し、stderr に [`this workspace has not been trusted`](/ja/errors#workspace-has-not-been-trusted) 警告を出力していました。上記の 2 つの例外は v2.1.195 以前と一致し、v2.1.200 で復元されました。

また v2.1.200 以降、許可ルールまたは追加ディレクトリがまだ適用されていないワークスペースで、親ディレクトリが既に信頼されていたためトラストダイアログが表示されなかった場合、次に Claude Code をそこで対話的に起動したときにダイアログが表示されます。ダイアログは 2 つの選択肢を提供します。

- **Yes, I trust this folder**: そのワークスペースのトラストを保存し、同じセッション内でルールを適用します。
- **No, continue without these permissions**: これらのルールを無視して作業を続けます。ダイアログは次のセッションで再度表示されます。

[非対話モード](/ja/headless)で `-p` を使用する場合、ダイアログは表示されず、ルールは無視されたままになります。

設定例

この[リポジトリ](https://github.com/anthropics/claude-code/tree/main/examples/settings)には、一般的なデプロイメントシナリオのスターター設定が含まれています。これらを出発点として使用し、ニーズに合わせて調整してください。

関連項目

- [設定](/ja/settings)：権限設定テーブルを含む完全な設定リファレンス
- [auto モードを設定する](/ja/auto-mode-config)：auto モード分類器が組織が信頼するインフラストラクチャを伝えます
- [サンドボックス](/ja/sandboxing)：Bash コマンドの OS レベルのファイルシステムとネットワーク分離
- [認証](/ja/authentication)：Claude Code へのユーザーアクセスを設定します
- [セキュリティ](/ja/security)：セキュリティ保護とベストプラクティス
- [フック](/ja/hooks-guide)：ワークフローを自動化し、権限評価を拡張します
