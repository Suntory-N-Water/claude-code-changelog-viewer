# ADR 0002: スクロール読み進めプログレスバーのカスタム実装採用

## Status

Accepted

## Context

apps/www は Astro + Tailwind CSS で構築された静的サイトであり、各 changelog バージョンの詳細ページはテキスト量が多い。読み手が「どこまで読んだか」を把握できる UI として、ページ最上部に固定表示されるスクロールプログレスバーの導入を検討した。

既にスクロールトップボタン（`ScrollToTop.astro`）が存在しており、同様の `astro:page-load` パターンで実装を揃えることが望ましい。

### 解決したい課題

- 長文ページでユーザーが現在の読み進め位置を把握しにくい
- ページ遷移後にスクロール位置がリセットされるため、遷移ごとにバーもリセットされる必要がある

### 検討した選択肢

- **選択肢A**: `astro-vtbot` ライブラリの `<ProgressBar>` コンポーネントを使用する
- **選択肢B**: 外部依存なしのカスタムコンポーネントとして実装する

### 各選択肢の評価

| 観点 | 選択肢A: astro-vtbot | 選択肢B: カスタム実装 |
|------|---------------------|----------------------|
| 実装コスト | 低（コンポーネントを置くだけ） | 低（数十行） |
| 外部依存 | あり（`astro-vtbot` パッケージ） | なし |
| 機能の適合性 | **不適合**（ページ遷移時のローディングバーであり、スクロール連動ではない） | 適合 |
| カスタマイズ性 | 限定的 | 自由 |
| バンドルサイズへの影響 | あり | なし |

## Decision

**スクロール読み進めプログレスバーは、外部ライブラリを使わずカスタムコンポーネント（`ScrollProgress.astro`）として実装する。**

### 1. astro-vtbot を採用しない理由

調査の結果、`astro-vtbot` の `<ProgressBar>` は `@swup/progress-plugin` を内部で使用しており、Astro のページ遷移イベント（`TRANSITION_AFTER_SWAP`）に連動したローディングインジケーターである。スクロール量に応じて幅が変化する「読み進めバー」とは根本的に異なる機能であり、要件を満たさない。

### 2. カスタム実装の構成

```astro
<!-- ScrollProgress.astro -->
<div
  id="scroll-progress"
  class="fixed top-0 left-0 h-1 w-0 bg-[hsl(var(--cc-main-orange))] z-60 transition-none"
  role="progressbar"
  aria-label="ページの読み進め状況"
  aria-valuenow={0}
  aria-valuemin={0}
  aria-valuemax={100}
></div>

<script>
  let controller: AbortController | null = null;

  document.addEventListener('astro:page-load', () => {
    controller?.abort();
    controller = new AbortController();
    const { signal } = controller;

    const bar = document.getElementById('scroll-progress');
    if (!bar) return;

    const updateProgress = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      bar.style.width = `${progress}%`;
      bar.setAttribute('aria-valuenow', String(Math.round(progress)));
    };

    window.addEventListener('scroll', updateProgress, { signal, passive: true });
    updateProgress();
  });
</script>
```

### 3. 設計上の選択

- **`z-60`**: ヘッダー（`z-50`）より前面に表示
- **`passive: true`**: スクロールイベントのパフォーマンス最適化
- **`AbortController`**: `astro:page-load` ごとにリスナーを再登録するため、前回リスナーを確実に解放
- **`role="progressbar"` + `aria-valuenow`**: スクリーンリーダー対応
- **色**: `hsl(var(--cc-main-orange))` でサイトテーマカラーと統一

## Consequences

### Positive

- 外部依存が増えない
- 実装がシンプルで `ScrollToTop.astro` と同じパターンで統一されている
- カラーやサイズの変更が容易

### Negative

- `astro-vtbot` のようなライブラリに比べてバグ修正・機能追加は自己管理が必要
  - → 実装がシンプルなため、保守コストは実質ほぼゼロ

### Risks

- Astro の View Transitions API が大きく変わった場合、`astro:page-load` イベントの挙動が変わる可能性がある
  - → 発生時は `ScrollToTop.astro` と合わせて修正する

## Notes

### 参考資料

- [astro-vtbot ProgressBar ソース（unpkg）](https://unpkg.com/astro-vtbot@1.8.7/components/ProgressBar.astro)
- [Bag of Tricks - Progress Bar デモ](https://events-3bg.pages.dev/loading/progress-bar/one/)
