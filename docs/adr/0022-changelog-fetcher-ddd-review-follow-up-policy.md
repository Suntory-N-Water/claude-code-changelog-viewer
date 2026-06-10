# ADR 0022: changelog-fetcher DDD レビュー結果と次セッションの整理方針

## Status

Proposed

## Context

ADR 0019 では `apps/changelog-fetcher` に Functional DDD を適用する方針を決め、ADR 0020 では層分類の判断ヒューリスティック、ADR 0021 では副作用境界だけを application port として抽象化する方針を決めた。

直近の整理では、`src/types.ts` を削除し、文脈ごとの型へ分解した。docs 検索型は `infrastructure/docs/docs-searcher.ts`、diff JSON 契約は `infrastructure/filesystem/changelog-file-store.ts` へ移した。また、`apps/changelog-fetcher/src/**/*.ts` の `readonly` を一旦すべて削除し、constructor parameter property だけ通常の private field に直した。さらに、`infrastructure/settings-reference/settings-entry-loader.ts` の薄い `mergeEnvEntries` wrapper を削除し、`domain/settings-reference/setting-entry.ts` の `mergeEnvEntries` を直接呼ぶようにした。

この状態に対して、NotebookLM の `ドメイン駆動設計入門.md`(Notebook ID: `f48ebcc4-48c3-44b5-80c0-02124052c154`, Source ID: `4bbc10f9-247d-4f68-b3d8-90e582530836`) と ADR 0019-0021 を基準に、複数の観点から DDD 実装を調査した。目的は、実務プロジェクトで DDD を採用するときに「なぜ domain / application / infrastructure / cli のどこに置くのか」を言葉で説明できる判断軸を得ることである。

### 解決したい課題

- `application` に置かれた処理が、ユースケース進行なのか domain の状態遷移なのか説明しづらい箇所がある
- `packages/types` に残す型と、changelog-fetcher 内部だけで使う外部 API 応答契約の境界が曖昧な箇所がある
- `readonly` 全削除により、domain snapshot や外部契約 DTO の意図が落ちていないか判断する必要がある
- infrastructure から domain の純粋ルールを呼ぶ形が、薄い wrapper より妥当か確認する必要がある
- 新規 helper / port / wrapper が、ADR 0019 の「薄いラッパー禁止」と矛盾していないか確認する必要がある

### 調査で確認した DDD の前提

NotebookLM 調査と ADR 0019-0021 から、次の前提を採用する。

| 分類 | 置くもの | 判断基準 |
|------|----------|----------|
| domain | 業務上の不変条件、表記ゆれ吸収、分類、重複判定、状態遷移、純粋な domain policy | 入力形式や保存形式を変えても残る判断であり、業務の人に説明できる |
| application | usecase の進行、port と domain の協調、retry、AI を呼ぶタイミング、結果採用の方針 | 判断そのものではなく、判断を使ってユースケースを進める |
| infrastructure | Markdown / JSON / filesystem / GitHub / Gemini / docs search / snake_case など外部形式・外部サービスへの依存 | 技術形式や外部契約を読んでいる、または domain object を再構築している |
| cli | argv / env / exit code / 実行時 wiring / 表示・ログ | 実行環境に依存する入口であり、業務判断を持たない |

補助的な問いは次の通りである。

- Markdown を JSON 入力に変えても、その処理は残るか
- 業務の人が「この分類・重複・状態遷移をこうしてほしい」と言えるか
- snake_case / camelCase / Date 文字列 / file path / API response shape が見えていないか
- port 化する理由は副作用差し替えか
- `packages/types` に置く理由は他アプリと共有する公開 JSON 契約か

### 検討した選択肢

1. 現状の DDD 移行結果をそのまま受け入れ、細部の違和感は ADR に追記しない
2. domain / application / infrastructure の分類を厳密にし、疑わしい型や関数をすべて即座に移動する
3. 説明不能な境界、外部契約の混線、挙動リスクを優先して直し、それ以外は判断理由を ADR とテストで補強する

### 各選択肢の評価

| 観点 | ① 現状維持 | ② 全面整理 | ③ 優先順位付き整理 |
|------|------------|------------|--------------------|
| 実務で説明できる判断軸 | 低い。違和感が残る | 高い | 高い |
| 既存差分への影響 | 低い | 高い | 中 |
| 過度な抽象化の回避 | 中。曖昧な helper が残る | 低。移動に伴い wrapper が増えやすい | 高い |
| 挙動リスクの解消 | 低い | 高い | 高い |
| 次セッションでの実行可能性 | 高いが価値が薄い | 低い | 高い |

## Decision

**changelog-fetcher の DDD 整理は、現行構造を大枠では維持しつつ、説明不能な境界・外部契約の混線・挙動リスクを優先して修正する。**

### 1. `applyInferenceBatch` は application DTO 適用と domain 状態遷移を分ける

