# 正データストアを git 管理の JSON から D1 に移す

これまでは git 上の JSON ファイルが正データで、D1 はその複製だった。
生成パイプラインを GitHub Actions から Cloudflare(Workers / Workflows)へ移すため、今後は D1 を正データストアとする。
機械が生成するデータは D1 に置き、人が推敲するコンテンツ(週次記事とコラム)は git に置く。

## Considered Options

#772(2026-08-01)では「生成データを git から移す必要はない」と結論していた。
当時はパイプラインが GitHub Actions ランナー上で動いており、ファイルシステムを前提にできた。
実行基盤ごと Cloudflare に移すとこの前提が消え、git 上の JSON には D1 への同期の手間だけが残る。
そのため判断を覆した。

## Consequences

- Astro は Content Loader API を使い、ビルド時に D1 からデータを取得する。SSG(`output: 'static'`)は維持する。
- 切り替えは一括で行う。既存 JSON の削除は、D1 経由の生成が正しく動くことを確認してから、切り替えとは別のコミットで行う。
