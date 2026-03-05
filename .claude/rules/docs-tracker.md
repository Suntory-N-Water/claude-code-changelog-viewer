---
paths:
  - "apps/docs-tracker/**"
---

# apps/docs-tracker - ドキュメント取得

Claude Code の公式ドキュメントを自動取得し変更を追跡する。

- llms.txt と docs_map.md からURL一覧を取得・マージ
- Markdown を直接取得して `docs/en/` に保存
- 3時間おきに GitHub Actions で定期実行
- 取得状況: `metadata/last_update.json`（自動生成、手動編集禁止）
