# ADR 0019: changelog-fetcher への DDD 適用方針

## Status

Accepted

## TLDL

2026-06-04 時点では、ADR の作成と `apps/changelog-fetcher/src/domain/` への初期実装まで完了している。したがって、次の作業は domain 層を新規実装することではない。ただし、NotebookLM の `ドメイン駆動設計入門.md` を使った再調査で、現在の domain 実装は「Functional Core としては前進しているが、DTO・外部形式パース・schema 互換だけの値が混ざっている可能性がある」と分かった。

この ADR では ADR 0018 と同じく、`domain` / `application` / `infrastructure` / `cli` の4分類だけを使う。CQRS 由来の追加層は導入しない。

次のタスクは、実装済み domain 層を DDD の基準に合わせて棚卸しし、domain に残すものと application / infrastructure へ移すものを分けることである。具体的には、`changelog` から `analysis` への依存を取り除く、Entity と Value Object を再分類する、`InferenceBatch` のような AI/API DTO を domain から外す、Markdown・ファイル・CLI 表面のパース処理を infrastructure または application 側へ移す。`needsInference` は1つの解析項目が推論未完了かを判断する純粋なルールであり、現時点では `domain/analysis` に置く。テストは、この再整理後に domain に残る業務ルールだけを対象に、実装ファイルと同じ階層へ置く。

## Context

`apps/changelog-fetcher` は Claude Code の CHANGELOG と関連ドキュメントを取得・解析し、通知や表示で使う JSON データを生成する CLI アプリケーションである。現在は `parse-changelog.ts` / `analyze-changelog.ts` / `infer-benefits.ts` / `generate-settings-reference.ts` などのスクリプトが主なエントリーポイントで、`parsers/` `searchers/` `scorers/` `ai/` `lib/` に処理が分散している。

最新の DDD 関連 ADR である ADR 0018 では、notification-worker において Functional DDD スタイル、`domain` / `application` / `infrastructure` / エントリーポイントの分離、port インターフェースによる依存性逆転、薄いラッパー禁止を実践した。`changelog-fetcher` でも同じ方針を基準にする。ただし、`changelog-fetcher` は常駐 Worker ではなくデータ生成 CLI であるため、HTTP route ではなく CLI スクリプトをエントリーポイントとして扱う。

### 解決したい課題

- CHANGELOG のパース、差分検知、ファイル読み書き、GitHub 取得、ログ出力が `parse-changelog.ts` に混在している
- 解析処理で、項目の分類・キーワード抽出・ドキュメント検索・関連ドキュメント整形・AI 向け整形が1つの流れに直書きされている
- AI 推論では、未処理項目の判定、推論結果の反映、Gemini API のリトライ・フォールバックが同じファイルにある
- 設定リファレンス生成では、設定エントリの抽出・重複排除・関連コンテキスト収集・翻訳・ファイル出力が `lib/` 配下に技術分類で置かれており、どれが業務ルールか分かりにくい
- `types.ts` と `packages/types` に出力形式の型があり、ドメイン概念と外部 JSON 契約の境界が曖昧になっている

### 影響範囲

この ADR は、将来の DDD 移行で以下に影響する。

- `apps/changelog-fetcher/src` のディレクトリ構成と import 方向
- CLI エントリーポイントの責務
- `analysis/` `inferred/` `settings/` `diff/` `metadata/` へ入出力する処理の置き場所
- changelog-fetcher のテスト配置

一方で、この ADR だけでは以下を変更しない。

- `analysis_*.json` / `inferred_*.json` / `settings_*.json` / `changelog_diff.json` の出力形式
- notification-worker が読む `AnalysisSchema` の契約
- Gemini のモデル選定、プロンプト文面、GitHub 取得元

### 検討した選択肢

1. 現状のスクリプト構成を維持し、関数分割だけで整理する
2. notification-worker と同じ4層 DDD をそのまま全面適用する
3. CLI アプリ向けに、境界づけられた文脈ごとの Functional DDD を適用する

### 各選択肢の評価

