---
name: analyze-changelog
description: Claude Code の CHANGELOG エントリーを解析し、キーワード抽出、grep による関連ドキュメント検索、ユーザー恩恵の推論準備を行う。changelog 項目の解析メタデータ生成時に使用。
allowed-tools: Read, Grep, Bash, Write
---

# CHANGELOG 解析スキル

Claude Code の CHANGELOG から特定バージョンの項目を解析し、キーワード抽出・関連ドキュメント検索・メタデータ生成を行う。

## ワークフロー

進捗チェックリスト:

```
解析進捗:
- [ ] Step 1: CHANGELOG ファイルを読み込み
- [ ] Step 2: changelog 項目をパース
- [ ] Step 3: 各項目からキーワード抽出
- [ ] Step 4: grep で関連ドキュメント検索
- [ ] Step 5: 検索結果をスコアリング・ランク付け
- [ ] Step 6: 解析メタデータを JSON 出力
```

## Step 1: CHANGELOG ファイルを読み込み

対象の changelog ファイルを読み込む:
```bash
cat apps/changelog-fetcher/changelogs/v${VERSION}.md
```

## Step 2: changelog 項目をパース

個別の changelog 項目を抽出する。各項目の特徴:
- ダッシュ (`-`) で始まる
- タグプレフィックス(`[SDK]`, `[VSCode]`, `[Windows]` など)を持つ場合がある
- 動詞で始まる: `Added`, `Fixed`, `Changed`, `Improved`, `Updated`, `Removed`

**項目の例**:
```
- Added env var `CLAUDE_CODE_ENABLE_TASKS`, set to `false` to keep the old system temporarily
- [SDK] Added replay of `queued_command` attachment messages
- Fixed crashes on processors without AVX instruction support
```

## Step 3: 各項目からキーワード抽出

各 changelog 項目から、以下の優先順位でキーワードを抽出:

### 優先度1: バッククォートで囲まれた文字列(最優先)
バッククォート内のテキストを全て抽出:
- `` `CLAUDE_CODE_ENABLE_TASKS` `` → `CLAUDE_CODE_ENABLE_TASKS`
- `` `$ARGUMENTS[0]` `` → `$ARGUMENTS[0]` と正規化版 `ARGUMENTS` の両方
- `` `/rename` `` → `/rename` と正規化版 `rename` の両方

### 優先度2: タグ
タグの内容を抽出:
- `[SDK]` → `SDK`
- `[VSCode]` → `VSCode`
- `[Windows]` → `Windows`

### 優先度3: 技術用語
ドメイン固有の用語(2語以上の連続大文字単語、または技術的な略語):
- `AVX`(CPU 命令セット)
- `EIO`(エラーコード)
- `SIGKILL`(シグナル)

**除外ワード**(ブラックリスト):
- 動詞: `Added`, `Fixed`, `Changed`, `Improved`, `Updated`, `Removed`
- 汎用名詞: `bug`, `issue`, `error`, `feature`, `performance`, `overall`, `system`
- 冠詞・接続詞: `the`, `and`, `or`, `with`, `for`, `to`, `in`, `on`

**Step 3 の出力形式**:
```json
{
  "keywords": ["CLAUDE_CODE_ENABLE_TASKS", "false"],
  "normalized_keywords": ["CLAUDE_CODE_ENABLE_TASKS", "false"],
  "tags": []
}
```

## Step 4: grep で関連ドキュメント検索

### 検索戦略: フォールバック方式

成功するまで以下の順序で検索を実行:

#### 戦略1: バッククォート完全一致検索
```bash
grep -l -F '`keyword`' apps/docs-tracker/docs/en/*.md
```

0件なら戦略2へ。

#### 戦略2: 正規化キーワード検索(記号除去)
```bash
grep -l -iE 'keyword' apps/docs-tracker/docs/en/*.md
```

0件または50件超なら戦略3へ。

