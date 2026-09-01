import { z } from 'zod';

export const SettingsReferenceResponseSchema = z.object({
  results: z.array(
    z.object({
      id: z.number(),
      description_ja: z.string(),
      use_case_ja: z.string(),
      enum_descriptions_ja: z.array(
        z.object({
          value: z.string(),
          description_ja: z.string(),
        }),
      ),
      default_note_ja: z.string(),
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
