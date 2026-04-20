---
title: permissions
source: https://code.claude.com/docs/ja/permissions.md
---

# 権限を設定する

> きめ細かい権限ルール、モード、管理ポリシーを使用して、Claude Code がアクセスして実行できる内容を制御します。

Claude Code は、エージェントが実行できることと実行できないことを正確に指定できるようにするため、きめ細かい権限をサポートしています。権限設定はバージョン管理にチェックインでき、組織内のすべての開発者に配布できるほか、個々の開発者がカスタマイズできます。

## 権限システム

Claude Code は、パワーと安全性のバランスを取るために、段階的な権限システムを使用しています。

| ツールタイプ | 例 | 承認が必要 | 「はい、今後は聞かない」の動作 |
| :- | :- | :- | :- |
| 読み取り専用 | ファイル読み取り、Grep | いいえ | N/A |
| Bash コマンド | シェル実行 | はい | プロジェクトディレクトリとコマンドごとに永続的 |
| ファイル変更 | Edit/Write ファイル | はい | セッション終了まで |

## 権限を管理する

`/permissions` を使用して、Claude Code のツール権限を表示および管理できます。この UI は、すべての権限ルールと、それらが取得される settings.json ファイルをリストします。

- **Allow** ルールは、Claude Code が手動承認なしで指定されたツールを使用できるようにします。
- **Ask** ルールは、Claude Code が指定されたツールを使用しようとするたびに確認を促します。
- **Deny** ルールは、Claude Code が指定されたツールを使用することを防止します。

ルールは順序で評価されます。**deny -> ask -> allow**。最初にマッチしたルールが優先されるため、deny ルールは常に優先されます。

## 権限モード

