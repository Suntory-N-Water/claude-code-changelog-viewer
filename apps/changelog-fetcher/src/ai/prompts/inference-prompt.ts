import type { ChangelogItem } from '@claude-code-changelog-viewer/types';

/**
 * 一括推論・翻訳・サマリー生成プロンプトを構築
 *
 * 入力: 全 CHANGELOG 項目 + バージョン番号
 * 出力: inferred_items(推論+翻訳)/ translated_items(翻訳のみ)/ summary
 */
export function buildBatchInferencePrompt(
  items: ChangelogItem[],
  version: string,
  modelContext: string,
): string {
  const inferenceItems = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.related_docs.length >= 2);

  const translationItems = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.related_docs.length < 2);

  const inferenceSection = inferenceItems
    .map(({ item, index }) => {
      const snippetsText = item.related_docs
        .map((doc) => {
          const snippets = doc.snippets.join('\n');
          return `### ${doc.file}\n${snippets}`;
        })
        .join('\n\n');

      return `#### 項目 id=${index}
- prefix: ${item.prefix}
- content: ${item.content}
- 関連情報:
${snippetsText}`;
    })
    .join('\n\n');

  const translationSection = translationItems
    .map(({ item, index }) => {
      return `#### 項目 id=${index}
- prefix: ${item.prefix}
- content: ${item.content}`;
    })
    .join('\n\n');

  const allItemsText = items
    .map((item) => `- [${item.prefix}] ${item.content}`)
    .join('\n');

  const featureAreaItemsText = items
    .map(
      (item, index) =>
        `- id=${index}, tags=[${(item.feature_areas ?? []).join(', ')}], content: ${item.content}`,
    )
    .join('\n');

  return `
# 思考のレンズ

## 前提 (Premise)
- Claude Code は開発者向けの AI アシスタント CLI ツールである
- ユーザーは技術的な詳細よりも「自分にとって何が良くなるか」を知りたい
- 変更の背景には必ず具体的な問題や不便があった
- 技術文書の翻訳では、正確性と自然な日本語表現の両立が求められる

## Claude Code のモデル情報 (重要)
${modelContext}

## 状況 (Situation)
バージョン ${version} の CHANGELOG を処理する。全 ${items.length} 項目。

## 目的 (Purpose)
以下の3つのタスクを一度に実行する:
1. **推論+翻訳** (inferred_items): 関連ドキュメントがある項目について、翻訳 + Before/After/Benefit を生成
2. **翻訳のみ** (translated_items): 関連ドキュメントがない項目について、日本語翻訳のみ生成
3. **サマリー** (summary): バージョン全体の日本語サマリーを生成

## 動機 (Motive)
単なる事実の羅列ではなく、ユーザーが「この変更で自分の作業がどう楽になるか」を直感的に理解できる説明を生成する。snippets の情報を活用し、技術的に正確で具体的な説明を心がける。

---

# タスク1: 推論+翻訳 (inferred_items)

以下の各項目について、content_ja / before / after / benefit を生成する。

## 制約
- content_ja: 技術用語を適切に日本語化し、開発者にとって分かりやすい自然な日本語で翻訳する
- 専門用語を使う場合は必ず文脈で意味が分かるように説明する
- before / after / benefit は各2-3文で簡潔に
- snippets に記載がない推測は避ける
- バグ修正(prefix: "Fixed")の場合、before はバグの症状を CHANGELOG の記述から推測してよい
- 機能追加(prefix: "Added", "Enabled")の場合、before は snippets から変更前の状態を推測する
- id は入力値をそのまま返すこと

## 対象項目

${inferenceSection || '(対象なし)'}

---

# タスク2: 翻訳のみ (translated_items)

以下の各項目について、content_ja のみを生成する。

## 制約
- 技術用語(CLI、API、VSCode など)はカタカナ表記またはそのまま英語を使用してよい
- 1-2文程度の簡潔な翻訳にする
- 原文の意味を正確に保つ
- 開発者にとって分かりやすい自然な日本語表現を心がける
- id は入力値をそのまま返すこと

## 対象項目

${translationSection || '(対象なし)'}

---

# タスク3: サマリー (summary)

バージョン ${version} の全変更項目:
${allItemsText}

## 制約
- 2-3文で簡潔にまとめる
- 主要な新機能、重要な改善点、注目すべきバグ修正を優先的に言及
- 技術用語は適切に日本語化
- 「です・ます」調で統一
- 「このバージョンでは」「バージョン vX.X.X では」「本バージョンでは」のようなバージョンを示す接頭辞は付けず、変更内容から書き始める

---

# タスク4: 機能領域タグの補正 (feature_area_corrections)

各項目にはルールベースで仮タグが付与されている。内容を精査し、明らかに誤っているタグのみ補正する。

## 定義済みタグ一覧
- IDE/VSCode: VSCode 拡張・IDE 連携
- Hooks: フック機能
- MCP: Model Context Protocol
- Skills: スキル機能
- Agent Teams: エージェントチーム・チームメイト
- Sub-agents: サブエージェント
- Plan: プランモード
- Plugins: プラグイン
- Settings: 設定
- Memory: メモリ・CLAUDE.md
- Permissions: パーミッション

## 制約
- 補正が必要な項目のみ返す(全項目を返す必要はない)
- 1項目に複数タグを付与してよい
- 補正不要であれば空配列を返す

## 対象項目

${featureAreaItemsText}
`;
}