`application/inference-batch.ts` の `applyInferenceBatch` は、AI の batch id と元 entry index の照合、retry 結果の適用、summary 採用方針を扱っている。この部分は application の責務である。

一方で、解析済み entry に `contentJa`、`inference`、`featureAreas` を反映し、「翻訳済み・推論済みの解析結果」へ更新する処理は domain の状態遷移である。`createInferenceResult` を使うだけでなく、`AnalyzedChangelogEntry` をどのような状態に更新するかを domain に寄せる。

```ts
// Bad: application が entry の domain snapshot 更新をすべて組み立てる
const updatedEntry = {
  ...entry,
  contentJa: translated?.contentJa ?? entry.contentJa,
  inference: inferred ? createInferenceResult(inferred) : entry.inference,
  featureAreas: corrected?.featureAreas ?? entry.featureAreas,
};

// Good: application は AI batch と entry を対応付け、状態遷移は domain 関数に委ねる
const updatedEntry = applyInferenceToAnalyzedEntry(entry, {
  translated,
  inferred,
  corrected,
});
```

また、retry 時に missing items だけを AI に送った場合、`batch.summary` で既存 summary を上書きしない。summary を採用するのは初回 batch か、明示的に summary 更新を許可した usecase に限定する。

### 2. AI 応答契約は内部契約と公開契約を分ける

`packages/types` は、notification-worker や www など他アプリと共有する外部 JSON 契約を置く場所である。`AnalysisSchema` のように `analysis_*.json` / `inferred_*.json` の読み手が複数存在する契約は `packages/types` に残す。

一方、Gemini 専用の応答 schema は changelog-fetcher 内部の infrastructure contract である。`InferenceBatchResultSchema` が Gemini 応答の snake_case 形式だけを表すなら、`apps/changelog-fetcher/src/infrastructure/ai` に寄せる。もし `packages/types` に残すなら、他アプリが読む公開契約として扱う理由を ADR に追記する。

### 3. feature area の分類語彙は domain policy か prompt policy かを明示する

`infrastructure/ai/prompts/inference-prompt.ts` にある feature area の定義は、単なる JSON 応答形式ではなく、「何を IDE / Hooks / MCP / Permissions と分類するか」という domain policy に見える。

次セッションでは、次のどちらかを選ぶ。

| 方針 | 置き場所 | 判断理由 |
|------|----------|----------|
| domain policy として扱う | `domain/analysis` または `domain/inference` | 分類語彙・除外条件が業務判断であり、AI 以外でも再利用・テストしたい |
| prompt policy として扱う | `infrastructure/ai/prompts` | AI に出す指示文としてだけ管理し、アプリ側では分類の正しさを検証しない |

実務の説明では、API 応答形式は infrastructure、分類語彙や除外条件は domain policy と切り分ける。

### 4. settings-reference の出力 DTO と domain rule を分ける

`SettingKey`、`createSettingSlugFromKey`、同一 key の扱い、`env-vars.md > schema.env > docs/en` の source 優先順位は domain rule として説明できる。

一方、`SettingReference` / `RelatedChangelog` は `settings_*.json` に近い usecase の成果物であり、domain object としては説明しづらい。次セッションでは application output DTO へ寄せる。`settings_*.json` の snake_case 変換は writer 境界に閉じ込める。

`infrastructure/settings-reference/settings-entry-loader.ts` が外部形式を読み、`createSettingKey` や `mergeEnvEntries` など domain の純粋ルールを呼ぶこと自体は許容する。これは外部データから domain-facing な値を再構築しているためである。ただし、source 優先順位のような重要な policy を adapter 内部に隠すと説明しづらいため、必要なら application から見える形に持ち上げる。

### 5. `readonly` は一律復元せず、意図が必要な型だけ戻す

`readonly` は domain かどうかの判定理由ではない。ただし、次の型では「snapshot / value object / 外部契約 DTO を mutation しない」という意図を伝えるために有効である。

- domain の value object / snapshot
- application output DTO
- infrastructure の外部 JSON 契約 DTO
- port input / result 型

一方で、ローカルの一時変数や内部 accumulator にまで機械的に `readonly` を戻さない。`readonly` を戻す場合は、層分類ではなく mutation を防ぐ目的として説明する。

### 6. helper / port / wrapper は call site と責務で判断する

port は副作用境界に限定する。Markdown parser、snake_case 変換、domain の純粋判定を interface で包まない。

helper は原則として、2箇所以上から呼ばれる、分岐・検証・副作用境界がありインラインでは読みにくい、または既存同種パターンへ揃える必要がある場合にだけ追加する。

今回の調査では、次を整理候補とする。

