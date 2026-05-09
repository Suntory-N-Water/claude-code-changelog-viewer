import type { AppLogger } from '@claude-code-changelog-viewer/common';
import {
  type InferenceBatchResult,
  InferenceBatchResultSchema,
} from '@claude-code-changelog-viewer/types';
import { ApiError, GoogleGenAI, Type } from '@google/genai';
import pRetry, { AbortError } from 'p-retry';

export type SettingsTranslateResult = {
  results: {
    id: number;
    description_ja: string;
    use_case_ja: string;
  }[];
};

const RETRY_DELAY_MS = 60 * 1000;
const MAX_RETRIES_PER_MODEL = 3;

/**
 * モデルごとのレート制限設定
 */
const MODEL_RATE_LIMITS: Record<string, number> = {
  'gemini-3-flash-preview': 15 * 1000, // 4 RPM
  'gemini-3.1-flash-lite': 15 * 1000, // 4 RPM
  'gemini-2.5-flash': 15 * 1000, // 4 RPM
  'gemini-2.5-flash-lite': 10 * 1000, // 6 RPM
};

/**
 * 推論タスク用のフォールバックモデル順序
 */
const INFERENCE_FALLBACK_MODELS = [
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];

/**
 * Gemini API クライアント
 *
 * フォールバック戦略:
 * - 429エラー時に別モデルで自動リトライ
 *
 * 注: 全項目の推論・翻訳・サマリーを1回のリクエストで処理
 */
export class GeminiClient {
  private ai: GoogleGenAI;
  private log: AppLogger;
  private lastRequestTimes: Map<string, number> = new Map();

  constructor(apiKey: string, logger: AppLogger) {
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }

