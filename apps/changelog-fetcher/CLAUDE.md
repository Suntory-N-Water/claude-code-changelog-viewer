# Changelog Fetcher

Claude Code の CHANGELOG を取得・解析し、AI 推論用データを生成。

## 処理フロー

```
CHANGELOG 取得 → 解析 → AI 推論
     ↓             ↓         ↓
changelogs/   analysis/  inferred/
```

## コマンド

```bash
pnpm run fetch              # CHANGELOG 取得
pnpm run analyze v2.1.25    # 解析実行
pnpm run infer v2.1.25      # AI 推論 (Gemini)
```

## Prefix 分類ロジック (`parsers/changelog-parser.ts`)

正規表現でコンテンツ全体を解析し、変更タイプを推論:

- `"Fixed ..."` → `Fixed`
- `"Added ..."`, `"New ..."`, `"can now ..."` → `Added`
- `"Breaking ..."` → `Breaking`
- その他 → `Changed` (デフォルト)

重要度スコア: `Breaking: 9, Added: 8, Deprecated: 7, Changed/Improved/Updated: 6, Removed: 5, Fixed: 4`

## 解析処理 (`analyze-changelog.ts`)

1. キーワード抽出
2. ドキュメント grep 検索
3. スニペット取得
4. スコアリング・上位3件選定

## AI 推論 (`infer-benefits.ts`)

- `related_docs >= 2件`: 翻訳 + Before/After/Benefit 推論
- `related_docs < 2件`: 翻訳のみ