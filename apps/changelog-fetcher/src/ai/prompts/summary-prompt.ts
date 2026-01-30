/**
 * バージョンサマリー生成プロンプトを構築
 */
export function buildSummaryPrompt(
  items: Array<{ content: string; prefix: string }>,
  version: string,
): string {
  const itemsText = items
    .map((item) => `- [${item.prefix}] ${item.content}`)
    .join('\n');

  return `
# 思考のレンズ

## 前提 (Premise)
- Claude Code は開発者向けの AI アシスタントCLIツールである
- このバージョン ${version} では複数の変更が含まれている
- 開発者は変更全体の概要を素早く把握したい

## 状況 (Situation)
- バージョン: ${version}
- 変更項目:
${itemsText}

## 目的 (Purpose)
このバージョンの変更内容全体のサマリーを日本語で作成する。
開発者が「このバージョンで何が変わったか」を一目で理解できる簡潔な要約を提供する。

## 動機 (Motive)
変更リストを羅列するのではなく、このバージョンアップで開発者の作業がどう改善されるかという「全体的な恩恵」を伝える。
技術的な詳細よりも、開発者視点での「使いやすさの向上」や「生産性の改善」を強調する。

## 制約 (Constraint)
- 2-3文で簡潔にまとめる
- 主要な新機能、重要な改善点、注目すべきバグ修正を優先的に言及
- 技術用語は適切に日本語化
- 「です・ます」調で統一
- サマリーのテキストのみを出力し、説明や追加情報は不要

# 出力形式
サマリーテキストのみを出力してください。
`;
}
