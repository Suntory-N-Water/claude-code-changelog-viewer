# ADR 0023: 複数プロジェクトで再利用する DDD 層分類ガイドライン

## Status

Proposed

## Context

このリポジトリでは、notification-worker と changelog-fetcher で Functional DDD の導入を進めてきた。ADR 0016-0018 では notification-worker、ADR 0019-0022 では changelog-fetcher を対象に、`domain` / `application` / `infrastructure` / entrypoint の分離、port の使い方、DTO と外部 JSON 契約の扱いを整理した。

ただし、これらの ADR には対象プロジェクト固有の語彙が多く含まれる。今後、別の CLI、Worker、バッチ処理、データ生成ツールでも DDD を使う場合に、同じ判断を再利用できるよう、プロジェクト非依存の層分類ガイドラインを残す。

この ADR は、特定の実装をそのまま他プロジェクトへ移植するためのものではない。新規プロジェクトで DDD を採用するときに、最初の層分類と責務分担の指針として参照することを目的とする。各プロジェクトの入力形式、出力契約、運用上の関心、チームが守りたい不変条件を明示したうえで、層分類を判断するための共通の言葉を提供する。

この ADR が扱うのは DDD 全体ではなく、実装時に迷いやすい層分類である。ユビキタス言語、境界づけられたコンテキスト、集約境界、コンテキストマップ、イベントストーミングなどの戦略的設計は、この ADR だけでは決めない。新規プロジェクトでは、この ADR を入口として使い、必要に応じてプロジェクト固有の DDD 方針 ADR を追加する。

### 解決したい課題

- 「domain に置くべきか infrastructure に置くべきか」の判断が、対象プロジェクトの具体例に引きずられやすい
- 純粋関数なら domain、外部 API なら infrastructure のような単純化で誤分類が起きる
- application service に usecase 進行と domain rule が混ざり、後から説明しづらくなる
- DTO、外部 JSON 契約、AI 応答 schema、domain snapshot の境界が曖昧になりやすい
- port や helper を増やす判断が抽象化そのものを目的にしてしまう

### 検討した選択肢

1. プロジェクトごとに個別 ADR を作り、共通ガイドラインは作らない
2. DDD の一般論だけを ADR に残し、具体例は一切書かない
3. 共通ガイドラインを作り、具体例は必ず前提条件付きで記載する

### 各選択肢の評価

| 観点 | ① 個別 ADR のみ | ② 一般論のみ | ③ 前提条件付きガイドライン |
|------|-----------------|--------------|------------------------------|
| 他プロジェクトへの再利用 | 低い | 中 | 高い |
| 誤適用の防止 | 中 | 低。抽象的すぎる | 高い |
| 実装時の判断しやすさ | 中 | 低い | 高い |
| プロジェクト固有事情の扱い | 高い | 低い | 高い |
| ADR の保守性 | 中 | 高い | 中 |

## Decision

**DDD の層分類は、対象プロジェクトの前提条件を明示したうえで、domain / application / infrastructure / entrypoint の責務として判断する。具体例は前提条件なしに一般化しない。**

### 1. まず対象プロジェクトの前提条件を明示する

層分類の前に、少なくとも次を明示する。

| 項目 | 確認する内容 |
|------|--------------|
| 入力 | CLI 引数、HTTP request、queue message、Markdown、JSON、DB record、外部 API response など |
| 出力 | UI response、通知、保存 JSON、DB record、生成ファイル、外部 API request など |
| 利用者 | エンドユーザー、運用者、他アプリ、後続バッチ、AI モデルなど |
| 守りたい判断 | 分類、重複判定、状態遷移、優先順位、権限制御、通知可否、公開可否など |
| 変わりやすい技術詳細 | 保存先、外部 API、ファイル形式、SDK、AI provider、ログ基盤など |

この前提がないまま「この関数は domain」と決めない。

### 2. domain は入力形式を変えても残る判断を置く

domain には、対象プロジェクトが守りたい業務上の不変条件、分類、重複判定、優先順位、状態遷移を置く。実装が純粋関数であることは domain の十分条件ではない。重要なのは、その判断が技術形式や保存形式を変えても残るかである。

ただし、「入力形式を変えても残るか」は有力なヒューリスティックであり、唯一の条件ではない。最終的には、その判断が対象ドメインの問題解決に必要な知識であり、ドメインの言葉で説明できるかを確認する。逆に、Markdown、CSV、JSON、帳票、特定ファイル形式のように技術形式に見えるものでも、利用者が業務上その形式を概念として扱うなら domain に含まれる可能性がある。

また、「入力形式を変えても残るか」だけでは application との区別がつかないことがある。追加の判断軸として「それはドメインの不変条件・業務ルールか、それとも usecase の進行管理か」を合わせて確認する。

