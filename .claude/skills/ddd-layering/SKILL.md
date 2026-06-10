---
name: ddd-layering
description: TypeScript の関数主体 DDD プロジェクトで、新規コードや既存コードを domain / usecase / infrastructure / entry point のどこに配置すべきかを判断するための内部手順書。次のいずれかに該当する場合に起動する — (1) domain / usecase / infrastructure / entry point / port / 集約 / リポジトリ / ユースケース / 値オブジェクト / エンティティ / ドメインサービス / ファクトリ / 仕様パターン といった DDD 語彙が登場する、(2) 「これはどの層に置くべきか」「port を切るべきか」「helper を関数化すべきか」「DTO はどこに置くか」のような層配置・モデリング判断が必要、(3) domain/ usecase/ infrastructure/ のレイアウトを持つ既存コードベースを編集する。非 DDD プロジェクト(単純な CRUD、スクリプト、UI のみ)では起動しない。
---

# Functional DDD 層分類スキル

Functional DDD を採用するプロジェクトで層配置・モデリング判断を行うときに Claude が参照する内部手順書。
成果物は「層分類のドキュメント」ではなく**コード**である。判断を素早く下し、ユーザと議論しながら実装に進む。

> **実装スタイル**: 関数宣言と純粋関数を既定とする(TypeScript で自然な書き方)。エンティティの状態遷移や複雑な不変条件の管理など、関数構成だと可読性が明確に落ちる箇所に限ってクラスを使ってよい。クラスを使う場合も、本 skill の層分類・集約境界・port の判断はそのまま適用する。

---

## 目次

