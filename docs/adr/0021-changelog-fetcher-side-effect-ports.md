# ADR 0021: changelog-fetcher の副作用境界を port で抽象化する

## Status

Accepted

## Context

ADR 0019 では `changelog-fetcher` を `domain` / `application` / `infrastructure` / `cli` の4分類へ移行する方針を決め、ステップ 7 として Gemini・GitHub / fetch / fs・docs search・schema 読み込みを infrastructure port に閉じ込めることを次の作業にした。

直近の実装では、`parse-changelog.ts` に残っていた GitHub 取得、remote Markdown 取得、ファイル読み書き、差分 JSON の読み書き、メタデータ更新を `application/fetch-changelog.ts` と infrastructure adapter へ分離した。あわせて、`fetch-builtin-data.ts` に直書きされていた remote Markdown 取得、GitHub API 取得、builtin-data JSON 書き込みも `application/fetch-builtin-surface.ts` と infrastructure adapter へ分離した。

この変更により、どこまでを port で抽象化し、どこからは単なる infrastructure 関数として扱うかを記録する必要が生じた。特に、外部依存を port 化する判断が DDD として妥当かどうかは NotebookLM の `ドメイン駆動設計入門.md`(ソース ID: `4bbc10f9-247d-4f68-b3d8-90e582530836`)で確認した。

同資料では、リポジトリは永続化・再構築を抽象的に扱うオブジェクトであり、具体的なデータストアが RDB、NoSQL、ファイルのどれかはドメインにとって重要ではないと説明されている。また、リポジトリはインターフェースで定義し、SQL や EntityFramework のような具体技術に依存した処理は実装クラスに記述してよいとされている。第14章では、インフラストラクチャ層は技術基盤へのアクセスを提供する層であり、クリーンアーキテクチャでは UI やデータストアなどの詳細を外側へ追いやり、依存方向を内側へ向けると説明されている。

一方で、同資料はリポジトリにドメインルールを寄せすぎる危険も示している。たとえば重複確認のようなルールをリポジトリ実装に入れると、実装次第で動作が変わり、ドメインサービスが主体ではなくなる。したがって、port は副作用境界を抽象化するために使い、ドメイン判断や形式変換を何でも port 化しないことが重要である。

### 解決したい課題

- `parse-changelog.ts` が GitHub 取得、remote fetch、Markdown パース、差分検知、fs 書き込み、JSON 変換、終了コード制御を同時に担っていた
- `fetch-builtin-data.ts` が remote Markdown 取得、GitHub API 取得、Markdown セクション抽出、JSON 書き込みを同時に担っていた
- `application/analyze-changelog.ts` が `infrastructure/docs/changelog-markdown-parser` と `keyword-extractor` を直接 import しており、application から infrastructure への依存が残っていた
- `extractMarkdownListItems` が domain に置かれていたが、実体は `cli-surface.md` の Markdown 記法に依存する形式パースだった
- port を増やしすぎると、ADR 0019 の「薄いラッパーを増やさない」方針に反する

### 検討した選択肢

1. CLI に外部 I/O とユースケース進行を残し、関数分割だけで整理する
2. すべての処理を port 化し、Markdown parser や純粋変換も interface 経由にする
3. GitHub / fetch / fs / AI / docs search のような副作用境界だけを port 化し、形式パースや純粋なドメイン判断は関数として残す

### 各選択肢の評価

| 観点 | ① CLI 内で関数分割 | ② すべて port 化 | ③ 副作用境界だけ port 化 |
|------|--------------------|------------------|--------------------------|
| DDD の依存方向 | 低。CLI に詳細が残り application が育たない | 高いが過剰 | 高い |
| 過度な抽象化の回避 | 中。抽象は増えないが責務が混ざる | 低。薄い interface が増える | 高い |
| テスト容易性 | 中。fs / fetch の差し替えが難しい | 高い | 高い |
| ADR 0020 との整合性 | 低。形式依存と業務判断が混ざりやすい | 中。形式依存まで port 化しやすい | 高い |
| 実装の読みやすさ | 中 | 低。追跡対象が増える | 高い |