#### 戦略3: 複数キーワードOR検索
```bash
grep -l -iE '(keyword1|keyword2|keyword3)' apps/docs-tracker/docs/en/*.md
```

それでも0件なら「関連ドキュメントなし」とマーク。

### タグ別の特別処理

**`[SDK]` または `[API]` タグ付き項目**:
- grep 検索をスキップ(SDK専用、一般ドキュメントに存在しない)
- パイプラインを `developer` にマーク
- 恩恵推論: 簡易的な技術説明のみ

**`[VSCode]`, `[IDE]`, `[Cursor]` タグ付き項目**:
- 標準 grep 検索を実行
- パイプラインを `extension` にマーク
- 恩恵推論: 詳細な Before/After 分析

**タグなし**:
- 標準 grep 検索を実行
- パイプラインを `general` にマーク
- 恩恵推論: 完全な多段階推論

## Step 5: 検索結果をスコアリング・ランク付け

grep でマッチした各ファイルについて:

### ヒット数をカウント
```bash
grep -c -iE '(keyword1|keyword2)' apps/docs-tracker/docs/en/matched-file.md
```

### コンテキストスニペットを抽出(前後3行)
```bash
grep -iE '(keyword1|keyword2)' -B 3 -A 3 apps/docs-tracker/docs/en/matched-file.md
```

