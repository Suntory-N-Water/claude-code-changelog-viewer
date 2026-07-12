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
python3 <skill_dir>/scripts/extract.py /tmp/weekly-input.json
```

`inferred_v{version}.json` は1件30KB超になることがあり、丸ごと読むとトークンを浪費する。このスクリプトは選定された `id` に該当する item だけを取り出し、`content_ja` / `inference`(before/after/benefit) / `comment` / `prefix` / `has_snippets` と、タイトル用の `version_min` / `version_max` を返す。**inferred JSON を直接 Read してはいけない。** 必ずこのスクリプト経由で取得する。

id 不一致や version ファイル欠落があればスクリプトがエラーで止まる。その場合は入力 JSON を確認する。

### 3. 必要な item だけ snippets を追加取得

`inference` が薄い、またはコメントが仕様の技術的な詳細を求めていて inference と content_ja だけでは本文が書けない item に限り、次を実行する(`has_snippets` が true の item のみ意味がある)。

```bash
python3 <skill_dir>/scripts/snippets.py <version> <id>
```

`analysis_v{version}.json` も大きいので、全件取得はしない。書けない item に絞って呼ぶ。

### 4. 記事を生成

文体・トーンは `references/` の各ファイルに従う。まず読むこと。

- `references/voice-and-tone.md` — 話し言葉・一人称・問いかけ・避けるべき表現(体言止め・倒置法など)
- `references/writing-guidelines.md` — 構成・見出し・読点とリズム・事実と意見の区別
- `references/attention-writing.md` — 次の1行を読ませる文の作り方

これらは長文ブログ向けの規範なので、週次記事の短い単位(見出し + 約100字)に当てはめて使う。inference の before→after→benefit を、ユーザーのコメントの体験と合わせて体験ベースの本文に変換する。コメントは最優先の素材として扱い、選定者が実際に使って感じた温度を地の文に反映する。changelog の翻訳をそのまま貼るだけにはしない。

### 5. ファイルに書き出す

`apps/changelog-fetcher/posts/weekly/{week}.md` に、下記フォーマットで書き出す。ここで手順は完了する(推敲の促しや公開はしない。後続の人手または GitHub Actions が担う)。

## 出力フォーマット

```markdown
---
title: "Claude Code 週次アップデート (v{version_min}–v{version_max})"
date: {period_end}
period_start: {period_start}
period_end: {period_end}
versions:
  - {version_min}
  - {version_max}
---

（冒頭ひとこと — コメント群から全体感を1〜2文）

## （何が変わったかを述語で言い切る見出し）

（体験ベースの本文 2〜3文、約100字）

## （次のアイテムの見出し）

（本文）
```

- `title` は `Claude Code 週次アップデート (v{version_min}–v{version_max})` で固定。バージョンが1つなら片方だけでよい。
- `date` は `period_end` を使う。
- `versions` は `version_min` と `version_max` を並べる(同一なら1つ)。
- セクションは入力 item の順で並べる。アイテム数に制限はない。
- frontmatter の区切りは全角ダッシュではなく半角の en dash `–` を使う(タイトル内)。

## セクション本文の例

入力: `content_ja` = 「セッションのトランスクリプトファイルを改ざんから保護する auto mode のルールを追加」、コメント =「auto mode で勝手にログ消されて焦ったことある」、inference の before/after/benefit あり。

```markdown
## auto mode がトランスクリプトの改ざんを防ぐようになった

auto mode に作業を任せている間、セッションのトランスクリプトが保護対象になりました。以前はエージェントの操作次第で履歴が書き換わる余地がありましたが、明示的なルールが入って履歴の整合性が守られます。任せきりで席を外しても記録が信頼できるのは地味に効きます。
```