| 観点 | 現状維持 + 関数分割 | 4層 DDD の全面適用 | 文脈ごとの Functional DDD |
|------|---------------------|---------------------|----------------------------|
| 業務ルールの発見性 | 改善は限定的。`lib/` がさらに膨らみやすい | 高い | 高い |
| CLI との相性 | 高い | 中。HTTP Worker 前提の名前を持ち込みやすい | 高い |
| 移行コスト | 低い | 高い | 中 |
| 過度な抽象化の回避 | 中。便利関数が増えやすい | 低。port が増えすぎる可能性がある | 高い |
| ADR 0018 との整合性 | 低い | 高い | 高い |
| テスト容易性 | 中 | 高い | 高い |

## Decision

**changelog-fetcher は、CLI エントリーポイントを薄くし、境界づけられた文脈ごとに domain / application / infrastructure を分ける Functional DDD スタイルへ移行する。**

### 1. 境界づけられた文脈を5つに分ける

`changelog-fetcher` の責務は1つの巨大な「CHANGELOG 処理」ではなく、次の文脈に分ける。

| 文脈 | 目的 | 現在の主な対応箇所 |
|------|------|--------------------|
| `changelog` | upstream CHANGELOG をバージョン別に扱い、差分を検知する | `parse-changelog.ts` |
| `analysis` | CHANGELOG 項目を解析し、関連ドキュメント付きの分析結果を作る | `analyze-changelog.ts`, `parsers/`, `searchers/`, `scorers/` |
| `inference` | 分析結果へ翻訳・利用者メリット・サマリーを付与する | `infer-benefits.ts`, `ai/` |
| `settings-reference` | 設定・環境変数リファレンスのエントリを生成する | `generate-settings-reference.ts`, `lib/settings-*` |
| `builtin-surface` | tool / command / skill / env / agent の組み込み表面を収集する | `fetch-builtin-data.ts` |

`domain/` は文脈ごとに分け、巨大な共通 `types.ts` に全型を集めない。型と振る舞いは概念名に対応するファイルへ置く。

### 2. ドメイン概念と DTO / 出力用データの分類

DDD 移行時に扱う主要なドメイン概念は以下とする。

以下の表は、初期実装時点の候補一覧を NotebookLM の `ドメイン駆動設計入門.md` 調査に基づいて再分類したものである。Entity は同一性とライフサイクルを持つもの、Value Object は値の等価性・不変条件・ガード節を持つもの、DTO / 出力用データは外部公開・出力・ユースケース結果の入れ物として扱う。

| 種別 | 概念 | 識別子 | 主な責務 |
|------|------|--------|----------|
| Value Object | `ChangelogVersion` | なし | `v2.1.19` と `2.1.19` の表記ゆれを吸収する |
| Value Object | `ChangelogEntryContent` | なし | 箇条書き本文の正規化と空文字拒否を行う |
| Value Object | `ChangelogPrefix` | なし | CHANGELOG 項目の変更種別を表す |
| Value Object / Snapshot | `ChangelogEntry` | なし | 項目本文、prefix、tags を保持する。永続識別子やライフサイクルは持たない |
| Value Object / Snapshot | `ChangelogRelease` | なし | 1バージョン分の CHANGELOG 本文と項目を保持する。更新ライフサイクルは持たない |
| Domain Event / Value Object | `ChangelogDiffEvent` | version + type + added/removed items | 項目変更・バージョン削除の重複判定を行う |
| Value Object | `KeywordSet` | なし | original / normalized keywords を表す |
| Value Object | `InferenceResult` | なし | before / after / benefit を表す |
| Value Object | `SettingKey` | なし | `permissions.allow` や `CLAUDE_CODE_*` のキーを表す |
| Value Object | `SettingSlug` | なし | settings ファイル名に使う slug を表す |
| Value Object | `SettingSource` | なし | `settings` / `env` の発生元を表す |
| Value Object | `BuiltinSurfaceCatalog` | なし | tools / commands / skills / envs / agents の一覧を重複なしで保持する |
| Value Object / Snapshot | `ChangelogAnalysis` | なし | 1バージョン分の解析結果を保持する |
| Value Object / Snapshot | `AnalyzedChangelogEntry` | なし | 翻訳、関連ドキュメント、推論結果を含む解析済み項目を保持し、推論未完了判定の対象になる |
| Value Object / Snapshot | `RelatedDoc` | なし | 解析項目に紐づく docs 情報を保持する |
| schema 互換フィールド | `importance_score`, `context_score`, `total_score` | なし | 既存 JSON schema 互換のため `0` 固定で残す。意味のある評価値としては使わない |
| DTO | `SettingsEntry` | なし | schema / docs から抽出した設定情報を保持する |
| DTO / 出力用データ | `SettingReference` | なし | `settings_*.json` 出力用の内容を保持する |
| DTO / 出力用データ | `RelatedChangelog` | なし | 設定リファレンス出力に紐づく CHANGELOG 情報を保持する |

