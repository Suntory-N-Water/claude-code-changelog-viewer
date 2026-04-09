# ADR 0003: ログIDの定義方式とエディタホバー表示の改善

## Status

Proposed

## Context

このプロジェクトは Bun ワークスペースのモノレポ構成で、TypeScript / Astro / Cloudflare Workers を使用している。

ログメッセージは `packages/common/src/log-messages/catalog.ts` で一元管理しており、アプリケーション全体で `logger.msg('APLG0004', { params: [...] })` のように文字列リテラルで呼び出す設計となっている。

### 解決したい課題

- 呼び出し側で `'APLG0004'` という文字列リテラルを記述した際、VS Code などのエディタでホバーしてもそのIDが何を意味するか分からない
- 存在しないIDを渡してもランタイムまでエラーが検知されない（型安全性が低い）
- 現在の `LogId = keyof typeof LOG_CATALOG` という型定義では、文字列リテラルに JSDoc が紐付かないため上記は解決できない

### 検討した選択肢

- **A案**: 現状維持（文字列リテラルで呼び出す）
- **B案**: `LOG_ID` 定数オブジェクトを分離し JSDoc を付与、`LOG_CATALOG` は `satisfies` でキー同期を強制
- **C案**: エントリオブジェクト自体を `logger.msg` に渡す（`LOG_CATALOG` を `LOG_ID` に統合）

### 各選択肢の評価

| 観点 | A案（現状維持） | B案（LOG_ID分離） | C案（オブジェクト渡し） |
|------|---------------|-----------------|----------------------|
| ホバーで内容確認 | 不可 | 可（`LOG_ID.APLG0004`） | 可（`LOG_ID.APLG0004`） |
| 型安全性 | 低（任意文字列を渡せる） | 高 | 高 |
| import の煩雑さ | なし（文字列リテラル） | 1つ（`LOG_ID`） | 1つ（`LOG_ID`） |
| 記述の一元性 | 1箇所 | 2箇所（JSDoc + template） | 1箇所 |
| `log.id` のログ出力 | 維持 | 維持 | 消える |
| キーずれの検知 | なし | コンパイルエラー | コンパイルエラー |
| logger.ts の改修 | 不要 | 不要 | 必要 |

## Decision

**`LOG_ID` を JSDoc 付き定数オブジェクトとして独立定義し、`LOG_CATALOG` は `satisfies Record<keyof typeof LOG_ID, CatalogEntry>` でキーの同期をコンパイル時に強制する（B案）。**

### 1. LOG_ID の定義

```typescript
// packages/common/src/log-messages/catalog.ts

const LOG_ID = {
  /** $0 を開始します */
  APLG0001: 'APLG0001',
  /** $0 が完了しました */
  APLG0002: 'APLG0002',
  /** $0 を初期化しました */
  APLG0004: 'APLG0004',
  // ...
} as const;

type LogId = (typeof LOG_ID)[keyof typeof LOG_ID];
```

### 2. LOG_CATALOG の型強制

```typescript
const LOG_CATALOG = {
  APLG0001: { level: 'INFO', template: '$0 を開始します' },
  APLG0002: { level: 'INFO', template: '$0 が完了しました' },
  APLG0004: { level: 'INFO', template: '$0 を初期化しました' },
  // ...
} as const satisfies Record<keyof typeof LOG_ID, CatalogEntry>;
```

`satisfies Record<keyof typeof LOG_ID, CatalogEntry>` により、`LOG_ID` に存在しないキーや欠落したキーがあればコンパイルエラーになる。

### 3. 呼び出し側

```typescript
// Before
logger.msg('APLG0004', { params: ['ディレクトリ'] });

// After（ホバーで「$0 を初期化しました」が表示される）
import { LOG_ID } from '@claude-code-changelog-viewer/common';
logger.msg(LOG_ID.APLG0004, { params: ['ディレクトリ'] });
```

### 採用理由

- C案はログ出力の `log.id` フィールドが消えるため採用しない（ログのトレーサビリティに影響）
- B案はテンプレート文字列が JSDoc と `template` フィールドの2箇所に存在するが、`satisfies` によりキーの過不足はコンパイルエラーで検知される。文言の微細なズレはコードレビューで対応可能な範囲と判断した

## Consequences

### Positive

- `LOG_ID.APLG0004` にホバーするだけで対象ログの概要が確認できる
- 型安全性が向上し、存在しない ID を渡すとコンパイルエラーになる
- `LOG_ID` の1 import で全 ID にアクセスできるため、呼び出し側のコードが煩雑にならない
- `log.id` のログ出力が維持されトレーサビリティに影響しない

### Negative

- テンプレート文字列が JSDoc と `LOG_CATALOG.template` の2箇所に存在する
  - → `satisfies` でキーのズレはコンパイルエラーで検知されるため、深刻な不整合は防止できる。文言レベルのズレはコードレビューで対応する
- 呼び出し側全ファイルで `LOG_ID` の import が必要になる
  - → `logger.msg` の引数を変更するだけで一括移行できる

### Risks

- JSDoc のコメント漏れ（`LOG_ID` にエントリを追加したが JSDoc を付け忘れる）を機械的に検知できない
  - → Biome の GritQL はコメントを trivia として扱うため、ツールによる強制は不可能と確認済み。コードレビューの規約として運用する

## 決めていないこと

| 項目 | 決めない理由 | いつ決めるか |
|------|------------|------------|
| 既存の呼び出し箇所の移行タイミング | 実装スコープ外。段階的移行も一括移行も可能 | 実装着手時に決定 |
| `LOG_ID` と `LOG_CATALOG` を同一ファイルに置くか分割するか | 現時点では1ファイルで十分な規模 | エントリ数が増えた場合に検討 |

## Notes

### 参考資料

- [TypeScript `satisfies` operator](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html)
- Biome GritQL でコメントの強制が不可能な理由: GritQL はコメントを trivia として扱い AST に含めないため、`/** ... */` の有無をパターンマッチで検知できない（`biome search` で確認済み）
