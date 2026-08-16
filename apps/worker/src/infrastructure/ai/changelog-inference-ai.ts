import type {
  ChangelogAiResult,
  ChangelogInferenceInput,
} from '../../domain/changelog-inference/changelog-inference';
import type { ChangelogInferencePort } from '../../usecases/changelog-inference';
import {
  ChangelogInferenceResponseFormat,
  ChangelogInferenceResponseSchema,
} from './changelog-inference-schema';
import { z } from 'zod';

const MODEL = '@cf/google/gemma-4-26b-a4b-it';
const MAX_TOKENS = 65536;

export type WorkersAiBinding = {
  run(
    model: string,
    input: {
      prompt: string;
      max_tokens: number;
      response_format: typeof ChangelogInferenceResponseFormat;
    },
    options: { gateway: { id: string } },
  ): Promise<unknown>;
};

const AiResponseEnvelopeSchema = z
  .object({ response: z.unknown() })
  .passthrough();

export function createChangelogInferenceAi(
  ai: WorkersAiBinding,
  gatewayId: string,
): ChangelogInferencePort {
  return {
    async infer(input): Promise<ChangelogAiResult> {
      const response = await ai.run(
        MODEL,
        {
          prompt: buildInferencePrompt(input),
          max_tokens: MAX_TOKENS,
          response_format: ChangelogInferenceResponseFormat,
        },
        { gateway: { id: gatewayId } },
      );
      const parsed = ChangelogInferenceResponseSchema.safeParse(
        parseAiResponse(response),
      );
      if (!parsed.success) {
        throw new Error(
          `AI 推論結果の形式が不正です: ${z.prettifyError(parsed.error)}`,
        );
      }

      return {
        inferredItems: parsed.data.inferred_items.map((item) => ({
          id: item.id,
          contentJa: item.content_ja,
          inference: {
            before: item.before,
            after: item.after,
            benefit: item.benefit,
          },
        })),
        translatedItems: parsed.data.translated_items.map((item) => ({
          id: item.id,
          contentJa: item.content_ja,
        })),
        featureAreaCorrections: parsed.data.feature_area_corrections.map(
          (item) => ({
            id: item.id,
            featureAreas: item.feature_areas,
          }),
        ),
        summary: parsed.data.summary,
      };
    },
  };
}

function parseAiResponse(response: unknown): unknown {
  if (typeof response === 'string') {
    try {
      return JSON.parse(response);
    } catch (error) {
      throw new Error('AI 応答の JSON 解析に失敗しました', { cause: error });
    }
  }

  const envelope = AiResponseEnvelopeSchema.safeParse(response);
  if (envelope.success) {
    return parseAiResponse(envelope.data.response);
  }

  return response;
}

function buildInferencePrompt(input: ChangelogInferenceInput): string {
  const inferenceItems = input.items
    .filter((item) => item.relatedDocs.length > 0)
    .map((item) => {
      const relatedDocs = item.relatedDocs
        .map((doc) => `#### ${doc.file}\n${doc.snippets.join('\n')}`)
        .join('\n\n');
      return [
        `### 項目 id=${item.id}`,
        `- prefix: ${item.prefix}`,
        `- content: ${item.content}`,
        '',
        '### 関連情報',
        relatedDocs,
      ].join('\n');
    })
    .join('\n\n');
  const translationItems = input.items
    .filter((item) => item.relatedDocs.length === 0)
    .map((item) =>
      [
        `### 項目 id=${item.id}`,
        `- prefix: ${item.prefix}`,
        `- content: ${item.content}`,
      ].join('\n'),
    )
    .join('\n\n');
  const allItems = input.items
    .map((item) => `- [${item.prefix}] ${item.content}`)
    .join('\n');
  const featureAreaItems = input.items
    .map((item) => `- id=${item.id}, content: ${item.content}`)
    .join('\n');

  return [
    '## 前提',
    '- Claude Code は開発者向けの AI アシスタント CLI ツールである',
    '- 技術用語を適切に日本語化し、開発者にとって自然な日本語で表現する',
    '- CHANGELOG の原文や関連ドキュメントにない内容を捏造しない',
    '',
    `## 状況\nバージョン ${input.version} の CHANGELOG を処理する。全 ${input.items.length} 項目。`,
    '',
    '以下の4つのタスクを一度に実行する:',
    '1. 関連ドキュメントがある項目の翻訳と Before / After / Benefit の推論',
    '2. 関連ドキュメントがない項目の翻訳',
    '3. バージョン全体の日本語サマリー',
    '4. 各項目の機能領域タグの付与',
    '',
    '# タスク1: 推論と翻訳',
    '- snippets に記載がない推測は避ける',
    '- before / after は変更前後を具体的に2〜3文で書く',
    '- benefit はユーザーの行動変化を1文で書く',
    '- content_ja と benefit は自然な日本語の動詞の終止形で終える',
    '- id は入力値をそのまま返す',
    '',
    inferenceItems || '(対象なし)',
    '',
    '# タスク2: 翻訳のみ',
    '- 原文の意味を正確に保ち、1〜2文の自然な日本語にする',
    '- id は入力値をそのまま返す',
    '',
    translationItems || '(対象なし)',
    '',
    '# タスク3: サマリー',
    '2〜3文で、具体的な変更を最大3件だけ取り上げる。CHANGELOG にない効果を補わない。',
    `バージョン ${input.version} の全変更項目:`,
    allItems,
    '',
    '# タスク4: 機能領域タグ',
    '該当する項目だけを返し、1項目に複数タグを付けてもよい。該当しなければ返さない。',
    'タグ候補: IDE, Hooks, MCP, Skills, Agent Teams, Sub-agents, Plan, Plugins, Settings, Memory, Permissions',
    featureAreaItems,
  ].join('\n');
}