#### ドメインモデル貧血症に注意する

Functional DDD で純粋関数ベースのアプローチを採用する場合、domain の業務ルールをすべてドメインサービス相当の関数に切り出し続けると、domain 型がデータを保持するだけの入れ物になる(ドメインモデル貧血症)。データとふるまいが断絶し、ロジックが散在して変更コストが高くなる。

ふるまいの配置に迷った場合は、まず domain 型(値オブジェクト・エンティティ相当の型)にロジックを持たせることを検討する。複数オブジェクトを横断する処理など、特定の型に持たせると不自然になるものに限って、ドメインサービス相当の関数として切り出す。

```ts
// 前提: 対象プロジェクトでは「同じ key は一度だけ扱う」ことが業務ルールである。
// 判断: 入力が Markdown でも JSON でも DB record でも残るため domain。
export function dedupeByBusinessKey<T extends { key: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
}
```

```ts
// 前提: 対象プロジェクトでは "- " で始まる行だけを項目として読む入力形式を採用している。
// 判断: Markdown の読み方であり、入力形式を JSON に変えると消えるため infrastructure。
export function parseMarkdownListItems(markdown: string): string[] {
  return markdown
    .split("\n")
    .filter((line) => line.startsWith("- "));
}
```

### 3. application は usecase の進行を置く

application は、domain の判断と infrastructure の外部能力を組み合わせて usecase を完了させる層である。ここには、どの port を呼ぶか、retry するか、既存結果を再利用するか、どのタイミングで保存するかを置く。

application がやってはいけないことを明示する。

- **domain rule を自ら記述しない。** 業務上の不変条件・分類・重複判定・状態遷移は domain 関数へ委譲する。application が domain object の内部状態を細かく組み立て続けると、domain rule が application に漏れる。

```ts
// 前提: 対象プロジェクトでは、外部 AI の結果を既存分析へ反映する usecase がある。
// 判断: AI batch id と元データの対応付けは usecase 進行なので application。
// ただし、分析済み item がどの状態へ更新されるかは domain 状態遷移に委ねる。
export async function applyExternalInference(input: {
  batch: InferenceBatch;
  analysis: AnalysisSnapshot;
}): Promise<AnalysisSnapshot> {
  return {
    ...input.analysis,
    items: input.analysis.items.map((item) =>
      applyInferenceToItem(item, findBatchItem(input.batch, item)),
    ),
  };
}
```

### 4. infrastructure は外部形式と技術基盤を置く

infrastructure には、DB、filesystem、HTTP、SDK、AI provider、Markdown parser、JSON schema、snake_case / camelCase 変換、Date 文字列変換などを置く。

外部データから domain object を再構築するために、infrastructure が domain factory や domain の純粋関数を呼ぶことは許容する。ただし、重要な domain policy を adapter の内部事情として隠さない。policy として説明したい判断は domain に置き、application から見える形で使うことを検討する。

domain type ↔ 外部 JSON 契約の変換(snake_case 変換、スキーマ整形、branded type の解除など)は infrastructure のシリアライザーに置く。entrypoint が domain 型のフィールドに逐一アクセスしてこの変換を書くのは infrastructure の仕事が entrypoint に漏れている状態であり、domain のフィールド名変更が entrypoint まで波及する原因になる。

```ts
// 前提: 保存ファイルは snake_case JSON、アプリ内部は camelCase の domain 型を使う。
// 判断: snake_case 変換と外部スキーマ整形は保存契約なので infrastructure のシリアライザーに置く。
// infrastructure が domain factory を呼んで domain object を再構築することも許容する。
export function toStoredJson(analysis: ChangelogAnalysis): StoredAnalysis {
  return {
    version: toVersionNumber(analysis.version),           // domain 関数を呼ぶ
    items: analysis.items.map((entry) => ({
      feature_areas: [...entry.featureAreas],             // camelCase → snake_case
      hit_count: entry.relatedDocs[0]?.hitCount ?? 0,     // camelCase → snake_case
    })),
  };
}

export function fromStoredJson(stored: StoredAnalysis): ChangelogAnalysis {
  return createChangelogAnalysis({                        // domain factory を呼ぶ
    version: createChangelogVersion(stored.version),
    items: stored.items.map((item) =>
      createAnalyzedChangelogEntry({
        featureAreas: item.feature_areas,                 // snake_case → camelCase
      }),
    ),
  });
}
```

### 5. entrypoint は実行環境への接続だけを置く

entrypoint は、CLI、HTTP route、queue handler、cron handler、test fixture runner などの入口である。ここには argv / env / request / response / exit code / wiring / 表示ログを置く。

