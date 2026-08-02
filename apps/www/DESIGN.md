---
name: CCログ超訳
description: Claude Code の変更履歴を日本語で読ませる、紙面基調のフラットな情報系デザインシステム
colors:
  clay-orange: "#DB8163"
  burnt-orange: "#D97757"
  link-orange: "#914127"
  paper-white: "#FAF9F5"
  ink-black: "#141413"
  line-beige: "#E0DFDA"
  card-white: "#FFFFFF"
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "normal"
  headline:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "normal"
  title:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "normal"
  body:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.625
    letterSpacing: "normal"
  body-long:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.9
    letterSpacing: "normal"
  label:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  code:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "0.9em"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "16px"
  md: "20px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.clay-orange}"
    textColor: "#FFFFFF"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "8px 20px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.burnt-orange}"
    textColor: "#FFFFFF"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink-black}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "8px 20px"
    height: "44px"
  button-outline-hover:
    backgroundColor: "rgba(219, 129, 99, 0.04)"
    textColor: "{colors.clay-orange}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-black}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "8px 20px"
  button-ghost-hover:
    backgroundColor: "rgba(219, 129, 99, 0.08)"
    textColor: "{colors.clay-orange}"
  card-page:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.ink-black}"
    rounded: "{rounded.xl}"
    padding: "20px"
  card-link:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink-black}"
    rounded: "{rounded.xl}"
    padding: "24px"
  card-accent:
    backgroundColor: "rgba(219, 129, 99, 0.06)"
    textColor: "{colors.ink-black}"
    rounded: "{rounded.xl}"
    padding: "20px"
  badge-neutral:
    backgroundColor: "rgba(224, 223, 218, 0.5)"
    textColor: "{colors.ink-black}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  badge-accent:
    backgroundColor: "rgba(219, 129, 99, 0.1)"
    textColor: "{colors.clay-orange}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  input-text:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.ink-black}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
    width: "100%"
  nav-link-active:
    backgroundColor: "rgba(219, 129, 99, 0.08)"
    textColor: "{colors.clay-orange}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "6px 8px"
---

# Design System: CCログ超訳

## Overview

明るい紙面の上に、細い罫線でブロックを区切っていく情報系のシステム。地は純白ではなくわずかに黄みを帯びた `#FAF9F5` で、その上に置かれるリンクカードだけが純白 `#FFFFFF` に浮く。この 2 段の明度差と 1px の罫線が、このシステムにおける唯一の常設の階層表現であり、影は静止状態では使わない。

色数は極端に少ない。地・文字・罫線の 3 つのニュートラルと、1 系統のオレンジしかない。オレンジは Claude のブランド色であり、バージョン番号・現在地・リンク・フォーカスリングという「読み手が次に触れる場所」だけに現れる。面積を取らないことがこの色の効き方を支えている。

書体は専用フォントを読み込まず、OS の システムスタックをそのまま使う。速度が設計の前提であり、フォント読み込みの遅延を持ち込まない判断が既に下されている。そのぶん日本語の可読性は組版側で作っている: 見出しの `word-break: auto-phrase` による文節改行、`text-wrap: balance`、バージョン番号や件数の `tabular-nums`、本文の 1.9 という深い行間。これらは装飾ではなく、この言語でこの内容を読ませるための機能である。

**Key Characteristics:**

- 紙 (`#FAF9F5`) の上にカード (`#FFFFFF`) が乗る、2 段だけの明度階層
- 1px `#E0DFDA` の罫線が区切りの主役。影は状態変化のときだけ現れる
- オレンジ 1 系統 + ニュートラル 3 色。それ以外の色相を持たない
- システムフォント。ウェブフォントを読み込まない
- 日本語組版のための CSS 機能 (auto-phrase / balance / tabular-nums) を常用する
- 全てのモーションに `prefers-reduced-motion` の無効化経路がある

## Colors

やや暖色に寄せたニュートラル 3 色に、テラコッタ寄りのオレンジ 1 系統だけを載せた構成。彩度の高い色は他に存在しない。

### Primary

