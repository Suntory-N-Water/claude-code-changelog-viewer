# ADR 0013: SEO テクニカル細部の修正

## Status

Proposed

## Context

claude-code-log.com は Astro + Cloudflare Workers で構築された静的サイトである。
これまで ADR 0004・ADR 0010 でSEOの包括的改善とインデックス登録率の改善を実施してきた。

今回は `/seo` スキル（`addyosmani/web-quality-skills@seo`）を用いてコードレベルの監査を行い、
Googleのモバイルフレンドリー要件・OGP仕様・JSON-LD の一貫性・BreadcrumbList の構造的正確性という
4つの細部に改善余地があることを確認した。

### 解決したい課題

**課題 1: `viewport` に `initial-scale=1` が欠落**

`Layout.astro` の viewport メタタグが `width=device-width` のみで、
`initial-scale=1` が設定されていなかった。
Google はモバイルSEOの基本要件として両方の指定を推奨しており、
Lighthouse の SEO 監査でも指摘される項目である。

**課題 2: OGP 画像に寸法メタタグが未設定**

`og:image` は設定済みだが `og:image:width` と `og:image:height` が存在しなかった。
OGP 画像は `ogp.tsx` の実装から 1200×630px と確認できているが、
Discord・LINE などのプラットフォームは明示的なサイズ宣言がないと画像を正しく展開できない場合がある。

**課題 3: changelog バージョンページのパンくずが中間ページを欠落**

`changelog/[version].astro` の BreadcrumbList が
`トップ > v{version}` の2階層のみで、
`/changelog` という中間ページを経由していなかった。
実際のURL階層（`/ > /changelog > /changelog/v{version}`）と JSON-LD の BreadcrumbList が乖離していた。

**課題 4: `docs/[slug].astro` に JSON-LD が未設定**

`docs/[slug].astro`（個別ドキュメント差分ページ）のみ `jsonLd` プロパティが未設定で、
他のページと一貫性が取れていなかった。
BreadcrumbList は付与済みだったが WebPage スキーマが生成されていなかった。

### 検討した選択肢

**課題 1: viewport**

- A. `initial-scale=1` を追加する（採用）
- B. 現状維持

**課題 2: OGP 画像サイズ**

- A. `og:image:width` / `og:image:height` を追加する（採用）
- B. 現状維持（プラットフォーム側の推論に任せる）
- C. `og:image:type` も含めて明示する（`image/png`）

**課題 3: パンくず**

- A. `/changelog` を中間ノードに追加する（採用）
- B. 現状の2階層を維持する
- C. さらに詳細な階層（メジャーバージョングループなど）を追加する

**課題 4: JSON-LD**

- A. `type: 'page'` を渡す（採用）
- B. ドキュメント差分ページ専用の `type: 'article'` スキーマを新設する
- C. 現状維持（JSON-LD なし）

### 各選択肢の評価

| 観点 | 課題1: A(追加) | 課題1: B(維持) |
|------|--------------|--------------|
| Google 推奨準拠 | ◎ | △ |
| 変更範囲 | 最小(1行) | — |
| 副作用 | なし | — |

| 観点 | 課題2: A(width/height追加) | 課題2: B(維持) | 課題2: C(type も追加) |
|------|--------------------------|--------------|----------------------|
| SNS展開の安定性 | ◎ | △ | ◎ |
| OGP仕様への準拠度 | ○ | △ | ◎ |
| 変更コスト | 小(2行) | — | 小(3行) |
| 必要性 | 高 | — | 低（主要SNSは推論可） |

| 観点 | 課題3: A(/changelog追加) | 課題3: B(2階層維持) | 課題3: C(詳細階層) |
|------|------------------------|--------------------|------------------|
| URL階層との一致 | ◎ | △ | ◎ |
| /changelog への内部リンク強化 | ○ | × | ○ |
| 実装コスト | 最小(1行) | — | 中 |

| 観点 | 課題4: A(type: page) | 課題4: B(article) | 課題4: C(維持) |
|------|---------------------|-----------------|--------------|
| 実装コスト | 最小(1行) | 大(型定義追加) | — |
| 構造化データの充実度 | ○ | ◎ | × |
| 将来の拡張余地 | ○ | ◎ | — |