entrypoint に domain rule を置かない。entrypoint でしか使わない変換でも、外部契約の変換なら infrastructure、usecase input の組み立てなら application 境界として扱う。

entrypoint は domain 型のフィールドに直接アクセスして変換処理を書かない。domain 型 ↔ 外部 JSON 契約の変換(snake_case 変換・スキーマ整形)は infrastructure のシリアライザーに置く。entrypoint が変換を書くと domain のフィールド名変更が entrypoint まで波及する。

### 6. DTO と外部契約は公開範囲で分類する

DTO は domain object ではない。DTO の置き場所は「誰との契約か」で決める。

| DTO の種類 | 置き場所 | 判断理由 |
|------------|----------|----------|
| 他アプリも読む保存 JSON 契約 | shared package または contract package | 公開契約であり、複数プロジェクトが依存する |
| そのアプリ内部だけの外部 API response | infrastructure | provider や SDK の応答形式に依存する |
| usecase の入力・出力 | application | usecase 境界の入れ物であり、domain rule ではない |
| domain snapshot | domain | 不変条件や状態遷移の対象として扱う値である |

特定プロジェクトで shared package を使う場合も、内部 provider 応答 schema を shared package に置かない。shared package に置くのは、他プロジェクトが読むことを約束した契約だけにする。

### 7. port は依存を逆転させるために置く

domain と application は infrastructure に直接依存しない。infrastructure の変更がビジネスロジックに波及することを防ぎ、テストで差し替えられる状態を保つために、port(interface)を介して依存の方向を逆転させる。

```
application → port (interface) ← infrastructure (実装)
```

domain は port すら呼ばない。port を呼ぶのは application だけである。domain は純粋関数として引数を受け取り値を返すだけで、外部への依存を持たない。

port は、外部 API、DB、filesystem、AI provider、queue、mail、検索基盤など、差し替えたい副作用境界にだけ置く。

純粋な形式変換、domain rule、単なる map 処理を interface で包まない。port を作る理由を「テストで差し替えたい」「外部 provider を隠したい」「usecase が技術基盤へ依存しないようにしたい」と説明できない場合は追加しない。

repository port は、単なる DB / filesystem 操作の隠蔽ではなく、集約、domain snapshot、または usecase が扱う永続化対象の保存と再構築を表す境界として定義する。`executeSql`、`readJsonFile`、`putObject` のような技術語彙を application へ公開せず、`saveAnalysis`、`findChangelogByKey`、`loadNotificationState` のように、対象プロジェクトの概念に沿った操作として表現する。

repository は変更の単位(集約または domain snapshot)ごとに用意する。複数の集約をまたぐ操作を一つの repository に混在させると、domain policy が repository 実装に紛れ込みやすい。

一方で、重複判定、状態遷移、分類、優先順位付けなどの domain policy を repository 実装へ押し込まない。repository が返す取得結果を使って判断することはあっても、何をもって重複とみなすか、どの状態へ遷移できるかといった判断は domain または application から見える domain 関数に置く。

### 8. 複雑なオブジェクト生成は domain 層にまとめる

domain object の生成が複数ステップにわたる場合、その生成知識を domain 層の関数(ファクトリ相当)にまとめる。生成ロジックを application や infrastructure に置くと、domain rule が層をまたいで散らばる。

単純な生成(フィールドをそのまま詰めるだけ)はインラインで十分である。生成条件の検証、複数フィールドの組み合わせ判断、生成失敗のハンドリングが必要な場合に domain 層の生成関数として切り出す。

### 9. helper は抽象化ではなく可読性と責務で判断する

helper は原則として追加しない。追加してよいのは、2箇所以上から呼ばれる、分岐・検証・副作用境界がありインラインでは明確に読みにくい、または既存の同種パターンに揃える必要がある場合である。

1箇所からしか呼ばれない整形・map・変換処理は、まず call site に置く。例外として、外部契約変換や domain 状態遷移のように名前が責務を説明する場合は、単一 call site でも関数化を許容する。

### 10. `readonly` は層分類ではなく mutation 意図で判断する

`readonly` が付いているから domain、付いていないから application とは判断しない。`readonly` は、値を snapshot / value object / external contract として扱い、mutation しない意図を表すために使う。

戻す候補は次である。

- domain の value object / snapshot
- application の usecase input / output
- infrastructure の外部 JSON 契約 DTO
- port input / result 型

ローカル accumulator や一時的に組み立てる mutable object にまで機械的に付けない。

## Consequences

### Positive

- プロジェクト固有の語彙に引きずられず、DDD の層分類を説明できる
- 具体例を前提条件付きで扱うため、別プロジェクトへの誤適用を減らせる
- domain rule、外部契約、usecase orchestration、技術基盤の境界が明確になる
- port と helper の増加を抑え、過度な抽象化を避けられる

