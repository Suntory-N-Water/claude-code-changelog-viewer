import { describe, expect, it, vi } from 'vitest';
import type { SettingsReferenceInput } from '../../usecases/settings-reference';
import { createSettingsReferenceAi } from './settings-reference-ai';

const input: SettingsReferenceInput = {
  entries: [
    {
      id: 0,
      key: 'permissions.additionalDirectories',
      source: 'settings',
      descriptionEn: 'Additional directories allowed for access.',
      parentDescriptions: ['Permission settings'],
      docSnippets: ['Add directories to grant access.'],
      officialDocs: ['permissions.md'],
      relatedChangelog: [],
    },
  ],
};

function chatCompletion(content: object) {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify(content),
        },
      },
    ],
  };
}

describe('Workers AI 設定リファレンス adapter', () => {
  it('AI 応答を設定リファレンスの型へ変換し、Gateway 経由で呼び出す', async () => {
    const run = vi.fn().mockResolvedValue(
      chatCompletion({
        results: [
          {
            id: 0,
            description_ja: 'アクセスを許可する追加ディレクトリです。',
            use_case_ja:
              '- プロジェクト外のディレクトリを参照する場合に使います。',
          },
        ],
      }),
    );
    const sut = createSettingsReferenceAi({ run }, 'project-gateway');

    await expect(sut.infer(input)).resolves.toEqual([
      {
        id: 0,
        descriptionJa: 'アクセスを許可する追加ディレクトリです。',
        useCaseJa: '- プロジェクト外のディレクトリを参照する場合に使います。',
      },
    ]);
    expect(run).toHaveBeenCalledWith(
      '@cf/google/gemma-4-26b-a4b-it',
      expect.objectContaining({
        max_tokens: 65536,
        response_format: expect.objectContaining({ type: 'json_schema' }),
        messages: [{ role: 'user', content: expect.any(String) }],
      }),
      { gateway: { id: 'project-gateway' } },
    );
  });

  it('AI 応答の形式が不正な時にエラーにする', async () => {
    const run = vi
      .fn()
      .mockResolvedValue(chatCompletion({ results: [{ id: 'invalid' }] }));
    const sut = createSettingsReferenceAi({ run }, 'project-gateway');

    await expect(sut.infer(input)).rejects.toThrow(
      'AI 設定リファレンス結果の形式が不正です',
    );
  });
});