    this.ai = new GoogleGenAI({ apiKey });
    this.log = logger;
  }

  /**
   * モデルごとのレート制限を考慮した待機
   */
  private async waitForRateLimit(model: string): Promise<void> {
    const now = Date.now();
    const lastRequestTime = this.lastRequestTimes.get(model) || 0;
    const timeSinceLastRequest = now - lastRequestTime;
    const minInterval = MODEL_RATE_LIMITS[model] || 12 * 1000;

    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTimes.set(model, Date.now());
  }

  /**
   * リトライ可能なエラーかどうかを判定
   * - 429: レート制限エラー
   * - 503: サービス一時利用不可(高負荷時など)
   */
  private isRetryableError(error: Error): boolean {
    return (
      error instanceof ApiError &&
      (error.status === 429 || error.status === 503)
    );
  }

  /**
   * 全項目の推論・翻訳・サマリーを1回のリクエストで取得(フォールバック対応)
   *
   * @param prompt - 一括推論プロンプト
   * @returns 推論結果・翻訳結果・サマリーを含むオブジェクト
   */
  async inferAll(prompt: string): Promise<InferenceBatchResult> {
    let lastError: Error | null = null;

    for (const model of INFERENCE_FALLBACK_MODELS) {
      try {
        return await pRetry(
          async () => {
            this.log.info(`モデルを試行: ${model}`, { method: 'inferAll' });
            await this.waitForRateLimit(model);

            const response = await this.ai.models.generateContent({
              model,
              contents: prompt,
              config: {
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    inferred_items: {
                      type: Type.ARRAY,
                      description: '関連ドキュメントがある項目の推論+翻訳結果',
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          id: {
                            type: Type.NUMBER,
                            description: '元のitems配列のインデックス',
                          },
                          content_ja: {
                            type: Type.STRING,
                            description: 'CHANGELOG項目の日本語翻訳',
                          },
                          before: {
                            type: Type.STRING,
                            description: '変更前の状況(何が不便だったか)',
                          },
                          after: {
                            type: Type.STRING,
                            description: '変更後の状況(何が改善されたか)',
                          },
                          benefit: {
                            type: Type.STRING,
                            description:
                              'ユーザーへの恩恵(なぜこれが嬉しいのか)',
                          },
                        },
                        propertyOrdering: [
                          'id',
                          'content_ja',
                          'before',
                          'after',
                          'benefit',
                        ],
                        required: [
                          'id',
                          'content_ja',
                          'before',
                          'after',
                          'benefit',
                        ],
                      },
                    },
                    translated_items: {
                      type: Type.ARRAY,
                      description: '関連ドキュメントがない項目の翻訳結果',
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          id: {
                            type: Type.NUMBER,
                            description: '元のitems配列のインデックス',
                          },
                          content_ja: {
                            type: Type.STRING,
                            description: 'CHANGELOG項目の日本語翻訳',
                          },
                        },
                        propertyOrdering: ['id', 'content_ja'],
                        required: ['id', 'content_ja'],
                      },
                    },
                    feature_area_corrections: {
                      type: Type.ARRAY,
                      description: '機能領域タグの補正(補正が必要な項目のみ)',
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          id: {
                            type: Type.NUMBER,
                            description: '元のitems配列のインデックス',
                          },
                          feature_areas: {
                            type: Type.ARRAY,
                            description: '補正後の機能領域タグ',
                            items: { type: Type.STRING },
                          },
                        },
                        propertyOrdering: ['id', 'feature_areas'],
                        required: ['id', 'feature_areas'],
                      },
                    },
                    summary: {
                      type: Type.STRING,
                      description: 'バージョン全体のサマリー(日本語、2-3文)',
                    },
                  },
                  propertyOrdering: [
                    'inferred_items',
                    'translated_items',
                    'feature_area_corrections',
                    'summary',
                  ],
                  required: ['inferred_items', 'translated_items', 'summary'],
                },
                thinkingConfig: {
                  thinkingBudget: 0,
                },
              },
            });

            if (!response.text) {
              throw new Error('Gemini APIからの応答が空です');
            }

            const usage = response.usageMetadata;
            this.log.info(
              `トークン消費: ↑${usage?.promptTokenCount ?? 0} ↓${usage?.candidatesTokenCount ?? 0} (thinking: ${usage?.thoughtsTokenCount ?? 0})`,
              { method: 'inferAll', model },
            );

            const parsed = JSON.parse(response.text);
            const result = InferenceBatchResultSchema.parse(parsed);
            this.log.info(`モデル成功: ${model}`, { method: 'inferAll' });
            return result;
          },
          {
            retries: MAX_RETRIES_PER_MODEL,
            onFailedAttempt: async ({ error, attemptNumber }) => {
              if (!this.isRetryableError(error)) {
                throw new AbortError(error.message);
              }
              this.log.warn(
                `リトライ待機: ${RETRY_DELAY_MS / 1000}秒 (${model}, ${attemptNumber}/${MAX_RETRIES_PER_MODEL + 1})`,
                { method: 'inferAll' },
              );
              await new Promise((resolve) =>
                setTimeout(resolve, RETRY_DELAY_MS),
              );
            },
          },
        );
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.log.msg('APLG0024', { params: [model] });
      }
    }

    this.log.error(`全モデルが失敗: ${lastError?.message}`, {
      method: 'inferAll',
    });
    throw new Error(
      `All models failed for inference task. Last error: ${lastError?.message}`,
    );
  }

  /**
   * テキスト生成(フォールバック対応)
   *
   * ドキュメント要約など、プレーンテキストを返すタスクに使用。
   *
   * @param prompt - プロンプト
   * @returns 生成されたテキスト
   */
  async generateText(prompt: string): Promise<string> {
    let lastError: Error | null = null;

    for (const model of INFERENCE_FALLBACK_MODELS) {
      try {
        return await pRetry(
          async () => {
            this.log.info(`モデルを試行: ${model}`, {
              method: 'generateText',
            });
            await this.waitForRateLimit(model);

            const response = await this.ai.models.generateContent({
              model,
              contents: prompt,
              config: {
                thinkingConfig: {
                  thinkingBudget: 0,
                },
              },
            });

            if (!response.text) {
              throw new Error('Gemini APIからの応答が空です');
            }

            const usage = response.usageMetadata;
            this.log.info(
              `トークン消費: ↑${usage?.promptTokenCount ?? 0} ↓${usage?.candidatesTokenCount ?? 0} (thinking: ${usage?.thoughtsTokenCount ?? 0})`,
              { method: 'generateText', model },
            );

            this.log.info(`モデル成功: ${model}`, { method: 'generateText' });
            return response.text.trim();
          },
          {
            retries: MAX_RETRIES_PER_MODEL,
            onFailedAttempt: async ({ error, attemptNumber }) => {
              if (!this.isRetryableError(error)) {
                throw new AbortError(error.message);
              }
              this.log.warn(
                `リトライ待機: ${RETRY_DELAY_MS / 1000}秒 (${model}, ${attemptNumber}/${MAX_RETRIES_PER_MODEL + 1})`,
                { method: 'generateText' },
              );
              await new Promise((resolve) =>
                setTimeout(resolve, RETRY_DELAY_MS),
              );
            },
          },
        );
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.log.msg('APLG0024', { params: [model] });
      }
    }
    throw new Error(
      `All models failed for text generation task. Last error: ${lastError?.message}`,
    );
  }

  /**
   * 設定・環境変数の翻訳と用途解説を一括生成(フォールバック対応)
   *
   * @param prompt - 翻訳・解説プロンプト
   * @returns 各エントリの description_ja / use_case_ja
   */
  async translateSettings(prompt: string): Promise<SettingsTranslateResult> {
    let lastError: Error | null = null;

    for (const model of INFERENCE_FALLBACK_MODELS) {
      try {
        return await pRetry(
          async () => {
            this.log.info(`モデルを試行: ${model}`, {
              method: 'translateSettings',
            });
            await this.waitForRateLimit(model);

            const response = await this.ai.models.generateContent({
              model,
              contents: prompt,
              config: {
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    results: {
                      type: Type.ARRAY,
                      description: '各設定エントリの翻訳・用途解説結果',
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          id: {
                            type: Type.NUMBER,
                            description: '入力エントリのid',
                          },
                          description_ja: {
                            type: Type.STRING,
                            description: '英語説明の日本語訳(1文)',
                          },
                          use_case_ja: {
                            type: Type.STRING,
                            description:
                              '用途解説(2〜3行の箇条書き)。コンテキストなしの場合は空文字',
                          },
                        },
                        propertyOrdering: [
                          'id',
                          'description_ja',
                          'use_case_ja',
                        ],
                        required: ['id', 'description_ja', 'use_case_ja'],
                      },
                    },
                  },
                  propertyOrdering: ['results'],
                  required: ['results'],
                },
                thinkingConfig: {
                  thinkingBudget: 0,
                },
              },
            });

            if (!response.text) {
              throw new Error('Gemini APIからの応答が空です');
            }

            const usage = response.usageMetadata;
            this.log.info(
              `トークン消費: ↑${usage?.promptTokenCount ?? 0} ↓${usage?.candidatesTokenCount ?? 0} (thinking: ${usage?.thoughtsTokenCount ?? 0})`,
              { method: 'translateSettings', model },
            );

            const result = JSON.parse(response.text) as SettingsTranslateResult;
            this.log.info(`モデル成功: ${model}`, {
              method: 'translateSettings',
            });
            return result;
          },
          {
            retries: MAX_RETRIES_PER_MODEL,
            onFailedAttempt: async ({ error, attemptNumber }) => {
              if (!this.isRetryableError(error)) {
                throw new AbortError(error.message);
              }
              this.log.warn(
                `リトライ待機: ${RETRY_DELAY_MS / 1000}秒 (${model}, ${attemptNumber}/${MAX_RETRIES_PER_MODEL + 1})`,
                { method: 'translateSettings' },
              );
              await new Promise((resolve) =>
                setTimeout(resolve, RETRY_DELAY_MS),
              );
            },
          },
        );
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.log.msg('APLG0024', { params: [model] });
      }
    }

    throw new Error(
      `All models failed for settings translate task. Last error: ${lastError?.message}`,
    );
  }
}
