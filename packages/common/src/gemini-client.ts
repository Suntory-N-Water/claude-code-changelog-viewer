import {
  ApiError,
  type CountTokensResponse,
  type GenerateContentConfig,
  type GenerateContentResponse,
  GoogleGenAI,
} from '@google/genai';
import pRetry, { AbortError } from 'p-retry';
import type { AppLogger } from './logger.js';

const RETRY_DELAY_MS = 60 * 1000;
const MAX_RETRIES_PER_MODEL = 3;

export const GEMINI_FALLBACK_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
] as const;

type GeminiModelType = (typeof GEMINI_FALLBACK_MODELS)[number];

/**
 * 公開RPMは固定値ではなくAI Studio上のアクティブな上限に依存するため、
 * 新しいGemini 3.xモデルは既存の3.xモデルと同じ保守的な間隔に揃える。
 *
 * @see https://ai.google.dev/gemini-api/docs/pricing
 * @see https://ai.google.dev/gemini-api/docs/rate-limits
 */
const MODEL_RATE_LIMITS: Record<GeminiModelType, number> = {
  'gemini-3.6-flash': 15 * 1000,
  'gemini-3.5-flash': 15 * 1000,
  'gemini-3.5-flash-lite': 15 * 1000,
  'gemini-3.1-flash-lite': 15 * 1000,
  'gemini-2.5-flash': 15 * 1000,
  'gemini-2.5-flash-lite': 10 * 1000,
};

type GeminiResponse = Pick<GenerateContentResponse, 'text' | 'usageMetadata'>;

export type GeminiApi = {
  models: {
    generateContent: (input: {
      model: string;
      contents: string;
      config: GenerateContentConfig;
    }) => Promise<GeminiResponse>;
    countTokens: (input: {
      model: string;
      contents: string;
    }) => Promise<Pick<CountTokensResponse, 'totalTokens'>>;
  };
};

type GeminiClientDependencies = {
  api?: GeminiApi;
};

type GenerateInput<T> = {
  prompt: string;
  method: string;
  config: GenerateContentConfig;
  parse: (text: string) => T;
  countPromptTokens?: boolean;
};

export class GeminiModelsExhaustedError extends Error {
  constructor(public lastError: Error) {
    super(`全Geminiモデルが失敗しました: ${lastError.message}`);
    this.name = 'GeminiModelsExhaustedError';
  }
}

export class GeminiClient {
  private api: GeminiApi;
  private lastRequestTimes = new Map<GeminiModelType, number>();

  constructor(
    apiKey: string,
    private log: AppLogger,
    dependencies: GeminiClientDependencies = {},
  ) {
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY 環境変数が未設定です');
    }
    this.api = dependencies.api ?? new GoogleGenAI({ apiKey });
  }

  async generate<T>(input: GenerateInput<T>): Promise<T> {
    let lastError: Error | null = null;

    if (input.countPromptTokens) {
      await this.logPromptTokenCount(input.prompt, input.method);
    }

    for (const model of GEMINI_FALLBACK_MODELS) {
      try {
        return await pRetry(
          async () => {
            this.log.info(`モデルを試行: ${model}`, {
              method: input.method,
            });
            await this.waitForRateLimit(model);

            const response = await this.api.models.generateContent({
              model,
              contents: input.prompt,
              config: input.config,
            });
            const text = response.text?.trim();
            if (!text) {
              throw new Error('Gemini APIからの応答が空です');
            }

            const usage = response.usageMetadata;
            this.log.info(
              `トークン消費: ↑${usage?.promptTokenCount ?? 0} ↓${usage?.candidatesTokenCount ?? 0} (thinking: ${usage?.thoughtsTokenCount ?? 0})`,
              { method: input.method, model },
            );

            const result = input.parse(text);
            this.log.info(`モデル成功: ${model}`, { method: input.method });
            return result;
          },
          {
            retries: MAX_RETRIES_PER_MODEL,
            onFailedAttempt: async ({ error, attemptNumber }) => {
              if (this.isApiStatus(error, 429)) {
                this.log.warn(
                  `クオータ超過、次モデルへフォールバック (${model}): ${this.describeError(error)}`,
                  { method: input.method },
                );
                throw new AbortError(error.message);
              }
              if (!this.isApiStatus(error, 503)) {
                this.log.warn(
                  `リトライ不可 (${model}, ${attemptNumber}回目): ${this.describeError(error)}`,
                  { method: input.method },
                );
                throw new AbortError(error.message);
              }
              this.log.warn(
                `リトライ待機: ${RETRY_DELAY_MS / 1000}秒 (${model}, ${attemptNumber}/${MAX_RETRIES_PER_MODEL + 1}) - ${this.describeError(error)}`,
                { method: input.method },
              );
              await new Promise((resolve) =>
                setTimeout(resolve, RETRY_DELAY_MS),
              );
            },
          },
        );
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.log.warn(`モデル失敗: ${model} - ${lastError.message}`, {
          method: input.method,
        });
      }
    }

    const error = lastError ?? new Error('モデルが設定されていません');
    this.log.error(`全モデルが失敗: ${error.message}`, {
      method: input.method,
    });
    throw new GeminiModelsExhaustedError(error);
  }

  private async waitForRateLimit(model: GeminiModelType): Promise<void> {
    const now = Date.now();
    const lastRequestTime = this.lastRequestTimes.get(model) ?? 0;
    const timeSinceLastRequest = now - lastRequestTime;
    const minInterval = MODEL_RATE_LIMITS[model];

    if (timeSinceLastRequest < minInterval) {
      await new Promise((resolve) =>
        setTimeout(resolve, minInterval - timeSinceLastRequest),
      );
    }
    this.lastRequestTimes.set(model, Date.now());
  }

  private async logPromptTokenCount(
    prompt: string,
    method: string,
  ): Promise<void> {
    const referenceModel = GEMINI_FALLBACK_MODELS[0];
    try {
      const result = await this.api.models.countTokens({
        model: referenceModel,
        contents: prompt,
      });
      this.log.info(
        `プロンプト実測トークン: ${result.totalTokens ?? 0} (${referenceModel})`,
        { method },
      );
    } catch (error) {
      const cause = error instanceof Error ? error : new Error(String(error));
      this.log.warn(`countTokens 失敗: ${this.describeError(cause)}`, {
        method,
      });
    }
  }

  private isApiStatus(error: Error, status: number): boolean {
    return error instanceof ApiError && error.status === status;
  }

  private describeError(error: Error): string {
    const message = error.message.replace(/\s+/g, ' ').slice(0, 500);
    if (error instanceof ApiError) {
      return `ApiError[${error.status}]: ${message}`;
    }
    return `${error.name}: ${message}`;
  }
}