### Negative

- 判断前に前提条件を明示する手間が増える
  - → 前提条件が曖昧なまま分類すると後で移動コストが大きくなるため、最初に短く書く
- グレーゾーンが完全には消えない
  - → 「入力形式を変えても残るか」「業務の人に説明できるか」「誰との契約か」を追加で確認する
- 単一 call site の関数化を常に禁止できるわけではない
  - → domain 状態遷移や外部契約変換のように名前が責務を説明する場合だけ例外にする

### Risks

- この ADR の具体例だけをコピーして、前提条件を確認せずに別プロジェクトへ適用するリスクがある
  - → 具体例はすべて「前提」を含めて読む。前提が違う場合は結論も変わる
- 「domain に置く」ことが目的化し、DTO や provider 応答まで domain に入れるリスクがある
  - → DTO は誰との契約かで置き場所を決める
- 「外部依存は port」という言葉だけが一人歩きし、薄い interface が増えるリスクがある
  - → port は副作用差し替えのためだけに使う
- Functional DDD で純粋関数に切り出し続け、domain 型がデータ保持専用の入れ物になるリスクがある(ドメインモデル貧血症)
  - → ふるまいはまず domain 型に持たせる。複数オブジェクトを横断する処理だけ関数として切り出す
- entrypoint が domain 型のフィールドに逐一アクセスして変換処理を書き、infrastructure の仕事が entrypoint に漏れるリスクがある
  - → domain 型 ↔ 外部 JSON 契約の変換は infrastructure に置く

## 決めていないこと

| 項目 | 決めない理由 | いつ決めるか |
|------|--------------|--------------|
| 具体的なディレクトリ名 | プロジェクトごとに runtime や既存構成が異なるため | 各プロジェクトの ADR で決める |
| class ベース DDD か Functional DDD か | この ADR は層分類の判断基準が対象であり、実装スタイルは別判断であるため | プロジェクトの言語・既存設計に合わせて決める |
| shared package の具体名 | モノレポ構成に依存するため | 外部契約を共有するプロジェクトで決める |
| ユビキタス言語、境界づけられたコンテキスト、集約境界、コンテキストマップ | この ADR は層分類の共通指針であり、戦略的設計やモデル境界は対象ドメインごとの議論が必要なため | 新規プロジェクトの立ち上げ時、または既存モデルの語彙や責務が衝突したときに別 ADR で決める |
| repository port を domain package / application package / ports package のどこに置くか | 言語機能、モノレポ構成、依存方向、テスト方針によって最適解が変わるため | 各プロジェクトで依存方向と公開範囲を決めるときに議論する |
| 「入力形式に見えるが業務概念でもあるもの」の扱い | 帳票、Markdown、CSV、外部規格などは技術形式にも業務語彙にもなり得るため | 対象利用者がその形式を業務上の概念として扱うかを確認して決める |

## Notes

### 判断チェックリスト

- この処理は、入力形式を変えても残るか
- この処理は、ドメインの不変条件・業務ルールか、それとも usecase の進行管理か
- この処理は、業務の人が変更理由を説明できる判断か
- domain 型はデータを保持するだけの入れ物になっていないか(ドメインモデル貧血症)
- ふるまいを関数に切り出す前に、domain 型に持たせることを検討したか
- この型は、domain snapshot か、usecase DTO か、外部契約 DTO か
- この DTO は、誰との契約か
- entrypoint が domain 型のフィールドに直接アクセスして変換処理を書いていないか(変換は infrastructure のシリアライザーに置く)
- 翻訳・検索結果・domain データを混合した出力は application DTO として定義しているか
- この port は、依存を逆転させるために必要か(domain/application が infrastructure に直接依存しないためか)
- domain が port を呼んでいないか(port を呼ぶのは application だけ)
- この helper は、責務の名前を与える価値があるか
- この `readonly` は、mutation しない意図を説明しているか

### 参考資料

- ADR 0016: notification-worker への DDD 適用方針
- ADR 0018: notification-worker DDD 実践記録
- ADR 0019: changelog-fetcher への DDD 適用方針
- ADR 0020: DDD 層分類の判断ヒューリスティック
- ADR 0021: changelog-fetcher の副作用境界を port で抽象化する
- ADR 0022: changelog-fetcher DDD レビュー結果と次セッションの整理方針
- NotebookLM「ドメイン駆動設計入門.md」(Notebook ID: `f48ebcc4-48c3-44b5-80c0-02124052c154`, Source ID: `4bbc10f9-247d-4f68-b3d8-90e582530836`)