| 対象 | 方針 | 理由 |
|------|------|------|
| `dedupeSettingsEntries` | export しない、または `mergeEnvEntries` 内へ閉じる | call site が実質 `mergeEnvEntries` だけである |
| `countEntriesWithContext` | 未使用 export を削除する | application 側に private 実装があり、infrastructure export が使われていない |
| `toVersionFilename` | `ChangelogFileStore` 側へ寄せる | filesystem の命名規則であり、使用箇所が store だけである |
| `computeChangelogItemDiff` | 未使用なら削除する | 古い string-based diff の名残に見える |
| `AnalysisSchema` 変換 | converter helper 化を許容する | 外部 JSON 契約変換であり、複数 call site がある |

## Consequences

### Positive

- DDD の層分類を「どこに置いたか」ではなく「なぜそこに置いたか」で説明できる
- `application` が domain の状態遷移を抱えすぎる問題を減らせる
- `packages/types` を公開 JSON 契約に絞り、内部 AI 応答契約との混線を避けられる
- `readonly` の有無を層分類と混同せず、mutation 防止の意図として扱える
- 薄い wrapper や過剰な port を増やさず、ADR 0019 の方針を維持できる

### Negative

- 既存の DDD 移行差分に追加整理が入り、次セッションの作業範囲が広がる
  - → 挙動リスクと外部契約境界から優先し、見た目の分類整理だけを目的にした移動は後回しにする
- `applyInferenceBatch` の分割により、application と domain の間に新しい domain 関数が増える
  - → helper 追加ではなく domain 状態遷移の名前として説明できる場合だけ追加する
- feature area を domain policy に寄せる場合、プロンプトと domain 定義の同期が必要になる
  - → 片方を source of truth にし、もう片方はそこから参照または明示的にテストする

### Risks

- 「domain に寄せる」こと自体が目的化し、DTO や外部契約まで domain に入れてしまうリスクがある
  - → ADR 0020 の「入力形式を変えたら死ぬか」と、本 ADR の公開契約基準を併用する
- `readonly` 復元が機械的な大量差分になり、意図が読み取りづらくなるリスクがある
  - → value object / snapshot / output DTO / port DTO に限定して戻す
- application からログを完全排除するために logger port を追加したくなるリスクがある
  - → ログは厳密には CLI 寄りだが、logger port 追加は過剰になりやすいため、挙動や依存方向の問題が出るまで優先しない

## 決めていないこと

| 項目 | 決めない理由 | いつ決めるか |
|------|--------------|--------------|
| feature area を domain policy として移すか | prompt policy として閉じる選択肢も残っているため | 次セッションで `inference-prompt.ts` のテスト可能性を確認するとき |
| `RelatedDoc.hitCount` を domain から外すか | analysis snapshot として説明できる一方、docs search detail にも見えるため | analysis JSON 契約 converter を整理するとき |
| `createChangelogEntryContent` の `- ` 必須を domain に残すか | content contract と Markdown list 表現の境界がまだ曖昧なため | changelog parser と domain content のテストを見直すとき |
| application 内 logger を CLI へ寄せるか | logger port 追加は過剰で、現時点の優先度が低いため | CLI wiring をまとめて整理するとき |
| hash / timestamp 生成を store へ寄せるか | `fetch-changelog` の挙動に影響し、今回の最優先ではないため | metadata JSON 契約を見直すとき |

## Notes

### 次セッションの推奨順序

1. `applyInferenceBatch` のテストを追加し、retry 時に summary が上書きされないことを保証する
2. entry への翻訳・推論・feature area 反映を domain 状態遷移として切り出す
3. `InferenceBatchResultSchema` を `packages/types` に置く理由を確認し、内部 Gemini 契約なら `infrastructure/ai` へ移す
4. `SettingReference` / `RelatedChangelog` を application output DTO へ寄せる
5. `toVersionFilename`、未使用 `computeChangelogItemDiff`、単一用途 helper export を整理する
6. 必要な型だけ `readonly` を戻し、domain snapshot / output DTO / external contract DTO の不変意図を明示する

### 実務で使う説明

- domain に置く理由は「技術形式を変えても残る業務判断だから」
- infrastructure に置く理由は「外部形式・外部サービス・保存形式に依存するから」
- application に置く理由は「判断そのものではなく、判断を使って usecase を進めるから」
- port を作る理由は「副作用を差し替えたいから」
- `packages/types` に置く理由は「他アプリが読む公開 JSON 契約だから」
- `readonly` を付ける理由は「DDD だから」ではなく「この値を snapshot / contract として mutation しないから」

### 参考資料

- ADR 0019: changelog-fetcher への DDD 適用方針
- ADR 0020: DDD 層分類の判断ヒューリスティック
- ADR 0021: changelog-fetcher の副作用境界を port で抽象化する
- NotebookLM「ドメイン駆動設計入門.md」(Notebook ID: `f48ebcc4-48c3-44b5-80c0-02124052c154`, Source ID: `4bbc10f9-247d-4f68-b3d8-90e582530836`)
