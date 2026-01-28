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

  // パイプライン別の指示
  const pipelineInstruction =
    item.pipeline === 'developer'
      ? '**developer パイプライン**: 簡易説明のみ。Before は省略可、After と Benefit のみ記述。'
      : item.pipeline === 'extension'
        ? '**extension パイプライン**: 標準的な恩恵推論。Before/After/Benefit/Target をすべて記述。'
        : '**general パイプライン**: 詳細な恩恵推論。Before/After/Benefit/Target をすべて記述。';

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
1. Before: 変更前の状況(何が不便だったか)
2. After: 変更後の状況(何が改善されたか)
3. Benefit: ユーザーへの恩恵(なぜこれが嬉しいのか)

## 動機 (Motive)
単なる事実の羅列ではなく、ユーザーが「この変更で自分の作業がどう楽になるか」を直感的に理解できる説明を生成する。snippets の情報を活用し、技術的に正確で具体的な説明を心がける。

## 制約 (Constraint)
- 専門用語を使う場合は必ず文脈で意味が分かるように説明する
- Before/After は2-3文で簡潔に
- snippets に記載がない推測は避ける
- バグ修正(prefix: "Fixed")の場合、Before はバグの症状を CHANGELOG の記述から推測してよい
- 機能追加(prefix: "Added", "Enabled")の場合、Before は snippets から変更前の状態を推測する
- 必ずJSONコードブロック(\`\`\`json ... \`\`\`)形式で出力する

## パイプライン指示
${pipelineInstruction}

# 出力形式
\`\`\`json
{
  "before": "...",
  "after": "...",
  "benefit": "..."
}
\`\`\`
`;
}
