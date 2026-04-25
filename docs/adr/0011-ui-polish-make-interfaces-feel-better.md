# ADR 0011: UI ポリッシュ方針の標準化(make-interfaces-feel-better)

## Status

Accepted

## Context

本プロジェクト(CCログ超訳)は Astro + Tailwind CSS で構築された静的サイトであり、複数のページ・コンポーネントが独立して実装されてきた。機能追加を重ねるなかで、以下のような品質のばらつきが生じていた。

### 解決したい課題

- `transition-all` が多数のコンポーネントで使われており、GPU が処理できないプロパティ(`width`、`height`、`border-radius` 等)まで監視対象になっていた
- 見出し(`<h1>`、`<h2>`)に `text-wrap: balance` が適用されておらず、ウィンドウ幅によって行末が不自然に折れるケースがあった
- バージョン数・件数など動的に変化しうる数値に `tabular-nums` が当たっておらず、数字の桁が変わるとレイアウトがずれる可能性があった
- ボタン・カードリンクにクリック時の触感フィードバック(scale on press)がなく、押した感覚が乏しかった
- モバイル向けハンバーガーボタンのヒットエリアが `36×36px` であり、タッチ操作の最小推奨サイズ `40×40px` を下回っていた
- macOS 環境でフォントスムージング(`-webkit-font-smoothing: antialiased`)が適用されておらず、テキストが太く見える場合があった

### 検討した選択肢

1. **個別コンポーネントで随時修正する** — 問題が表面化した都度、該当箇所だけ直す
2. **UI ライブラリ(shadcn/ui 等)を導入して標準化する** — コンポーネントレベルで品質を担保する
3. **make-interfaces-feel-better スキルによる横断レビューと一括適用** — 設計原則を明文化し、全コンポーネントに一斉適用する

### 各選択肢の評価

| 観点 | 個別修正 | UI ライブラリ導入 | スキルによる横断適用 |
|------|---------|-----------------|-------------------|
| 既存コードへの影響 | 最小限 | 大規模リライト必要 | 中程度(クラス変更のみ) |
| 品質の網羅性 | 低い(見落としが残る) | 高い | 高い |
| 導入コスト | 低い | 高い | 低〜中 |
| 将来の追加実装への指針 | なし | ライブラリ依存 | 原則として残る |
| Tailwind との親和性 | 高い | 要調整 | 高い |

## Decision

**make-interfaces-feel-better スキルが定める設計原則を、全ページ・コンポーネントに横断適用し、今後の実装指針として採用する。**

### 1. フォントスムージング

`global.css` の `body` に `-webkit-font-smoothing: antialiased` を追加し、macOS 環境でのテキスト表示を改善する。

```css
body {
  -webkit-font-smoothing: antialiased;
  font-smoothing: antialiased;
}
```

### 2. transition プロパティの明示化

`transition-all` を禁止し、アニメーション対象のプロパティを常に明示する。

```html
<!-- Bad -->
<a class="transition-all">...</a>

<!-- Good -->
<a class="transition-[border-color,color,transform]">...</a>
```

対象プロパティの組み合わせ例：
- カード: `transition-[box-shadow,border-color,transform]`
- テキストリンク: `transition-[color]`
- ボタン(背景あり): `transition-[background-color,box-shadow,transform]`
- 入力フィールド: `transition-[border-color,box-shadow]`

### 3. 見出しの text-wrap

`<h1>`・`<h2>` には必ず `text-balance` を付与する。本文段落には `text-pretty` を付与する。

```html
<h1 class="text-balance ...">タイトル</h1>
<p class="text-pretty ...">本文テキスト</p>
```

### 4. 数値の tabular-nums

件数・バージョン番号・追加/削除行数など、動的に変化しうる数値を含む要素には `tabular-nums` を付与する。

```html
<p class="tabular-nums">{itemCount}件</p>
<span class="tabular-nums">+{additions}</span>
```

### 5. Scale on press

クリッカブルなカード・ボタン・リンクには `active:scale-[0.96]`(全幅カードは `active:scale-[0.98]`)を付与する。`transition-transform` を含む transition 指定とセットで使用する。

```html
<!-- ボタン・リンク -->
<a class="transition-[border-color,color,transform] active:scale-[0.96]">...</a>

<!-- 全幅カード -->
<a class="transition-[box-shadow,border-color,transform] active:scale-[0.98]">...</a>
```

`0.95` 未満の値は過剰に見えるため使用しない。

### 6. ヒットエリアの最小サイズ

インタラクティブ要素のヒットエリアは最低 `40×40px` を確保する。
モバイルハンバーガーボタンを `w-9 h-9`(36px)から `w-10 h-10`(40px)に修正した。

## Consequences

### Positive

- `transition-all` の廃止により、ブラウザが監視するプロパティ数が減り、アニメーション処理が軽量になる
- `text-balance` により、見出しの改行が均等になり可読性が向上する
- `tabular-nums` により、数字の桁変化によるレイアウトシフトが防止される
- Scale on press により、ボタン・カードを押した際の触感フィードバックが得られる
- ヒットエリア修正により、スマートフォンでの操作ミスが減る
- フォントスムージングにより、macOS 環境でテキストが鮮明に表示される

### Negative

- 新規コンポーネント追加時に、各原則を意識して実装する手間が生じる
  - → 本 ADR と make-interfaces-feel-better スキルを実装指針として参照することで対応する
- `transition-[...]` の記述が `transition-all` より冗長になる
  - → 冗長さは許容範囲内。パフォーマンスと意図の明確さを優先する

### Risks

- 今後追加されるコンポーネントで原則が守られない場合、品質のばらつきが再発する
  - → プルリクエストレビュー時に make-interfaces-feel-better スキルで確認する運用を推奨する

## Notes

### 参考資料

- make-interfaces-feel-better スキル: `.claude/skills/make-interfaces-feel-better/`
- [WCAG 2.5.5 – Target Size](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)(ヒットエリア最小サイズの根拠)
