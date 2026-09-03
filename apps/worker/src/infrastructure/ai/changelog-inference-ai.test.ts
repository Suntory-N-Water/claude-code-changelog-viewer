import { describe, expect, it, vi } from 'vitest';
import type {
  ChangelogInferenceInput,
  ChangelogRelease,
} from '../../domain/changelog-inference/changelog-inference';
import {
  createChangelogItemInferenceAi,
  createChangelogSummaryAi,
  isUnusableAiResponseError,
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
  return rawChatCompletion(JSON.stringify(content), 'stop');
}

function rawChatCompletion(content: string, finishReason: string) {
  return {
    id: 'test-completion',
    object: 'chat.completion',
    created: 0,
    model: '@cf/zai-org/glm-5.3-flash',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content,
          refusal: null,
        },
        finish_reason: finishReason,
        logprobs: null,
      },
    ],
  };
}

const truncatedJson = `{"inferred_items":[{"id":"with-docs","content_ja":"文書化された機能を追`;

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
      '@cf/zai-org/glm-5.3-flash',
      expect.objectContaining({
        messages: [{ role: 'user', content: expect.any(String) }],
        response_format: expect.objectContaining({ type: 'json_schema' }),
        max_completion_tokens: 4096,
        chat_template_kwargs: { enable_thinking: false },
        stop: [' '.repeat(24)],
      }),
      { gateway: { id: 'project-gateway' } },
    );
  });

  it('AI 応答が出力上限で打ち切られた時、打ち切りと分かるエラーにすること', async () => {
    // このメッセージは諦めた項目の GitHub Issue にそのまま載るため、原因が読み取れる必要がある
    const run = vi
      .fn()
      .mockResolvedValue(rawChatCompletion(truncatedJson, 'length'));
    const sut = createChangelogItemInferenceAi({ run }, 'project-gateway');

    await expect(sut.inferItems(input)).rejects.toThrow(
      'AI 応答が出力上限で打ち切られました',
    );
  });

  describe('AI 応答が使えない失敗', () => {
    it.each([
      ['出力上限に達した応答', rawChatCompletion(truncatedJson, 'length')],
      // stop で空白の連続を切り落とすと末尾に空白が残らず finish_reason も stop のままになるため、
      // 打ち切りは壊れた JSON としてしか現れない
      [
        'stop で切り落とされた壊れた JSON',
        rawChatCompletion(truncatedJson, 'stop'),
      ],
      ['JSON ですらない応答', rawChatCompletion('not json at all', 'stop')],
      [
        'スキーマを満たさない応答',
        rawChatCompletion(
          JSON.stringify({
            ...validResponse,
            translated_items: [{ id: 'without-docs', content_ja: '短い' }],
          }),
          'stop',
        ),
      ],
    ])('%s のとき、その項目を諦めてよい失敗になること', async (_, response) => {
      const run = vi.fn().mockResolvedValue(response);
      const sut = createChangelogItemInferenceAi({ run }, 'project-gateway');

      const error = await sut
        .inferItems(input)
        .catch((caught: unknown) => caught);

      expect(isUnusableAiResponseError(error)).toBe(true);
    });

    it('Workers AI の呼び出し自体が失敗したとき、諦めてよい失敗にはしないこと', async () => {
      const run = vi
        .fn()
        .mockRejectedValue(new Error('AiError: 5030: capacity exceeded'));
      const sut = createChangelogItemInferenceAi({ run }, 'project-gateway');

      const error = await sut
        .inferItems(input)
        .catch((caught: unknown) => caught);

      expect(isUnusableAiResponseError(error)).toBe(false);
    });
  });

  it('サマリーの AI 応答が出力上限で打ち切られた時、打ち切りと分かるエラーにすること', async () => {
    const run = vi
      .fn()
      .mockResolvedValue(
        rawChatCompletion('{"summary":"文書化された機', 'length'),
      );
    const sut = createChangelogSummaryAi({ run }, 'project-gateway');

    await expect(sut.summarize(release)).rejects.toThrow(
      'AI 応答が出力上限で打ち切られました',
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
