---
name: infer-benefits
description: analysis_v2.1.19.json の ready_for_inference 項目について、snippets を活用して恩恵推論を実行。Before/After比較と恩恵説明を生成。
allowed-tools: Read, Write
disable-model-invocation: true
---

# 恩恵推論スキル

## 目的

`apps/changelog-fetcher/metadata/analysis_v2.1.19.json` の `ready_for_inference` ステータスの項目について、既に含まれている snippets を活用して、Before/After 比較と恩恵説明を生成します。

## タスク

### 1. analysis_v2.1.19.json の読み込み

`apps/changelog-fetcher/metadata/analysis_v2.1.19.json` を読み込み、`analysis_status` が `ready_for_inference` の項目を特定してください。

### 2. 関連情報の活用

各 `ready_for_inference` 項目について、`related_docs` の `snippets` フィールドを活用してください。

**重要**: ファイルの全文を Read する必要はありません。`snippets` に含まれている情報だけで恩恵推論を行ってください。snippets がない場合のみ、必要に応じてファイルを読み込んでください。

### 3. 恩恵推論の実行

各項目について、以下のコグニティブ・デザイン形式のプロンプトに従って恩恵推論を行ってください:

#### 思考のレンズ

**前提 (Premise)**:
- Claude Code は開発者向けの AI アシスタントCLIツールである
- ユーザーは技術的な詳細よりも「自分にとって何が良くなるか」を知りたい
- 変更の背景には必ず具体的な問題や不便があった

**状況 (Situation)**:
- CHANGELOG項目: {content}
- 関連情報: {related_docs の snippets}
- この変更は v2.1.19 で実装された

**目的 (Purpose)**:
この変更について、以下を明確に説明する:
1. Before: 変更前の状況(何が不便だったか)
2. After: 変更後の状況(何が改善されたか)
3. Benefit: ユーザーへの恩恵(なぜこれが嬉しいのか)
4. Target: 対象ユーザー(誰が恩恵を受けるか)

**動機 (Motive)**:
単なる事実の羅列ではなく、ユーザーが「この変更で自分の作業がどう楽になるか」を直感的に理解できる説明を生成する。snippets の情報を活用し、技術的に正確で具体的な説明を心がける。

**制約 (Constraint)**:
- 専門用語を使う場合は必ず文脈で意味が分かるように説明する
- Before/After は2-3文で簡潔に
- snippets に記載がない推測は避ける
- バグ修正(prefix: "Fixed")の場合、Before はバグの症状を CHANGELOG の記述から推測してよい
- 機能追加(prefix: "Added", "Enabled")の場合、Before は snippets から変更前の状態を推測する

#### パイプライン別の処理

**general パイプライン**:
- 詳細な恩恵推論を実施(上記のコグニティブ・デザイン全要素を使用)
- Before/After/Benefit/Target をすべて記述

**extension パイプライン**:
- 標準的な恩恵推論を実施
- Before/After/Benefit/Target をすべて記述

**developer パイプライン**:
- 簡易説明のみ
- Before は省略可、After と Benefit のみ記述

**SDK タグがある項目(analysis_status: "sdk_only")**:
- スキップする(恩恵推論を行わない)

### 4. 出力形式

`apps/changelog-fetcher/metadata/benefits_v2.1.19.json` に以下の形式で出力してください:

```json
{
  "version": "2.1.19",
  "inferred_at": "2026-01-26T12:00:00Z",
  "items": [
    {
      "item_index": 1,
      "content": "Added shorthand `$0`, `$1`, etc. for accessing individual arguments in custom commands",
      "before": "スキルやカスタムコマンドで引数を扱う際、$ARGUMENTSですべての引数を一括で受け取ることしかできず、個別の引数を取り出すには自分でパースする必要がありました。",
      "after": "$0、$1、$2といったショートハンドを使うことで、引数を位置で直接参照できるようになりました。",
      "benefit": "スキル作成時の引数処理が大幅に簡素化されます。複雑なパース処理を書く必要がなくなり、スキルの定義がシンプルで読みやすくなります。",
      "target_users": "スキル作成者"
    }
  ]
}
```

**重要な注意事項**:
- `item_index` は analysis_v2.1.19.json の配列インデックス(0始まり)です
- `inferred_at` には実行時の ISO 8601 形式のタイムスタンプを記録してください
- `ready_for_inference` ステータスの項目のみを出力してください(`docs_pending` や `sdk_only` は除外)

### 5. 統合メタデータの生成

`apps/changelog-fetcher/metadata/final_v2.1.19.json` に、`analysis_v2.1.19.json` と `benefits_v2.1.19.json` を統合した形式で出力してください:

```json
{
  "version": "2.1.19",
  "items": [
    {
      "content": "...",
      "importance_score": 8,
      "related_docs": [...],
      "analysis_status": "ready_for_inference",
      "benefit_inference": {
        "before": "...",
        "after": "...",
        "benefit": "...",
        "target_users": "..."
      }
    }
  ]
}
```

**統合ルール**:
- `analysis_v2.1.19.json` のすべての項目を含める
- `ready_for_inference` の項目には `benefit_inference` フィールドを追加
- `docs_pending` や `sdk_only` の項目には `benefit_inference` を追加しない

## 実行手順

1. `apps/changelog-fetcher/metadata/analysis_v2.1.19.json` を読み込む
2. `ready_for_inference` 項目を特定
3. 各項目の `related_docs.snippets` を確認(ファイルの全文は読まない)
4. snippets を使って恩恵推論を実行(パイプライン別に処理を分岐)
5. `benefits_v2.1.19.json` を生成
6. `final_v2.1.19.json` を生成(analysis と benefits を統合)

## トークン削減のための重要な注意

- **絶対に関連ドキュメントの全文を Read しないこと**
- `analysis_v2.1.19.json` には既に必要な `snippets` が含まれている
- snippets だけで恩恵推論を行うことで、トークン消費を 90% 削減できる

## 出力例

検証結果(`docs/design/benefit-inference-validation.md`)を参考にしてください。
