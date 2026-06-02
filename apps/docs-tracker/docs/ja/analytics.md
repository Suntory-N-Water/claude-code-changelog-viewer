---
title: analytics
source: https://code.claude.com/docs/ja/analytics.md
---

# チームの使用状況を分析で追跡する

> Claude Code の使用メトリクスを表示し、採用状況を追跡し、分析ダッシュボードでエンジニアリング速度を測定します。

Claude Code は、組織が開発者の使用パターンを理解し、貢献メトリクスを追跡し、Claude Code がエンジニアリング速度にどのような影響を与えるかを測定するのに役立つ分析ダッシュボードを提供します。お客様のプランに応じたダッシュボードにアクセスしてください。

| プラン | ダッシュボード URL | 含まれる内容 | 詳細 |
| - | - | - | - |
| Claude for Teams / Enterprise | [claude.ai/analytics/claude-code](https://claude.ai/analytics/claude-code) | 使用メトリクス、GitHub 統合による貢献メトリクス、リーダーボード、データエクスポート | [詳細](#access-analytics-for-team-and-enterprise) |
| API（Claude Console） | [platform.claude.com/claude-code](https://platform.claude.com/claude-code) | 使用メトリクス、支出追跡、チームインサイト | [詳細](#access-analytics-for-api-customers) |

## Team と Enterprise の分析にアクセスする

[claude.ai/analytics/claude-code](https://claude.ai/analytics/claude-code) に移動してください。管理者とオーナーがダッシュボードを表示できます。

Team と Enterprise ダッシュボードには以下が含まれます。

- **使用メトリクス**：受け入れられたコード行数、提案受け入れ率、日次アクティブユーザー数とセッション数
- **貢献メトリクス**：[GitHub 統合](#enable-contribution-metrics)を使用した Claude Code 支援による PR とシップされたコード行数
- **リーダーボード**：Claude Code 使用量でランク付けされたトップコントリビューター
- **データエクスポート**：カスタムレポート用に貢献データを CSV としてダウンロード

ユーザーごとのトークン数とコスト推定については、[OpenTelemetry エクスポート](/ja/monitoring-usage)を構成してください。

### 貢献メトリクスを有効にする

貢献メトリクスはパブリックベータ版であり、Claude for Teams と Claude for Enterprise プランで利用可能です。これらのメトリクスは、claude.ai 組織内のユーザーのみをカバーしています。Claude Console API またはサードパーティ統合を通じた使用は含まれていません。

使用状況と採用データは、すべての Claude for Teams と Claude for Enterprise アカウントで利用可能です。貢献メトリクスには、GitHub 組織を接続するための追加セットアップが必要です。

分析設定を構成するには、オーナーロールが必要です。GitHub 管理者が GitHub アプリをインストールする必要があります。

[Zero Data Retention](/ja/zero-data-retention) が有効になっている組織では、貢献メトリクスは利用できません。分析ダッシュボードは使用メトリクスのみを表示します。

GitHub 管理者が、[github.com/apps/claude](https://github.com/apps/claude) で組織の GitHub アカウントに Claude GitHub アプリをインストールします。

Claude オーナーが [claude.ai/admin-settings/claude-code](https://claude.ai/admin-settings/claude-code) に移動し、Claude Code 分析機能を有効にします。

同じページで、'GitHub analytics'トグルを有効にします。

GitHub 認証フローを完了し、分析に含める GitHub 組織を選択します。

データは通常、有効化後 24 時間以内に表示され、毎日更新されます。データが表示されない場合は、以下のいずれかのメッセージが表示される可能性があります。

- **「GitHub app required」**：貢献メトリクスを表示するには GitHub アプリをインストールしてください
- **「Data processing in progress」**：数日後に確認し、データが表示されない場合は GitHub アプリがインストールされていることを確認してください

貢献メトリクスは GitHub Cloud と GitHub Enterprise Server をサポートしています。

### サマリーメトリクスを確認する

これらのメトリクスは意図的に保守的であり、Claude Code の実際の影響の過小評価を表しています。Claude Code の関与に高い信頼度がある行と PR のみがカウントされます。

ダッシュボードの上部に以下のサマリーメトリクスが表示されます。

- **PRs with CC**：Claude Code で記述された少なくとも 1 行のコードを含むマージされたプルリクエストの総数
- **Lines of code with CC**：Claude Code 支援で記述されたすべてのマージされた PR 全体のコード行数。「有効な行」のみがカウントされます。正規化後に 3 文字以上の行で、空行と括弧またはトリビアルな句読点のみの行を除きます。
- **PRs with Claude Code（%）**：Claude Code 支援コードを含むすべてのマージされた PR のパーセンテージ
- **Suggestion accept rate**：ユーザーが Claude Code のコード編集提案を受け入れる回数のパーセンテージ。Edit、Write、NotebookEdit ツール使用を含みます。
- **Lines of code accepted**：ユーザーがセッション内で受け入れた Claude Code で記述されたコード行の総数。これは拒否された提案を除外し、その後の削除を追跡しません。

### チャートを探索する

ダッシュボードには、時系列でトレンドを視覚化するためのいくつかのチャートが含まれています。

#### 採用を追跡する

採用チャートは日次使用トレンドを表示します。

- **users**：日次アクティブユーザー
- **sessions**：1 日あたりのアクティブな Claude Code セッション数

#### ユーザーあたりの PR を測定する

このチャートは、時系列での個々の開発者アクティビティを表示します。

- **PRs per user**：1 日にマージされた PR の総数を日次アクティブユーザーで割った値
- **users**：日次アクティブユーザー

これを使用して、Claude Code の採用が増加するにつれて個々の生産性がどのように変化するかを理解します。

#### プルリクエストの内訳を表示する

プルリクエストチャートは、マージされた PR の日次内訳を表示します。

- **PRs with CC**：Claude Code 支援コードを含むプルリクエスト
- **PRs without CC**：Claude Code 支援コードを含まないプルリクエスト

**Lines of code** ビューに切り替えて、PR 数ではなくコード行数による同じ内訳を表示します。

#### トップコントリビューターを見つける

リーダーボードは、貢献量でランク付けされたトップ 10 ユーザーを表示します。以下を切り替えます。

- **Pull requests**：各ユーザーの Claude Code を使用した PR とすべての PR を表示
- **Lines of code**：各ユーザーの Claude Code を使用した行とすべての行を表示

**Export all users** をクリックして、すべてのユーザーの完全な貢献データを CSV ファイルとしてダウンロードします。エクスポートには、表示されているトップ 10 だけでなく、すべてのユーザーが含まれます。

### PR 属性

貢献メトリクスが有効になっている場合、Claude Code はマージされたプルリクエストを分析して、Claude Code 支援で記述されたコードを判定します。これは、Claude Code セッションアクティビティを各 PR のコードと照合することで行われます。

#### タグ付け基準

PR は、Claude Code セッション中に記述された少なくとも 1 行のコードを含む場合、「with Claude Code」としてタグ付けされます。システムは保守的なマッチングを使用します。Claude Code の関与に高い信頼度がある場合のみ、支援されたコードとしてカウントされます。

#### 属性プロセス

プルリクエストがマージされるとき。

1. 追加された行が PR diff から抽出されます
2. 時間ウィンドウ内で一致するファイルを編集した Claude Code セッションが識別されます
3. PR 行が複数の戦略を使用して Claude Code 出力と照合されます
4. AI 支援行と総行数のメトリクスが計算されます

比較前に、行は正規化されます。空白がトリミングされ、複数のスペースが折りたたまれ、引用符が標準化され、テキストが小文字に変換されます。

Claude Code 支援行を含むマージされたプルリクエストは、GitHub で `claude-code-assisted` としてラベル付けされます。

#### 時間ウィンドウ

PR マージ日の 21 日前から 2 日後のセッションが属性マッチングの対象と見なされます。

#### 除外されたファイル

特定のファイルは自動生成されるため、分析から自動的に除外されます。

- ロックファイル：package-lock.json、yarn.lock、Cargo.lock など
- 生成されたコード：Protobuf 出力、ビルドアーティファクト、縮小ファイル
- ビルドディレクトリ：dist/、build/、node\_modules/、target/
- テストフィクスチャ：スナップショット、カセット、モックデータ
- 1,000 文字を超える行（縮小または生成されている可能性が高い）

#### 属性に関する注記

属性データを解釈する際は、以下の追加の詳細に注意してください。

- 開発者によって大幅に書き直されたコード（20% 以上の差がある場合）は Claude Code に属性されません
- 21 日ウィンドウ外のセッションは考慮されません
- アルゴリズムは属性を実行するときに PR ソースまたは宛先ブランチを考慮しません

### 分析から最大限の価値を得る

貢献メトリクスを使用して ROI を実証し、採用パターンを特定し、他のユーザーが開始するのを支援できるチームメンバーを見つけます。

#### 採用を監視する

採用チャートとユーザー数を追跡して、以下を特定します。

- ベストプラクティスを共有できるアクティブユーザー
- 組織全体の全体的な採用トレンド
- 摩擦または問題を示す可能性のある使用の低下

#### ROI を測定する

貢献メトリクスは、独自のコードベースからのデータを使用して「このツールは投資する価値があるか？」という質問に答えるのに役立ちます。

- 採用が増加するにつれて、時系列でユーザーあたりの PR の変化を追跡します
- Claude Code を使用した場合と使用しない場合の PR とシップされたコード行を比較します
- [DORA メトリクス](https://dora.dev/)、スプリント速度、または他のエンジニアリング KPI と一緒に使用して、Claude Code の採用による変化を理解します

#### パワーユーザーを特定する

リーダーボードは、高い Claude Code 採用を持つチームメンバーを見つけるのに役立ちます。彼らは以下を行うことができます。

- プロンプティング技術とワークフローをチームと共有する
- 何がうまく機能しているかについてのフィードバックを提供する
- 新しいユーザーのオンボーディングを支援する

#### プログラムでデータにアクセスする

GitHub を通じてこのデータをクエリするには、`claude-code-assisted` でラベル付けされた PR を検索します。

## API カスタマー向けの分析にアクセスする

Claude Console を使用している API カスタマーは、[platform.claude.com/claude-code](https://platform.claude.com/claude-code) で分析にアクセスできます。ダッシュボードにアクセスするには UsageView 権限が必要です。これは Developer、Billing、Admin、Owner、Primary Owner ロールに付与されます。

GitHub 統合による貢献メトリクスは、現在 API カスタマーには利用できません。Console ダッシュボードは使用メトリクスと支出メトリクスのみを表示します。

Console ダッシュボードは以下を表示します。

- **Lines of code accepted**：ユーザーがセッション内で受け入れた Claude Code で記述されたコード行の総数。これは拒否された提案を除外し、その後の削除を追跡しません。
- **Suggestion accept rate**：ユーザーがコード編集ツール使用を受け入れる回数のパーセンテージ。Edit、Write、NotebookEdit ツールを含みます。
- **Activity**：チャートに表示される日次アクティブユーザーとセッション。
- **Spend**：ユーザー数と並んでドルでの日次 API コスト。

### チームインサイトを表示する

チームインサイトテーブルはユーザーごとのメトリクスを表示します。

- **Members**：Claude Code に認証されたすべてのユーザー。API キーユーザーはキー識別子で表示され、OAuth ユーザーはメールアドレスで表示されます。
- **Spend this month**：ユーザーごとの現在の月の API コストの合計。
- **Lines this month**：ユーザーごとの現在の月の受け入れられたコード行の合計。

Console ダッシュボードの支出数値は分析目的の推定値です。実際のコストについては、請求ページを参照してください。

## 関連リソース

- [OpenTelemetry での監視](/ja/monitoring-usage)：リアルタイムメトリクスとイベントを可観測性スタックにエクスポート
- [コストを効果的に管理する](/ja/costs)：支出制限を設定し、トークン使用を最適化
- [権限](/ja/permissions)：ロールと権限を構成
