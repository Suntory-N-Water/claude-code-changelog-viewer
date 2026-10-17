import { z } from 'zod';

export const SettingsTranslationResponseSchema = z.object({
  results: z.array(
    z.object({
      id: z.number(),
      description_ja: z.string().min(1).describe('英語説明を自然な日本語に翻訳した文'),
      enum_descriptions_ja: z.array(
        z.object({
          value: z.string(),
          description_ja: z.string().describe('選択肢の説明を日本語に翻訳した1文'),
        }),
      ),
      default_note_ja: z
        .string()
        .describe('既定値の補足を日本語に翻訳した1文。補足がない場合は空文字'),
    }),
  ),
});

export const SettingsTranslationResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'settings_translation',
    schema: z.toJSONSchema(SettingsTranslationResponseSchema, {
      target: 'draft-07',
    }),
  },
} as const;

// 1 つの文字列で箇条書きを書かせると、改行を入れずに「…できる。- また…」と 1 行へ詰めて返した。
// 項目ごとの配列で受け取り、箇条書きへの整形はプログラム側で行う
export const SettingsUseCaseResponseSchema = z.object({
  use_cases_ja: z
    .array(z.string().max(300))
    .max(3)
    .describe('設定を使う場面を日本語の1文ずつに分けた配列。書けることがない場合は空配列'),
});

export const SettingsUseCaseResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'settings_use_case',
    schema: z.toJSONSchema(SettingsUseCaseResponseSchema, {
      target: 'draft-07',
    }),
  },
} as const;
