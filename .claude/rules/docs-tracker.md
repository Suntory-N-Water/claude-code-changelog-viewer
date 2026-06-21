---
paths:
  - "apps/docs-tracker/**"
---

# apps/docs-tracker - ドキュメント取得

Claude Code の公式ドキュメントと外部ソースを自動取得し、変更追跡または蓄積を行う。

- llms.txt と docs_map.md からURL一覧を取得・マージ
- Markdown を直接取得して `docs/en/` に保存
- Claude / Anthropic blog と YouTube transcript を `sources/` に積み上げ保存
- docs は「同期モデル」(URL消失時にローカル削除)、blog / youtube は「積み上げモデル」(URL消失時もローカル保持)
- 3時間おきに GitHub Actions で定期実行
- 取得状況: `metadata/last_update.json`(自動生成、手動編集禁止)
