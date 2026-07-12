---
name: weekly-post
description: Claude Code 週次アップデート記事を、管理画面で選定・コメント済みの changelog JSON から生成する。`/weekly-post {json}` の実行時、または「週次記事を作って」「今週のアップデート記事を書いて」「選定した changelog を記事にして」等の依頼時に必ず使う。汎用のブログ執筆スキルとは別物で、専用の抽出スクリプトと文体ルールを使う。
---

# 週次アップデート記事の生成

管理画面で選定・コメントされた changelog アイテムの JSON を入力に、Claude Code ユーザー向けの週次アップデート記事を生成し、`apps/changelog-fetcher/posts/weekly/{week}.md` に書き出す。

読者は Claude Code を業務で日常使いしている開発者で、価値は「自分のワークフローがどう変わるか」を筆者の体験ベースで受け取れること。単なる changelog の翻訳貼り付けには価値がない。人間の選定眼とコメントを核に据える。

## 入力

引数として次の形の JSON を受け取る。

```json
{"week":"2026-w28","period_start":"2026-07-06","period_end":"2026-07-12","items":[{"id":"ea64434ed3ad","version":"2.1.205","comment":"8階層になったことある"}]}
```

## 手順

### 1. 入力 JSON を一時ファイルに保存

受け取った JSON をそのまま一時ファイル(例 `/tmp/weekly-input.json`)に書く。

### 2. 抽出スクリプトで素材を取得

```bash
python3 <skill_dir>/scripts/extract.py /tmp/weekly-input.json > /tmp/extracted.json
```

`inferred_v{version}.json` は1件30KB超になることがあり、丸ごと読むとトークンを浪費する。このスクリプトは選定された `id` に該当する item だけを取り出し、`content_ja` / `inference`(before/after/benefit) / `comment` / `prefix` / `has_snippets` と、frontmatter 用の `version_min` / `version_max` / `versions`(全件) を返す。出力 JSON は次の手順で skeleton.py にそのまま渡す。**inferred JSON を直接 Read してはいけない。** 必ずこのスクリプト経由で取得する。

id 不一致や version ファイル欠落があればスクリプトがエラーで止まる。その場合は入力 JSON を確認する。

### 3. skeleton を書き出す

```bash
python3 <skill_dir>/scripts/skeleton.py /tmp/extracted.json
```

extract.py の出力 JSON を渡すと、`apps/changelog-fetcher/posts/weekly/{week}.md` に frontmatter・冒頭の定型文(`{期間}の変更で、個人的に気になったものをピックアップしました。`)・各見出し(`## {content_ja}`)・プレースホルダ(`<!-- intro -->` と item ごとの `<!-- body -->`)を書き出す。**見出し = content_ja はここで byte 単位で確定する。以降 LLM は content_ja を一度もタイプしない**(更新履歴カードと1文字も違わないことをこれで保証する)。

### 4. 必要な item だけ snippets を追加取得

`inference` が薄い、またはコメントが仕様の技術的な詳細を求めていて inference と content_ja だけでは本文が書けない item に限り、次を実行する(`has_snippets` が true の item のみ意味がある)。

```bash
python3 <skill_dir>/scripts/snippets.py <version> <id>
```

`analysis_v{version}.json` も大きいので、全件取得はしない。書けない item に絞って呼ぶ。

### 5. プレースホルダを埋める

skeleton の `<!-- intro -->` と各 `<!-- body -->` だけを Edit で置き換える。frontmatter と見出しには一切触れない(見出しはスクリプトが確定済み)。

- `<!-- intro -->` → 冒頭の定型文の直後に続く一言。コメント群から週全体の温度感を1〜2文(定型文とは別に書く。日付や「ピックアップしました」の言い換えはしない)。
- 各 `<!-- body -->` → 直前の見出しの本文。体験ベースの散文 2〜3文、約100字。

文体・トーンは `<skill_dir>/references/` の各ファイルに従う。埋める前に読むこと。

- `<skill_dir>/references/voice-and-tone.md` — 話し言葉・一人称・問いかけ・避けるべき表現(体言止め・倒置法・内輪のジャーゴンや安易な比喩など)
- `<skill_dir>/references/writing-guidelines.md` — 構成・読点とリズム・事実と意見の区別
- `<skill_dir>/references/attention-writing.md` — 次の1行を読ませる文の作り方

**本文は体験・意見に特化する。** 見出し(content_ja)が事実を担うので、本文で事実を言い換えて繰り返してはいけない。最優先の素材は選定時のコメントで、選定者が実際に使って感じた温度を地の文に反映する。inference の before→after→benefit はコメントの体験を裏付ける補助として使い、changelog の翻訳をそのまま貼るだけにはしない。

### 6. 埋めた本文を読み返して直す

書いた直後は「それっぽく」書けたつもりでも、体言止め・倒置法・内輪のジャーゴンや安易な比喩が紛れやすい。read → write で終わらせず、埋めた intro と各 body を `<skill_dir>/references/voice-and-tone.md` の「避けるべき表現」に一度照らして読み返す。特に、選定者本人の具体的な体験ではなく、誰が書いても同じになる汎用的な「テックブログ声」になっている文を探し、コメントにある具体へ戻すか削る。ここまでやって手順は完了する(推敲の促しや公開はしない。後続の人手または GitHub Actions が担う)。

## skeleton とプレースホルダ規約

skeleton.py が書き出す `.md` は次の形になる。LLM が触ってよいのは `<!-- intro -->` と `<!-- body -->` の2種類のプレースホルダだけ。

```markdown
---
title: "Claude Code 週次アップデート (v{version_min}–v{version_max})"
date: "{period_end}"
period_start: "{period_start}"
period_end: "{period_end}"
versions:
  - {version}
  - ...
---

{period_start}~{period_end}の変更で、個人的に気になったものをピックアップしました。

<!-- intro -->

## {content_ja そのまま}

<!-- body -->

## {次の item の content_ja そのまま}

<!-- body -->
```

- frontmatter・冒頭の定型文・見出しはスクリプトが確定済み。**Edit で書き換えない**(content_ja verbatim と versions 全件、定型文の期間表記がここで保証されている)。
- 各 `<!-- body -->` は直前の見出しに対応する。プレースホルダの位置・個数は変えない。
- item 順・アイテム数はスクリプト側で決まる。LLM は増減しない。

## 本文(body)の例

入力: `content_ja` = 「セッションのトランスクリプトファイルを改ざんから保護する auto mode のルールを追加」(→ 見出しに verbatim で入る)、コメント =「auto mode で勝手にログ消されて焦ったことある」、inference の before/after/benefit あり。

`<!-- body -->` を次の散文で置き換える。事実(何が追加されたか)は見出しが担うので繰り返さず、体験だけを書く。

```markdown
auto mode に任せて席を外している間、履歴が勝手に書き換わっていないか毎回ヒヤヒヤしていました。明示的なルールが入って、任せきりでも記録を信頼できるようになったのは地味に効きます。
```
