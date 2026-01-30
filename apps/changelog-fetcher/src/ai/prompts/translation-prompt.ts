import type { ChangelogItem } from '@claude-code-changelog-viewer/types';

/**
 * 翻訳のみのプロンプトを構築（コグニティブ・デザイン形式）
 */
export function buildTranslationPrompt(item: ChangelogItem): string {
  return `
# 思考のレンズ

## 前提 (Premise)
- Claude Code は開発者向けの AI アシスタント CLI ツールである
- 技術文書の翻訳では、正確性と自然な日本語表現の両立が求められる
- 専門用語は適切に日本語化しつつ、開発者にとって理解しやすい表現を選ぶ

## 状況 (Situation)
- CHANGELOG 項目: ${item.content}
- これは Claude Code の変更履歴の1項目である

## 目的 (Purpose)
この CHANGELOG 項目を、日本語を母語とする開発者が一読して理解できる自然な日本語に翻訳する。

## 動機 (Motive)
開発者が変更内容を素早く正確に把握できるようにすることで、Claude Code の利用体験を向上させる。
機械的な直訳ではなく、文脈を理解した上での意訳も含めて、読みやすく自然な日本語を提供する。

## 制約 (Constraint)
- 技術用語（CLI、API、VSCode など）はカタカナ表記またはそのまま英語を使用してよい
- 1-2文程度の簡潔な翻訳にする
- 原文の意味を正確に保つ
- 開発者にとって分かりやすい自然な日本語表現を心がける
`;
}