## Decision

**`/seo` スキルによる監査結果に基づき、viewport・OGP寸法・BreadcrumbList・JSON-LD の4点を最小コストで修正し、Google推奨仕様への準拠度を高める。**

### 1. viewport に `initial-scale=1` を追加（`Layout.astro`）

```html
<!-- Before -->
<meta name='viewport' content='width=device-width' />

<!-- After -->
<meta name='viewport' content='width=device-width, initial-scale=1' />
```

全ページに一括適用される。

### 2. OGP 画像寸法メタタグを追加（`Layout.astro`）

OGP画像は `src/lib/ogp.tsx` で `width: 1200, height: 630` をデフォルト値として生成している。
この値を明示的にメタタグで宣言する。

```html
<meta property='og:image' content={ogImage} />
<!-- 追加 -->
<meta property='og:image:width' content='1200' />
<meta property='og:image:height' content='630' />
```

`og:image:type` は主要SNSが `Content-Type` ヘッダーで判定可能なため今回は省略する。

### 3. changelog バージョンページの BreadcrumbList に `/changelog` を追加

```astro
<!-- Before -->
breadcrumbs={[
  { name: 'トップ', url: import.meta.env.SITE },
  { name: `v${version}`, url: `${import.meta.env.SITE}/changelog/v${version}` },
]}

<!-- After -->
breadcrumbs={[
  { name: 'トップ', url: import.meta.env.SITE },
  { name: '変更履歴', url: `${import.meta.env.SITE}/changelog` },
  { name: `v${version}`, url: `${import.meta.env.SITE}/changelog/v${version}` },
]}
```

これにより JSON-LD の BreadcrumbList が実際のURLパス階層と一致する。

### 4. `docs/[slug].astro` に `jsonLd={{ type: 'page' }}` を追加

```astro
<Layout
  title={`${pageTitle} - ${SITE_TITLE}`}
  description={entry.aiSummary}
  jsonLd={{ type: 'page' }}  <!-- 追加 -->
  breadcrumbs={...}
>
```

`type: 'page'` は `Layout.astro` 内で `WebPage` スキーマを生成する既存パスを利用する。
ドキュメント差分ページ専用の `TechArticle` 化は将来の拡張として残す。

## Consequences

### Positive

- Lighthouse SEO 監査で「viewport に initial-scale がない」の指摘が解消される
- Discord・LINE など `og:image:width/height` を参照するプラットフォームでサムネイルが安定表示される
- changelog バージョンページの JSON-LD BreadcrumbList が URL 階層と一致し、Googleリッチリザルトでのパンくず表示が正確になる
- 全ページで JSON-LD の付与が統一され、Search Console の構造化データレポートに欠損がなくなる

### Negative

- OGP画像サイズを `1200x630` とハードコードしたため、将来サイズを変更した場合にメタタグも追従させる必要がある
  - → `ogp.tsx` の定数と `Layout.astro` のメタタグを同時に変更するよう運用ルールを設ける

### Risks

- `docs/[slug].astro` を `WebPage` として宣言しているが、将来的にコンテンツが増えた場合に `TechArticle` の方が適切になる可能性がある
  - → ドキュメント差分ページの充実度に応じて ADR を追記し、`type: 'article'` へ移行することを検討する

## 決めていないこと

| 項目 | 決めない理由 | いつ決めるか |
|------|------------|------------|
| `og:image:type` の明示 | 主要SNSは Content-Type で判定可能 | 特定プラットフォームで展開不良が報告されたとき |
| `docs/[slug].astro` を `TechArticle` に昇格するか | 現状のページ内容が WebPage として十分 | ドキュメント差分ページの情報量が増加したとき |

## Notes

### 参考資料

- [Google: モバイルフレンドリーページの作成方法](https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing)
- [The Open Graph protocol: og:image](https://ogp.me/#structured)
- [Google: 構造化データのBreadcrumbリスト](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb)
- 関連 ADR: [ADR 0004: SEO 包括的改善](./0004-seo-comprehensive-improvements.md)
- 関連 ADR: [ADR 0010: Google Search Console インデックス登録率の改善](./0010-seo-indexing-improvement.md)
