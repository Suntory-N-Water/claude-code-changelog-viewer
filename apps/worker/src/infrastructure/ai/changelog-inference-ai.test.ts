import { describe, expect, it, vi } from 'vitest';
import type {
  ChangelogInferenceInput,
  ChangelogRelease,
} from '../../domain/changelog-inference/changelog-inference';
import { translateChangelogItemBatch } from '../../usecases/changelog-inference';
import {
  createChangelogItemInferenceAi,
  createChangelogSummaryAi,
  createChangelogTranslationAi,
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
      before: '繰り返しの設定を手動で行う必要がありました。',
      after: '設定を自動化する機能が追加されました。',
      benefit: '繰り返しの設定作業を毎回行わずに済みます。',
    },
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

const truncatedJson = `{"inferred_items":[{"id":"with-docs","before":"繰り返しの設定を手動で`;

describe('Workers AI CHANGELOG adapter', () => {
  it('AI 応答が Zod で検証できる時、usecase の型へ変換すること', async () => {
    const run = vi.fn().mockResolvedValue(chatCompletion(validResponse));
    const sut = createChangelogItemInferenceAi({ run }, 'project-gateway');

    const result = await sut.inferItems(input);

    expect(result).toEqual({
      inferredItems: [
        {
          id: 'with-docs',
          inference: {
            before: '繰り返しの設定を手動で行う必要がありました。',
            after: '設定を自動化する機能が追加されました。',
            benefit: '繰り返しの設定作業を毎回行わずに済みます。',
          },
        },
      ],
      featureAreaCorrections: [{ id: 'with-docs', featureAreas: ['Settings'] }],
    });
    expect(run).toHaveBeenCalledWith(
      '@cf/zai-org/glm-5.3-flash',
      expect.objectContaining({
        messages: [{ role: 'user', content: expect.any(String) }],
        response_format: expect.objectContaining({ type: 'json_schema' }),
        max_completion_tokens: 4096,
        reasoning_effort: 'low',
      }),
      { gateway: { id: 'project-gateway' } },
    );
  });

  it('AI 応答が出力上限で打ち切られた時、打ち切りと分かるエラーにすること', async () => {
    // このメッセージは諦めた項目の GitHub Issue にそのまま載るため、原因が読み取れる必要がある
    const run = vi.fn().mockResolvedValue(rawChatCompletion(truncatedJson, 'length'));
    const sut = createChangelogItemInferenceAi({ run }, 'project-gateway');

    await expect(sut.inferItems(input)).rejects.toThrow('AI 応答が出力上限で打ち切られました');
  });

  describe('AI 応答が使えない失敗', () => {
    it.each([
      ['出力上限に達した応答', rawChatCompletion(truncatedJson, 'length')],
      // 思考を抑える指定が無視されると、思考だけで上限を使い切り本文が空になる
      ['思考で上限を使い切った空の応答', rawChatCompletion('', 'length')],
      ['途中で終わった JSON', rawChatCompletion(truncatedJson, 'stop')],
      ['JSON ですらない応答', rawChatCompletion('not json at all', 'stop')],
      [
        'スキーマを満たさない応答',
        rawChatCompletion(
          JSON.stringify({
            ...validResponse,
            inferred_items: [{ ...validResponse.inferred_items[0], benefit: '' }],
          }),
          'stop',
        ),
      ],
    ])('%s のとき、その項目を諦めてよい失敗になること', async (_, response) => {
      const run = vi.fn().mockResolvedValue(response);
      const sut = createChangelogItemInferenceAi({ run }, 'project-gateway');

      const error = await sut.inferItems(input).catch((caught: unknown) => caught);

      expect(isUnusableAiResponseError(error)).toBe(true);
    });

    it.each([
      [
        'スキーマを満たさない翻訳応答',
        chatCompletion({ translated_items: [{ id: 'with-docs', content_ja: '' }] }),
      ],
      [
        '項目を取りこぼした翻訳応答',
        chatCompletion({
          translated_items: [{ id: 'with-docs', content_ja: '文書化された機能を追加した。' }],
        }),
      ],
    ])('%s のとき、そのバッチの翻訳を諦めてよい失敗になること', async (_, response) => {
      const run = vi.fn().mockResolvedValue(response);
      const translator = createChangelogTranslationAi({ run }, 'project-gateway');

      const error = await translateChangelogItemBatch(translator, release).catch(
        (caught: unknown) => caught,
      );

      expect(isUnusableAiResponseError(error)).toBe(true);
    });

    it('Workers AI の呼び出し自体が失敗したとき、諦めてよい失敗にはしないこと', async () => {
      const run = vi.fn().mockRejectedValue(new Error('AiError: 5030: capacity exceeded'));
      const sut = createChangelogItemInferenceAi({ run }, 'project-gateway');

      const error = await sut.inferItems(input).catch((caught: unknown) => caught);

      expect(isUnusableAiResponseError(error)).toBe(false);
    });
  });

  it('翻訳の AI 応答が正しい形のとき、原文だけをプロンプトに渡して項目ごとの日本語訳に変換すること', async () => {
    const run = vi.fn().mockResolvedValue(
      chatCompletion({
        translated_items: [
          { id: 'with-docs', content_ja: '文書化された機能を追加した。' },
          { id: 'without-docs', content_ja: '小さな誤字を修正した。' },
        ],
      }),
    );
    const sut = createChangelogTranslationAi({ run }, 'project-gateway');

    const result = await sut.translateItems(release);

    expect(result).toEqual([
      { id: 'with-docs', contentJa: '文書化された機能を追加した。' },
      { id: 'without-docs', contentJa: '小さな誤字を修正した。' },
    ]);
    const prompt = run.mock.calls[0]?.[1]?.messages?.[0]?.content;
    // 原文の箇条書き記号を渡すと訳の先頭にも "- " が書き写される
    expect(prompt).toContain('- content: Added a documented feature');
    expect(prompt).not.toContain('- content: - ');
    expect(prompt).not.toContain('The feature automates the repeated setup.');
  });

  it('原文に二重引用符があるとき、翻訳プロンプトでは一重引用符に置き換えること', async () => {
    // 二重引用符を書き写させると JSON 文字列が途中で閉じ、空白ループか途中で切れた訳になる
    const run = vi.fn().mockResolvedValue(
      chatCompletion({
        translated_items: [
          { id: 'quoted', content_ja: 'fork サブエージェントを最初から有効にした。' },
        ],
      }),
    );
    const sut = createChangelogTranslationAi({ run }, 'project-gateway');

    await sut.translateItems({
      version: 'v2.1.302',
      items: [
        {
          id: 'quoted',
          content: '- Changed fork subagents (`subagent_type: "fork"`) to be on by default',
          prefix: 'Changed',
        },
      ],
    });

    const prompt = run.mock.calls[0]?.[1]?.messages?.[0]?.content;
    expect(prompt).toContain("(`subagent_type: 'fork'`)");
    expect(prompt).not.toContain('"fork"');
  });

  it('原文が短く訳が 10 字未満のとき、翻訳を受け付けること', async () => {
    const run = vi.fn().mockResolvedValue(
      chatCompletion({
        translated_items: [
          { id: 'with-docs', content_ja: '機能を追加した。' },
          { id: 'without-docs', content_ja: '誤字を修正した' },
        ],
      }),
    );
    const sut = createChangelogTranslationAi({ run }, 'project-gateway');

    const result = await sut.translateItems(release);

    expect(result).toEqual([
      { id: 'with-docs', contentJa: '機能を追加した。' },
      { id: 'without-docs', contentJa: '誤字を修正した' },
    ]);
  });

  it('推論の before / after / benefit が 10 字未満のとき、推論を受け付けること', async () => {
    const run = vi.fn().mockResolvedValue(
      chatCompletion({
        inferred_items: [
          {
            id: 'with-docs',
            before: '手動だった。',
            after: '自動になった。',
            benefit: '手間が減る。',
          },
        ],
        feature_area_corrections: [],
      }),
    );
    const sut = createChangelogItemInferenceAi({ run }, 'project-gateway');

    const result = await sut.inferItems(input);

    expect(result.inferredItems).toEqual([
      {
        id: 'with-docs',
        inference: { before: '手動だった。', after: '自動になった。', benefit: '手間が減る。' },
      },
    ]);
  });

  it('サマリーの AI 応答が出力上限で打ち切られた時、打ち切りと分かるエラーにすること', async () => {
    const run = vi
      .fn()
      .mockResolvedValue(rawChatCompletion('{"summary":"文書化された機', 'length'));
    const sut = createChangelogSummaryAi({ run }, 'project-gateway');

    await expect(sut.summarize(release)).rejects.toThrow('AI 応答が出力上限で打ち切られました');
  });

  it('サマリー生成では原文だけをプロンプトに渡すこと', async () => {
    const run = vi
      .fn()
      .mockResolvedValue(chatCompletion({ summary: '文書化された機能が追加されました。' }));
    const sut = createChangelogSummaryAi({ run }, 'project-gateway');

    await expect(sut.summarize(release)).resolves.toBe('文書化された機能が追加されました。');

    const prompt = run.mock.calls[0]?.[1]?.messages?.[0]?.content;
    expect(prompt).toContain('- [Added] - Added a documented feature');
    expect(prompt).not.toContain('The feature automates the repeated setup.');
  });

  it('サマリーの AI 応答が空の時、再試行可能なエラーにすること', async () => {
    const run = vi.fn().mockResolvedValue(chatCompletion({ summary: '' }));
    const sut = createChangelogSummaryAi({ run }, 'project-gateway');

    await expect(sut.summarize(release)).rejects.toThrow('AI サマリー結果の形式が不正です');
  });
});
