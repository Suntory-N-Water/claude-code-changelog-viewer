import { describe, expect, test } from 'vitest';
import { buildModelContext, parseModelNames } from '../ai/model-context';

// platform.claude.com/docs/en/about-claude/models/overview.md の構造を再現
const MODELS_OVERVIEW = `### Latest models comparison

| Feature | <NextOpus /> | Claude Sonnet 4.6 | Claude Haiku 4.5 |
|:--------|:-------------|:------------------|:-----------------|
| **Description** | Most capable model | Best speed/intelligence | Fastest model |
| **Claude API ID** | <NextOpusId /> | claude-sonnet-4-6 | claude-haiku-4-5-20251001 |

## Migrating to <NextOpus /> {#migrating-to-claude-opus-4-8}

If you're currently using Claude Opus 4.7 or earlier, see the migration guide.`;

describe('parseModelNames', () => {
  test('実際のテーブル形式からモデル名を抽出する', () => {
    const result = parseModelNames(MODELS_OVERVIEW);

    expect(result).toEqual(['Opus 4.8', 'Sonnet 4.6', 'Haiku 4.5']);
  });

  test('Opusアンカーがない場合はSonnet/Haikuのみ返す', () => {
    const content = `### Latest models comparison

| Feature | Claude Sonnet 4.6 | Claude Haiku 4.5 |
|:--------|:------------------|:-----------------|
| **Description** | Best speed | Fastest |
`;
    const result = parseModelNames(content);

    expect(result).toEqual(['Sonnet 4.6', 'Haiku 4.5']);
  });

  test('Latest models comparison セクションがない場合は空配列を返す', () => {
    const content = `## Other section

| Feature | Claude Sonnet 4.6 |
|:--------|:------------------|
`;
    const result = parseModelNames(content);

    expect(result).toEqual([]);
  });

  test('Opusアンカーのみある場合はOpusのみ返す', () => {
    const content = `### Latest models comparison

| Feature | <NextOpus /> |
|:--------|:-------------|
| **Description** | Most capable |

## Migrating to <NextOpus /> {#migrating-to-claude-opus-4-8}
`;
    const result = parseModelNames(content);

    expect(result).toEqual(['Opus 4.8']);
  });

  test('将来モデル名が変わっても正しく抽出できる', () => {
    const content = `### Latest models comparison

| Feature | <NextOpus /> | Claude Sonnet 5.0 | Claude Haiku 5.0 |
|:--------|:-------------|:------------------|:-----------------|
| **Description** | Most capable | Best speed | Fastest |

## Migrating to <NextOpus /> {#migrating-to-claude-opus-5-0}
`;
    const result = parseModelNames(content);

    expect(result).toEqual(['Opus 5.0', 'Sonnet 5.0', 'Haiku 5.0']);
  });

  test('重複するモデル名は1つにまとめる', () => {
    const content = `### Latest models comparison

| Feature | Claude Sonnet 4.6 | Claude Sonnet 4.6 |
|:--------|:------------------|:-----------------|
`;
    const result = parseModelNames(content);

    expect(result).toEqual(['Sonnet 4.6']);
  });
});

describe('buildModelContext', () => {
  const ANTI_HALLUCINATION =
    'CHANGELOG の原文や snippets に記載されていないモデル名・バージョン番号・スペック値を捏造しないこと';

  test('モデル名を取得できた場合、参考情報として含む', () => {
    const result = buildModelContext(['Opus 4.8', 'Sonnet 4.6', 'Haiku 4.5']);

    expect(result).toContain('Opus 4.8');
    expect(result).toContain('Sonnet 4.6');
    expect(result).toContain('Haiku 4.5');
    expect(result).toContain('参考');
    expect(result).toContain(ANTI_HALLUCINATION);
  });

  test('モデル名が空の場合でもハルシネーション防止の制約は含まれる', () => {
    const result = buildModelContext([]);

    expect(result).toContain(ANTI_HALLUCINATION);
    expect(result).not.toContain('参考');
  });
});
