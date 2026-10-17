import { describe, expect, it, vi } from 'vitest';
import type { SettingsReferenceInputEntry } from '../../usecases/settings-reference';
import {
  buildSettingsTranslationPrompt,
  buildSettingsUseCasePrompt,
  createSettingsTranslationAi,
  createSettingsUseCaseAi,
  isUnusableSettingsAiResponseError,
} from './settings-reference-ai';

const entry: SettingsReferenceInputEntry = {
  id: 0,
  key: 'permissions.additionalDirectories',
  source: 'settings',
  descriptionEn: 'Additional directories allowed for access.',
  parentDescriptions: ['Permission settings'],
  docSnippets: ['Add directories to grant access.'],
  officialDocs: ['permissions.md'],
  relatedChangelog: [],
};

function chatCompletion(content: object | string, finishReason = 'stop') {
  return {
    choices: [
      {
        message: {
          content: typeof content === 'string' ? content : JSON.stringify(content),
        },
        finish_reason: finishReason,
      },
    ],
  };
}

describe('Workers AI 設定リファレンス adapter', () => {
  it('翻訳のプロンプトに、英語説明・選択肢ごとの英語説明・既定値の補足を二重引用符を外して入れること', () => {
    const result = buildSettingsTranslationPrompt([
      {
        ...entry,
        key: 'autoUpdatesChannel',
        descriptionEn: 'Choose the "release channel" updates follow.',
        enumDescriptions: { latest: 'updates follow the most recent release' },
        defaultNote: 'unset, so Claude Code follows `"latest"`',
      },
    ]);

    expect(result).toContain('`autoUpdatesChannel`');
    expect(result).toContain("Choose the 'release channel' updates follow.");
    expect(result).toContain('- `latest`: updates follow the most recent release');
    expect(result).toContain("unset, so Claude Code follows `'latest'`");
    expect(result).not.toContain('"');
  });

  it('用途のプロンプトに、関連ドキュメントと CHANGELOG の英語原文を二重引用符を外して入れること', () => {
    const result = buildSettingsUseCasePrompt({
      ...entry,
      docSnippets: ['Set "additionalDirectories" to grant access.'],
      relatedChangelog: [
        { version: '2.1.234', content: '- Added "permissions.additionalDirectories" support' },
      ],
    });

    expect(result).toContain("Set 'additionalDirectories' to grant access.");
    expect(result).toContain("- v2.1.234: Added 'permissions.additionalDirectories' support");
    expect(result).not.toContain('"');
  });

  it('翻訳の応答が正しい形のとき、設定ごとの説明・選択肢の説明・既定値の補足に変換すること', async () => {
    const run = vi.fn().mockResolvedValue(
      chatCompletion({
        results: [
          {
            id: 0,
            description_ja: 'アクセスを許可する追加ディレクトリ。',
            enum_descriptions_ja: [{ value: 'latest', description_ja: '最新のリリースを追う' }],
            default_note_ja: '未設定のときは最新を追う',
          },
        ],
      }),
    );
    const sut = createSettingsTranslationAi({ run }, 'project-gateway');

    await expect(sut.translate([entry])).resolves.toEqual([
      {
        id: 0,
        descriptionJa: 'アクセスを許可する追加ディレクトリ。',
        enumDescriptionsJa: [{ value: 'latest', descriptionJa: '最新のリリースを追う' }],
        defaultNoteJa: '未設定のときは最新を追う',
      },
    ]);
  });

  it('用途の応答が正しい形のとき要素ごとに 1 行の箇条書きにして返し、モデル・出力上限・Gateway ID を AI に渡すこと', async () => {
    const run = vi.fn().mockResolvedValue(
      chatCompletion({
        use_cases_ja: [
          'プロジェクト外のディレクトリを読ませたいときに使う。',
          // 指示に反して記号を付けてきても二重にしない
          '- モノレポの隣のパッケージを参照するときに使う。',
        ],
      }),
    );
    const sut = createSettingsUseCaseAi({ run }, 'project-gateway');

    const result = await sut.describeUseCase(entry);

    expect(result).toBe(
      '- プロジェクト外のディレクトリを読ませたいときに使う。\n- モノレポの隣のパッケージを参照するときに使う。',
    );
    expect(run).toHaveBeenCalledWith(
      '@cf/zai-org/glm-5.3-flash',
      expect.objectContaining({
        response_format: expect.objectContaining({ type: 'json_schema' }),
        max_completion_tokens: 2048,
        reasoning_effort: 'low',
      }),
      { gateway: { id: 'project-gateway' } },
    );
  });

  describe('AI 応答が使えない失敗', () => {
    it.each([
      ['出力上限で打ち切られた応答', chatCompletion('{"results":[{"id":0,', 'length')],
      ['JSON として読めない応答', chatCompletion('not-json')],
      ['形式が不正な応答', chatCompletion({ results: [{ id: 'invalid' }] })],
    ])('翻訳で%sのとき、諦めてよい失敗と判定すること', async (_, response) => {
      const sut = createSettingsTranslationAi(
        { run: vi.fn().mockResolvedValue(response) },
        'project-gateway',
      );

      const error = await sut.translate([entry]).catch((caught: unknown) => caught);

      expect(isUnusableSettingsAiResponseError(error)).toBe(true);
    });

    it('用途で形式が不正な応答のとき、諦めてよい失敗と判定すること', async () => {
      const sut = createSettingsUseCaseAi(
        { run: vi.fn().mockResolvedValue(chatCompletion({ use_cases_ja: 1 })) },
        'project-gateway',
      );

      const error = await sut.describeUseCase(entry).catch((caught: unknown) => caught);

      expect(isUnusableSettingsAiResponseError(error)).toBe(true);
    });

    it('AI の呼び出し自体が失敗したとき、諦めてよい失敗と判定しないこと', async () => {
      const sut = createSettingsTranslationAi(
        { run: vi.fn().mockRejectedValue(new Error('network error')) },
        'project-gateway',
      );

      const error = await sut.translate([entry]).catch((caught: unknown) => caught);

      expect(isUnusableSettingsAiResponseError(error)).toBe(false);
    });
  });
});
