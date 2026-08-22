import { describe, expect, it, vi } from 'vitest';
import type {
  ChangelogInferenceInput,
  ChangelogRelease,
} from '../../domain/changelog-inference/changelog-inference';
import {
  createChangelogItemInferenceAi,
  createChangelogSummaryAi,
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
} satisfies ChangelogInferenceInput;

const release = {
  version: 'v2.1.234',
  items: input.items.map(({ id, content, prefix }) => ({
    id,
    content,
    prefix,
  })),
} satisfies ChangelogRelease;

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
};

function chatCompletion(content: object) {
  return {
    id: 'test-completion',
    object: 'chat.completion',
    created: 0,
    model: '@cf/zai-org/glm-4.7-flash',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: JSON.stringify(content),
          refusal: null,
        },
        finish_reason: 'stop',
        logprobs: null,
      },
    ],
  };
}

describe('Workers AI CHANGELOG adapter', () => {
  it('AI 応答が Zod で検証できる時、usecase の型へ変換すること', async () => {
    const run = vi.fn().mockResolvedValue(chatCompletion(validResponse));
    const sut = createChangelogItemInferenceAi({ run }, 'project-gateway');

    const result = await sut.inferItems(input);

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
    });
    expect(run).toHaveBeenCalledWith(
      '@cf/zai-org/glm-4.7-flash',
      expect.objectContaining({
        messages: [{ role: 'user', content: expect.any(String) }],
        response_format: expect.objectContaining({ type: 'json_schema' }),
        max_completion_tokens: 4096,
        chat_template_kwargs: { enable_thinking: false },
      }),
      { gateway: { id: 'project-gateway' } },
    );
  });

  it('AI 応答の Zod 検証に失敗した時、再試行可能なエラーにすること', async () => {
    const run = vi.fn().mockResolvedValue(
      chatCompletion({
        ...validResponse,
        translated_items: [{ id: 'without-docs', content_ja: '短い' }],
      }),
    );
    const sut = createChangelogItemInferenceAi({ run }, 'project-gateway');

    await expect(sut.inferItems(input)).rejects.toThrow(
      'AI 推論結果の形式が不正です',
    );
  });

  it('サマリー生成では原文だけをプロンプトに渡すこと', async () => {
    const run = vi
      .fn()
      .mockResolvedValue(
        chatCompletion({ summary: '文書化された機能が追加されました。' }),
      );
    const sut = createChangelogSummaryAi({ run }, 'project-gateway');

    await expect(sut.summarize(release)).resolves.toBe(
      '文書化された機能が追加されました。',
    );

    const prompt = run.mock.calls[0]?.[1]?.messages?.[0]?.content;
    expect(prompt).toContain('- [Added] - Added a documented feature');
    expect(prompt).not.toContain('The feature automates the repeated setup.');
  });

  it('サマリーの AI 応答が空の時、再試行可能なエラーにすること', async () => {
    const run = vi.fn().mockResolvedValue(chatCompletion({ summary: '' }));
    const sut = createChangelogSummaryAi({ run }, 'project-gateway');

    await expect(sut.summarize(release)).rejects.toThrow(
      'AI サマリー結果の形式が不正です',
    );
  });
});