### コンテキストスコアを計算
各スニペットについて、以下の基準でスコア付け:
- 見出しを含む(`##` または `###`): +5点
- コードブロックを含む(` ``` `): +3点
- 解説キーワードを含む(`how to`, `example`, `usage`, `説明`, `使い方`): +2点
- 基本スコア: +1点

**総合スコア** = `ヒット数 × コンテキストスコア`

### 上位2-3ファイルを選択
- 総合スコア降順でソート
- 上位2-3ファイルのみ選択
- `changelog.md` のみマッチした場合 → 「新機能、ドキュメント整備待ち」とマーク

**Step 5 の出力形式**:
```json
{
  "related_docs": [
    {
      "file": "apps/docs-tracker/docs/en/skills.md",
      "hit_count": 9,
      "context_score": 15,
      "total_score": 135,
      "snippets": ["...", "..."]
    }
  ]
}
```

## Step 6: 解析メタデータを JSON 出力

JSON ファイルを生成: `apps/changelog-fetcher/metadata/analysis_v${VERSION}.json`

**完全な出力構造**:
```json
{
  "version": "2.1.19",
  "analyzed_at": "2026-01-25T12:00:00Z",
  "items": [
    {
      "content": "Added env var `CLAUDE_CODE_ENABLE_TASKS`, set to `false` to keep the old system temporarily",
      "prefix": "Added",
      "importance_score": 8,
      "tags": [],
      "pipeline": "general",
      "keywords": {
        "original": ["CLAUDE_CODE_ENABLE_TASKS", "false"],
        "normalized": ["CLAUDE_CODE_ENABLE_TASKS", "false"]
      },
      "search_strategy": "normalized",
      "related_docs": [
        {
          "file": "apps/docs-tracker/docs/en/changelog.md",
          "hit_count": 1,
          "context_score": 1,
          "total_score": 1
        }
      ],
      "analysis_status": "docs_pending"
    },
    {
      "content": "Added shorthand `$0`, `$1`, etc. for accessing individual arguments in custom commands",
      "prefix": "Added",
      "importance_score": 8,
      "tags": [],
      "pipeline": "general",
      "keywords": {
        "original": ["$0", "$1", "$ARGUMENTS"],
        "normalized": ["0", "1", "ARGUMENTS"]
      },
      "search_strategy": "exact",
      "related_docs": [
        {
          "file": "apps/docs-tracker/docs/en/skills.md",
          "hit_count": 9,
          "context_score": 15,
          "total_score": 135,
          "snippets": [
            "| `$ARGUMENTS` | All arguments passed when invoking the skill...",
            "### Pass arguments to skills\n\nBoth you and Claude can pass arguments..."
          ]
        },
        {
          "file": "apps/docs-tracker/docs/en/hooks.md",
          "hit_count": 5,
          "context_score": 8,
          "total_score": 40
        }
      ],
      "analysis_status": "ready_for_inference"
    }
  ]
}
```

### フィールド定義

**項目レベルのフィールド**:
- `content`: 元の changelog テキスト
- `prefix`: 先頭の動詞(Added/Fixed/Changed)
- `importance_score`: プレフィックスから計算(Added=8, Changed=6, Fixed=4, [Breaking]=+3)
- `tags`: 抽出されたタグ(`["SDK"]` や `["VSCode"]`)
- `pipeline`: `developer` | `extension` | `general`
- `keywords.original`: 記号付きの抽出キーワード
- `keywords.normalized`: 記号除去後のキーワード
- `search_strategy`: 成功した grep 戦略(`exact` | `normalized` | `multi`)
- `related_docs`: マッチしたドキュメントとスコアの配列
- `analysis_status`: `ready_for_inference` | `docs_pending` | `sdk_only` | `no_docs_found`

**解析ステータスの判定基準**:
- `ready_for_inference`: 関連ドキュメントが1件以上見つかった(changelog.md除く)
- `docs_pending`: changelog.md のみマッチ(新機能)
- `sdk_only`: SDK/API タグ付き項目(一般ドキュメントをスキップ)
- `no_docs_found`: grep で0件

## 重要度スコア算出リファレンス

`importance_score` を自動計算:

| プレフィックス | 基本スコア | 備考           |
|---------------|-----------|---------------|
| Added         | 8         | 新機能         |
| Changed       | 6         | 変更           |
| Fixed         | 4         | バグ修正       |
| Improved      | 6         | 改善           |
| Updated       | 6         | 更新           |
| Removed       | 5         | 廃止           |

**ボーナス**: `[Breaking]` タグ → +3点

**例**:
- `Added feature` → 8
- `[Breaking] Changed API` → 6 + 3 = 9
- `Fixed crash` → 4

## パイプライン分類リファレンス

| タグ                | パイプライン | 検索戦略         | 推論の深さ   |
|--------------------|------------|-----------------|-------------|
| `[SDK]`, `[API]`    | developer  | grep スキップ   | 簡易のみ     |
| `[VSCode]`, `[IDE]` | extension  | 標準 grep       | 詳細         |
| なし                | general    | 標準 grep       | 完全推論     |

## 使い方

バージョン番号を指定してスキルを起動:

```bash
/analyze-changelog 2.1.19
```

スキルは以下を実行:
1. `apps/changelog-fetcher/changelogs/v2.1.19.md` の全項目を処理
2. `apps/changelog-fetcher/metadata/analysis_v2.1.19.json` を生成
3. 統計情報を報告(処理項目数、ドキュメント発見数、解析準備状況)

## 期待される出力サマリー

完了後、以下を表示:

```
解析完了: v2.1.19
- 総項目数: 17
- 推論準備完了: 12 (70.6%)
- ドキュメント整備待ち: 3 (17.6%)
- SDK専用: 2 (11.8%)
- ドキュメント未発見: 0 (0%)

メタデータ保存先: apps/changelog-fetcher/metadata/analysis_v2.1.19.json
```

## バリデーション

確定前に以下を確認:
- [ ] 全項目に `importance_score` が設定されている
- [ ] 全項目に `pipeline` 分類が設定されている
- [ ] `related_docs` 配列が `total_score` 降順でソートされている
- [ ] `analysis_status` が実際の検索結果と一致している
- [ ] JSON が valid で適切にフォーマットされている

## 備考

このスキルは**解析メタデータのみ**を出力し、最終的な恩恵推論は行わない。メタデータは別の LLM 推論ステップで使用され、Before/After 比較と恩恵説明を生成する。
