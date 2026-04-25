# ADR 0010: Google Search Console インデックス登録率の改善

## Status

Accepted

## Context

claude-code-log.com は Astro + Cloudflare Workers で構築された静的サイトで、
Claude Code の変更履歴を日本語解説するサービスである。

サイトマップには 349 URL が存在するにもかかわらず、Google Search Console で以下の状態が確認された。

- インデックス登録済み: 140 件
- インデックス未登録: 289 件(登録率 40%)

### 解決したい課題

**課題 1: canonical URL が実際のアクセス URL と不一致**

`astro.config.mjs` に `build: { format: 'file' }` を設定しているため、Astro の仕様として
ビルド中の `Astro.url.pathname` に `.html` 拡張子が付与される(例: `/changelog/v1.0.0.html`)。
Cloudflare Workers は `.html` を自動的に省略して配信するため、
実際のアクセス URL(`/changelog/v1.0.0`)と canonical URL(`/changelog/v1.0.0.html`)が全ページで乖離していた。

この不一致が Search Console の「代替ページ(canonical あり)31件」の主要因と判断した。

また `src/pages/index.astro` は `dist/index.html` に出力されるため、
`Astro.url.pathname` は `/index.html` となり、canonical が
`https://claude-code-log.com/index` という誤った値になっていた。

**課題 2: トップページに全バージョンが集中し内部リンク構造が非効率**

トップページが「もっと見る」ボタンで全 270+ バージョンを動的に追加する構造だった。
初期 HTML には最初の 20 件しか含まれず、残りは `<template>` タグ内に隠れていた。
Googlebot は JavaScript を実行するが `<template>` 内のリンクはクロールされにくく、
古いバージョンページへの内部リンクが事実上機能していなかった。

**課題 3: `/changelog` 一覧ページが存在せず 404**

全バージョン一覧に対応する静的 URL がなく、SEO 上のエントリポイントが欠落していた。

**課題 4: サイトマップの `lastmod` が古いバージョンに未設定**

GitHub Releases API を `per_page=100&page=1` の 1 ページのみ取得していたため、
バージョン数が 100 を超えた時点で古いバージョンの `lastmod` が取得できなくなっていた。
サイトマップ全体の約 74% で `lastmod` が未設定の状態だった。

### 検討した選択肢

**canonical 修正の選択肢**

- A. `build.format` を `'directory'` に変更する
- B. Layout.astro で pathname から `.html` と `/index` を除去する(採用)
- C. Cloudflare Workers のリダイレクト設定で正規化する

**トップページ構造の選択肢**

- A. 「もっと見る」ボタンを維持しつつ `<template>` を廃止してサーバー側レンダリングに変更する
- B. トップページを最新 N 件に絞り、別ページに全一覧を移す(採用)
- C. ページネーション(`/changelog?page=2` 等)を実装する

### 各選択肢の評価

**canonical 修正**

| 観点 | A: format 変更 | B: pathname 正規化(採用) | C: Cloudflare リダイレクト |
|------|--------------|--------------------------|--------------------------|
| 変更範囲 | 大(ルーティング全体) | 小(Layout.astro 1行) | 中(Workers 設定) |
| 副作用リスク | 高(URL 構造が変わる) | 低 | 低 |
| Astro 仕様との整合性 | ◎(推奨構成) | ○(workaround だが明示的) | △(アプリ層で解決すべき問題) |

**トップページ構造**

| 観点 | A: template 廃止 | B: 別ページ分離(採用) | C: ページネーション |
|------|----------------|----------------------|------------------|
| 内部リンク強化 | ○ | ◎ | ○ |
| 実装コスト | 中 | 小 | 大 |
| UX | △(重い初期 HTML) | ○(トップは軽量) | ○ |
| 新規 URL 追加 | なし | `/changelog`(SEO 有利) | 多数(管理コスト増) |

## Decision

**`build: { format: 'file' }` 環境における canonical URL の自動正規化ロジックを Layout.astro に実装し、全バージョン一覧ページを `/changelog` に新設、トップページを最新 30 件に絞り込む。**

### 1. canonical URL 正規化(Layout.astro)

`Astro.url.pathname` から `.html` 拡張子と末尾の `/index` を除去する。

```ts
// Before
const canonicalUrl = new URL(Astro.url.pathname, siteUrl).toString();

// After
const canonicalUrl = new URL(
  Astro.url.pathname.replace(/\.html$/, '').replace(/\/index$/, '') || '/',
  siteUrl,
).toString();
```