## Decision

**changelog-fetcher では GitHub / fetch / fs / AI / docs search のような副作用境界だけを application port で抽象化し、infrastructure 実装に閉じ込める。**

### 1. application port はユースケースが必要とする外部能力として定義する

`application/` はユースケースの進行管理を担当する。具体的な `gh`、`fetch`、`node:fs`、Gemini SDK、docs ファイル検索には依存しない。

今回追加・整理した port は以下である。

| port | 定義場所 | 実装場所 | 抽象化する副作用 |
|------|----------|----------|------------------|
| `ChangelogSourcePort` | `application/fetch-changelog.ts` | `infrastructure/github/claude-code-changelog-client.ts` | `gh api` と remote CHANGELOG fetch |
| `ChangelogStorePort` | `application/fetch-changelog.ts` | `infrastructure/filesystem/changelog-file-store.ts` | changelog / metadata / diff JSON の fs 読み書き |
| `BuiltinSurfaceSourcePort` | `application/fetch-builtin-surface.ts` | `infrastructure/github/builtin-surface-client.ts` | remote Markdown と GitHub API の取得 |
| `BuiltinSurfaceStorePort` | `application/fetch-builtin-surface.ts` | `infrastructure/filesystem/builtin-surface-file-store.ts` | builtin-data JSON の fs 書き込み |
| `DocsSearchPort` | `application/analyze-changelog.ts` | `infrastructure/docs/docs-searcher.ts` | docs 検索、スニペット抽出、キーワード抽出 |

```ts
// 採用: application は外部能力を port として受け取る
export async function fetchChangelog(input: {
  readonly source: ChangelogSourcePort;
  readonly store: ChangelogStorePort;
  readonly detectedAt?: Date;
}): Promise<FetchChangelogResult> {
  const releases = await input.source.fetchReleases();
  const existingMetadata = await input.store.loadMetadata();
  // domain の純粋ルールと port を組み合わせてユースケースを進める
}
```

### 2. CLI は依存の組み立てと終了コードだけを担当する

`parse-changelog.ts` と `fetch-builtin-data.ts` は、実行時の依存組み立て、ログ、終了コードだけを担当する。

```ts
// 採用: CLI は wiring に寄せる
const result = await fetchChangelog({
  source: new ClaudeCodeChangelogClient(),
  store: new ChangelogFileStore(appDir),
});
```

これにより、`application/` は CLI 実行環境に依存せず、`infrastructure/` の実装差し替えも CLI の組み立てだけで行える。

### 3. Markdown parser は infrastructure 関数として扱い、原則 port 化しない

`parseChangelogEntries`、`parseChangelogReleases`、`extractBuiltinSurfaceSection` は Markdown という入力形式に依存するため domain ではない。ただし、それ自体は副作用を持たない形式変換であり、現時点で差し替え可能性も高くないため port にはしない。

```ts
// 採用: 形式依存の純粋関数は infrastructure/docs に置く
export function extractBuiltinSurfaceSection(
  markdown: string,
  sectionName: string,
): string[] {
  // cli-surface.md の Markdown 構造を読む
}
```

これは ADR 0020 の「入力フォーマットを変えたら死ぬか」の基準に従った分類である。domain には置かないが、port で包むほどの副作用境界でもない。

### 4. ドメインルールは port 実装に入れない

`ChangelogDiffEvent` の重複判定や `BuiltinSurfaceCatalog` の重複排除は、外部 I/O に依存しないルールであるため domain に残す。

```ts
// 採用: 項目差分と重複判定は domain の純粋ルール
const diff = computeChangelogEntryDiff(localRelease.entries, release.entries);

if (!isDuplicateDiffEvent(diffEvents, candidate)) {
  diffEvents.push(candidate);
}
```

