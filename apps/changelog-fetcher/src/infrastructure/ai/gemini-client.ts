import {
  type AppLogger,
  GeminiClient as CommonGeminiClient,
  GeminiModelsExhaustedError,
} from '@claude-code-changelog-viewer/common';

/**
 * Gemini API クライアント
 *
 * 429 エラー時は即座に次モデルへフォールバックし、503 エラー時は
 * 同一モデルで再試行してから次モデルへフォールバックする。
 */
export class GeminiClient {
  private client: CommonGeminiClient;

  constructor(apiKey: string, logger: AppLogger) {
    this.client = new CommonGeminiClient(apiKey, logger);
  }

  /**
   * テキスト生成(フォールバック対応)
   *
   * @param prompt - プロンプト
   * @returns 生成されたテキスト
   */
  async generateText(prompt: string): Promise<string> {
    try {
      return await this.client.generate({
        prompt,
        method: 'generateText',
        config: {
          thinkingConfig: {
            thinkingBudget: 0,
          },
        },
        parse: (text) => text,
      });
    } catch (error) {
      const cause = getLastGeminiError(error);
      throw new Error(
        `All models failed for text generation task. Last error: ${cause.message}`,
      );
    }
  }
}

function getLastGeminiError(error: unknown): Error {
  if (error instanceof GeminiModelsExhaustedError) {
    return error.lastError;
  }
  return error instanceof Error ? error : new Error(String(error));
}
