import type { ChangelogItem } from '@claude-code-changelog-viewer/types';

/**
 * プロンプトを構築(SKILL.md のコグニティブ・デザイン形式)
 */
export function buildInferencePrompt(item: ChangelogItem): string {
  const snippetsText = item.related_docs
    .map((doc) => {
      const snippets = doc.snippets.join('\n');
      return `## ${doc.file}\n${snippets}`;
    })
    .join('\n\n');

  return `
# 思考のレンズ

## 前提 (Premise)
- Claude Code は開発者向けの AI アシスタントCLIツールである
- ユーザーは技術的な詳細よりも「自分にとって何が良くなるか」を知りたい
- 変更の背景には必ず具体的な問題や不便があった

## 状況 (Situation)
- CHANGELOG項目: ${item.content}
- 関連情報 (snippets):
${snippetsText}

## 目的 (Purpose)
この変更について、以下を明確に説明する:
1. content_ja: CHANGELOG項目の日本語翻訳
2. Before: 変更前の状況(何が不便だったか)
3. After: 変更後の状況(何が改善されたか)
4. Benefit: ユーザーへの恩恵(なぜこれが嬉しいのか)

## 動機 (Motive)
単なる事実の羅列ではなく、ユーザーが「この変更で自分の作業がどう楽になるか」を直感的に理解できる説明を生成する。snippets の情報を活用し、技術的に正確で具体的な説明を心がける。

## 制約 (Constraint)
- content_ja: 技術用語を適切に日本語化し、開発者にとって分かりやすい自然な日本語で翻訳する
- 専門用語を使う場合は必ず文脈で意味が分かるように説明する
- Before/After/Benefit は各2-3文で簡潔に
- snippets に記載がない推測は避ける
- バグ修正(prefix: "Fixed")の場合、Before はバグの症状を CHANGELOG の記述から推測してよい
- 機能追加(prefix: "Added", "Enabled")の場合、Before は snippets から変更前の状態を推測する
- 必ずJSONコードブロック(\`\`\`json ... \`\`\`)形式で出力する

# 出力形式
\`\`\`json
{
  "content_ja": "...",
  "before": "...",
  "after": "...",
  "benefit": "..."
}
\`\`\`
`;
}
