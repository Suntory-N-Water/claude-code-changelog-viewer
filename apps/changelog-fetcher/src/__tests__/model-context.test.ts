import { describe, expect, test } from 'bun:test';
import { buildModelContext, parseModelNames } from '../ai/model-context';

// 実際の model-config.md のエイリアステーブル部分を再現したテストデータ
const MODEL_CONFIG_TABLE = `### Model aliases

Model aliases provide a convenient way to select model settings without
remembering exact version numbers:

| Model alias      | Behavior                                                                                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **\`default\`**    | Recommended model setting, depending on your account type                                                                                                            |
| **\`sonnet\`**     | Uses the latest Sonnet model (currently Sonnet 4.6) for daily coding tasks                                                                                           |
| **\`opus\`**       | Uses the latest Opus model (currently Opus 4.6) for complex reasoning tasks                                                                                          |
| **\`haiku\`**      | Uses the fast and efficient Haiku model for simple tasks                                                                                                             |
| **\`sonnet[1m]\`** | Uses Sonnet with a [1 million token context window](https://platform.claude.com/docs/en/build-with-claude/context-windows#1m-token-context-window) for long sessions |
| **\`opusplan\`**   | Special mode that uses \`opus\` during plan mode, then switches to \`sonnet\` for execution                                                                              |

Aliases always point to the latest version.`;

describe('parseModelNames', () => {
  test('実際のテーブル形式からモデル名を抽出する', () => {
    const result = parseModelNames(MODEL_CONFIG_TABLE);

    expect(result).toEqual(['Sonnet 4.6', 'Opus 4.6']);
  });

  test('重複するモデル名は1つにまとめる', () => {
    const content = `
| **\`sonnet\`** | Uses (currently Sonnet 4.6) for tasks |
| **\`sonnet[1m]\`** | Uses (currently Sonnet 4.6) with 1M context |
`;
    const result = parseModelNames(content);

    expect(result).toEqual(['Sonnet 4.6']);
  });

  test('(currently ...) パターンがない場合は空配列を返す', () => {
    const content = `
| **\`default\`** | Recommended model setting |
| **\`haiku\`** | Uses the fast Haiku model |
`;
    const result = parseModelNames(content);

    expect(result).toEqual([]);
  });

  test('閉じ括弧がない壊れた形式の場合は空配列を返す', () => {
    const content = `
| **\`sonnet\`** | Uses the latest Sonnet model (currently Sonnet 4.6 for tasks |
`;
    const result = parseModelNames(content);

    expect(result).toEqual([]);
  });

  test('将来モデル名が変わっても正しく抽出できる', () => {
    const content = `
| **\`sonnet\`** | Uses the latest Sonnet model (currently Sonnet 5.0) for tasks |
| **\`opus\`** | Uses the latest Opus model (currently Opus 5.0) for tasks |
`;
    const result = parseModelNames(content);

    expect(result).toEqual(['Sonnet 5.0', 'Opus 5.0']);
  });

  test('大文字小文字だけが異なるモデル名は別要素として保持する', () => {
    const content = `
| **\`sonnet\`** | Uses the latest Sonnet model (currently Sonnet 4.6) for tasks |
| **\`sonnet-alt\`** | Uses the latest Sonnet model (currently sonnet 4.6) for tasks |
`;
    const result = parseModelNames(content);

    expect(result).toEqual(['Sonnet 4.6', 'sonnet 4.6']);
  });
});

describe('buildModelContext', () => {
  const ANTI_HALLUCINATION =
    'CHANGELOG の原文や snippets に記載されていないモデル名・バージョン番号・スペック値を捏造しないこと';

  test('モデル名を取得できた場合、参考情報として含む', () => {
    const result = buildModelContext(['Sonnet 4.6', 'Opus 4.6']);

    expect(result).toContain('Sonnet 4.6');
    expect(result).toContain('Opus 4.6');
    expect(result).toContain('参考');
    expect(result).toContain(ANTI_HALLUCINATION);
  });

  test('モデル名が空の場合でもハルシネーション防止の制約は含まれる', () => {
    const result = buildModelContext([]);

    expect(result).toContain(ANTI_HALLUCINATION);
    expect(result).not.toContain('参考');
  });
});
