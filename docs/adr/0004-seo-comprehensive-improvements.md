# ADR 0004: SEO 全面改善 — Astro SEO ベストプラクティスの適用

## Status

Accepted

## Context

`apps/www` は Astro 製の静的サイト(Cloudflare Workers にデプロイ)として Claude Code の CHANGELOG を公開している。

2026年4月時点で、記事「Astro SEO: the definitive guide」と現状実装を比較したところ、以下の未実装項目が判明した。

- `robots` メタタグに snippet 制御ディレクティブがない
- JSON-LD が複数の独立スクリプトとして出力されており、エンティティ間の関係が機械読取不能
- WebSite JSON-LD に信頼シグナル(`SearchAction`・`publishingPrinciples`・`copyrightHolder`)がない
- サイトマップに `changefreq` / `priority` / `lastmod` がない
- 404 ページが存在しない
- AI エージェント向けのスキーマエンドポイントがない
- ビルド時に SEO 品質(重複 title、H1 欠損 など)を自動検証する仕組みがない
- `No-Vary-Search` ヘッダーがなく UTM パラメータで重複キャッシュが生じる
- NLWeb 対応リンクがない

### 検討した選択肢

| 観点 | 外部ライブラリ(`@jdevalk/astro-seo-graph`)| 自前実装 |
|------|------|------|
| 導入コスト | 低(npm install のみ) | 高(設計・実装が必要) |
| カスタマイズ性 | ライブラリの API に制約される | 任意に変更可能 |
| 依存リスク | ライブラリのメンテナンス状況に依存 | なし |
| 既存コードとの統合 | json-ld.ts・Layout.astro の全面置き換えが必要 | 既存コードを段階的に拡張可能 |
| 学習コスト | ライブラリ固有の概念・API を習得 | なし |

また、個別の技術選択についても以下を比較検討した。

#### サイトマップ lastmod の取得方法

| 手法 | Cloudflare CI で動くか | 精度 | 実装コスト |
|------|------|------|------|
| `git log` | ❌ シャロークローンで失敗 | 高 | 中 |
| GitHub Releases API の `published_at` | ✅ | 高(公式リリース日) | 低(既存 API 呼び出しを再利用) |
| ファイル mtime | ❌ CI でリセットされる | 低 | 低 |
| lastmod 省略 | ✅ | なし | ゼロ |

#### ビルド時 SEO バリデーションの実装方法

| 手法 | タイミング | 実装コスト |
|------|------|------|
| Astro インテグレーション(`astro:build:done` フック) | ビルド完了後に dist を検査 | 低 |
| 外部 CI ツール(lychee 等) | PR ごとにワークフロー実行 | 中(CI 設定が必要) |
| 手動レビュー | リリース前 | ゼロだが属人的 |

## Decision

**自前実装で、すべての SEO 改善を `apps/www` に直接組み込む。**

### 1. robots meta に snippet 制御ディレクティブを追加

`src/layouts/Layout.astro` の `robots` メタタグを以下に変更し、Google Discover とリッチスニペット表示の上限を解除した。

```html
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
```

### 2. JSON-LD を単一 `@graph` 形式に移行

`src/lib/json-ld.ts` を全面改訂し、複数の独立スクリプトを廃止して単一の `@graph` に統合した。

**変更前(独立スクリプト複数):**
```html
<script type="application/ld+json">{ "@context": "...", "@type": "WebSite", ... }</script>
<script type="application/ld+json">{ "@context": "...", "@type": "BreadcrumbList", ... }</script>
```

**変更後(単一 @graph + @id 相互参照):**
```html
<script type="application/ld+json">{
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": "/#organization", ... },
    { "@type": "WebSite",      "@id": "/#website", "publisher": { "@id": "/#organization" }, ... },
    { "@type": "TechArticle",  "@id": "/changelog/v1.2.3#article", "isPartOf": { "@id": "/#website" }, ... },
    { "@type": "BreadcrumbList", ... }
  ]
}</script>
```

公開 API は `generateGraphJsonLd(params, breadcrumbs?, faqItems?)` の単一関数に一本化した。

### 3. WebSite JSON-LD に信頼シグナルを追加

WebSite ノードに以下のプロパティを追加し、検索エンジンおよび AI エージェントへの信頼性シグナルとした。

- `publishingPrinciples`: `/about`(編集方針)
- `copyrightHolder` / `copyrightYear`: Organization ノードへの参照 / `2026`
- `knowsAbout`: `['Claude Code', 'Anthropic', 'AI coding assistant', 'changelog']`
- `potentialAction`: SearchAction(Pagefind の `?highlight=` パラメータに対応)

TechArticle ノードには `datePublished` / `dateModified` を追加し、GitHub Releases API の `published_at` で設定した(リリースが存在するバージョンのみ)。

### 4. サイトマップ改善

`astro.config.mjs` の `sitemap()` オプションを設定した。

