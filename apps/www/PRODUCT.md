# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

主要ユーザーは、Claude Code を日常的に使っている日本語圏の開発者。ターミナルで作業する合間に「今週・今日は何が変わったか」を短時間で拾い、自分の使い方に影響する変更だけを見分けたい。英語の原文 changelog を読むコストと、1行の変更行から実際の影響を読み取るコストの両方を避けたい。

第二のユーザーは、把握した内容をチームへ共有する人(テックリード、社内広報的な役割)。共有時に引用元・根拠として提示できることが重要で、記事や個別バージョンのページが「そのまま貼れる URL」として機能する必要がある。

## Product Purpose

CCログ超訳は、Claude Code の公式 CHANGELOG と公式ドキュメントの更新を自動取得し、AI が日本語に翻訳・分析したうえで公開する非公式サイト。成功とは、ユーザーが公式リリースノートを開かなくても、自分に関係する変更とその意味を把握できている状態。

## Positioning

公式 changelog / リリースノートが代替できないのは、次の 3 点の組み合わせ:

1. **「変更前 → 変更後 → ユーザーへの恩恵」の推論** — 1行の変更記述から、実際に何がどう変わり、何が得られるかを AI が補完して提示する。
2. **日本語で読めること** — 翻訳済みであること自体が価値であり、英語原文を読む負荷を取り除く。
3. **公式ドキュメントとの紐づけ** — 変更項目のキーワードを抽出して公式 docs の該当箇所・設定リファレンス・機能領域に接続し、単体の行ではなく文脈として読める。

## Operating Context

- 読み手は開発作業の合間に短時間で訪れる。滞在は「一覧を走査 → 気になる項目だけ展開」が基本形。
- 更新の検知は受動的でもよい: Discord / Slack / メールの通知登録と週次記事が、能動的に見に来なくても追える導線になっている。
- 運営側のワークフローとして、管理画面 `/admin/weekly` で週次記事に載せる changelog の選定とコメント付けを行い、その選定 JSON から記事を生成する。

## Capabilities and Constraints

**機能**

- バージョン一覧 (`/`, `/changelog`) と個別バージョンページ (`/changelog/[version]`)
- 機能領域別の集約ページ (`/features`, `/features/[area]`)
- 設定リファレンス (`/reference/settings`)
- 読みもの: 週次アップデート記事 (`/posts/weekly`)、コラム (`/posts/column`、OG 画像を satori で動的生成)
- 通知登録 (`/notify`) — Discord / Slack / メール。notification-worker (Hono + D1 + Queues + Turnstile) が配信を担当
- サイト内検索 (Pagefind)、RSS、sitemap、`llms.txt`、JSON Schema エンドポイント
- 管理画面 (`/admin/weekly`, `/admin/weekly/[week]`)

**技術的制約**

- Astro 静的ビルド + Cloudflare Workers ホスティング。コンテンツは Content Collections (changelog / diff / postsWeekly / column / settingsReference)。
- スタイリングは Tailwind CSS v4 + `src/styles/global.css` の CSS 変数トークン。
- Lighthouse CI の閾値を下回らない: accessibility ≥ 0.9、performance ≥ 0.7、best-practices ≥ 0.8、SEO ≥ 0.9。
- 日本語単一。i18n / 英語版は予定に入れない。日本語組版(禁則・行間・text-balance 等)を前提に設計する。
- 明示的に求められない限り後方互換性は維持しない(プロジェクト方針)。

**用語**

「変更履歴 / changelog」「機能領域 (feature area)」「読みもの(週次・コラム)」「設定リファレンス」を UI 上の呼称として使う。

## Brand Commitments

- サイト名は「CCログ超訳」。
- Claude のブランド色を踏襲する。既存トークン `--cc-main-orange` (#DB8163) / `--cc-main-white` (#FAF9F5) / `--cc-main-black` (#141413) / `--cc-gray` (#E0DFDA) / `--cc-orange-hover` (#D97757) / `--cc-link-orange` を維持する。
- Anthropic 非公式であること、および AI 生成コンテンツを含むことを表示から外さない。公式サイトと見まがうデザインにしない。
- 文章・ログ・コメントはすべて日本語。

## Evidence on Hand

- 実データ: 公式 CHANGELOG の全バージョンと AI 推論結果 (`src/content/` の Content Collections 経由)、バージョン間の changelog 差分 (diff collection)。
- 実コンテンツ: 週次アップデート記事、コラム記事、設定リファレンス。
- 稼働中の通知基盤 (Discord / Slack / メールプレビュー版)。
- **存在しないもの(捏造しない)**: 利用者数・PV・導入企業・お客様の声・受賞歴・ベンチマーク・価格。Anthropic による承認や提携も存在しない。

## Product Principles

1. **公式の一次情報を置き換えず、そこへ届ける** — 解釈は付加価値だが、正確な情報の所在(公式リリースノート・公式 docs)への導線を常に残す。
2. **走査が先、精読は後** — 一覧は数十バージョンを目で追える密度を保ち、詳細は展開して読む。全文を最初から見せない。
3. **AI 生成であることを隠さない** — 推論・翻訳の産物であることが読み手に分かる形で提示し、断定調で公式の記述を装わない。
4. **共有できる単位で作る** — バージョン・機能領域・記事はそれぞれ独立した URL とタイトルを持ち、そのまま他人に渡せる。
5. **静的で速いことを設計の前提にする** — クライアント JavaScript に依存する体験を既定にしない。

## Accessibility & Inclusion

Lighthouse accessibility スコア 0.9 以上を維持することが確定要件。本文リンクには通常のオレンジではなく高コントラストの `--cc-link-orange` を使う既存判断があり、コントラスト確保の方針として継続する。
