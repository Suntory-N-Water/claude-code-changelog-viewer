import { z } from 'zod';

export const SettingsReferenceResponseSchema = z.object({
  results: z.array(
    z.object({
      id: z.number(),
      description_ja: z
        .string()
        .describe('英語説明を自然な日本語に翻訳した1文'),
      use_case_ja: z
        .string()
        .describe(
          '設定の用途を日本語で説明した箇条書き。情報がない場合は空文字',
        ),
      enum_descriptions_ja: z.array(
        z.object({
          value: z.string(),
          description_ja: z
            .string()
            .describe('選択肢の説明を日本語に翻訳した1文'),
        }),
      ),
      default_note_ja: z
        .string()
        .describe('既定値の補足を日本語に翻訳した1文。補足がない場合は空文字'),
    }),
  ),
});

export const SettingsReferenceResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'settings_reference',
    schema: z.toJSONSchema(SettingsReferenceResponseSchema, {
      target: 'draft-07',
    }),
  },
} as const;
