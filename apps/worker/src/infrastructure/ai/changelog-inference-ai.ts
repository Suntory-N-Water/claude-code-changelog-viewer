import {
  FEATURE_AREAS,
  ITEM_IDS_MISMATCH_MESSAGE,
  type ChangelogAiTranslationItem,
  type ChangelogInferenceInput,
  type ChangelogItemsAiResult,
  type ChangelogRelease,
} from '../../domain/changelog-inference/changelog-inference';
import type {
  ChangelogItemInferencePort,
  ChangelogSummaryPort,
  ChangelogTranslationPort,
} from '../../usecases/changelog-inference';
import { z } from 'zod';
import {
  ChangelogItemsResponseFormat,
  ChangelogItemsResponseSchema,
  ChangelogSummaryResponseFormat,
  ChangelogSummaryResponseSchema,
  ChangelogTranslationResponseFormat,
  ChangelogTranslationResponseSchema,
} from './changelog-inference-schema';
import {
  logAiFailure,
  logAiUsage,
  MODEL,
  parseAiResponse,
  PARSE_FAILED_MESSAGE,
  REASONING_EFFORT,
  TRUNCATED_MESSAGE,
} from './workers-ai';

// 65536 のままだと暴走した応答が Workers AI の約240秒に達してしまうため、通常の出力量の
// 2倍程度で打ち切って step の再試行に回す。翻訳は 30 項目で約3,000 トークンだった (2026-10-14 計測)
const INFERENCE_MAX_COMPLETION_TOKENS = 4096;
const TRANSLATION_MAX_COMPLETION_TOKENS = 8192;
const SUMMARY_MAX_COMPLETION_TOKENS = 4096;

const ITEMS_SCHEMA_FAILED_MESSAGE = 'AI 推論結果の形式が不正です';
const TRANSLATION_SCHEMA_FAILED_MESSAGE = 'AI 翻訳結果の形式が不正です';

// 応答の形が不正な失敗は再試行を尽くしても回復しないことがあるので、
// 呼び出し側がその項目を諦める判断に使えるようまとめて扱う
const UNUSABLE_RESPONSE_MESSAGES = [
  TRUNCATED_MESSAGE,
  PARSE_FAILED_MESSAGE,
  ITEMS_SCHEMA_FAILED_MESSAGE,
  TRANSLATION_SCHEMA_FAILED_MESSAGE,
  ITEM_IDS_MISMATCH_MESSAGE,
];

/**
 * Workflow の step 境界を越えるとエラーは再生成され instanceof が使えないため、
 * メッセージで判定する。
 */
export function isUnusableAiResponseError(error: unknown): boolean {
  return (
    error instanceof Error &&
    UNUSABLE_RESPONSE_MESSAGES.some((message) => error.message.startsWith(message))
  );
}

async function runChat(
  ai: Pick<Cloudflare.Env['AI'], 'run'>,
  gatewayId: string,
  request: {
    prompt: string;
    maxCompletionTokens: number;
    responseFormat:
      | typeof ChangelogItemsResponseFormat
      | typeof ChangelogTranslationResponseFormat
      | typeof ChangelogSummaryResponseFormat;
  },
): Promise<unknown> {
  const startedAt = Date.now();
  let response: unknown;
  try {
    response = await ai.run(
      MODEL,
      {
        messages: [{ role: 'user', content: request.prompt }],
        max_completion_tokens: request.maxCompletionTokens,
        reasoning_effort: REASONING_EFFORT,
        response_format: request.responseFormat,
      },
      { gateway: { id: gatewayId } },
    );
  } catch (error) {
    logAiFailure(error, startedAt);
    throw error;
  }
  logAiUsage(response, startedAt);
  return parseAiResponse(response, request.maxCompletionTokens);
}

export function createChangelogItemInferenceAi(
  ai: Pick<Cloudflare.Env['AI'], 'run'>,
  gatewayId: string,
): ChangelogItemInferencePort {
  return {
    async inferItems(input): Promise<ChangelogItemsAiResult> {
      const parsed = ChangelogItemsResponseSchema.safeParse(
        await runChat(ai, gatewayId, {
          prompt: buildItemsPrompt(input),
          maxCompletionTokens: INFERENCE_MAX_COMPLETION_TOKENS,
          responseFormat: ChangelogItemsResponseFormat,
        }),
      );
      if (!parsed.success) {
        throw new Error(`${ITEMS_SCHEMA_FAILED_MESSAGE}: ${z.prettifyError(parsed.error)}`);
      }

      return {
        inferredItems: parsed.data.inferred_items.map((item) => ({
          id: item.id,
          inference: {
            before: item.before,
            after: item.after,
            benefit: item.benefit,
          },
        })),
        featureAreaCorrections: parsed.data.feature_area_corrections.map((item) => ({
          id: item.id,
          featureAreas: item.feature_areas,
        })),
      };
    },
  };
}

