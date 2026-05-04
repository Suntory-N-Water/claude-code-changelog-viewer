# ADR 0014: 設定・環境変数リファレンスページの新設

## Status

Accepted

## Context

本サイトは Claude Code の変更履歴を日本語で解説することを主目的としている。Search Console の過去3ヶ月データを分析したところ、`enable_claudeai_mcp_servers`・`enableweakernetworkisolation` などの設定名・環境変数名をそのままクエリとして検索して来訪するユーザーが一定数存在することが判明した。

これらのユーザーは「この設定キーが何をするか知りたい」という明確な目的を持っているが、現状のサイトにはその答えを提供するページが存在しないため、機会損失が生じていた。

### 解決したい課題

- 設定名・環境変数名での検索流入に対して、挙動を日本語で説明するページが存在しない
- pagefind の日本語対応（ADR 0010）により `CLAUDE_CODE_*` のような `_` 区切りの設定名がトークン分割され、サイト内検索でも完全一致ができない
- 公式ドキュメントは「現在の状態」しか記載しない。このサイトが提供できる差別化価値は「いつ追加されたか・変更前後の挙動・誰に嬉しいか」という時間軸の情報

### 利用可能なデータソース

| ソース | 件数 | 内容 |
|---|---|---|
| `apps/docs-tracker/schema/claude-code-settings.json` の `properties` | 79件 | camelCase 設定名 + 英語 description + 型情報 |
| `apps/docs-tracker/schema/claude-code-settings.json` の `env.properties` + `env-vars.md` | 221件 | SCREAMING_SNAKE 環境変数 + 英語 description |
| `apps/changelog-fetcher/inferred/inferred_v*.json` | 全バージョン | content / content_ja / inference(before/after/benefit) を持つ変更履歴 |

### 検討した選択肢

1. **Astro Content Collection + シンボリックリンク方式**（採用）  
   設定ごとに生成した JSON ファイルを Astro の Content Collection として読み込み、静的ページを生成する。

2. **ビルド時 glob import 方式**  
   `import.meta.glob` で設定 JSON を直接読み込む。Content Collection のスキーマ検証が使えない。

3. **既存 changelog ページへの統合**  
   設定説明を changelog ページの補足情報として表示する。設定を直接 URL でアクセスできず、SEO 効果が限定的。

### 各選択肢の評価

| 観点 | Content Collection + Symlink | glob import | changelog ページ統合 |
|------|:---:|:---:|:---:|
| SEO（独立 URL） | ✅ | ✅ | ❌ |
| Zod スキーマ検証 | ✅ | ❌ | — |
| 既存パターンとの一貫性 | ✅（docs-diff と同様） | △ | — |
| 実装コスト | 低 | 低 | 高 |

## Decision

**設定・環境変数ごとに独立した静的ページを生成し、日本語説明・英語原文・関連 changelog を提供する `/reference/settings` ルートを新設する。**

### 1. データパイプライン（`apps/changelog-fetcher`）

`generate-settings-reference.ts` スクリプトが以下を出力する。

```
apps/changelog-fetcher/settings/
  settings_auto-memory-enabled.json   # settings.json 由来
  settings_claude-code-disable-auto-memory.json  # 環境変数由来
  ...（計300件）
```

各ファイルのスキーマ：

```typescript
type SettingReference = {
  key: string;           // 元のキー名（camelCase または SCREAMING_SNAKE）
  slug: string;          // URL 用 kebab-case
  source: 'settings' | 'env';
  schema_type?: string;  // settings.json 由来のみ（boolean / string / array など）
  description_en: string;
  description_ja: string;
  use_case_ja?: string;  // コンテキストあり設定のみ生成
  related_changelog: RelatedChangelog[];  // 生成時エビデンス（表示には使用しない）
};
```

### 2. Astro Content Collection の読み込み

`docs-diff` コレクションと同じシンボリックリンク方式を採用する。

```
apps/www/src/content/settings -> ../../../changelog-fetcher/settings
```

`content.config.ts` に `settingsReference` コレクションを追加し、Zod でスキーマ検証を行う。

### 3. 関連 changelog の取得方針（重要）

**settings JSON 内の `related_changelog` フィールドはフロントエンドでは使用しない。**

Astro ビルド時に `getCollection('changelog')` で全 changelog を読み込み、各設定の `key` 文字列が `content` または `content_ja` に含まれるアイテムを動的に収集する。

```typescript
// settings-reference.ts
export function findRelatedChangelogs(
  key: string,
  changelogs: { version: string; items: ChangelogItem[] }[],
): ChangelogItemWithVersion[] {
  const results: ChangelogItemWithVersion[] = [];
  for (const { version, items } of changelogs) {
    for (const item of items) {
      if (item.content.includes(key) || item.content_ja?.includes(key)) {
        results.push({ version, item });
      }
    }
  }
  return results;
}
```

