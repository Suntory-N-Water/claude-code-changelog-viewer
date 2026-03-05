---
paths:
  - "apps/changelog-fetcher/**"
---

# apps/changelog-fetcher - CHANGELOG パーサー

CHANGELOG.md をパースして JSON 化し、Gemini API で翻訳・推論を実行。

## 処理フロー

CHANGELOG 取得 → 解析 → AI 推論

- `changelogs/` - 取得した CHANGELOG（自動生成、手動編集禁止）
- `analysis/` - 解析結果（自動生成、手動編集禁止）
- `inferred/` - 推論結果（自動生成、手動編集禁止）
- `metadata/last_fetch.json` - 取得状況（自動生成、手動編集禁止）

## コマンド

- `bun run fetch` - CHANGELOG 取得
- `bun run analyze v2.1.25` - 解析実行
- `bun run infer v2.1.25` - AI 推論 (Gemini)

## 解析・推論

- 解析: キーワード抽出 → grep 検索 → スニペット取得 → スコアリング・上位3件
- 推論: related_docs >= 2件なら翻訳+Before/After/Benefit、< 2件なら翻訳のみ