`AnalysisSchema` など `packages/types` にある型は、外部 JSON 契約として扱う。ドメイン層は必要に応じて専用の型を持ち、application または infrastructure 境界で JSON 契約へ変換する。

2026-06-04 時点の NotebookLM 再調査では、domain に残すかどうかを以下の基準で判断する。

| 判断 | 対象 | 理由 |
|------|------|------|
| domain に残す | `ChangelogVersion`, `ChangelogEntryContent`, `ChangelogPrefix`, `ChangelogEntry`, `ChangelogRelease`, `ChangelogDiffEvent`, `KeywordSet`, `InferenceResult`, `SettingKey`, `SettingSlug`, `BuiltinSurfaceCatalog` | 不正値を防ぐガード節、表記ゆれの正規化、変更種別や重複なし一覧のような domain の値・ルールを持つ |
| domain に残す | `ChangelogAnalysis`, `AnalyzedChangelogEntry`, `RelatedDoc`, `needsInference` | 解析文脈の値と、1項目が推論未完了かどうかの純粋な判定を表す |
| domain に残す | prefix 判定、tag 抽出、差分イベント重複判定 | 外部 I/O に依存せず、domain の評価・分類ルールを表す |
| domain から外す | `computeChangelogItemDiff`, `changelog-parser`, Markdown list extraction、`extractMarkdownListItems` | Markdown という特定の外部形式に依存するパース / 抽出処理である |
| domain から外す | `extractKeywordSetFromContent`, `ImportanceScore`, `calculateImportanceScore` | docs 検索や Markdown 断片の構造に依存した処理、または現在意味を持たない評価値である |
| domain から外す | `InferenceBatch`, `InferredBatchItem`, `TranslatedBatchItem`, `FeatureAreaCorrection` | AI 応答を application 側で扱うための DTO であり、domain 概念ではない |
| domain から外す候補として再確認する | `SettingsEntry`, `dedupeSettingsEntries`, `mergeEnvEntries`, `SettingReference`, `RelatedChangelog` | 設定リファレンス文脈の値として扱える部分と、抽出結果・JSON 出力用データにすぎない部分が混ざっている |

### 3. レイヤー構成

移行後の構成は以下を目標にする。

```
apps/changelog-fetcher/src/
  domain/
    changelog/
      changelog-version.ts
      changelog-release.ts
      changelog-entry.ts
      changelog-diff-event.ts
    analysis/
      keyword-set.ts
      related-doc.ts
      analyzed-changelog-entry.ts
      changelog-analysis.ts
    inference/
      inference-result.ts
    settings-reference/
      setting-key.ts
      setting-slug.ts
      setting-entry.ts
      setting-reference.ts
    builtin-surface/
      builtin-surface-catalog.ts
  application/
    fetch-changelog.ts
    analyze-changelog.ts
    infer-benefits.ts
    inference-batch.ts
    generate-settings-reference.ts
    fetch-builtin-surface.ts
  infrastructure/
    github/
      claude-code-changelog-client.ts
      builtin-surface-client.ts
    filesystem/
      changelog-file-store.ts
      analysis-file-store.ts
      settings-reference-file-store.ts
      builtin-surface-file-store.ts
    docs/
      changelog-markdown-parser.ts
      builtin-surface-markdown-parser.ts
      docs-searcher.ts
      snippet-extractor.ts
    ai/
      gemini-inference-client.ts
      gemini-settings-translator.ts
    schema/
      settings-schema-reader.ts
  cli/
    parse-changelog.ts
    analyze-changelog.ts
    infer-benefits.ts
    generate-settings-reference.ts
    fetch-builtin-data.ts
```

