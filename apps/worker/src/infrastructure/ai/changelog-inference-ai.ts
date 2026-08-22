import { getLogger, toError } from '@claude-code-changelog-viewer/common';
import type {
  ChangelogInferenceInput,
  ChangelogItemsAiResult,
  ChangelogRelease,
} from '../../domain/changelog-inference/changelog-inference';
import type {
  ChangelogItemInferencePort,
  ChangelogSummaryPort,
} from '../../usecases/changelog-inference';
import { z } from 'zod';
import {
  ChangelogItemsResponseFormat,
  ChangelogItemsResponseSchema,
  ChangelogSummaryResponseFormat,
  ChangelogSummaryResponseSchema,
} from './changelog-inference-schema';

const MODEL = '@cf/zai-org/glm-4.7-flash';
// JSON schema 制約下では文字列の途中でも空白が合法な継続になるため、モデルが閉じ括弧を出せずに
// 空白を吐き続けることがある。上限を出力実測値(約2,000)の2倍に切って、暴走しても数十秒で
// 打ち切らせ、step の再試行に回す。65536 のままだと Workers AI の約240秒に達してしまう
const MAX_COMPLETION_TOKENS = 4096;

const logger = getLogger({
  name: 'infrastructure.ai.changelog-inference',
  serviceName: 'changelog-viewer-worker',
  level: 'INFO',
  format: 'json',
});

const AiChatResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string().min(1) }),
      }),
    )
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number(),
      completion_tokens: z.number(),
      total_tokens: z.number(),
      prompt_tokens_details: z
        .object({ cached_tokens: z.number().optional() })
        .optional(),
    })
    .optional(),
});

export function createChangelogItemInferenceAi(
  ai: Pick<Cloudflare.Env['AI'], 'run'>,
  gatewayId: string,
): ChangelogItemInferencePort {
  return {
    async inferItems(input): Promise<ChangelogItemsAiResult> {
      const startedAt = Date.now();
      let response: unknown;
      try {
        response = await ai.run(
          MODEL,
          {
            messages: [{ role: 'user', content: buildItemsPrompt(input) }],
            max_completion_tokens: MAX_COMPLETION_TOKENS,
            // 思考トークンは出力本体の数倍に達し、量が回ごとに大きく揺れる
            chat_template_kwargs: { enable_thinking: false },
            response_format: ChangelogItemsResponseFormat,
          },
          { gateway: { id: gatewayId } },
        );
      } catch (error) {
        logger.error('Workers AI の呼び出しに失敗しました', {
          'ai.model': MODEL,
          'ai.duration_ms': Date.now() - startedAt,
          error: toError(error),
        });
        throw error;
      }
      logAiUsage(response, startedAt);
      const parsed = ChangelogItemsResponseSchema.safeParse(
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
      };
    },
  };
}

export function createChangelogSummaryAi(
  ai: Pick<Cloudflare.Env['AI'], 'run'>,
  gatewayId: string,
): ChangelogSummaryPort {
  return {
    async summarize(release): Promise<string> {
      const startedAt = Date.now();
      let response: unknown;
      try {
        response = await ai.run(
          MODEL,
          {
            messages: [{ role: 'user', content: buildSummaryPrompt(release) }],
            max_completion_tokens: MAX_COMPLETION_TOKENS,
            chat_template_kwargs: { enable_thinking: false },
            response_format: ChangelogSummaryResponseFormat,
          },
          { gateway: { id: gatewayId } },
        );
      } catch (error) {
        logger.error('Workers AI の呼び出しに失敗しました', {
          'ai.model': MODEL,
          'ai.duration_ms': Date.now() - startedAt,
          error: toError(error),
        });
        throw error;
      }
      logAiUsage(response, startedAt);
      const parsed = ChangelogSummaryResponseSchema.safeParse(
        parseAiResponse(response),
      );
      if (!parsed.success) {
        throw new Error(
          `AI サマリー結果の形式が不正です: ${z.prettifyError(parsed.error)}`,
        );
      }

      return parsed.data.summary;
    },
  };
}

function logAiUsage(response: unknown, startedAt: number): void {
  const parsed = AiChatResponseSchema.safeParse(response);
  const usage = parsed.success ? parsed.data.usage : undefined;
  logger.info('Workers AI の呼び出しが完了しました', {
    'ai.model': MODEL,
    'ai.usage.prompt_tokens': usage?.prompt_tokens,
    'ai.usage.completion_tokens': usage?.completion_tokens,
    'ai.usage.total_tokens': usage?.total_tokens,
    'ai.usage.cached_tokens': usage?.prompt_tokens_details?.cached_tokens ?? 0,
    'ai.duration_ms': Date.now() - startedAt,
  });
}

function parseAiResponse(response: unknown): unknown {
  const parsed = AiChatResponseSchema.safeParse(response);
  if (!parsed.success) {
    throw new Error(
      `AI 応答の形式が不正です: ${z.prettifyError(parsed.error)}`,
    );
  }

  const content = parsed.data.choices[0]?.message.content;
  if (content === undefined) {
    throw new Error('AI 応答に choices がありません');
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error('AI 応答の JSON 解析に失敗しました', { cause: error });
  }
}

const PROMPT_PREAMBLE = [
  '## 前提',
  '- Claude Code は開発者向けの AI アシスタント CLI ツールである',
  '- 技術用語を適切に日本語化し、開発者にとって自然な日本語で表現する',
  '- CHANGELOG の原文や関連ドキュメントにない内容を捏造しない',
].join('\n');

function buildItemsPrompt(input: ChangelogInferenceInput): string {
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
  const featureAreaItems = input.items
    .map((item) => `- id=${item.id}, content: ${item.content}`)
    .join('\n');

  return [
    PROMPT_PREAMBLE,
    '',
    `## 状況\nバージョン ${input.version} の CHANGELOG のうち ${input.items.length} 項目を処理する。`,
    '',
    '以下の3つのタスクを一度に実行する:',
    '1. 関連ドキュメントがある項目の翻訳と Before / After / Benefit の推論',
    '2. 関連ドキュメントがない項目の翻訳',
    '3. 各項目の機能領域タグの付与',
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
    '# タスク3: 機能領域タグ',
    '該当する項目だけを返し、1項目に複数タグを付けてもよい。該当しなければ返さない。',
    'タグ候補: IDE, Hooks, MCP, Skills, Agent Teams, Sub-agents, Plan, Plugins, Settings, Memory, Permissions',
    featureAreaItems,
  ].join('\n');
}

function buildSummaryPrompt(release: ChangelogRelease): string {
  return [
    PROMPT_PREAMBLE,
    '',
    `## 状況\nバージョン ${release.version} の CHANGELOG 全 ${release.items.length} 項目からサマリーを書く。`,
    '',
    '# タスク: サマリー',
    '2〜3文で、具体的な変更を最大3件だけ取り上げる。CHANGELOG にない効果を補わない。',
    `バージョン ${release.version} の全変更項目:`,
    release.items
      .map((item) => `- [${item.prefix}] ${item.content}`)
      .join('\n'),
  ].join('\n');
}