- **クレイオレンジ** (#DB8163): Claude のブランド色。バージョン番号の見出し、プライマリボタンの地、ナビゲーションの現在地、フォーカスリング、hover 時の罫線に使う。面積を占める用途はプライマリボタンのみ。
- **バーントオレンジ** (#D97757): クレイオレンジの hover / active 段。単独では使わず、必ずクレイオレンジからの遷移先として現れる。
- **リンクオレンジ** (#914127): 記事本文中のリンク専用。クレイオレンジは本文サイズの文字にはコントラストが足りないため、明度を落としたこの色を使い分ける。

### Neutral

- **ペーパーホワイト** (#FAF9F5): ページ全体の地。ヘッダーは同色の 95% 不透明 + `backdrop-blur-sm` で重なる。
- **カードホワイト** (#FFFFFF): リンクカードの地。地との 2% 程度の明度差だけで「浮いている面」を作る。
- **インクブラック** (#141413): 本文と見出し。副次的な文字は同色の不透明度 0.85 / 0.7 / 0.6 / 0.5 / 0.4 / 0.3 を段階として使い、灰色の別トークンは作らない。
- **ラインベージュ** (#E0DFDA): 罫線・区切り・無効状態。0.5 / 0.2 / 0.18 の不透明度で、バッジや控えめな面の地としても使う。

### Named Rules

**The Single Hue Rule.** このシステムに存在する色相はオレンジ (hue 15〜23) のみ。新しい意味を色で表現したくなったら、色相を増やすのではなく不透明度・罫線・書体ウェイトで解く。唯一の例外は入力エラーの `#ff6b6b` で、これは「システムの色ではない」ことが警告として機能している。

**The Opacity Ladder Rule.** 文字のグレーは新規トークンを作らず、必ず `hsl(var(--cc-main-black) / X)` の不透明度で段を作る。本文 0.85、副文 0.7、メタ 0.6、補助 0.5、プレースホルダ 0.3。

**The Two Oranges Rule.** UI 要素 (ボタン、見出し、アイコン、罫線) にはクレイオレンジ #DB8163、本文サイズのリンクにはリンクオレンジ #914127。この使い分けは Lighthouse アクセシビリティ 0.9 の維持要件に直結しており、統合してはいけない。

## Typography

**Display / Body Font:** システムスタック (`ui-sans-serif, system-ui, sans-serif`)
**Label/Mono Font:** システム等幅スタック (`ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`)

**Character:** 書体そのものには個性を持たせず、階層をサイズとウェイトの差だけで作る。太さは 400 と 700 の 2 段が基本で、中間の 500 / 600 はナビゲーションの現在地と検索結果リンクにのみ現れる。

### Hierarchy

- **Display** (700, 1.5rem → sm 1.875rem, 1.3): ページ見出し (h1)、およびバージョンカードの `v2.1.4`。バージョン番号はクレイオレンジ + `tabular-nums`。
- **Headline** (700, 1.25rem → sm 1.5rem, 1.4): 記事本文の h2。下に 1px `#E0DFDA` の罫線を持ち、`scroll-mt-20` でアンカー着地位置を確保する。
- **Title** (700, 1.125rem, 1.4): カード内のセクション見出し。罫線を持たない。
- **Body** (400, 0.875rem, 1.625): UI 全般の本文。カード内の説明文、フォームのラベル。
- **Body-long** (400, 0.9375rem → sm 1rem, 1.9): 記事本文 (`.post-prose p`) 専用。UI 本文より行間を大きく取り、長文の読み継ぎを支える。
- **Label** (400, 0.75rem, 1.4): メタ情報、バッジ、日付、件数。バッジの最小段は 0.625rem。
- **Code** (400, 0.9em): インラインコードは `#E0DFDA` 50% の地に 6px 角丸。ブロックは Expressive Code の `github-dark` テーマで、明るい紙面の中で唯一暗い面になる。

### Named Rules

**The Japanese Wrapping Rule.** 見出しには必ず `word-break: auto-phrase` と `text-wrap: balance` を併用する。日本語の見出しが助詞の途中で折り返る状態を許容しない。

**The Tabular Numeral Rule.** バージョン番号・件数・日付など、縦に並べて比較される数字には `tabular-nums` を付ける。一覧の走査速度はこの桁揃えに依存している。

**The No Webfont Rule.** ウェブフォントを追加しない。書体で個性を出したくなった場合はサイズ・ウェイト・字間で解く。

## Layout

コンテンツ幅は用途で 3 段に分かれる。ヘッダーのナビゲーションは `max-w-6xl` (72rem)、一覧系のページはその内側でグリッドを組み、散文中心のページ (このサイトについて、プライバシー等) は `max-w-xl` (36rem) まで絞って 1 カラムにする。読み物の幅を狭く取ることは意図的な判断であり、一覧の幅と揃えてはいけない。

ページの縦リズムは `py-12 sm:py-20` (48px → 80px)、左右は `px-4` 固定。カードの内側は `p-4` / `p-5 sm:p-6` / `p-6 sm:p-8` の 3 段。セクション間は `space-y-8` (32px)、カード内のブロック間は `mt-4` (16px)。

ヘッダーは `sticky top-0` の 48px 固定高。地はペーパーホワイトの 95% 不透明 + `backdrop-blur-sm` で、スクロール中も下のコンテンツが透けて動く。

レスポンシブの分岐は実質 `sm` (640px) と `md` (768px) の 2 点しかない。`md` 未満ではナビゲーションリンクが消えてハンバーガーメニューに畳まれ、`sm` 未満では余白と本文サイズが 1 段小さくなる。3 点以上のブレークポイントを持ち込まない。

**The Reading Width Rule.** 散文が主のページは 36rem を超えない。一覧・グリッドのページは 72rem まで使ってよい。

## Elevation & Depth

静止状態はほぼ完全にフラット。深さは影ではなく、地の明度差 (`#FAF9F5` の上に `#FFFFFF`) と 1px 罫線で表現する。影は「触れたことへの応答」として現れるものであり、静止状態の装飾ではない。

唯一の例外は検索モーダルで、これはページの文脈から切り離された浮遊面であるため、静止状態でも強い影を持つ。この非対称は意図的なもの。

### Shadow Vocabulary

- **rest** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)`): リンクカードの静止状態。ほぼ知覚されない程度で、罫線を補強する役割。
- **hover** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`): カード・リンクカードの hover。罫線のオレンジ化と同時に発生する。
- **modal** (`box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.05)`): 検索モーダル本体のみ。他に転用しない。

### Named Rules

**The Response-Only Shadow Rule.** 影は hover / focus / オーバーレイの 3 状況にのみ現れる。静止した面に影を付けて階層を作らない。階層が足りないと感じたら、罫線か地の明度差で解く。

## Shapes

角丸は `--radius: 0.625rem` (10px) を基点に、Tailwind の計算式で 6 / 8 / 10 / 14px の 4 段を持つ。実際に使われるのは 2 段に集約されている: カードとコンテナは 14px (`rounded-xl`)、ボタン・入力欄・アコーディオンは 10px (`rounded-lg`)。バッジとピル型ボタンは `rounded-full`。

罫線は全て 1px。太い罫線は引用ブロックの左 4px アクセントのみで、これはオレンジ 40% 不透明度。破線は「まだ中身がない」状態 (Card の `dashed` variant) を表す専用の形として予約されている。

**The Two Radii Rule.** 新しい要素の角丸は 14px (面) か 10px (操作対象) のどちらか。中間値やそれ以外の値を導入しない。

## Components

全体を貫く性格は「静止時は控えめ、接触時の応答は明確」。押せるものは例外なく `active:scale-[0.96]` (ボタン) または `active:scale-[0.98]` (カード) で沈み込み、hover では色か罫線のどちらかが必ずオレンジに転ずる。

### Buttons

- **Shape:** 10px の角丸 (`rounded-lg`)。`shape="pill"` で完全な丸型も選べる。
- **Primary:** クレイオレンジの地に白文字。標準サイズは最小高 44px、`px-5 py-2`、0.875rem。
- **Outline:** 透明地 + 1px ラインベージュの罫線、文字はインクブラック 70%。hover で罫線・文字がクレイオレンジになり、地にオレンジ 4% が乗る。
- **Ghost:** 罫線なし、文字はインクブラック 60%。hover で地にオレンジ 8%。
- **Link:** 地も罫線も持たず、クレイオレンジの文字 + hover で下線。
- **Hover / Focus:** 遷移は `background-color, border-color, color, transform` に限定。フォーカスは `outline-2 outline-offset-2` のクレイオレンジ。押下時 `scale(0.96)`。
- **Sizes:** xs / sm / md / lg / icon-sm (32px 正方) / icon (44px 正方)。タップ対象になるものは 44px を下回らない。

### Cards / Containers

- **Corner Style:** 14px (`rounded-xl`)。密度を上げたい場面のみ 10px。
- **Background:** `page` はペーパーホワイト、`muted` はラインベージュ 20%、`accent` はオレンジ 6% + オレンジ 30% の罫線、`dashed` は破線罫線のみ。
- **Shadow Strategy:** 静止時なし。`interactive` を付けた場合のみ hover で罫線がクレイオレンジ化 + `shadow-lg`、押下で `scale(0.98)`。
- **Border:** 常時 1px。罫線を外したカードは作らない。
- **Internal Padding:** 16px / 20px→24px / 24px→32px の 3 段。

### Inputs / Fields

- **Style:** ペーパーホワイトの地、1px ラインベージュの罫線、10px 角丸、`px-4 py-3`。
- **Focus:** 罫線がクレイオレンジに変わり、同色 20% の 2px リングが外側に付く。`outline` は消し、リングで代替する。
- **Error:** `invalid:not-placeholder-shown` のときだけ罫線が `#ff6b6b`。入力前や未接触の状態でエラー表示を出さない。
- **Disabled:** `cursor-not-allowed` + 不透明度 50%。
- **Select:** 入力欄と同じ地・罫線・角丸だが、フォーカスはオレンジ 45% のリングのみで罫線色は変えない。

### Navigation

- ヘッダーは 48px 固定、`sticky` + 半透明 + `backdrop-blur-sm`。左にサイト名 (0.875rem / 700)、右にリンク群と検索ボタン。
- リンクは 0.875rem、8px 角丸。現在地はクレイオレンジの文字 + オレンジ 8% の地 + `font-medium` + `aria-current="page"`。非現在地はインクブラック 70%、hover でオレンジ文字 + オレンジ 6% の地。
- `md` 未満ではリンク群が消え、ハンバーガーメニューに畳まれる。

### Badges

- 4 つの variant: `neutral` (ラインベージュ 50% の地)、`accent` (オレンジ 10% の地にクレイオレンジ文字)、`outline` (罫線のみ)、`prefix` (地を持たず太字大文字)。
- 既定は `rounded-full`、`px-2 py-0.5`、0.75rem。最小段は 0.625rem。

### VersionCard (シグネチャコンポーネント)

一覧の中核。リンクカードの上に、クレイオレンジ 1.5rem 700 の `v2.1.4` (`tabular-nums`)、状態バッジ (削除済み / 更新あり)、変更項目の件数、AI 要約の 2 行クランプを積む。バージョン見出しには `view-transition-name: version-title-{version}` が振られており、詳細ページの見出しへ実際に移動して見せる。一覧と詳細が同じ要素であることを、この遷移が保証している。

カードは `stagger-fade-in` で下から 20px 上がりながら順に現れる。遅延は `sibling-index() * 0.05s` で、非対応ブラウザには JS が `--sibling-index` を補う。

## Do's and Don'ts

### Do:

- **Do** 新しい面の色を決めるとき、`--cc-main-orange` / `--cc-main-white` / `--cc-main-black` / `--cc-gray` の 4 変数と、その不透明度だけで解く。
- **Do** 本文サイズのリンクには `--cc-link-orange` (#914127) を使い、UI 要素には `--cc-main-orange` (#DB8163) を使う。
- **Do** 日本語見出しに `word-break: auto-phrase` と `text-balance` を付ける。
- **Do** 縦に並ぶ数字に `tabular-nums` を付ける。
- **Do** 新しいアニメーションを追加したら、同じ場所に `@media (prefers-reduced-motion: reduce)` の無効化を必ず書く。既存のモーションは全てこの対を持っている。
- **Do** タップ対象の最小寸法を 44px に保つ (`min-h-11` / `w-11 h-11`)。
- **Do** 角丸は 14px (面) か 10px (操作対象) のどちらかにする。
- **Do** 散文が主のページの本文幅を `max-w-xl` (36rem) に収める。

### Don't:

- **Don't** オレンジ以外の色相を導入しない。ステータスや分類を色で分けたくなったら、罫線・不透明度・バッジの variant で解く。
- **Don't** 静止状態のカードや面に影を付けない。影は hover / focus / モーダルの応答としてのみ存在する。
- **Don't** ウェブフォントを読み込まない。
- **Don't** `bg-card` / `text-muted-foreground` などの oklch トークン群 (`--background`, `--primary`, `--muted` …) を新規コードで使わない。これは shadcn 由来の第 2 のカラーシステムが `--cc-*` と併存している状態で、`bg-card` が純白 #FFFFFF を返すのはリンクカードの浮きとして機能しているが偶然の一致に近い。新しい要素は `--cc-*` 側で書く。
- **Don't** ブレークポイントを `sm` (640px) と `md` (768px) 以外に増やさない。
- **Don't** グレーの新規トークンを作らない。インクブラックの不透明度段で表現する。
- **Don't** 記事本文の行間 (1.9) を UI 本文 (1.625) に持ち込まない。逆も同様。
- **Don't** 公式サイトと見紛う体裁にしない。このサイトは非公式であり、AI 生成コンテンツを含むことを表示から外さない。
