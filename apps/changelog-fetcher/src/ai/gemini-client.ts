import {
  type InferenceWithTranslation,
  InferenceWithTranslationSchema,
} from '@claude-code-changelog-viewer/types';
import { GoogleGenAI, Type } from '@google/genai';
import { z } from 'zod';

/**
 * モデルごとのレート制限設定
 */
const MODEL_RATE_LIMITS: Record<string, number> = {
  'gemini-3-flash-preview': 12 * 1000, // 5 RPM
  'gemini-2.5-flash': 12 * 1000, // 5 RPM
  'gemini-2.5-flash-lite': 6 * 1000, // 10 RPM
  'gemma-3-12b': 2 * 1000, // 30 RPM
};

/**
 * 推論タスク用のフォールバックモデル順序
 */
const INFERENCE_FALLBACK_MODELS = [
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];

/**
 * 翻訳タスク用のフォールバックモデル順序
 * 軽量モデルを優先して貴重なGemini枠を節約
 */
const TRANSLATION_FALLBACK_MODELS = [
  'gemini-2.5-flash-lite',
  'gemma-3-12b',
  'gemini-2.5-flash',
];

/**
 * Gemini API クライアント
 *
 * フォールバック戦略:
 * - 429エラー時に別モデルで自動リトライ
 * - 推論タスク: 高品質モデル優先
 * - 翻訳タスク: 軽量モデル優先でGemini枠を節約
 */
export class GeminiClient {
  private ai: GoogleGenAI;
  private lastRequestTimes: Map<string, number> = new Map();

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }

    this.ai = new GoogleGenAI({ apiKey });
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
   * 429エラーかどうかを判定
   */
  private is429Error(error: Error): boolean {
    return error.message.includes('429');
  }

  /**
   * 推論結果と翻訳を一度に取得(フォールバック対応)
   *
   * @param prompt - 推論プロンプト
   * @returns JSON形式の推論結果(翻訳含む)
   */
  async inferWithTranslation(
    prompt: string,
  ): Promise<InferenceWithTranslation> {
    let lastError: Error | null = null;

    for (const model of INFERENCE_FALLBACK_MODELS) {
      try {
        console.log(`[inferWithTranslation] Trying model: ${model}`);
        await this.waitForRateLimit(model);

        const response = await this.ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
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
                  description: 'ユーザーへの恩恵(なぜこれが嬉しいのか)',
                },
              },
              propertyOrdering: ['content_ja', 'before', 'after', 'benefit'],
              required: ['content_ja', 'before', 'after', 'benefit'],
            },
            thinkingConfig: {
              thinkingBudget: 0,
            },
          },
        });

        if (!response.text) {
          throw new Error('Gemini APIからの応答が空です');
        }

        const parsed = JSON.parse(response.text);
        const result = InferenceWithTranslationSchema.parse(parsed);
        console.log(`[inferWithTranslation] Success with model: ${model}`);
        return result;
      } catch (error) {
        if (error instanceof Error) {
          lastError = error;
          if (this.is429Error(error)) {
            console.log(
              `[inferWithTranslation] 429 error with ${model}, trying next model...`,
            );
            continue;
          }
          // 429以外のエラーは即座にthrow
          throw error;
        }
        throw error;
      }
    }

    // 全モデルで失敗した場合はエラーをthrow
    console.error(
      `[inferWithTranslation] All models failed. Last error: ${lastError?.message}`,
    );
    throw new Error(
      `All models failed for inference task. Last error: ${lastError?.message}`,
    );
  }

  /**
   * 翻訳のみを取得(フォールバック対応)
   * related_docs が2件未満の項目用
   * 軽量モデルを優先して貴重なGemini枠を節約
   *
   * @param prompt - 翻訳プロンプト
   * @returns 日本語翻訳
   */
  async translateOnly(prompt: string): Promise<string> {
    let lastError: Error | null = null;

    for (const model of TRANSLATION_FALLBACK_MODELS) {
      try {
        console.log(`[translateOnly] Trying model: ${model}`);
        await this.waitForRateLimit(model);

        const response = await this.ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                content_ja: {
                  type: Type.STRING,
                  description: 'CHANGELOG項目の日本語翻訳',
                },
              },
              required: ['content_ja'],
            },
            thinkingConfig: {
              thinkingBudget: 0,
            },
          },
        });

        if (!response.text) {
          throw new Error('Gemini APIからの応答が空です');
        }

        const parsed = JSON.parse(response.text);
        const result = z.string().parse(parsed.content_ja);
        console.log(`[translateOnly] Success with model: ${model}`);
        return result;
      } catch (error) {
        if (error instanceof Error) {
          lastError = error;
          if (this.is429Error(error)) {
            console.log(
              `[translateOnly] 429 error with ${model}, trying next model...`,
            );
            continue;
          }
          // 429以外のエラーは即座にthrow
          throw error;
        }
        throw error;
      }
    }

    // 全モデルで失敗した場合はフォールバックメッセージを返す
    console.warn(
      `[translateOnly] All models failed. Last error: ${lastError?.message}`,
    );
    return '(翻訳の生成に失敗しました)';
  }

  /**
   * バージョン全体のサマリーを生成(フォールバック対応)
   *
   * @param prompt - サマリー生成プロンプト
   * @returns 日本語サマリー
   */
  async generateVersionSummary(prompt: string): Promise<string> {
    let lastError: Error | null = null;

    for (const model of INFERENCE_FALLBACK_MODELS) {
      try {
        console.log(`[generateVersionSummary] Trying model: ${model}`);
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

        console.log(`[generateVersionSummary] Success with model: ${model}`);
        return response.text.trim();
      } catch (error) {
        if (error instanceof Error) {
          lastError = error;
          if (this.is429Error(error)) {
            console.log(
              `[generateVersionSummary] 429 error with ${model}, trying next model...`,
            );
            continue;
          }
          // 429以外のエラーは即座にthrow
          throw error;
        }
        throw error;
      }
    }

    // 全モデルで失敗した場合はフォールバックメッセージを返す
    console.warn(
      `[generateVersionSummary] All models failed. Last error: ${lastError?.message}`,
    );
    return 'ドキュメントが更新されましたが、AI要約の生成に失敗しました。詳細はコミットをご確認ください。';
  }
}