変換例:

| `Astro.url.pathname` | canonical(修正後) |
|---|---|
| `/index.html` | `https://claude-code-log.com/` |
| `/changelog/index.html` | `https://claude-code-log.com/changelog` |
| `/changelog/v1.0.0.html` | `https://claude-code-log.com/changelog/v1.0.0` |

この仕様は Astro 公式ドキュメントに明記されている。

> **`file`** - The `Astro.url.pathname` will include `.html`. (e.g. `/foo.html`)

### 2. トップページを最新 30 件に絞り込み(index.astro)

`<template>` 要素と「もっと見る」ボタンのクライアントサイド JS を削除し、
トップページには降順ソートで上位 30 件のみを静的レンダリングする。
残りのバージョンへは `/changelog` へのリンクで誘導する。

```ts
// Before: 複雑な分割ロジック + クライアント JS
const CUTOFF_VERSION = '2.1.0';
const recentVersions = ...;
const olderVersions = ...;
const remainingVersions = [...recentVersions.slice(PAGE_SIZE), ...olderVersions];

// After: シンプル
const TOP_PAGE_SIZE = 30;
const initialVersions = versionData.slice(0, TOP_PAGE_SIZE);
const remainingCount = versionData.length - TOP_PAGE_SIZE;
```

### 3. 全バージョン一覧ページ新設(/changelog/index.astro)

全バージョンをメジャーバージョン(v0.x / v1.x / v2.x)でグループ化して表示する。
既存の `VersionCard` コンポーネントを再利用し、実装コストを最小化する。

これにより:
- 各バージョンページへの内部リンクが /changelog 経由で張られ、クロールパスが確立する
- トップページから `/changelog` へのリンクが貼られ、階層構造が明確になる

### 4. sitemap lastmod のページネーション対応(astro.config.mjs)

GitHub Releases API を最大 3 ページ(300 件)取得するよう変更する。

```js
// Before: 1ページのみ取得
await fetch('.../releases?per_page=100')

// After: 最大3ページ取得
for (let page = 1; page <= 3; page++) {
  const res = await fetch(`.../releases?per_page=100&page=${page}`);
  // ...件数が0またはper_page未満なら break
}
```

また `/changelog` に `changefreq: DAILY, priority: 0.9` を付与し、
更新頻度の高い一覧ページを優先的にクロールさせる。

## Consequences

### Positive

- canonical URL が実際のアクセス URL と一致し、Search Console の「代替ページ」エラーが解消される
- トップページの初期 HTML が軽量化され、Googlebot がリンクを確実に認識できる
- `/changelog` という恒久的な URL が生まれ、内部リンク構造が強化される
- 古いバージョン(v0.x / v1.x)にも `lastmod` が付与され、サイトマップの信頼性が向上する

### Negative

- `build.format: 'file'` を維持する限り、pathname 正規化ロジックが Layout.astro に残り続ける
  - → コメントで Astro 仕様との関係を明示し、意図的な workaround であることを記録する
- トップページから「もっと見る」でバージョンを閲覧するユーザー体験が変わる
  - → `/changelog` への遷移コストは 1 クリックで、UX 劣化は軽微と判断

### Risks

- Astro が将来 `build.format: 'file'` 時の `Astro.url.pathname` の挙動を変更した場合、canonical が二重に正規化される
  - → `build.format` を `'directory'` に変更すれば根本解決できる。CI での canonical 確認を推奨

## 決めていないこと

| 項目 | 決めない理由 | いつ決めるか |
|------|------------|------------|
| `build.format` を `'directory'` へ移行するか | Cloudflare Workers との互換性検証が必要 | インデックス登録率が改善しない場合に再検討 |
| 古いバージョン(v0.x / v1.x)ページへの thin content 対策 | v2.1.0 以降には背景情報が付与済み。旧バージョンの優先度を評価中 | Search Console の推移を 4〜8 週間観察後に判断 |

## Notes

### 参考資料

- [Astro 公式: build.format の Effect on Astro.url](https://docs.astro.build/en/reference/configuration-reference/#buildformat)
- [Google: サイトマップ構築ガイド(lastmod の信頼条件)](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Google: クロールバジェット最適化ガイド](https://developers.google.com/crawling/docs/crawl-budget)