- [0. ワークフロー全体](#0-ワークフロー全体)
- [1. 前提整理](#1-前提整理)
- [2. 層の責務](#2-層の責務)
- [3. 判定フロー](#3-判定フロー)
- [4. モデリング判断](#4-モデリング判断)
- [5. 横断的な判断軸](#5-横断的な判断軸)
- [6. アンチパターン照合](#6-アンチパターン照合)
- [7. 最小例](#7-最小例)

---

## 0. ワークフロー全体

**ショートカット条件**: 次のすべてに該当する軽微変更はこのワークフローを skip し、直接実装してよい。
- 既存ファイルの位置を変えない
- 新規型・新規 port・新規 usecase 関数を作らない
- 既存ロジックの意味を変えない(rename / typo fix / 既存バグの修正 / フォーマット整え)

逆に次のいずれかが絡む場合は必ず §0 をフル実行する。
- 新しい型・新しい port・新しい usecase 関数の追加
- 既存コードのレイヤ間移動
- 既存集約への新しい不変条件の追加


1. **前提を聞く** (§1) — 業務上の不変条件・ポリシーは **AskUserQuestion で必ず 1 問確認する**(コードや会話履歴からは読めないため)。入力 / 出力 / 技術依存はコード・会話履歴から読み取れるならスキップ可。前提が曖昧なまま層を断定しない。
2. **層を決める** (§2, §3) — 判定フローを順に当てて domain / usecase / infrastructure / entry point のどれかに落とす。
3. **モデリング判断** (§4) — 値オブジェクト vs エンティティ、集約境界、ファクトリ、リポジトリ、ドメインサービス、仕様パターンを決める。
4. **横断軸の確認** (§5) — DTO 配置、port の要否、helper の要否、readonly。
5. **アンチパターン照合** (§6) — 結論が表のどれかに該当しないかを最後にチェックする。
6. **配置案を提示して合意を取る** — 次の 4 行フォーマットで提示する。ユーザが OK と言うまでコードに進まない。長文ドキュメント化はしない。

   ```
   [配置案]
   - domain: <型・関数を列挙>
   - usecase: <ユースケース関数・受け取る port を列挙>
   - infrastructure: <port 実装・シリアライザ・リードモデルを列挙>
   - 残課題: <聞き残し・判断保留・要確認を 1 〜 2 件。なければ「なし」>
   ```

7. **実装する** — 合意済みの配置案に沿ってコードを書く。

---

## 1. 前提整理

層分類は前提によって結論が変わる。実装に入る前に、最低この 4 つは言語化する。会話履歴に既出のものは聞き直さない。

| 項目 | 具体例 |
|------|--------|
| 入力 | CLI 引数 / HTTP request / queue message / Markdown / JSON / DB record / 外部 API response |
| 出力 | UI response / 通知 / 保存 JSON / DB record / 生成ファイル / 外部 API request |
| 業務上の不変条件・ポリシー | 分類 / 重複判定 / 状態遷移 / 優先順位 / 権限制御 / 公開可否。**ドメインエキスパートが説明できる判断** |
| 差し替え候補となる技術依存 | 保存先 / 外部 API / ファイル形式 / SDK / AI provider / ログ基盤 |

**業務上の不変条件・ポリシーは必ず AskUserQuestion で 1 問確認する**。コードや会話履歴からは推測できず、ここを誤ると domain と usecase の区分け自体が破綻するため。他の 3 項目(入力 / 出力 / 技術依存)はコード・会話履歴から十分読み取れるならスキップしてよい。読み取れず判断を左右するときだけ追加で聞く。1 ターンの質問は最大 2 件までにまとめ、質問攻めにしない。

---

## 2. 層の責務

| 層 | ディレクトリ | 役割 | 副作用 | port |
|----|-------------|------|--------|------|
| domain | `domain/` | 業務上の不変条件・分類・状態遷移を表現する型と純粋関数。port (interface) の宣言を置くことが**できる** | 不可 | 宣言のみ |
| usecase | `usecase/` | ユースケースの進行管理。port 呼び出し順、retry、トランザクション境界 | port 経由でのみ | 引数で受ける |
| infrastructure | `infrastructure/` | 外部形式・技術基盤・副作用。port 実装、シリアライザ、リードモデル | あり | 実装 |
| entry point | `routes/`, `cli/`, `queue/` 等 | 実行環境との接続のみ。argv / env / request / response / exit code / wiring | 実行環境固有 | 組み立てる |

---

## 3. 判定フロー

### Q1. 副作用を持つか?(`await fetch`, `fs`, `db`, SDK 呼び出し、`Date.now()`、ランダム生成等)

- **持つ** → infrastructure(port 実装)または entry point。Q4 へ。
- **持たない** → Q2 へ。

### Q2. 業務ルールか、進行管理か?

「ドメインエキスパートが言葉で説明できる判断」(分類、重複判定、状態遷移、優先順位、公開可否)か、「どの port をどの順で呼ぶか・retry・トランザクション境界」か。

- **業務ルール** → Q3 へ(domain 候補)。
- **進行管理** → usecase。

### Q3. 入力形式 / 保存形式を変えても残る判断か?

例: 入力が CLI から HTTP に変わっても、保存先が JSON から DB に変わっても、その判断は残るか?

- **残る** → domain。
- **形式に依存する**(snake_case ↔ camelCase 変換、JSON schema 整形、provider 応答パース) → infrastructure のシリアライザ。

補足: Markdown / CSV / 帳票のように技術形式に見えても、**利用者が業務上その形式を概念として扱う**なら domain に含まれうる。

### Q4. infrastructure か entry point か?

- 外部 API / DB / filesystem / AI provider / queue / mail / 検索基盤への副作用、または domain 型 ↔ 外部契約の変換 → **infrastructure**。
- argv / env / request / response / exit code / port の組み立て(wiring)/ 表示ログのみ → **entry point**。
- entry point に業務ルールや「フィールド名変換」が混ざっていたら infrastructure に移す。

---

## 4. モデリング判断

### 値オブジェクト vs エンティティ

判定軸は **同一性 vs 等価性 / ライフサイクル**。

- 値オブジェクト: 同じフィールド値を持つ 2 つは同一とみなす。不変。変更時は新しい値を返す。
- エンティティ: ID で同一性を判定する。生成・更新・削除のライフサイクルを持つ。更新時もスプレッドで新オブジェクトを返す。

境界事例(同じ概念でも文脈で扱いが変わる)では「業務上ライフサイクル・履歴・連続性を持たせる必要があるか」を問う。

不変性は `readonly` だけでは保証されない:
- 配列要素 → `ReadonlyArray<T>`
- ネスト → 再帰的に `Readonly`
- 同じ参照を複数の集約が共有 → 生成時にコピー

### 集約境界

**変更の単位** = 集約。1 トランザクションで一緒に変更すべき範囲を 1 つの集約にする。

- 外部からの操作は集約ルート経由のみ。境界内オブジェクトを直接公開しない。
- 他の集約は **ID で参照**(直接参照を持たない)。
- 1 つのユースケースで変更する集約は原則 1 つ。複数集約をまたぐなら結果整合性を検討する。

### ファクトリ

**作る条件**(いずれか):
- 採番が伴う
- 複数フィールドの検証が必要
- 複数オブジェクトの組み立てが必要
- 生成失敗のハンドリングが必要

**作らない**: フィールドをそのまま詰めるだけ → インライン。

配置は **domain**。生成知識は業務ルールの一部。usecase / infrastructure に散らさない。

### リポジトリ

**集約単位で 1 つ**。

- 命名はドメインの言葉:`saveAnalysis`, `findChangelogByKey`, `loadNotificationState`。`executeSql`, `readJsonFile` のような技術語彙を usecase に公開しない。
- domain policy(重複判定、状態遷移、分類)を repository 実装に押し込まない。
- 集約をまたぐ複雑なクエリ(集計・一覧)は集約 repository に押し込まず、**リードモデル**として infrastructure に書いてよい。ただし**書き込みは必ず集約 repository 経由**。
- **port の宣言位置**: 「集約型(エンティティ)を直接引数・返り値に取るか」で決める。
  - **domain に置く**: 集約型を直接やり取りする境界。命名は `~Repository`, `~Notifier`。例: `ChannelRepository.save(channel: Channel)`, `ChannelNotifier.notify(channel: Channel)`。
  - **usecase に置く**: usecase の入出力データフローを担う境界(raw API response, 保存 JSON, 検索結果など)。命名は `~SourcePort`, `~StorePort`, `~SearchPort`。例: `ChangelogSourcePort.fetch(): RawChangelog`, `AnalysisStorePort.save(analysisJson)`。
  - 既存プロジェクトに別命名規則があればそれに揃える。

### ドメインサービス(最後の手段)

**先に**値オブジェクトかエンティティ相当の型(その型を引数に取る関数)にふるまいを持たせられないか検討する。
それでも単一の型に持たせると不自然な、複数オブジェクトを横断する業務ルールに限って独立した純粋関数として切り出す。

**ガード**: ドメインサービスを作る前に、「なぜ X 型に持たせると不自然か」を 1 文で言語化すること。例: 「`isDuplicateWithin24h` は新規 `Article` 1 件と既存 `Article[]` 2 種類のコレクションを比較するため、どちらの型にメソッドとして持たせても主従が逆転して不自然」。1 文で説明できないなら、それは型に持たせるべき。この一手間でドメインモデル貧血症を物理的に防ぐ。

既定は状態を持たない純粋関数として実装する(複雑な不変条件管理でクラスのほうが明確なら可)。いずれの形でも **repository を呼ばない**(domain は副作用を持たない)。

複数オブジェクト横断の業務ルール(重複判定など)は、usecase が repository でデータを揃えて domain 関数に**引数として渡す**パターンで実現する。domain 関数自身が repository を呼ぶ形にしない。

ドメインサービスの濫用はドメインモデル貧血症を招く。

### 仕様パターン

評価基準を満たすかを判定する関数として切り出す。

- 用途: 複数フィールドの組み合わせ判定など、メソッドに埋もれさせず**ドメインの語彙で**切り出したいとき。
- 単純な述語(`isActive` 等)は型を引数に取る関数で十分。
- 仕様パターンは**複数条件を組み合わせる必要が出てきたとき**に初めて導入する。

---

## 5. 横断的な判断軸

### DTO の置き場所

「**誰との契約か**」で決める。

| DTO の種類 | 置き場所 | 理由 |
|-----------|---------|------|
| 他アプリも読む保存 JSON 契約 | shared / contract package | 公開契約 |
| そのアプリ内部だけの外部 API response | infrastructure | provider 応答形式に依存 |
| ユースケースの入力・出力 | usecase | ユースケース境界の入れ物。業務ルールではない |
| domain snapshot | domain | 不変条件・状態遷移の対象 |

shared package には**他プロジェクトが読むことを約束した契約だけ**を置く。内部 provider 応答 schema を出さない。

### port の作成条件

```
usecase → port (interface) ← infrastructure の実装
```

- domain は port すら呼ばない(純粋関数として引数を受け取り値を返す)。port を呼ぶのは **usecase だけ**。
- 新設の理由が次のいずれかで説明できなければ作らない:
  1. テストで差し替えたい
  2. 外部 provider を usecase から隠したい
  3. 副作用境界を usecase から遠ざけたい
- 適切な対象: 外部 API / DB / filesystem / AI provider / queue / mail / 検索基盤。
- **作らない**: 純粋な形式変換、業務ルール、単なる map 処理。**薄い interface は禁止**。

### helper の追加条件

層分類の文脈で helper を追加すべきか迷う典型ケースに対する判断軸。一般的な helper 規約はプロジェクトの CLAUDE.md に従う。

| ケース | 判断 |
|--------|------|
| domain 関数内で値オブジェクトの変換が 1 箇所だけ | インライン。値オブジェクト型のメソッド/関数に持たせるか、call site で展開 |
| usecase 内の port 呼び出しの前後処理 | 原則インライン。**名前が責務を説明できる**(`buildDeduplicationKey` など)なら usecase ファイル内の private 関数で関数化可 |
| infrastructure のシリアライザ(JSON ↔ domain 型) | 関数化。**「シリアライザは名前が責務を説明する」例外**にあたるため、単一 call site でも分離する |
| 同じ domain ルールが 2 つの usecase から呼ばれる | domain 関数として切り出す(これは helper というより domain の純粋関数の追加) |

新規追加した場合は call site 数を確認し、1 箇所だけならインライン化できない理由を 1 文で言語化する。

### readonly の使い分け

層ではなく **mutation 意図** で判断する。

付ける: domain の値オブジェクト / snapshot、usecase input / output DTO、外部 JSON 契約 DTO、port の input / result 型。

付けない: ローカル accumulator、一時的に組み立てる mutable object。

---

## 6. アンチパターン照合

最後にこの表で結論を点検する。1 行でも当てはまるなら設計を見直す。

| 兆候 | 何が壊れるか | 直し方 |
|------|------------|-------|
| 純粋関数だから domain と即断 | DTO / provider 応答まで domain に混入 | 「入力形式に依存しないか」「誰との契約か」を再確認 |
| 外部依存だから port と即断 | 薄い interface が量産される | 「差し替え / 隠蔽 / 依存制御」のいずれかで説明できるか |
| domain 型がデータ保持専用 | ドメインモデル貧血症 | まず値オブジェクト・エンティティ相当の型にふるまいを持たせる |
| usecase で `if (count >= 3)` のような業務ルール分岐 | domain ルールの漏れ | domain 関数に委譲 |
| entry point で `obj.fieldA` → `field_a` 変換 | infrastructure の仕事が漏れる | infrastructure のシリアライザに移す |
| repository 実装の中で重複判定 | domain policy が repository に混入 | domain 関数に出して usecase から呼ぶ |
| shared package に provider 応答 schema | 公開範囲ミス | 内部 schema は infrastructure に閉じ込める |
| `port.executeSql(sql)` | 技術語彙が usecase に漏れる | `port.saveAnalysis(analysis)` のようにドメインの言葉に置き換え |
| 集約型を引数・返り値に取る repository を usecase 側に宣言 | port 命名規則が崩れて domain 境界が見えなくなる | `~Repository` / `~Notifier` は domain へ移す |
| raw データの SourcePort / StorePort を domain 側に宣言 | domain が外部形式に汚染される | usecase 入出力境界は usecase へ移す |
| domain で `await fetch(...)` | domain が副作用を持つ | port を usecase 経由で呼ぶ |
| 1 ユースケースで複数集約を同一トランザクションで保存 | ロック競合、整合性破綻 | 集約境界を見直す、または結果整合性へ |
| ドメインサービスを早期に量産 | ロジックが点在し貧血症を招く | まず型にふるまいを持たせる |

---

## 7. 最小例

業務: 「ユーザが記事を投稿する。同タイトルが過去 24 時間以内にあれば拒否」。入力は HTTP、保存は DB。

- **domain**
  - `Article`(エンティティ。ID と作成日時を持つ)
  - `ArticleTitle`(値オブジェクト。長さ検証を持つ)
  - `isDuplicateWithin24h(newTitle, recentArticles): boolean` — 横断ルール。**repository を呼ばない**。`recentArticles` は引数で受ける
  - `ArticleRepository` port を**宣言**(集約直結の repository を domain に置く方針の場合)
- **usecase**
  - `postArticle(input, deps)`:
    1. `deps.articleRepo.findRecent(24h)` で履歴を取得
    2. `isDuplicateWithin24h` を呼ぶ
    3. 拒否なら `Result.error('duplicate')` を返す
    4. `Article` を組み立て `deps.articleRepo.save(article)`
- **infrastructure**
  - `ArticleRepository` の DB 実装
  - HTTP request body ↔ usecase input DTO のシリアライザ
- **entry point** (`routes/articles.ts`)
  - HTTP body をパースし usecase を呼び、結果を HTTP response に変換するだけ

`if (duplicate)` を usecase で書くのは OK(分岐はユースケース進行管理)。**判定そのもの**(`isDuplicateWithin24h`)は domain にある点に注意。
