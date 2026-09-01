import { describe, expect, it, vi } from 'vitest';
import type { SettingsReferenceInput } from '../../usecases/settings-reference';
import {
  buildSettingsReferencePrompt,
  createSettingsReferenceAi,
} from './settings-reference-ai';

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

function chatCompletion(content: object | string) {
  return {
    choices: [
      {
        message: {
          content:
            typeof content === 'string' ? content : JSON.stringify(content),
        },
      },
    ],
  };
}

describe('Workers AI 設定リファレンス adapter', () => {
  it('関連情報とスキーマ情報がある時、AI 向けの入力に含めること', () => {
    const result = buildSettingsReferencePrompt({
      entries: [
        ...input.entries,
        {
          id: 1,
          key: 'CLAUDE_CODE_TEST',
          source: 'env',
          descriptionEn: 'Test environment variable.',
          parentDescriptions: [],
          docSnippets: [],
          officialDocs: [],
          relatedChangelog: [],
          schemaDefault: 'false',
          schemaEnum: ['true', 'false'],
        },
      ],
    });

    expect(result).toContain('`permissions.additionalDirectories`');
    expect(result).toContain('Add directories to grant access.');
    expect(result).toContain('`CLAUDE_CODE_TEST`');
    expect(result).toContain('デフォルト値: "false"');
    expect(result).toContain('選択肢: ["true", "false"]');
  });

  it('有効な AI 応答の時、設定リファレンスの翻訳結果を返すこと', async () => {
    const run = vi.fn().mockResolvedValue(
      chatCompletion({
        results: [
          {
            id: 0,
            description_ja: 'アクセスを許可する追加ディレクトリです。',
            use_case_ja:
              '- プロジェクト外のディレクトリを参照する場合に使います。',
            enum_descriptions_ja: [],
            default_note_ja: '',
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
        enumDescriptionsJa: [],
        defaultNoteJa: '',
      },
    ]);
  });

  it('選択肢ごとの英文と既定値の補足があるとき、原文を AI 向けの入力に含めること', () => {
    const result = buildSettingsReferencePrompt({
      entries: [
        {
          id: 0,
          key: 'autoUpdatesChannel',
          source: 'settings',
          descriptionEn: 'Choose which release channel updates follow.',
          parentDescriptions: [],
          docSnippets: [],
          officialDocs: [],
          relatedChangelog: [],
          enumDescriptions: {
            latest: 'updates follow the most recent release',
          },
          defaultNote: 'unset, so Claude Code follows `"latest"`',
        },
      ],
    });

    expect(result).toContain(
      '- `"latest"`: updates follow the most recent release',
    );
    expect(result).toContain('unset, so Claude Code follows `"latest"`');
  });

  it('選択肢ごとの日本語説明を返す AI 応答のとき、値ごとに取り出すこと', async () => {
    const run = vi.fn().mockResolvedValue(
      chatCompletion({
        results: [
          {
            id: 0,
            description_ja: 'アクセスを許可する追加ディレクトリです。',
            use_case_ja: '',
            enum_descriptions_ja: [
              { value: 'latest', description_ja: '最新のリリースを追いかける' },
            ],
            default_note_ja: '未設定のときは最新を追いかける',
          },
        ],
      }),
    );
    const sut = createSettingsReferenceAi({ run }, 'project-gateway');

    await expect(sut.infer(input)).resolves.toEqual([
      {
        id: 0,
        descriptionJa: 'アクセスを許可する追加ディレクトリです。',
        useCaseJa: '',
        enumDescriptionsJa: [
          { value: 'latest', descriptionJa: '最新のリリースを追いかける' },
        ],
        defaultNoteJa: '未設定のときは最新を追いかける',
      },
    ]);
  });

  it('Gateway ID を指定した時、外部 AI 境界へ渡すこと', async () => {
    const run = vi.fn().mockResolvedValue(
      chatCompletion({
        results: [
          {
            id: 0,
            description_ja: 'アクセスを許可する追加ディレクトリです。',
            use_case_ja: '',
            enum_descriptions_ja: [],
            default_note_ja: '',
          },
        ],
      }),
    );
    const sut = createSettingsReferenceAi({ run }, 'project-gateway');

    await sut.infer(input);

    expect(run.mock.calls[0]?.[0]).toEqual('@cf/zai-org/glm-4.7-flash');
    expect(run.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        response_format: expect.objectContaining({ type: 'json_schema' }),
        max_completion_tokens: 8192,
        chat_template_kwargs: { enable_thinking: false },
      }),
    );
    expect(run.mock.calls[0]?.[2]).toEqual({
      gateway: { id: 'project-gateway' },
    });
  });

  it('AI 応答の envelope が不正な時、エラーになること', async () => {
    const run = vi.fn().mockResolvedValue({ choices: [] });
    const sut = createSettingsReferenceAi({ run }, 'project-gateway');

    await expect(sut.infer(input)).rejects.toThrow('AI 応答の形式が不正です');
  });

  it('AI 応答の JSON が不正な時、エラーになること', async () => {
    const run = vi.fn().mockResolvedValue(chatCompletion('not-json'));
    const sut = createSettingsReferenceAi({ run }, 'project-gateway');

    await expect(sut.infer(input)).rejects.toThrow(
      'AI 応答の JSON 解析に失敗しました',
    );
  });

  it('AI 応答の結果スキーマが不正な時、エラーになること', async () => {
    const run = vi
      .fn()
      .mockResolvedValue(chatCompletion({ results: [{ id: 'invalid' }] }));
    const sut = createSettingsReferenceAi({ run }, 'project-gateway');

    await expect(sut.infer(input)).rejects.toThrow(
      'AI 設定リファレンス結果の形式が不正です',
    );
  });
});