**採用理由:** settings JSON の生成は一度きりで行われる。新バージョンが追加されるたびに全 settings JSON を再生成するのは非効率であり、changelog のリアルタイム性を損なう。動的収集とすることで、新バージョン追加時の settings ファイル再生成が不要になる。

settings JSON の `related_changelog` は「AI が `use_case_ja` を生成した時点のエビデンス」として記録目的で保持するが、画面表示には使わない。

### 4. フロントエンド構成

```
/reference/settings         → index.astro（一覧ページ）
/reference/settings/[slug]  → [slug].astro（詳細ページ、300件の静的生成）
```

**一覧ページ（`index.astro`）の機能:**
- テキスト検索ボックス（`?q=` URL パラメータで状態保持）
- タブフィルタ: 全て / settings.json / 環境変数（`?type=` URL パラメータで状態保持）
- URL パラメータによるリロード後の状態復元（notify.astro と同じパターン）

**詳細ページ（`[slug].astro`）のコンテンツ:**
1. 日本語説明（`description_ja`）
2. 英語原文（公式ドキュメントより）+ 公式ドキュメントリンクを `description_en` から抽出して表示
3. 使い方・用途（`use_case_ja`、存在する場合のみ）
4. 関連する変更履歴（`findRelatedChangelogs()` で動的収集、バージョン降順）
5. 関連する機能エリアへのリンク（`/features/[slug]`）
6. 空状態メッセージ（変更履歴・use_case_ja の両方が存在しない場合）

### 5. テキスト整形

`description_en` / `description_ja` にはスキーマ由来の Markdown リンクが含まれる場合があるため、専用の整形関数を実装する。

```typescript
// format-changelog-content.ts に追加
export function formatSettingDescription(content: string): string
// 処理: escapeHtml → /en/* 相対パスを公式 URL に変換 → Markdown リンク → code タグ

export function formatUseCaseJa(content: string): string
// 処理: escapeHtml → code タグ → - 箇条書きを <ul><li> に変換
```

### 6. OG 画像

設定ページ固有の OG 画像は生成しない。ビルド負荷（300件分の画像生成）に対して効果が限定的なため、サイト共通のデフォルト OGP 画像を使用する。

## Consequences

### Positive

- 設定名・環境変数名で検索して来訪したユーザーが日本語で挙動を理解できる
- 各設定が独立した URL を持つため、pagefind のサイト内検索インデックスにも収録される（issue #86 の副次的改善）
- 新バージョンの changelog が追加されるたびに自動的に関連付けが更新される（再生成不要）
- テキスト検索と URL パラメータ保持により、300件の一覧を探索しやすい

### Negative

- `findRelatedChangelogs()` がビルド時に全 changelog × 全設定でスキャンするため、ビルド時間が増加する
  - → 現状のビルド時間への影響は軽微（約3秒増加）。ビルド時間が問題になった場合は設定ファイルにインデックスを持つ方式に移行する
- 設定名の単純文字列マッチングのため、無関係な changelog が混入する可能性がある
  - → 短いキー名（`model` など）は誤マッチが発生しやすい。現時点は許容し、問題が顕在化した場合にフィルタリング精度を改善する

### Risks

- `use_case_ja` の生成に使用した AI（Gemini）がハルシネーションを含む可能性がある
  - → 英語原文（公式ドキュメントより）を常時表示し、読者が原文と対照できるようにする
- コンテキストがない設定（`use_case_ja` なし + 関連 changelog なし）のページが情報量不足に見える
  - → 英語原文・公式ドキュメントリンクを常時表示することで最低限の情報を保証する

## 決めていないこと

| 項目 | 決めない理由 | いつ決めるか |
|------|------------|------------|
| changelog → settings への逆リンク | `[version].astro` の改修が必要で今回のスコープを超える | 流入データを見てニーズを確認してから |
| settings ファイルの定期自動再生成 | 現状は手動運用で十分。Claude Code の設定追加頻度が高くなれば検討 | 新規設定追加が月1件以上になったとき |
| 設定ページの OG 画像生成 | ビルド負荷対効果が不明 | Search Console でクリック率を確認してから |

## Notes

### 参考資料

- Issue #113: 設定・環境変数辞書ページの新設
- ADR 0010: SEO インデックス改善（pagefind 日本語対応の背景）
- ADR 0013: SEO テクニカル改善（サイト構造整備の文脈）
- `apps/changelog-fetcher/src/generate-settings-reference.ts` — データ生成スクリプト
- `apps/www/src/lib/settings-reference.ts` — フロントエンド向けユーティリティ