CLI は `process.argv`、`process.env`、`process.exit`、ログ出力、実行時の依存組み立てだけを担当する。application はユースケースの進行管理を担当し、domain の純粋関数と infrastructure の port 実装を組み合わせる。

### 4. Functional DDD を採用する

ADR 0018 と同じく、エンティティの振る舞いは class メソッドではなく純粋関数で表現する。

```ts
// 採用: domain/changelog/changelog-diff-event.ts
export function isDuplicateDiffEvent(
  events: ChangelogDiffEvent[],
  candidate: ChangelogDiffEventCandidate,
): boolean {
  // version / type / added / removed の同一性で判定する
}

// 採用しない: class メソッドスタイル
// diffEventList.isDuplicate(candidate)
```

業務ルールが domain にあることを重視し、データと関数が分かれていること自体は問題にしない。

### 5. port インターフェースは副作用境界にだけ置く

過度な抽象化を避けるため、port は DB・ファイルシステム・外部 API・AI API・ドキュメント検索のような副作用境界に限定する。prefix 判定、差分イベント重複判定、値オブジェクトの形式検証のような純粋処理には port を作らない。

| 副作用 | port 例 | 実装場所 |
|--------|---------|----------|
| GitHub / remote Markdown 取得 | `ChangelogSource` | `infrastructure/github/` |
| ファイル読み書き | `ChangelogStore`, `AnalysisStore`, `SettingsReferenceStore` | `infrastructure/filesystem/` |
| docs 検索・スニペット抽出 | `DocsSearcher` | `infrastructure/docs/` |
| Gemini 推論・翻訳 | `InferenceClient`, `SettingsTranslator` | `infrastructure/ai/` |
| settings schema 読み込み | `SettingsSchemaSource` | `infrastructure/schema/` |

薄いラッパーを増やさない。既存関数を名前だけ変えて移すのではなく、その関数が domain の業務ルールなのか、application の進行管理なのか、infrastructure の技術詳細なのかを確認してから移す。

### 6. 既存の出力契約は境界で変換する

`analysis_*.json` と `inferred_*.json` は notification-worker から参照されるため、移行中も `packages/types` の `AnalysisSchema` を外部契約として維持する。domain 内部の名前や構造を変える場合は、application または infrastructure に変換関数を置く。

```ts
// application 境界の例
const analysis = analyzeRelease(release, relatedDocs);
const output = toAnalysisJson(analysis);
AnalysisSchema.parse(output);
await analysisStore.save(version, output);
```

この変換は「出力契約への変換」という明確な責務を持つため許可する。ただし、単に型名を変えるだけの薄いラッパーにはしない。

### 7. 移行順序

移行はデータ破壊リスクの低い純粋処理から進める。

1. `[実装済み]` ADR 0018 と同じ4分類だけを使い、追加層を導入しない方針を明記する
2. `[実装済み]` `domain/changelog` から `analysis` への依存を外し、`ChangelogEntry` は content / prefix / tags までに絞る。`importance_score` は schema 互換の固定値として application 境界で扱う
3. `[実装済み]` `InferenceBatch` 系を application 境界へ移し、domain には `InferenceResult` を残す
4. `[実装済み]` `needsInference` は `AnalyzedChangelogEntry` の推論未完了を判定する純粋ルールとして `domain/analysis` に置く
5. `[一部実装済み]` `parsers/` の Markdown パース、Markdown list extraction、`computeChangelogItemDiff`、docs 検索結果整形、builtin surface extraction を domain から infrastructure または application 側へ移す。意味のある score を扱わなくなった `scorers/` は削除する
6. `[未着手]` `application/analyze-changelog.ts` を作り、既存 `analyze-changelog.ts` を CLI に薄くする
7. `[未着手]` Gemini と GitHub / fetch / fs を infrastructure port に閉じ込める
8. `[未着手]` `src/types.ts` を文脈ごとの型へ分解し、外部契約だけを `packages/types` に残す

