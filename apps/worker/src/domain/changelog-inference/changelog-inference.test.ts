import { describe, expect, it } from 'vitest';
import { mergeChangelogItemInferences, verifyChangelogTranslations } from './changelog-inference';

const items = [
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
    content: '- Added a small option',
    prefix: 'Added',
    relatedDocs: [],
  },
];

const benefit = '繰り返しの設定作業を毎回行わずに済む。';

describe('CHANGELOG 推論の整合性', () => {
  it('関連ドキュメントがある項目とない項目が同じバッチにあるとき、関連ドキュメントがある項目だけに変更後が付くこと', () => {
    const result = mergeChangelogItemInferences(items, {
      inferredItems: [{ id: 'with-docs', benefit }],
    });

    expect(result).toEqual([{ id: 'with-docs', benefit }, { id: 'without-docs' }]);
  });

  it('変更後を求めていない項目の変更後を AI が返したとき、その変更後を採用しないこと', () => {
    const fixedItem = {
      id: 'fixed-with-docs',
      content: '- Fixed a crash in the documented feature',
      prefix: 'Fixed',
      relatedDocs: [{ file: 'features.md', snippets: ['The feature automates the setup.'] }],
    };

    const result = mergeChangelogItemInferences([fixedItem], {
      inferredItems: [{ id: 'fixed-with-docs', benefit }],
    });

    expect(result).toEqual([{ id: 'fixed-with-docs' }]);
  });

  it('推論対象の項目が不足しているとき、AI 結果を受け付けないこと', () => {
    expect(() => mergeChangelogItemInferences(items, { inferredItems: [] })).toThrow(
      'AI 結果の項目 id が入力と一致しません (推論)',
    );
  });

  it('バッチにない項目の変更後を AI が返したとき、推論結果全体を採用しないこと', () => {
    expect(() =>
      mergeChangelogItemInferences(items, {
        inferredItems: [
          { id: 'with-docs', benefit },
          { id: 'unknown', benefit },
        ],
      }),
    ).toThrow('AI 結果の項目 id が入力と一致しません (推論)');
  });

  it('翻訳結果から入力の項目が欠けているとき、AI 結果を受け付けないこと', () => {
    expect(() =>
      verifyChangelogTranslations(items, [
        { id: 'with-docs', contentJa: '文書化された機能を追加した。' },
      ]),
    ).toThrow('AI 結果の項目 id が入力と一致しません (翻訳)');
  });
});
