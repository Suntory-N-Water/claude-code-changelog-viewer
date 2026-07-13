---
name: weekly-post
description: Claude Code 週次アップデート記事を、管理画面で選定・コメント済みの changelog JSON から生成する。`/weekly-post {json}` の実行時、または「週次記事を作って」「今週のアップデート記事を書いて」「選定した changelog を記事にして」等の依頼時に使う。専用の抽出スクリプトと文体ルールに依存するため、選定 JSON を伴わない自由記述のブログや、個別 changelog の単純翻訳だけを求められた場合には使わない。
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

`inferred_v{version}.json` は1件30KB超になることがあり、丸ごと読むとトークンを浪費する。このスクリプトは選定された `id` に該当する item だけを取り出し、`content`(英語原文) / `content_ja` / `inference`(before/after/benefit) / `comment` / `prefix` / `has_snippets` と、frontmatter 用の `version_min` / `version_max` / `versions`(全件) を返す。`has_snippets` は `analysis_v{version}.json` 側の `related_docs[].snippets` を見て判定する(inferred JSON の `related_docs` には `file` しかなく `snippets` は含まれない)。`content_ja` や `inference` の記載内容に疑問が生じたら、まず出力済みの `content`(英語原文)で裏取りする。出力 JSON は次の手順で skeleton.py にそのまま渡す。**inferred JSON を直接 Read してはいけない。** 必ずこのスクリプト経由で取得する。

id 不一致や version ファイル欠落があればスクリプトがエラーで止まる。その場合は入力 JSON を確認する。

### 3. skeleton を書き出す

```bash
python3 <skill_dir>/scripts/skeleton.py /tmp/extracted.json
```

extract.py の出力 JSON を渡すと、`apps/changelog-fetcher/posts/weekly/{week}.md` に frontmatter・冒頭の定型文(`{期間}の変更で、個人的に気になったものをピックアップしました。`)・バージョン見出し(`## v{version}`)・変更内容の見出し(`### {content_ja}`)・プレースホルダ(`<!-- intro -->` と item ごとの `<!-- body -->`)を書き出す。items は古い→新しいバージョンの昇順で並び、同一バージョンの複数項目は1つの `## v{version}` 下にまとまる。**`### 見出し = content_ja` はここで byte 単位で確定する。以降 content_ja は一切タイプしない**(更新履歴カードと1文字も違わないことをこれで保証する)。

### 4. 必要な item だけ snippets を追加取得

`inference` が薄い、またはコメントが仕様の技術的な詳細を求めていて inference と content_ja だけでは本文が書けない item に限り、次を実行する(`has_snippets` が true の item のみ意味がある)。

```bash
python3 <skill_dir>/scripts/snippets.py <version> <id>
```

`analysis_v{version}.json` も大きいので、全件取得はしない。書けない item に絞って呼ぶ。

### 5. プレースホルダを埋める

skeleton の `<!-- intro -->` と各 `<!-- body -->` だけを Edit で置き換える。frontmatter とバージョン見出し・変更内容の見出しには一切触れない(見出しはスクリプトが確定済み)。

- `<!-- intro -->` → 冒頭の定型文の直後に続く一言。**大量の changelog から自分が拾った数件についての印象を1〜2文**(定型文とは別に書く。日付や「ピックアップしました」の言い換えはしない)。**その週の changelog 全体を要約・代表してはいけない**。「今週は〜な変更が目立った」のように書くと、拾った数件がその週の全変更であるかのように誤読される。あくまで自分が拾った範囲の話だと分かる書き方にする。
- 各 `<!-- body -->` → 直前の `### 見出し`(content_ja)の本文。体験ベースの散文 2〜3文、約100字。

文体・トーンは `<skill_dir>/references/` の各ファイルに従う。埋める前に読むこと。

- `<skill_dir>/references/voice-and-tone.md` — 話し言葉・一人称・問いかけ・避けるべき表現(体言止め・倒置法・内輪のジャーゴンや安易な比喩など)
- `<skill_dir>/references/writing-guidelines.md` — 構成・読点とリズム・事実と意見の区別
- `<skill_dir>/references/attention-writing.md` — 次の1行を読ませる文の作り方

**本文は体験・意見に特化する。** 見出し(content_ja)が事実を担うので、本文で事実を言い換えて繰り返してはいけない。最優先の素材は選定時のコメントで、選定者が実際に使って感じた温度を地の文に反映する。inference の before→after→benefit はコメントの体験を裏付ける補助として使い、changelog の翻訳をそのまま貼るだけにはしない。

### 6. 埋めた本文を読み返して直す

書いた直後は「それっぽく」書けたつもりでも、体言止め・倒置法・内輪のジャーゴンや安易な比喩が紛れやすい。read → write で終わらせず、埋めた intro と各 body を `<skill_dir>/references/voice-and-tone.md` の「避けるべき表現」に一度照らして読み返す。特に、選定者本人の具体的な体験ではなく、誰が書いても同じになる汎用的な「テックブログ声」になっている文を探し、コメントにある具体へ戻すか削る。

本文にコマンド名・フラグ・スラッシュコマンド・製品名・モデル名などの固有名詞を書いたら、入力コメントや content_ja のカタカナ表記を鵜呑みにせず正式名称に直す(例: 「レジューム」→ `--resume`)。確認はローカルの公式ドキュメントで足りる。見当たらなければそのまま残し、Web を延々と探し回らない。

ここまでやって手順は完了する(推敲の促しや公開はしない。後続の人手または GitHub Actions が担う)。

## skeleton とプレースホルダ規約

skeleton.py が書き出す `.md` は次の形になる。編集してよいのは `<!-- intro -->` と `<!-- body -->` の2種類のプレースホルダだけ。

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

## v{古いバージョン}

### {content_ja そのまま}

<!-- body -->

## v{次のバージョン}

### {content_ja そのまま}

<!-- body -->

### {同一バージョンの次の item の content_ja そのまま}

<!-- body -->
```

- frontmatter・冒頭の定型文・バージョン見出し(`## v{version}`)・変更内容の見出し(`### {content_ja}`)はスクリプトが確定済み。**Edit で書き換えない**(content_ja verbatim と versions 全件、定型文の期間表記がここで保証されている)。
- バージョンは古い→新しいの昇順で `## v{version}` セクションになり、同一バージョンの複数項目はその下に `### {content_ja}` として並ぶ。
- 各 `<!-- body -->` は直前の `### 見出し` に対応する。プレースホルダの位置・個数は変えない。
- item 順・アイテム数・バージョンの区切りはスクリプト側で決まる。増減しない。

## 本文(body)の例

入力: `content_ja` = 「セッションのトランスクリプトファイルを改ざんから保護する auto mode のルールを追加」(→ `### 見出し`に verbatim で入る)、コメント =「auto mode で勝手にログ消されて焦ったことある」、inference の before/after/benefit あり。

`<!-- body -->` を次の散文で置き換える。事実(何が追加されたか)は見出しが担うので繰り返さず、体験だけを書く。

```markdown
auto mode に任せて席を外している間、履歴が勝手に書き換わっていないか毎回ヒヤヒヤしていました。明示的なルールが入って、任せきりでも記録を信頼できるようになったのは地味に効きます。
```