domain に残すと判断した関数にはユニットテストを付ける。domain から外す DTO や外部形式パースには、移動先の責務に応じて application / infrastructure 側で必要なテストを付ける。既存の実データテストは、移行中の回帰検知として残す。
テストコードは実装する関数と同じ階層に置き、テスト対象関数がどの文脈のどの概念に属するかを明確にする。

### 8. 2026-06-04 時点の実装状況

完了したことは以下である。

- この ADR を `Accepted` にした
- 作業ブランチ `feat/changelog-fetcher-domain-ddd` を作成した
- `apps/changelog-fetcher/src/domain/` 配下に、`changelog`、`analysis`、`inference`、`settings-reference`、`builtin-surface` の初期ファイルを追加した
- domain 層の exported function に JSDoc を追加した
- 今回追加したテストは、価値の低いものが混ざっていたため削除済みである

まだ完了していないことは以下である。

- `parsers/` 配下の Markdown パース処理、`computeChangelogItemDiff`、builtin surface extraction の domain 外への移動
- `scorers/` 配下の不要処理削除
- 既存 CLI から application 層への切り出し
- GitHub、Gemini、filesystem、docs search、schema 読み込みの infrastructure 分離
- 既存の JSON 出力契約と domain モデルの変換境界
- `packages/types` と domain 型の責務整理
- NotebookLM の `ドメイン駆動設計入門.md` 調査結果に照らした Entity / Value Object / DTO / 出力用データの分類修正

### 9. NotebookLM 再調査で分かった修正方針

NotebookLM の `ドメイン駆動設計入門.md` を基準に、対象ソース `4bbc10f9-247d-4f68-b3d8-90e582530836` へ確認した。判断基準は「そこに domain のルールが存在するか」「単体で扱いたい値か」「同一性とライフサイクルを持つか」「外部形式や DTO ではないか」である。ただし、このプロジェクトでは ADR 0018 と同じ4分類だけを使うため、追加層を作らない。現在の初期実装には以下の修正が必要である。

| 優先度 | 対象 | 方針 |
|--------|------|------|
| P1 | `domain/changelog/changelog-entry.ts` | `analysis/importance-score` への依存を外す。`importance_score` は schema 互換の固定値として出力データ生成時に付与する |
| P1 | Entity と Value Object の分類 | `ChangelogEntry`、`ChangelogRelease`、`BuiltinSurfaceCatalog` は domain に残すが Entity ではなく Value Object / snapshot として扱う |
| P1 | `domain/analysis/changelog-analysis.ts`, `domain/analysis/analyzed-changelog-entry.ts` | 解析文脈の値として domain に残す。外部 JSON 契約への変換は application 境界で扱う |
| P1 | `domain/analysis/related-doc.ts` | 解析項目に紐づく docs 情報として domain に残す。docs 検索・スニペット抽出そのものは infrastructure 側へ移す。`context_score` / `total_score` は schema 互換の固定値にする |
| P1 | `domain/inference/inference-batch.ts` | AI 応答 DTO / application DTO として domain から外す。domain には `InferenceResult` のような値だけを残す |
| P1 | `needsInference` | `AnalyzedChangelogEntry` の推論未完了を判定する純粋ルールとして `domain/analysis` に置く |
| P1 | `domain/settings-reference/setting-entry.ts`, `domain/settings-reference/setting-reference.ts` | 設定リファレンス文脈の値として domain に残すか、出力用 DTO として application 側へ移すかを再確認する。`SettingKey` と `SettingSlug` は domain に残す |
| P2 | `changelog-parser`、Markdown list extraction、builtin surface extraction | 外部形式のパースや収集は infrastructure または application 側へ移す。domain には正規化後の概念と判断だけを置く |
| P2 | `extractKeywordSetFromContent` | backtick や大文字技術語の抽出は文字列フォーマット依存の処理として domain から外す。`KeywordSet` 自体は重複排除ルールを持つ値として domain に残す |
| P2 | `apps/changelog-fetcher/src/parsers/` | 旧構成の技術分類ディレクトリなので、Markdown パースは infrastructure、docs 検索用 keyword 抽出は application 側へ移して削除する |
| P2 | `apps/changelog-fetcher/src/scorers/` | score が意味を持たなくなったため、残っている `getTopDocs` は呼び出し元へインライン化してディレクトリを削除する |
| P2 | `domain/analysis/importance-score.ts` | 意味のある評価値として使っていないため domain から外す。schema 互換が必要な間は `importance_score: 0` をコメント付きで出力する |
| P2 | `dedupeSettingsEntries`, `mergeEnvEntries` | 配列操作、特定ファイル群の優先順位統合として application / infrastructure 側へ移す候補にする |

