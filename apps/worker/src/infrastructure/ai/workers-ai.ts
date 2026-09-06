import { toError } from '@claude-code-changelog-viewer/common';
import { z } from 'zod';
import { workerLogger } from '../../logger';

export const MODEL = '@cf/zai-org/glm-5.3-flash';

export const TRUNCATED_MESSAGE = 'AI 応答が出力上限で打ち切られました';
export const PARSE_FAILED_MESSAGE = 'AI 応答の JSON 解析に失敗しました';

const logger = workerLogger('infrastructure.ai');

const AiChatResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string().min(1) }),
        finish_reason: z.string().optional(),
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

export function logAiFailure(error: unknown, startedAt: number): void {
  logger.error('Workers AI の呼び出しに失敗しました', {
    'ai.model': MODEL,
    'ai.duration_ms': Date.now() - startedAt,
    error: toError(error),
  });
}

export function logAiUsage(response: unknown, startedAt: number): void {
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

export function parseAiResponse(
  response: unknown,
  maxCompletionTokens: number,
): unknown {
  const parsed = AiChatResponseSchema.safeParse(response);
  if (!parsed.success) {
    throw new Error(
      `AI 応答の形式が不正です: ${z.prettifyError(parsed.error)}`,
    );
  }

  const choice = parsed.data.choices[0];
  if (choice === undefined) {
    throw new Error('AI 応答に choices がありません');
  }

  // 打ち切られた応答は JSON として必ず壊れる。「解析に失敗」ではなく打ち切りだと分かる
  // メッセージにして、呼び出し側が諦める判断をできるようにする
  if (choice.finish_reason === 'length') {
    throw new Error(
      `${TRUNCATED_MESSAGE}: max_completion_tokens=${maxCompletionTokens}`,
    );
  }

  try {
    return JSON.parse(choice.message.content);
  } catch (error) {
    throw new Error(PARSE_FAILED_MESSAGE, { cause: error });
  }
}
