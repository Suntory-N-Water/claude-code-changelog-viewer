import type { HighImpactItem } from '../../../usecase/weekly-post-generation';

// TODO: Gemini 週次まとめ用の本番プロンプトを設計して置き換える。
export function buildWeeklyPostPrompt(input: {
  isoWeek: string;
  versions: string[];
  highImpactItems: HighImpactItem[];
}): string {
  return [
    '# 週次まとめ記事生成',
    '',
    'プロンプトは未確定のため、入力データ確認用のプレースホルダーです。',
    '',
    `ISO週: ${input.isoWeek}`,
    `対象バージョン: ${input.versions.join(', ')}`,
    `high impact 件数: ${input.highImpactItems.length}`,
    '',
    '## high impact items',
    ...input.highImpactItems.map((item) =>
      [
        `- version: ${item.version}`,
        `  id: ${item.id}`,
        `  prefix: ${item.prefix}`,
        `  content: ${item.content}`,
        ...(item.contentJa !== undefined
          ? [`  content_ja: ${item.contentJa}`]
          : []),
      ].join('\n'),
    ),
    '',
    '以下の形式で返してください。',
    '',
    '# 記事タイトル',
    '',
    '本文Markdown',
  ].join('\n');
}