次に実装する時は、このレビュー結果を先に反映し、その後で application / infrastructure の移行へ進む。ここでいう「domain 層の作業」は新規実装ではなく、実装済みファイルから domain ではないものを外す作業である。

## Consequences

### Positive

- 「CHANGELOG を扱う」「解析する」「推論する」「設定リファレンスを作る」という文脈ごとに責務を追える
- prefix 判定、差分イベント重複判定、値オブジェクトの形式検証を DB・fs・AI なしでテストできる
- Gemini API、GitHub API、ファイル出力の変更が infrastructure に閉じやすくなる
- CLI は引数・環境変数・終了コードの処理に集中し、処理本体を application から読める
- ADR 0018 の Functional DDD 方針と揃い、アプリ間で判断基準が共通化される

### Negative

- ファイル数が増え、移行直後は現在より探索コストが上がる
  - → ファイル名を概念名に合わせ、文脈ごとのディレクトリに分けて検索しやすくする
- CLI ツールとしては port インターフェースが重く見える箇所が出る
  - → port は副作用境界に限定し、純粋処理には作らない
- `packages/types` の外部契約と domain 型の二重管理が発生する
  - → 外部 JSON 契約へ変換する境界を明確にし、domain 型を直接 JSON 出力形式に引きずられないようにする

### Risks

- 既存の生成済み JSON と同じ出力を維持できず、notification-worker や表示側に影響するリスクがある
  - → 移行中は `AnalysisSchema` による検証と実データテストを維持し、出力契約の変更は別 ADR で扱う
- `application/` に業務ルールが残り、実質的に domain が型置き場になるリスクがある
  - → prefix 判定、差分イベント重複判定、値オブジェクトの形式検証など判断を含む処理は domain の純粋関数へ置く
- `infrastructure/` が便利関数置き場になり、責務が再び曖昧になるリスクがある
  - → infrastructure は外部世界との接続と外部形式への変換に限定する

## 決めていないこと

| 項目 | 決めない理由 | いつ決めるか |
|------|--------------|--------------|
| `analysis_*.json` のスキーマ変更 | notification-worker との契約に影響するため、この ADR の範囲を超える | 出力契約を変える必要が出た時点で別 ADR を作る |
| Gemini プロンプトの改善 | DDD の境界設計とは独立して評価すべきため | inference 文脈の移行後 |
| `packages/types` の責務再定義 | 他アプリへの影響範囲が広いため | changelog-fetcher の domain 型分離後 |
| 生成済み `analysis/` `inferred/` `settings/` データの再生成方針 | 実装移行とは別に運用判断が必要なため | 出力差分が発生した時点 |

## Notes

### 参考資料

- ADR 0016: notification-worker への DDD 適用方針
- ADR 0017: notification-worker DDD移行時の実装ルール
- ADR 0018: notification-worker DDD 実践記録 — Functional DDD スタイルと設計の最終形
