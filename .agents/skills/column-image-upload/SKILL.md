---
name: column-image-upload
description: コラム記事(`apps/www/src/content/posts/column/`)に相対パスで貼られたローカル画像を R2 バケット `weekly-assets` にアップロードし、記事内の参照を `https://assets.claude-code-log.com/` を指す `<img>` に書き換えて、ローカルの画像ファイルを削除する。`/column-image-upload` の実行時、または「コラムの画像を R2 に上げて」「記事の画像を公開 URL に差し替えて」「画像を貼ったコラムを公開できる状態にして」等の依頼時に使う。週次アップデート記事(`apps/changelog-fetcher/posts/weekly/`)の画像は管理画面からアップロード済みなので対象外。`public/` 配下の静的画像・OGP 画像の差し替えや、記事の執筆・推敲そのものにも使わない。macOS 専用(`sips` に依存する)。
argument-hint: "[記事のパス | slug]"
---

# コラム記事の本文画像を R2 にアップロードする

執筆中はローカルの画像ファイルを相対パスで貼り、公開前にこのスキルで R2 へ移す。

Astro は Markdown 内の相対パス画像をビルド時に最適化しようとするため、貼ったままだと `pnpm run build` が Sharp 不足で失敗する。書き換えて初めてビルドが通る。

**アップロードを全件終えてから記事を書き換える。** 1枚ずつ書き換えると途中で失敗したときに記事が壊れる。手順4と手順5を混ぜない。

## 手順

### 1. 対象記事を確定する

`$ARGUMENTS` を確認して記事の `.md` パスを1つに確定する。

- `.md` パスが渡された → それを使う
- slug が渡された → `apps/www/src/content/posts/column/` 配下から frontmatter の `slug` が一致する記事を探す
- 空 → `apps/www/src/content/posts/column/*.md` を Grep して `![...](...)` のローカル画像参照を含む記事を探す。1件ならそれを使い、複数あればどれを対象にするかユーザーに確認して止まる

R2 のキーには**ファイル名ではなく frontmatter の `slug`** が入る(記事の URL がそれで決まるため)。

### 2. ローカル画像を検出する

```bash
mkdir -p .tmp
python3 <skill_dir>/scripts/scan.py <記事パス> > .tmp/column-images.json
```

記事内の `![alt](パス)` を走査し、ローカル画像だけをマニフェストに書き出す。`http(s)://` 始まり(アップロード済み)と `/` 始まり(`public/` 配下)は除外されるので、**書き足して再実行しても既存の画像は再アップロードされない**。

マジックバイトで PNG / JPEG / WebP を判定し、`sips` で寸法を取り、R2 キーと公開 URL をここで確定する。

`images` が空だった場合は、書き換える画像がないことをユーザーに伝えて終了する。以降の手順は実行しない。

### 3. alt を埋める

マニフェストの各 `file` を Read して画像を見て、`alt` が空の項目を Edit で埋める。**編集してよいのは `alt` だけ**で、`key` / `url` / `start` / `end` / `width` / `height` には触らない(手順5の位置照合と CLS 対策がここで確定している)。

- 画像に何が写っているかを日本語で書く。スクリーンショットなら、どの画面のどの状態かが伝わるようにする
- 本文で既に説明されている内容をそのまま繰り返さない
- 「画像」「スクリーンショット」「〜の図」で始めない(スクリーンリーダーが二重に読み上げる)
- 20〜60字を目安にする
- 執筆者が `![...]` に既に alt を書いていた場合は、その意図を尊重してそのまま残す

### 4. R2 にアップロードする

```bash
python3 <skill_dir>/scripts/upload.py .tmp/column-images.json
```

バケット `weekly-assets` に全件アップロードする。1件でも失敗した時点で止まり、記事は無傷のまま残る。**失敗したら手順5に進まない。**

### 5. 記事を書き換えてローカル画像を削除する

```bash
python3 <skill_dir>/scripts/rewrite.py .tmp/column-images.json
```

Markdown 記法を `<img>` に置き換え、書き換えが終わってからローカルの画像ファイルを削除する。`alt` が空の項目が残っていると、書き換えずにエラーで止まる。

### 6. 検証する

```bash
pnpm run ai-check
pnpm run build
```

`pnpm run build` は相対パス画像が残っていると失敗するため、書き換えの取りこぼしを検出できる。

## 出力される `<img>` の形

`apps/changelog-fetcher/posts/weekly/2026-w30.md` の記法に `width` / `height` を足したもの。属性の順序も含めてこの形になる。

```html
<img
	alt="設定画面の通知トグルが有効になっている状態"
	src="https://assets.claude-code-log.com/column/sample-article/01-20260731-004512.png"
	width="1262"
	height="932"
/>
```

`.post-prose img` が `max-w-full h-auto` を当てるので、`width` / `height` は実寸のままでよい。ブラウザはこの2つからアスペクト比を計算して読み込み前に領域を確保する(CLS 対策)。

## マニフェストの形

`scan.py` が書き出す `.tmp/column-images.json`。手順3で埋めるのは `alt` だけ。

```json
{
	"article": "apps/www/src/content/posts/column/sample-article.md",
	"slug": "sample-article",
	"images": [
		{
			"seq": "01",
			"markdown": "![](image.png)",
			"start": 1234,
			"end": 1248,
			"file": "apps/www/src/content/posts/column/image.png",
			"alt": "",
			"key": "column/sample-article/01-20260731-004512.png",
			"url": "https://assets.claude-code-log.com/column/sample-article/01-20260731-004512.png",
			"content_type": "image/png",
			"width": 1262,
			"height": 932
		}
	]
}
```

連番は今回アップロードする画像だけを出現順に採番する(再実行時はまた `01` から始まる)。同じキーの衝突はタイムスタンプが防ぐ。

## エラーハンドリング

- **`scan.py` が「画像が見つからない」で止まる** → 記事に書かれた相対パスが記事ファイルからの相対で解決できていない。記事側のパスを直してから再実行する。
- **`scan.py` が「PNG・JPEG・WebP のいずれでもない」で止まる** → 拡張子ではなく中身で弾いている。対応形式に変換してよいかユーザーに確認する。勝手に変換しない。
- **`scan.py` が「frontmatter に slug がない」で止まる** → `apps/www/src/content.config.ts` の `column` コレクションは `slug` を必須にしている。記事側に追加する。
- **`upload.py` が認証エラーで止まる** → `pnpm --filter changelog-viewer-worker exec wrangler login` をユーザーに実行してもらう。このスキルからは実行しない。
- **`upload.py` が途中で止まる** → 記事は書き換わっていないので、原因を解消して `upload.py` から再実行する。先にアップロード済みだったオブジェクトは R2 に残るが、再実行では別のタイムスタンプのキーになるため衝突しない(記事から参照されない孤児が残るだけ)。孤児を消す必要があれば `wrangler r2 object delete weekly-assets/<キー> --remote` をユーザーに提案する。
- **`rewrite.py` が「記事が scan.py 実行後に変更されている」で止まる** → 手順2以降で記事を編集した。手順2からやり直す。アップロード済みのオブジェクトは孤児になる。
- **アップロードしたはずのオブジェクトが公開 URL で見えない** → `wrangler r2 object put` は `--remote` がないとローカルの miniflare ストレージに書き込む。`upload.py` は付けているが、手動で叩き直すときは付け忘れない。
