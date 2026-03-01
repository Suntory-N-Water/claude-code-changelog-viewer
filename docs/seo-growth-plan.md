# SEO・グロース施策チェックリスト

## 背景

当サイト(claude-code-log.com)は Claude Code の全バージョンの変更履歴を AI で日本語解説する静的サイトだが、Google にインデックスされたページが **0 件** で、検索流入がゼロの状態にある。

原因は 2 つある。

1. `.workers.dev` サブドメインで運用していたため、ドメインオーソリティが低く検索エンジンに認識されにくかった
2. Google Search Console へのサイトマップ送信・インデックス登録リクエストを行っていなかった

232 ページ分のコンテンツ資産がありながら、検索エンジンに届いていない。この問題を解消し、検索流入を獲得するために以下の施策を実施する。

## 実施済み(コード変更)

- [x] カスタムドメイン `claude-code-log.com` への移行設定(astro.config.mjs, wrangler.jsonc, robots.txt 動的化)
- [x] JSON-LD 構造化データ(WebSite, TechArticle, BreadcrumbList, FAQPage)
- [x] meta description 最適化(全ページ 120-160 文字)
- [x] 見出し階層修正(H1→H2 スキップ解消)
- [x] About ページ作成(E-E-A-T 改善)
- [x] タイトルタグ最適化(検索意図に合うキーワード含む)
- [x] GA4 修正(Partytown インストール・integration 追加)
- [x] Cache-Control ヘッダー設定(`_astro/*` immutable, favicon/icon 1 日)
- [x] 不要 CSS 削除(tw-animate-css, 未使用 shadcn/ui 変数, .dark ブロック)
- [x] og:type 動的切替(article ページは `article`)
- [x] og:site_name メタタグ追加
- [x] RSS `<link rel="alternate">` 追加
- [x] robots meta タグ追加
- [x] FAQ セクション + FAQPage JSON-LD(トップページ)
- [x] トップページ H1 日本語化 + リード文拡充
- [x] VersionCard にサマリープレビュー表示
- [x] SNS シェアボタン(X, はてなブックマーク)追加
- [x] Discord 通知 CTA バナー(changelog 詳細ページ)
- [x] notify.astro / privacy.astro に jsonLd + breadcrumbs 追加
- [x] about.astro に Claude Code 説明 + 内部リンク追加
- [x] Footer に「全バージョンの変更履歴」リンク + RSS リンク追加
- [x] TechArticle JSON-LD に author / publisher 追加

## 未実施(デプロイ・インフラ)

### Cloudflare

- [ ] Cloudflare ダッシュボードで `claude-code-log.com` のゾーンを登録
- [ ] DNS 設定(ネームサーバーを Cloudflare に変更)
- [ ] `wrangler deploy` でデプロイ
- [ ] カスタムドメインでの表示確認後、`wrangler.jsonc` に `"workers_dev": false` を追加(.workers.dev URL を無効化)

### Google Search Console

- [ ] `claude-code-log.com` を GSC に登録(DNS 認証推奨)
- [ ] `https://claude-code-log.com/sitemap-index.xml` をサイトマップとして送信
- [ ] 主要ページの URL 検査 → インデックス登録リクエスト
  - `/`(トップ)
  - `/about`
  - `/notify`
  - 最新 5 バージョンの changelog ページ
- [ ] 1-2 週間後にインデックス状況を確認

## 未実施(外部集客)

### Zenn 記事

- [ ] **記事 1**:「Claude Code 全バージョンの変更履歴をAIで分析してサイトにした話」
  - 技術スタック(Astro + Cloudflare Workers + AI 分析パイプライン)の解説
  - GitHub Releases → AI 分析 → JSON 生成 → SSG → Discord 通知の自動化フロー
  - OGP 自動生成(satori + resvg-js)の実装
  - 末尾にサイト URL
- [ ] **記事 2**:「Claude Code の進化を振り返る - 主要マイルストーンまとめ」
  - 232 バージョンのデータを横断分析
  - MCP サポート、Hooks、バックグラウンドエージェントなどの転換点
  - 各バージョンページへの内部リンクを多数配置
- [ ] **継続**: 大型リリースの都度、速報記事を投稿

### Qiita 記事

- [ ] 「Claude Code を最大限活用するために知っておきたい最近のアップデート 10 選」
  - 実務的な Tips 形式、各バージョンページへのリンク付き
  - タグ: Claude, Anthropic, AI コーディング, 開発環境

### X (Twitter)

- [ ] サイト公開アナウンスツイート
- [ ] 新バージョンリリース時の速報ツイート(テンプレート化推奨)
  - `Claude Code v{version} がリリースされました。詳細: https://claude-code-log.com/changelog/v{version} #ClaudeCode #Anthropic`
- [ ] 週次まとめスレッド(「今週の Claude Code 更新まとめ」)

### コミュニティ

- [ ] GitHub リポジトリの README にサイトリンクを明記
- [ ] GitHub Topics に `claude-code`, `changelog`, `astro`, `cloudflare-workers` を設定
- [ ] はてなブックマーク: Zenn/Qiita 記事投稿後に初動 3-5 ブクマを目指す
- [ ] Reddit r/ClaudeAI: 英語で紹介投稿
- [ ] Anthropic 公式 Discord で関連議論があれば自然に紹介
- [ ] 日本の AI エンジニア Discord サーバーで紹介

## 将来検討(中長期)

### コンテンツ拡充

- [ ] `/features` ページ(機能タイムライン: 各機能が初登場したバージョンを横断表示)
- [ ] 月次アップデートまとめページ(`/updates/2026-03` など、自動生成検討)
- [ ] カテゴリ別変更一覧(Added / Fixed / Improved で横断フィルタ)
- [ ] バージョン間の差分比較ページ
- [ ] 検索・フィルター機能(232 バージョンの絞り込み)

### 対策キーワード(参考値・実データ未検証)

| キーワード | 推定難易度 | 対応ページ |
|---|---|---|
| Claude Code changelog 日本語 | 低 | トップページ |
| Claude Code v{X} 変更点 | 低 | 既存 232 ページ |
| Claude Code アップデート | 中 | トップページ |
| Claude Code 新機能 | 中 | 将来の /features ページ |
| Claude Code バックグラウンドエージェント | 低 | 将来の機能別ページ |

※ 検索ボリューム・難易度は推定値。正確なデータは Google Search Console の蓄積データまたは SEO ツール(Ahrefs, SEMrush 等)で取得すること。