- **filter**: OG 画像・RSS・llms.txt・スキーマエンドポイントをサイトマップから除外
- **serialize**: `changefreq` / `priority` をページ種別ごとに付与(トップ: daily/1.0、changelog: monthly/0.8、features/docs: weekly/0.7-0.6)
- **lastmod**: changelog ページは GitHub Releases API の `published_at` を使用。API 呼び出しはビルド中に1回だけ行いキャッシュする(`git log` は Cloudflare CI のシャロークローン環境で動作しないため不採用)

### 5. 404 ページ + FuzzyRedirect

`src/pages/404.astro` を新規作成した。ビルド時に全 URL(changelog / features / docs / static)を HTML にインライン埋め込みし、クライアントサイドの Levenshtein 距離計算で候補 URL を最大 3 件表示する。

```
/changelog/v1.2 にアクセス → 「もしかして: /changelog/v1.2.3」を表示
```

- 閾値は `Math.max(5, Math.floor(currentPath.length * 0.4))` でパス長に比例させ、短いパスでの false positive を抑制
- View Transitions 経由のブラウザバック時も再発火するよう `astro:page-load` イベントで初期化処理を登録

### 6. AI エージェント向けスキーマエンドポイント + スキーママップ

- `src/pages/schema/changelog.json.ts`: 全 changelog エントリの JSON-LD グラフを `application/ld+json` で一括配信
- `src/pages/schemamap.xml.ts`: スキーマエンドポイント一覧を XML で配信
- `src/pages/robots.txt.ts`: `Schemamap:` ディレクティブを追加

### 7. NLWeb 対応リンク

`<head>` に Microsoft NLWeb プロトコル向けのリンクを追加した(草案段階のため `llms.txt` を暫定エンドポイントとして指定)。

```html
<link rel="nlweb" type="text/plain" href="/llms.txt" />
```

### 8. No-Vary-Search ヘッダー

`public/_headers` の `/*` セクションに追加し、UTM パラメータ・`highlight`(Pagefind)などのトラッキングパラメータをブラウザキャッシュのキーから除外した。

```
No-Vary-Search: params=("utm_source" "utm_medium" "utm_campaign" "utm_content" "utm_term" "fbclid" "gclid" "highlight")
```

### 9. ビルド時 SEO バリデーション

`src/integrations/seo-validate.ts` を Astro インテグレーションとして実装し、`astro:build:done` フックで dist の全 HTML ファイルを検査する。

検査項目:
- H1 タグの存在・重複(warn)
- ページ横断での title 重複(error) ← 初回実行で docs ページネーションの重複を検出・修正
- meta description の存在(warn)
- img の alt 属性(warn)
- canonical link の存在(warn)

`failOnError: false` でビルドを止めず警告のみとし、CI では `true` に切り替え可能。

## Consequences

### Positive

- JSON-LD が `@graph` 形式になり、AI エージェントがエンティティ間の関係をグラフとして走査できるようになった
- サイトマップに `lastmod` が入り、クローラーが更新差分を効率的に検出できる
- 404 ページが存在することでユーザーが近いページへ誘導される
- ビルド時バリデーションにより SEO 品質劣化(重複 title など)をリリース前に検出できる
- UTM パラメータによるブラウザキャッシュ分散が解消される
- `schema/changelog.json` により AI エージェントがサイト全体の構造化データを1リクエストで取得できる

### Negative

- `astro.config.mjs` が肥大化した(GitHub API fetch ロジックを含む)
  - → serialize コールバック内でのキャッシュ変数により、API 呼び出しはビルド中1回に抑えている
- サイトマップのビルドが GitHub API の応答速度に依存するようになった
  - → try/catch で API 失敗時は lastmod なしにフォールバック
- `404.astro` で全 URL をインライン埋め込みするため、URL 数が増えるとビルド後の HTML サイズが増加する
  - → changelog が数百件規模でも JSON 文字列で数十 KB 以下のため許容範囲

### Risks

- NLWeb は草案段階の仕様であり、エンドポイント仕様が変更される可能性がある
  - → `href="/llms.txt"` を変えるだけで対応可能な設計のため影響は最小限
## 決めていないこと

| 項目 | 決めない理由 | いつ決めるか |
|------|------------|------------|
| NLWeb 専用エンドポイントの実装 | 仕様が草案段階であり実装コストに見合わない | NLWeb が広く採用された時点で検討 |
| `failOnError: true` への切り替え | 既存ページの品質確認が必要 | SEO 警告がゼロになったタイミングで CI に導入 |

## Notes

### 参考資料

- [Astro SEO: the definitive guide](https://joost.blog/astro-seo/) — 本 ADR の実装方針の起点となった記事
- [Microsoft NLWeb](https://github.com/nlweb-ai/NLWeb)
- [No-Vary-Search MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/No-Vary-Search)