逆に、JSON の snake_case / camelCase 変換や `Date` 変換は外部ファイル契約との境界であるため、`ChangelogFileStore` に閉じ込める。

### 5. `DocsSearchPort` は entry を受け取り、keyword 抽出を infrastructure 側へ閉じ込める

`application/analyze-changelog.ts` は `ChangelogEntry` と `DocsSearchPort` だけを扱う。バッククォート記法や大文字略語を使ったキーワード抽出は Markdown / docs 検索に近い形式依存処理であるため、`infrastructure/docs/docs-searcher.ts` が内部で `extractKeywords` を呼ぶ。

```ts
// 採用: application は docs 検索の入力形式を知らない
export type DocsSearchPort = {
  readonly findRelatedDocs: (entry: ChangelogEntry) => Promise<RelatedDoc[]>;
};
```

これにより、application から `infrastructure/docs/changelog-markdown-parser` と `keyword-extractor` への直接依存を解消する。

## Consequences

### Positive

- CLI から GitHub / fetch / fs の具体処理が外れ、エントリーポイントが薄くなる
- application が `infrastructure/` を直接 import しない構造に近づき、ADR 0019 のステップ 7 が前進する
- `ChangelogFileStore` が diff JSON 契約との変換境界になり、domain event と外部 JSON の責務が分かれる
- `extractMarkdownListItems` 相当の処理が domain から外れ、ADR 0020 の層分類に沿う
- NotebookLM の `ドメイン駆動設計入門.md` で確認したリポジトリ・依存関係逆転の考え方と整合する

### Negative

- port 型と adapter class が増え、単純な CLI スクリプトよりファイル数は増える
  - → 副作用境界に限定し、純粋な形式変換やドメイン判断には port を作らない
- `DocsSearchPort` が `ChangelogEntry` を受け取るため、docs 検索 adapter がキーワード抽出まで担当する
  - → キーワード抽出は Markdown / docs 検索に依存する形式処理として扱い、domain へ戻さない
- `parseChangelogEntries` などの parser は infrastructure 関数として直接 CLI から呼ばれる
  - → 副作用を持たない形式変換なので許容する。application から直接 import しないことを優先する

### Risks

- 「外部依存は port」というルールだけが一人歩きし、薄い interface が増えるリスクがある
  - → ADR 0019 の「薄いラッパー禁止」と ADR 0020 の分類ヒューリスティックを併用する
- リポジトリや store 実装にドメインルールを入れてしまうリスクがある
  - → 重複判定、差分判定、値の正規化は domain に残し、store は読み書きと外部契約変換に限定する
- `src/types.ts` に残る外部 JSON 契約と domain 型の境界がまだ曖昧な箇所がある
  - → ADR 0019 のステップ 8 として、文脈ごとの型分解を別タスクで進める

## 決めていないこと

| 項目 | 決めない理由 | いつ決めるか |
|------|--------------|--------------|
| `src/types.ts` の完全分解 | 今回は port と副作用境界の整理が目的であり、外部 JSON 契約の再配置は影響が広い | ADR 0019 ステップ 8 の実装時 |
| Markdown parser の interface 化 | 現時点では副作用がなく、差し替え要求も薄いため port 化しない | Markdown 以外の入力形式を扱う要件が出たとき |
| `cli/` ディレクトリへの物理移動 | 既存 npm script と未完了移行への影響がある | DDD 移行の残タスクをまとめて整理するとき |

## Notes

### 参考資料

- ADR 0019: changelog-fetcher への DDD 適用方針
- ADR 0020: DDD 層分類の判断ヒューリスティック
- NotebookLM「ドメイン駆動設計入門.md」(Notebook ID: `f48ebcc4-48c3-44b5-80c0-02124052c154`, Source ID: `4bbc10f9-247d-4f68-b3d8-90e582530836`)