export function createChangelogTranslationAi(
  ai: Pick<Cloudflare.Env['AI'], 'run'>,
  gatewayId: string,
): ChangelogTranslationPort {
  return {
    async translateItems(release): Promise<ChangelogAiTranslationItem[]> {
      const parsed = ChangelogTranslationResponseSchema.safeParse(
        await runChat(ai, gatewayId, {
          prompt: buildTranslationPrompt(release),
          maxCompletionTokens: TRANSLATION_MAX_COMPLETION_TOKENS,
          responseFormat: ChangelogTranslationResponseFormat,
        }),
      );
      if (!parsed.success) {
        throw new Error(`${TRANSLATION_SCHEMA_FAILED_MESSAGE}: ${z.prettifyError(parsed.error)}`);
      }

      return parsed.data.translated_items.map((item) => ({
        id: item.id,
        contentJa: item.content_ja,
      }));
    },
  };
}

export function createChangelogSummaryAi(
  ai: Pick<Cloudflare.Env['AI'], 'run'>,
  gatewayId: string,
): ChangelogSummaryPort {
  return {
    async summarize(release): Promise<string> {
      const parsed = ChangelogSummaryResponseSchema.safeParse(
        await runChat(ai, gatewayId, {
          prompt: buildSummaryPrompt(release),
          maxCompletionTokens: SUMMARY_MAX_COMPLETION_TOKENS,
          responseFormat: ChangelogSummaryResponseFormat,
        }),
      );
      if (!parsed.success) {
        throw new Error(`AI サマリー結果の形式が不正です: ${z.prettifyError(parsed.error)}`);
      }

      return parsed.data.summary;
    },
  };
}

const PROMPT_PREAMBLE = [
  '## 前提',
  '- Claude Code は開発者向けの AI アシスタント CLI ツールである',
  '- 技術用語を適切に日本語化し、開発者にとって自然な日本語で表現する',
  '- CHANGELOG の原文や関連ドキュメントにない内容を捏造しない',
].join('\n');

// モデルは学習時点の知識から実在しないモデル名や古い版数を補いがちなため、明示して止める
const MODEL_NAME_RULES = [
  '## Claude Code のモデル情報 (重要)',
  '- CHANGELOG の原文や関連ドキュメントに記載されていないモデル名・バージョン番号・スペック値を捏造しない',
  '- CHANGELOG の原文に具体的なモデル名が記載されている場合はそのまま使う',
].join('\n');

function buildTranslationPrompt(release: ChangelogRelease): string {
  const items = release.items
    .map((item) => [`### 項目 id=${item.id}`, `- content: ${item.content}`].join('\n'))
    .join('\n\n');

  return [
    PROMPT_PREAMBLE,
    '',
    MODEL_NAME_RULES,
    '',
    `## 状況\nバージョン ${release.version} の CHANGELOG のうち ${release.items.length} 項目を日本語に翻訳する。`,
    '',
    '# タスク: 翻訳',
    '- 原文の意味を正確に保ち、1〜2文の自然な日本語にする',
    '- コマンド名・設定キー・ファイル名・ツール名は原文の表記のまま残す',
    '- それ以外の英単語は日本語にする',
    '- 自然な日本語の動詞の終止形で終える',
    '- 全項目を1件ずつ返し、id は入力値をそのまま返す',
    '',
    items,
  ].join('\n');
}

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
  const featureAreaItems = input.items
    .map((item) => `- id=${item.id}, content: ${item.content}`)
    .join('\n');

  return [
    PROMPT_PREAMBLE,
    '',
    MODEL_NAME_RULES,
    '',
    `## 状況\nバージョン ${input.version} の CHANGELOG のうち ${input.items.length} 項目を処理する。`,
    '',
    '以下の2つのタスクを一度に実行する:',
    '1. 関連ドキュメントがある項目の Before / After / Benefit の推論',
    '2. 各項目の機能領域タグの付与',
    '',
    '# タスク1: 推論',
    '- snippets に記載がない推測は避ける',
    '- before / after は変更前後を具体的に2〜3文で書く',
    '- benefit はユーザーの行動変化を1文で書く',
    '- benefit は自然な日本語の動詞の終止形で終える',
    '- id は入力値をそのまま返す',
    '',
    inferenceItems || '(対象なし)',
    '',
    '# タスク2: 機能領域タグ',
    '該当する項目だけを返し、1項目に複数タグを付けてもよい。該当しなければ返さない。',
    `タグ候補: ${FEATURE_AREAS.join(', ')}`,
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
    release.items.map((item) => `- [${item.prefix}] ${item.content}`).join('\n'),
  ].join('\n');
}
