import { describe, expect, it, vi } from 'vitest';
import {
  createChangelogInferenceAi,
  type WorkersAiBinding,
} from './changelog-inference-ai';

const input = {
  version: 'v2.1.234',
  items: [
    {
      id: 'with-docs',
      content: '- Added a documented feature',
      prefix: 'Added',
      relatedDocs: [
        {
          file: 'features.md',
          snippets: ['The feature automates the repeated setup.'],
        },
      ],
    },
    {
      id: 'without-docs',
      content: '- Fixed a small typo',
      prefix: 'Fixed',
      relatedDocs: [],
    },
  ],
} as const;

const validResponse = {
  inferred_items: [
    {
      id: 'with-docs',
      content_ja: '文書化された機能を追加しました。',
      before: '繰り返しの設定を手動で行う必要がありました。',
      after: '設定を自動化する機能が追加されました。',
      benefit: '繰り返しの設定作業を毎回行わずに済みます。',
    },
  ],
  translated_items: [
    { id: 'without-docs', content_ja: '小さな誤字を修正しました。' },
  ],
  feature_area_corrections: [{ id: 'with-docs', feature_areas: ['Settings'] }],
  summary: '文書化された機能が追加され、誤字が修正されました。',
};

describe('Workers AI CHANGELOG adapter', () => {
  it('Zod で検証した AI 応答を usecase の型へ変換すること', async () => {
    const run = vi.fn<WorkersAiBinding['run']>().mockResolvedValue({
      response: JSON.stringify(validResponse),
    });
    const sut = createChangelogInferenceAi({ run }, 'project-gateway');

    const result = await sut.infer(input);

    expect(result).toEqual({
      inferredItems: [
        {
          id: 'with-docs',
          contentJa: '文書化された機能を追加しました。',
          inference: {
            before: '繰り返しの設定を手動で行う必要がありました。',
            after: '設定を自動化する機能が追加されました。',
            benefit: '繰り返しの設定作業を毎回行わずに済みます。',
          },
        },
      ],
      translatedItems: [
        { id: 'without-docs', contentJa: '小さな誤字を修正しました。' },
      ],
      featureAreaCorrections: [{ id: 'with-docs', featureAreas: ['Settings'] }],
      summary: '文書化された機能が追加され、誤字が修正されました。',
    });
    expect(run).toHaveBeenCalledWith(
      '@cf/google/gemma-4-26b-a4b-it',
      expect.objectContaining({
        response_format: expect.objectContaining({ type: 'json_schema' }),
      }),
      { gateway: { id: 'project-gateway' } },
    );
  });

  it('Zod の検証に失敗した AI 応答を再試行可能なエラーにすること', async () => {
    const run = vi.fn<WorkersAiBinding['run']>().mockResolvedValue({
      response: JSON.stringify({
        ...validResponse,
        summary: '',
      }),
    });
    const sut = createChangelogInferenceAi({ run }, 'project-gateway');

    await expect(sut.infer(input)).rejects.toThrow(
      'AI 推論結果の形式が不正です',
    );
  });
});