Claude Code は、ツールの承認方法を制御するいくつかの権限モードをサポートしています。[権限モード](/ja/permission-modes)を参照して、各モードをいつ使用するかを確認してください。[設定ファイル](/ja/settings#settings-files)で `defaultMode` を設定します。

| モード | 説明 |
| :- | :- |
| `default` | 標準動作。各ツールの最初の使用時に権限を促します |
| `acceptEdits` | ファイル編集と一般的なファイルシステムコマンド（`mkdir`、`touch`、`mv`、`cp` など）を、作業ディレクトリまたは `additionalDirectories` 内のパスに対して自動的に受け入れます |
| `plan` | Plan Mode。Claude はファイルを分析できますが、ファイルを変更したりコマンドを実行したりすることはできません |
| `auto` | バックグラウンド安全チェック付きでツール呼び出しを自動承認し、アクションがリクエストと一致することを確認します。現在は研究プレビューです |
| `dontAsk` | `/permissions` または `permissions.allow` ルールで事前に承認されていない限り、ツールを自動的に拒否します |
| `bypassPermissions` | 保護されたディレクトリへの書き込みを除くすべての権限プロンプトをスキップします（以下の警告を参照してください） |

`bypassPermissions` モードは権限プロンプトをスキップします。`.git`、`.claude`、`.vscode`、`.idea`、`.husky` ディレクトリへの書き込みは、リポジトリ状態、エディタ設定、git フックの偶発的な破損を防ぐために、確認を促すままです。`.claude/commands`、`.claude/agents`、`.claude/skills` への書き込みは除外され、プロンプトを表示しません。Claude はスキル、サブエージェント、コマンドを作成するときにそこに定期的に書き込むためです。このモードは、Claude Code が損害を引き起こせないコンテナや VM などの隔離された環境でのみ使用してください。管理者は、[管理設定](#managed-settings)で `permissions.disableBypassPermissionsMode` を `"disable"` に設定することで、このモードを防止できます。

`bypassPermissions` または `auto` モードが使用されるのを防ぐには、任意の[設定ファイル](/ja/settings#settings-files)で `permissions.disableBypassPermissionsMode` または `permissions.disableAutoMode` を `"disable"` に設定します。これらは、オーバーライドできない[管理設定](#managed-settings)で最も有用です。

## 権限ルール構文

権限ルールは、`Tool` または `Tool(specifier)` の形式に従います。

### ツールのすべての使用をマッチさせる

ツールのすべての使用をマッチさせるには、括弧なしでツール名を使用します。

| ルール | 効果 |
| :- | :- |
| `Bash` | すべての Bash コマンドをマッチさせます |
| `WebFetch` | すべてのウェブフェッチリクエストをマッチさせます |
| `Read` | すべてのファイル読み取りをマッチさせます |

`Bash(*)` は `Bash` と同等で、すべての Bash コマンドをマッチさせます。

### 細かい制御のためにスペシファイアを使用する

括弧内にスペシファイアを追加して、特定のツール使用をマッチさせます。

| ルール | 効果 |
| :- | :- |
| `Bash(npm run build)` | 正確なコマンド `npm run build` をマッチさせます |
| `Read(./.env)` | 現在のディレクトリの `.env` ファイルを読み取ることをマッチさせます |
| `WebFetch(domain:example.com)` | example.com へのフェッチリクエストをマッチさせます |

### ワイルドカードパターン

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

## ツール固有の権限ルール

### Bash

Bash 権限ルールは `*` を使用したワイルドカードマッチングをサポートしています。ワイルドカードは、開始、中央、終了を含むコマンド内の任意の位置に表示できます。

- `Bash(npm run build)` は正確な Bash コマンド `npm run build` をマッチさせます
- `Bash(npm run test *)` は `npm run test` で始まる Bash コマンドをマッチさせます
- `Bash(npm *)` は `npm ` で始まるコマンドをマッチさせます
- `Bash(* install)` は ` install` で終わるコマンドをマッチさせます
- `Bash(git * main)` は `git checkout main` や `git log --oneline main` などのコマンドをマッチさせます

単一の `*` は、スペースを含む任意の文字シーケンスをマッチさせるため、1 つのワイルドカードで複数の引数にまたがることができます。`Bash(git *)` は `git log --oneline --all` をマッチさせ、`Bash(git * main)` は `git push origin main` および `git merge main` をマッチさせます。

`*` が末尾にスペース付きで表示される場合（`Bash(ls *)` など）、単語境界を強制し、プレフィックスの後にスペースまたは文字列の終わりが続く必要があります。たとえば、`Bash(ls *)` は `ls -la` にマッチしますが `lsof` にはマッチしません。対照的に、スペースなしの `Bash(ls*)` は、単語境界制約がないため、`ls -la` と `lsof` の両方にマッチします。

#### 複合コマンド

Claude Code はシェルオペレータを認識しているため、`Bash(safe-cmd *)` のようなルールは、`safe-cmd && other-cmd` コマンドを実行する権限を与えません。認識されるコマンド区切り文字は `&&`、`||`、`;`、`|`、`|&`、`&`、および改行です。ルールは各サブコマンドを独立して個別にマッチさせる必要があります。

「はい、今後は聞かない」で複合コマンドを承認すると、Claude Code は複合文字列全体の単一ルールではなく、承認が必要な各サブコマンドの個別ルールを保存します。たとえば、`git status && npm test` を承認すると、`npm test` のルールが保存されるため、将来の `npm test` 呼び出しは `&&` の前に何があるかに関係なく認識されます。`cd` をサブディレクトリに移動するようなサブコマンドは、そのパスの独自の Read ルールを生成します。単一の複合コマンドに対して最大 5 つのルールが保存される場合があります。

#### プロセスラッパー

Bash ルールをマッチさせる前に、Claude Code は固定されたプロセスラッパーセットをストリップするため、`Bash(npm test *)` のようなルールは `timeout 30 npm test` もマッチさせます。認識されるラッパーは `timeout`、`time`、`nice`、`nohup`、`stdbuf` です。

ベア `xargs` もストリップされるため、`Bash(grep *)` は `xargs grep pattern` をマッチさせます。ストリップは `xargs` にフラグがない場合にのみ適用されます。`xargs -n1 grep pattern` のような呼び出しは `xargs` コマンドとしてマッチされるため、内部コマンド用に記述されたルールはそれをカバーしません。

このラッパーリストは組み込まれており、設定不可能です。`direnv exec`、`devbox run`、`mise exec`、`npx`、`docker exec` などの開発環境ランナーはリストに含まれていません。これらのツールは引数をコマンドとして実行するため、`Bash(devbox run *)` のようなルールは `run` の後に続くものをマッチさせます。これには `devbox run rm -rf .` が含まれます。環境ランナー内での作業を承認するには、ランナーと内部コマンドの両方を含む特定のルールを記述します。例えば `Bash(devbox run npm test)`。許可する内部コマンドごとに 1 つのルールを追加します。

`watch`、`setsid`、`ionice`、`flock` などの Exec ラッパーは常にプロンプトを表示し、`Bash(watch *)` のようなプレフィックスルールで自動承認することはできません。同じことが `-exec` または `-delete` を使用する `find` にも適用されます。`Bash(find *)` ルールはこれらの形式をカバーしません。特定の呼び出しを承認するには、完全なコマンド文字列の正確一致ルールを記述します。

#### 読み取り専用コマンド

Claude Code は、Bash コマンドの組み込みセットを読み取り専用として認識し、すべてのモードで権限プロンプトなしで実行します。これには `ls`、`cat`、`head`、`tail`、`grep`、`find`、`wc`、`diff`、`stat`、`du`、`cd`、および `git` の読み取り専用形式が含まれます。セットは設定不可能です。これらのコマンドの 1 つにプロンプトを要求するには、それに対して `ask` または `deny` ルールを追加します。

すべてのフラグが読み取り専用であるコマンドに対しては、引用符なしのグロブパターンが許可されるため、`ls *.ts` および `wc -l src/*.py` はプロンプトなしで実行されます。`find`、`sort`、`sed`、`git` などの書き込み可能または実行可能なフラグを持つコマンドは、グロブが `-delete` のようなフラグに展開される可能性があるため、引用符なしのグロブが存在する場合でもプロンプトを表示します。

作業ディレクトリまたは[追加ディレクトリ](#working-directories)内のパスへの `cd` も読み取り専用です。`cd packages/api && ls` のような複合コマンドは、各部分が独立して適格である場合、プロンプトなしで実行されます。複合コマンドで `cd` と `git` を組み合わせると、ターゲットディレクトリに関係なく常にプロンプトが表示されます。

コマンド引数を制約しようとする Bash 権限パターンは脆弱です。たとえば、`Bash(curl http://github.com/ *)` は curl を GitHub URL に制限することを意図していますが、次のようなバリエーションにはマッチしません。

- URL の前のオプション。`curl -X GET http://github.com/...`
- 異なるプロトコル。`curl https://github.com/...`
- リダイレクト。`curl -L http://bit.ly/xyz`（github にリダイレクト）
- 変数。`URL=http://github.com && curl $URL`
- 余分なスペース。`curl  http://github.com`

より信頼性の高い URL フィルタリングについては、以下を検討してください。

- **Bash ネットワークツールを制限する**。deny ルールを使用して `curl`、`wget` などのコマンドをブロックし、許可されたドメインに対して `WebFetch(domain:github.com)` 権限で WebFetch ツールを使用します
- **PreToolUse フックを使用する**。Bash コマンドの URL を検証し、許可されていないドメインをブロックするフックを実装します
- CLAUDE.md を通じて Claude Code に許可された curl パターンについて指示します

WebFetch のみを使用しても、ネットワークアクセスは防止されません。Bash が許可されている場合、Claude は `curl`、`wget` または他のツールを使用して任意の URL に到達できます。

### Read と Edit

`Edit` ルールは、ファイルを編集するすべての組み込みツールに適用されます。Claude は、Grep や Glob などのファイルを読み取るすべての組み込みツールに `Read` ルールを適用するためにベストエフォートを試みます。

Read と Edit deny ルールは Claude の組み込みファイルツールに適用され、Bash サブプロセスには適用されません。`Read(./.env)` deny ルールは Read ツールをブロックしますが、Bash での `cat .env` は防止しません。パスへのすべてのプロセスのアクセスをブロックする OS レベルの強制については、[サンドボックスを有効にしてください](/ja/sandboxing)。

Read と Edit ルールの両方は、[gitignore](https://git-scm.com/docs/gitignore) 仕様に従い、4 つの異なるパターンタイプがあります。

| パターン | 意味 | 例 | マッチ |
| - | - | - | - |
| `//path` | ファイルシステムルートからの**絶対**パス | `Read(//Users/alice/secrets/**)` | `/Users/alice/secrets/**` |
| `~/path` | **ホーム**ディレクトリからのパス | `Read(~/Documents/*.pdf)` | `/Users/alice/Documents/*.pdf` |
| `/path` | **プロジェクトルートからの相対**パス | `Edit(/src/**/*.ts)` | `<project root>/src/**/*.ts` |
| `path` または `./path` | **現在のディレクトリからの相対**パス | `Read(*.env)` | `<cwd>/*.env` |

`/Users/alice/file` のようなパターンは絶対パスではありません。プロジェクトルートからの相対パスです。絶対パスには `//Users/alice/file` を使用してください。

Windows では、パスはマッチング前に POSIX 形式に正規化されます。`C:\Users\alice` は `/c/Users/alice` になるため、`//c/**/.env` を使用してそのドライブ上の `.env` ファイルをマッチさせます。すべてのドライブ全体でマッチさせるには、`//**/.env` を使用します。

例。

- `Edit(/docs/**)`: `<project>/docs/` での編集（`/docs/` ではなく、`<project>/.claude/docs/` でもありません）
- `Read(~/.zshrc)`: ホームディレクトリの `.zshrc` を読み取ります
- `Edit(//tmp/scratch.txt)`: 絶対パス `/tmp/scratch.txt` を編集します
- `Read(src/**)`: `<current-directory>/src/` から読み取ります

gitignore パターンでは、`*` は単一のディレクトリ内のファイルをマッチさせ、`**` はディレクトリ全体で再帰的にマッチさせます。すべてのファイルアクセスを許可するには、括弧なしでツール名を使用します。`Read`、`Edit`、または `Write`。

Claude がシンボリックリンクにアクセスするとき、権限ルールは 2 つのパスをチェックします。シンボリックリンク自体と、それが解決するファイルです。Allow ルールと deny ルールはそのペアを異なる方法で扱います。allow ルールはプロンプトにフォールバックし、deny ルールは完全にブロックします。

- **Allow ルール**。シンボリックリンクパスとそのターゲットの両方がマッチする場合にのみ適用されます。許可されたディレクトリ内のシンボリックリンクがそれの外を指している場合でも、プロンプトが表示されます。
- **Deny ルール**。シンボリックリンクパスまたはそのターゲットのいずれかがマッチする場合に適用されます。拒否されたファイルを指すシンボリックリンク自体が拒否されます。

たとえば、`Read(./project/**)` が許可され、`Read(~/.ssh/**)` が拒否されている場合、`./project/key` にあるシンボリックリンクが `~/.ssh/id_rsa` を指している場合、ターゲットが allow ルールに失敗し、deny ルールにマッチするため、ブロックされます。

### WebFetch

- `WebFetch(domain:example.com)` は example.com へのフェッチリクエストをマッチさせます

### MCP

- `mcp__puppeteer` は `puppeteer` サーバーによって提供されるツール（Claude Code で設定された名前）をマッチさせます
- `mcp__puppeteer__*` ワイルドカード構文は、`puppeteer` サーバーからのすべてのツールもマッチさせます
- `mcp__puppeteer__puppeteer_navigate` は `puppeteer` サーバーによって提供される `puppeteer_navigate` ツールをマッチさせます

### Agent（subagents）

`Agent(AgentName)` ルールを使用して、Claude が使用できる [subagents](/ja/sub-agents) を制御します。

- `Agent(Explore)` は Explore subagent をマッチさせます
- `Agent(Plan)` は Plan subagent をマッチさせます
- `Agent(my-custom-agent)` は `my-custom-agent` という名前のカスタム subagent をマッチさせます

これらのルールを設定の `deny` 配列に追加するか、`--disallowedTools` CLI フラグを使用して特定のエージェントを無効にします。Explore エージェントを無効にするには。

```json
{
  "permissions": {
    "deny": ["Agent(Explore)"]
  }
}
```

## フックで権限を拡張する

[Claude Code フック](/ja/hooks-guide)は、実行時に権限評価を実行するカスタムシェルコマンドを登録する方法を提供します。Claude Code がツール呼び出しを行うと、PreToolUse フックは権限プロンプトの前に実行されます。フック出力はツール呼び出しを拒否し、プロンプトを強制し、またはプロンプトをスキップしてコールを続行させることができます。

フック決定は権限ルールをバイパスしません。deny ルールと ask ルールは、フックが何を返すかに関係なく評価されるため、マッチする deny ルールはコールをブロックし、マッチする ask ルールはフックが `"allow"` または `"ask"` を返した場合でもプロンプトを表示します。これは、[権限を管理する](#manage-permissions)で説明されている deny 優先の優先順位を保持し、管理設定で設定された deny ルールを含みます。

ブロッキングフックは allow ルールよりも優先されます。終了コード 2 で終了するフックは、権限ルールが評価される前にツール呼び出しを停止するため、allow ルールがコールを許可する場合でもブロックが適用されます。プロンプトなしですべての Bash コマンドを実行し、ブロックしたい少数のコマンドを除外するには、allow リストに `"Bash"` を追加し、それらの特定のコマンドを拒否する PreToolUse フックを登録します。適応できるフックスクリプトについては、[保護されたファイルへの編集をブロックする](/ja/hooks-guide#block-edits-to-protected-files)を参照してください。

## 作業ディレクトリ

デフォルトでは、Claude は起動されたディレクトリ内のファイルにアクセスできます。このアクセスを拡張できます。

- **起動時**。`--add-dir <path>` CLI 引数を使用します
- **セッション中**。`/add-dir` コマンドを使用します
- **永続的な設定**。[設定ファイル](/ja/settings#settings-files)の `additionalDirectories` に追加します

追加ディレクトリ内のファイルは、元の作業ディレクトリと同じ権限ルールに従います。プロンプトなしで読み取り可能になり、ファイル編集権限は現在の権限モードに従います。

### 追加ディレクトリはファイルアクセスを許可し、設定ではありません

ディレクトリを追加すると、Claude がファイルを読み取りおよび編集できる場所が拡張されます。そのディレクトリを完全な設定ルートにはしません。ほとんどの `.claude/` 設定は追加ディレクトリから検出されませんが、いくつかのタイプは例外として読み込まれます。

次の設定タイプは `--add-dir` ディレクトリから読み込まれます。

| 設定 | `--add-dir` から読み込まれます |
| :- | :- |
| `.claude/skills/` の [Skills](/ja/skills) | はい、ライブリロード付き |
| `.claude/settings.json` のプラグイン設定 | `enabledPlugins` と `extraKnownMarketplaces` のみ |
| [CLAUDE.md](/ja/memory) ファイル、`.claude/rules/`、および `CLAUDE.local.md` | `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1` が設定されている場合のみ。`CLAUDE.local.md` はさらに `local` 設定ソースが必要です。これはデフォルトで有効になっています |

その他すべて（subagents、コマンド、出力スタイル、フック、その他の設定を含む）は、現在の作業ディレクトリとその親、`~/.claude/` のユーザーディレクトリ、および管理設定からのみ検出されます。その設定をプロジェクト全体で共有するには、次のいずれかのアプローチを使用します。

- **ユーザーレベルの設定**。`~/.claude/agents/`、`~/.claude/output-styles/`、または `~/.claude/settings.json` にファイルを配置して、すべてのプロジェクトで利用可能にします
- **プラグイン**。設定を [プラグイン](/ja/plugins)としてパッケージ化および配布し、チームがインストールできるようにします
- **設定ディレクトリから起動する**。使用する `.claude/` 設定を含むディレクトリから Claude Code を実行します

## 権限がサンドボックスとどのように相互作用するか

権限と[サンドボックス](/ja/sandboxing)は、補完的なセキュリティレイヤーです。

- **権限**は、Claude Code が使用できるツール、およびアクセスできるファイルまたはドメインを制御します。すべてのツール（Bash、Read、Edit、WebFetch、MCP など）に適用されます。
- **サンドボックス**は、Bash ツールのファイルシステムとネットワークアクセスを制限する OS レベルの強制を提供します。Bash コマンドとその子プロセスにのみ適用されます。

防御を深くするために両方を使用します。

- 権限 deny ルールは、Claude が制限されたリソースへのアクセスを試みることさえ防止します
- サンドボックス制限は、プロンプトインジェクションが Claude の意思決定をバイパスしても、Bash コマンドが定義された境界外のリソースに到達することを防止します
- サンドボックス内のファイルシステム制限は、Read と Edit deny ルールを使用し、別のサンドボックス設定は使用しません
- ネットワーク制限は、WebFetch 権限ルールとサンドボックスの `allowedDomains` と `deniedDomains` リストを組み合わせます

サンドボックスが `autoAllowBashIfSandboxed: true` で有効になっている場合（デフォルト）、サンドボックス化された Bash コマンドは、権限に `ask: Bash(*)` が含まれている場合でもプロンプトなしで実行されます。サンドボックス境界はコマンドごとのプロンプトの代わりになります。[サンドボックスモード](/ja/sandboxing#sandbox-modes)を参照して、この動作を変更してください。

## 管理設定

Claude Code 設定の一元的な制御が必要な組織の場合、管理者はユーザーまたはプロジェクト設定でオーバーライドできない管理設定をデプロイできます。これらのポリシー設定は通常の設定ファイルと同じ形式に従い、MDM/OS レベルのポリシー、管理設定ファイル、または[サーバー管理設定](/ja/server-managed-settings)を通じて配信できます。配信メカニズムとファイルの場所については、[設定ファイル](/ja/settings#settings-files)を参照してください。

### 管理のみの設定

一部の設定は管理設定でのみ有効です。ユーザーまたはプロジェクト設定ファイルに配置しても効果がありません。

| 設定 | 説明 |
| :- | :- |
| `allowedChannelPlugins` | メッセージをプッシュできるチャネルプラグインのホワイトリスト。設定されている場合、デフォルトの Anthropic ホワイトリストを置き換えます。`channelsEnabled: true` が必要です。[チャネルプラグインの実行を制限する](/ja/channels#restrict-which-channel-plugins-can-run)を参照してください |
| `allowManagedHooksOnly` | `true` の場合、管理フック、SDK フック、および管理設定 `enabledPlugins` で強制有効にされたプラグインからのフックのみが読み込まれます。ユーザー、プロジェクト、およびその他すべてのプラグインフックはブロックされます |
| `allowManagedMcpServersOnly` | `true` の場合、管理設定からの `allowedMcpServers` のみが尊重されます。`deniedMcpServers` はすべてのソースからマージされます。[管理 MCP 設定](/ja/mcp#managed-mcp-configuration)を参照してください |
| `allowManagedPermissionRulesOnly` | `true` の場合、ユーザーおよびプロジェクト設定が `allow`、`ask`、または `deny` 権限ルールを定義することを防止します。管理設定のルールのみが適用されます |
| `blockedMarketplaces` | マーケットプレイスソースのブロックリスト。ブロックされたソースはダウンロード前にチェックされるため、ファイルシステムに触れることはありません。[管理マーケットプレイス制限](/ja/plugin-marketplaces#managed-marketplace-restrictions)を参照してください |
| `channelsEnabled` | Team および Enterprise ユーザーの[チャネル](/ja/channels)を許可します。設定されていないか `false` の場合、ユーザーが `--channels` に渡すものに関係なく、チャネルメッセージ配信をブロックします |
| `forceRemoteSettingsRefresh` | `true` の場合、リモート管理設定が新しく取得されるまで CLI 起動をブロックし、取得に失敗した場合は終了します。[フェイルクローズ強制](/ja/server-managed-settings#enforce-fail-closed-startup)を参照してください |
| `pluginTrustMessage` | インストール前に表示されるプラグイン信頼警告に追加されるカスタムメッセージ |
| `sandbox.filesystem.allowManagedReadPathsOnly` | `true` の場合、管理設定からの `filesystem.allowRead` パスのみが尊重されます。`denyRead` はすべてのソースからマージされます |
| `sandbox.network.allowManagedDomainsOnly` | `true` の場合、管理設定からの `allowedDomains` と `WebFetch(domain:...)` allow ルールのみが尊重されます。許可されていないドメインはユーザーに促すことなく自動的にブロックされます。拒否されたドメインはすべてのソースからマージされます |
| `strictKnownMarketplaces` | ユーザーが追加できるプラグインマーケットプレイスを制御します。[管理マーケットプレイス制限](/ja/plugin-marketplaces#managed-marketplace-restrictions)を参照してください |

`disableBypassPermissionsMode` は通常、組織ポリシーを強制するために管理設定に配置されますが、任意のスコープから機能します。ユーザーは独自の設定で設定して、自分自身をバイパスモードからロックアウトできます。

[リモートコントロール](/ja/remote-control)と[ウェブセッション](/ja/claude-code-on-the-web)へのアクセスは、管理設定キーで制御されません。Team および Enterprise プランでは、管理者が [Claude Code 管理設定](https://claude.ai/admin-settings/claude-code)でこれらの機能を有効または無効にします。

## auto モード分類器を設定する

[Auto mode](/ja/permission-modes#eliminate-prompts-with-auto-mode)は、分類器モデルを使用して、プロンプトなしで実行しても安全なアクションかどうかを判断します。デフォルトでは、作業ディレクトリと、存在する場合は現在のリポジトリのリモートのみを信頼します。会社のソースコントロール org にプッシュしたり、チームクラウドバケットに書き込んだりするようなアクションは、潜在的なデータ流出としてブロックされます。`autoMode` 設定ブロックを使用して、組織が信頼するインフラストラクチャを分類器に伝えることができます。

分類器は、ユーザー設定、`.claude/settings.local.json`、管理設定から `autoMode` を読み取ります。チェックインされたリポジトリが独自の allow ルールを注入できるため、`.claude/settings.json` の共有プロジェクト設定からは読み取りません。

| スコープ | ファイル | 用途 |
| :- | :- | :- |
| 1 人の開発者 | `~/.claude/settings.json` | 個人的な信頼できるインフラストラクチャ |
| 1 つのプロジェクト、1 人の開発者 | `.claude/settings.local.json` | プロジェクトごとの信頼できるバケットまたはサービス、gitignored |
| 組織全体 | 管理設定 | すべての開発者に対して強制される信頼できるインフラストラクチャ |

各スコープからのエントリが結合されます。開発者は個人的なエントリで `environment`、`allow`、`soft_deny` を拡張できますが、管理設定が提供するエントリを削除することはできません。allow ルールは分類器内のブロックルールの例外として機能するため、開発者が追加した `allow` エントリは組織の `soft_deny` エントリをオーバーライドできます。組み合わせは加算的であり、ハードポリシー境界ではありません。開発者が回避できないルールが必要な場合は、代わりに管理設定で `permissions.deny` を使用してください。これは分類器が相談される前にアクションをブロックします。

### 信頼できるインフラストラクチャを定義する

ほとんどの組織では、`autoMode.environment` が設定する必要がある唯一のフィールドです。これは、組み込みのブロックルールと allow ルールに触れることなく、信頼できるリポジトリ、バケット、ドメインを分類器に伝えます。分類器は `environment` を使用して「外部」が何を意味するかを決定します。リストされていない宛先は潜在的な流出ターゲットです。

```json
{
  "autoMode": {
    "environment": [
      "Source control: github.example.com/acme-corp and all repos under it",
      "Trusted cloud buckets: s3://acme-build-artifacts, gs://acme-ml-datasets",
      "Trusted internal domains: *.corp.example.com, api.internal.example.com",
      "Key internal services: Jenkins at ci.example.com, Artifactory at artifacts.example.com"
    ]
  }
}
```

エントリは散文であり、正規表現またはツールパターンではありません。分類器はそれらを自然言語ルールとして読み取ります。新しいエンジニアにインフラストラクチャを説明する方法で記述してください。徹底的な environment セクションは以下をカバーします。

- **組織**。会社名と Claude Code が主に使用される用途（ソフトウェア開発、インフラストラクチャ自動化、データエンジニアリングなど）
- **ソースコントロール**。開発者がプッシュするすべての GitHub、GitLab、または Bitbucket org
- **クラウドプロバイダーと信頼できるバケット**。Claude が読み取りおよび書き込みできるバケット名またはプレフィックス
- **信頼できる内部ドメイン**。`*.internal.example.com` のようなネットワーク内の API、ダッシュボード、サービスのホスト名
- **主要な内部サービス**。CI、アーティファクトレジストリ、内部パッケージインデックス、インシデントツール
- **追加コンテキスト**。規制業界の制約、マルチテナントインフラストラクチャ、または分類器がリスクとして扱うべき内容に影響するコンプライアンス要件

有用な開始テンプレート。括弧で囲まれたフィールドを入力し、適用されない行を削除します。

```json
{
  "autoMode": {
    "environment": [
      "Organization: {COMPANY_NAME}. Primary use: {PRIMARY_USE_CASE, e.g. software development, infrastructure automation}",
      "Source control: {SOURCE_CONTROL, e.g. GitHub org github.example.com/acme-corp}",
      "Cloud provider(s): {CLOUD_PROVIDERS, e.g. AWS, GCP, Azure}",
      "Trusted cloud buckets: {TRUSTED_BUCKETS, e.g. s3://acme-builds, gs://acme-datasets}",
      "Trusted internal domains: {TRUSTED_DOMAINS, e.g. *.internal.example.com, api.example.com}",
      "Key internal services: {SERVICES, e.g. Jenkins at ci.example.com, Artifactory at artifacts.example.com}",
      "Additional context: {EXTRA, e.g. regulated industry, multi-tenant infrastructure, compliance requirements}"
    ]
  }
}
```

より具体的なコンテキストを提供するほど、分類器は日常的な内部操作と流出の試みをより良く区別できます。

すべてを一度に入力する必要はありません。合理的なロールアウト。デフォルトから開始し、ソースコントロール org と主要な内部サービスを追加します。これにより、自分のリポジトリへのプッシュのような最も一般的な誤検知が解決されます。次に、信頼できるドメインとクラウドバケットを追加します。ブロックが発生したら、残りを入力します。

### ブロックルールと allow ルールをオーバーライドする

2 つの追加フィールドを使用して、分類器の組み込みルールリストを置き換えることができます。`autoMode.soft_deny` はブロックされるものを制御し、`autoMode.allow` は適用される例外を制御します。各は散文説明の配列であり、自然言語ルールとして読み取られます。

分類器内では、優先順位は次のとおりです。`soft_deny` ルールが最初にブロックし、次に `allow` ルールが例外としてオーバーライドし、次に明示的なユーザーの意図が両方をオーバーライドします。ユーザーのメッセージが Claude が実行しようとしている正確なアクションを直接かつ具体的に説明する場合、分類器は `soft_deny` ルールがマッチしても allow します。一般的なリクエストはカウントされません。Claude に「リポジトリをクリーンアップする」ように依頼することは force-push を認可しませんが、「このブランチを force-push する」ように依頼することはします。

緩和するには。デフォルトがパイプラインが PR レビュー、CI、またはステージング環境で既に保護しているものをブロックする場合は `soft_deny` からルールを削除するか、分類器がデフォルト例外がカバーしない日常的なパターンを繰り返しフラグする場合は `allow` に追加します。厳しくするには。環境に固有のリスクをデフォルトが見落とす場合は `soft_deny` に追加するか、デフォルト例外をブロックルールに保持するために `allow` から削除します。すべての場合で、`claude auto-mode defaults` を実行して完全なデフォルトリストを取得し、コピーして編集します。空のリストから開始しないでください。

```json
{
  "autoMode": {
    "environment": [
      "Source control: github.example.com/acme-corp and all repos under it"
    ],
    "allow": [
      "Deploying to the staging namespace is allowed: staging is isolated from production and resets nightly",
      "Writing to s3://acme-scratch/ is allowed: ephemeral bucket with a 7-day lifecycle policy"
    ],
    "soft_deny": [
      "Never run database migrations outside the migrations CLI, even against dev databases",
      "Never modify files under infra/terraform/prod/: production infrastructure changes go through the review workflow",
      "...copy full default soft_deny list here first, then add your rules..."
    ]
  }
}
```

`allow` または `soft_deny` を設定すると、そのセクションのデフォルトリスト全体が置き換わります。単一のエントリで `soft_deny` を設定すると、すべての組み込みブロックルールが破棄されます。force push、データ流出、`curl | bash`、本番環境へのデプロイ、およびその他すべてのデフォルトブロックルールが許可されます。安全にカスタマイズするには、`claude auto-mode defaults` を実行して組み込みルールを出力し、それらを設定ファイルにコピーし、各ルールを独自のパイプラインとリスク許容度に対して確認します。インフラストラクチャが既に軽減するリスクのルールのみを削除します。

3 つのセクションは独立して評価されるため、`environment` のみを設定すると、デフォルトの `allow` と `soft_deny` リストはそのままになります。

### デフォルトと有効な設定を検査する

`allow` または `soft_deny` を設定するとデフォルトが置き換わるため、カスタマイズを開始する前に完全なデフォルトリストをコピーしてください。3 つの CLI サブコマンドは、検査と検証に役立ちます。

```bash
claude auto-mode defaults  # the built-in environment, allow, and soft_deny rules
claude auto-mode config    # what the classifier actually uses: your settings where set, defaults otherwise
claude auto-mode critique  # get AI feedback on your custom allow and soft_deny rules
```

`claude auto-mode defaults` の出力をファイルに保存し、ポリシーに合わせてリストを編集し、結果を設定ファイルに貼り付けます。保存後、`claude auto-mode config` を実行して、有効なルールが期待どおりであることを確認します。カスタムルールを記述した場合、`claude auto-mode critique` はそれらを確認し、曖昧、冗長、または誤検知を引き起こす可能性があるエントリをフラグします。

## 設定の優先順位

権限ルールは、他のすべての Claude Code 設定と同じ[設定優先順位](/ja/settings#settings-precedence)に従います。

1. **管理設定**。コマンドライン引数を含む他のレベルでオーバーライドできません
2. **コマンドライン引数**。一時的なセッションオーバーライド
3. **ローカルプロジェクト設定**（`.claude/settings.local.json`）
4. **共有プロジェクト設定**（`.claude/settings.json`）
5. **ユーザー設定**（`~/.claude/settings.json`）

ツールがいずれかのレベルで拒否されている場合、他のレベルはそれを許可できません。たとえば、管理設定 deny は `--allowedTools` でオーバーライドできず、`--disallowedTools` は管理設定が定義する内容を超えて制限を追加できます。

権限がユーザー設定で許可されているがプロジェクト設定で拒否されている場合、プロジェクト設定が優先され、権限はブロックされます。

## 設定例

この[リポジトリ](https://github.com/anthropics/claude-code/tree/main/examples/settings)には、一般的なデプロイメントシナリオのスターター設定が含まれています。これらを出発点として使用し、ニーズに合わせて調整してください。

## 関連項目

- [設定](/ja/settings)。権限設定テーブルを含む完全な設定リファレンス
- [サンドボックス](/ja/sandboxing)。Bash コマンドの OS レベルのファイルシステムとネットワーク分離
- [認証](/ja/authentication)。Claude Code へのユーザーアクセスを設定します
- [セキュリティ](/ja/security)。セキュリティ保護とベストプラクティス
- [フック](/ja/hooks-guide)。ワークフローを自動化し、権限評価を拡張します
