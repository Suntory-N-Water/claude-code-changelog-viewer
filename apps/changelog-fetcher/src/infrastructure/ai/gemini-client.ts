import {
  type AppLogger,
  GeminiClient as CommonGeminiClient,
  GeminiModelsExhaustedError,
} from '@claude-code-changelog-viewer/common';
import { Type } from '@google/genai';
import { z } from 'zod';

const InferenceBatchResultSchema = z.object({
  inferred_items: z.array(
    z.object({
      id: z.string(),
      content_ja: z.string(),
      before: z.string(),
      after: z.string(),
      benefit: z.string(),
    }),
  ),
  translated_items: z.array(
    z.object({
      id: z.string(),
      content_ja: z.string(),
    }),
  ),
  feature_area_corrections: z
    .array(
      z.object({
        id: z.string(),
        feature_areas: z.array(z.string()),
      }),
    )
    .optional(),
  impact_items: z.array(
    z.object({
      id: z.string(),
      reason: z.string(),
      default_behavior_change: z.boolean(),
      breaking: z.boolean(),
      level: z.enum(['high', 'medium', 'low']),
    }),
  ),
  summary: z.string(),
});

export type InferenceBatchResult = z.infer<typeof InferenceBatchResultSchema>;

const SettingsTranslateResultSchema = z.object({
  results: z.array(
    z.object({
      id: z.number(),
      description_ja: z.string(),
      use_case_ja: z.string(),
    }),
  ),
});

export type SettingsTranslateResult = z.infer<
  typeof SettingsTranslateResultSchema
>;

/**
 * タスク1(推論+翻訳)の inferred_items スキーマ。
 * inferAll の responseSchema と dry-run(--with-schema)出力の両方で参照する。
 */
const INFERRED_ITEMS_SCHEMA = {
  type: Type.ARRAY,
  description: '関連ドキュメントがある項目の推論+翻訳結果',
  items: {
    type: Type.OBJECT,
    properties: {
      id: {
        type: Type.STRING,
        description: '入力項目の id (12桁の16進文字列)',
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
        description: 'ユーザーへの恩恵(なぜこれが嬉しいのか)',
      },
    },
    propertyOrdering: ['id', 'content_ja', 'before', 'after', 'benefit'],
    required: ['id', 'content_ja', 'before', 'after', 'benefit'],
  },
};

/**
 * dry-run(--with-schema)で出力するタスク1のみの responseSchema。
 * タスク1 のプロンプトは inferred_items のみを生成させるため、
 * バッチ全体ではなく inferred_items に絞ったスキーマを AI Studio 用に出力する。
 */
export const INFERENCE_TASK_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    inferred_items: INFERRED_ITEMS_SCHEMA,
  },
  propertyOrdering: ['inferred_items'],
  required: ['inferred_items'],
};

/**
 * Gemini API クライアント
 *
 * フォールバック戦略:
 * - 429エラー時は即座に次モデルへフォールバック
 * - 503エラー時は同一モデルで再試行後にフォールバック
 *
 * 注: 全項目の推論・翻訳・サマリーを1回のリクエストで処理
 */
export class GeminiClient {
  private client: CommonGeminiClient;

  constructor(apiKey: string, logger: AppLogger) {
    this.client = new CommonGeminiClient(apiKey, logger);
  }

  /**
   * 全項目の推論・翻訳・サマリーを1回のリクエストで取得(フォールバック対応)
   *
   * @param prompt - 一括推論プロンプト
   * @returns 推論結果・翻訳結果・サマリーを含むオブジェクト
   */
  async inferAll(prompt: string): Promise<InferenceBatchResult> {
    try {
      return await this.client.generate({
        prompt,
        method: 'inferAll',
        countPromptTokens: true,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              inferred_items: INFERRED_ITEMS_SCHEMA,
              translated_items: {
                type: Type.ARRAY,
                description: '関連ドキュメントがない項目の翻訳結果',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: {
                      type: Type.STRING,
                      description: '入力項目の id (12桁の16進文字列)',
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
                      type: Type.STRING,
                      description: '入力項目の id (12桁の16進文字列)',
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
              impact_items: {
                type: Type.ARRAY,
                description: '各項目の影響度評価(全項目対象)',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: {
                      type: Type.STRING,
                      description: '入力項目の id (12桁の16進文字列)',
                    },
                    reason: {
                      type: Type.STRING,
                      description: '影響度判定の理由(1文)',
                    },
                    default_behavior_change: {
                      type: Type.BOOLEAN,
                      description:
                        'opt-out 可能でもデフォルト挙動が黙って変わるか',
                    },
                    breaking: {
                      type: Type.BOOLEAN,
                      description: '今すでに使い方が壊れるか',
                    },
                    level: {
                      type: Type.STRING,
                      format: 'enum',
                      enum: ['high', 'medium', 'low'],
                      description: '総合的な影響度ラベル',
                    },
                  },
                  propertyOrdering: [
                    'id',
                    'reason',
                    'default_behavior_change',
                    'breaking',
                    'level',
                  ],
                  required: [
                    'id',
                    'reason',
                    'default_behavior_change',
                    'breaking',
                    'level',
                  ],
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
              'impact_items',
              'summary',
            ],
            required: [
              'inferred_items',
              'translated_items',
              'impact_items',
              'summary',
            ],
          },
          thinkingConfig: {
            thinkingBudget: 0,
          },
        },
        parse: (text) => InferenceBatchResultSchema.parse(JSON.parse(text)),
      });
    } catch (error) {
      const cause = getLastGeminiError(error);
      throw new Error(
        `All models failed for inference task. Last error: ${cause.message}`,
      );
    }
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

  /**
   * 設定・環境変数の翻訳と用途解説を一括生成(フォールバック対応)
   *
   * @param prompt - 翻訳・解説プロンプト
   * @returns 各エントリの description_ja / use_case_ja
   */
  async translateSettings(prompt: string): Promise<SettingsTranslateResult> {
    try {
      return await this.client.generate({
        prompt,
        method: 'translateSettings',
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
                  propertyOrdering: ['id', 'description_ja', 'use_case_ja'],
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
        parse: (text) => SettingsTranslateResultSchema.parse(JSON.parse(text)),
      });
    } catch (error) {
      const cause = getLastGeminiError(error);
      throw new Error(
        `All models failed for settings translate task. Last error: ${cause.message}`,
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
