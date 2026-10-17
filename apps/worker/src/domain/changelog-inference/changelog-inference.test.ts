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
  it('関連ドキュメントの有無が異なるとき、変更後と機能領域タグを項目ごとにまとめること', () => {
    const result = mergeChangelogItemInferences(items, {
      inferredItems: [{ id: 'with-docs', benefit }],
      featureAreaCorrections: [{ id: 'with-docs', featureAreas: ['Settings', 'Settings'] }],
    });

    expect(result).toEqual([
      { id: 'with-docs', featureAreas: ['Settings'], benefit },
      { id: 'without-docs', featureAreas: [] },
    ]);
  });

  it('Fixed の項目のとき、関連ドキュメントがあっても変更後を作らず機能領域タグだけを残すこと', () => {
    const fixedItem = {
      id: 'fixed-with-docs',
      content: '- Fixed a crash in the documented feature',
      prefix: 'Fixed',
      relatedDocs: [{ file: 'features.md', snippets: ['The feature automates the setup.'] }],
    };

    const result = mergeChangelogItemInferences([fixedItem], {
      inferredItems: [],
      featureAreaCorrections: [{ id: 'fixed-with-docs', featureAreas: ['Settings'] }],
    });

    expect(result).toEqual([{ id: 'fixed-with-docs', featureAreas: ['Settings'] }]);
  });

  it('変更後を求めていない項目の変更後が AI 結果に含まれているとき、その変更後を捨てて機能領域タグを残すこと', () => {
    const fixedItem = {
      id: 'fixed-with-docs',
      content: '- Fixed a crash in the documented feature',
      prefix: 'Fixed',
      relatedDocs: [{ file: 'features.md', snippets: ['The feature automates the setup.'] }],
    };

    const result = mergeChangelogItemInferences([fixedItem], {
      inferredItems: [{ id: 'fixed-with-docs', benefit }],
      featureAreaCorrections: [{ id: 'fixed-with-docs', featureAreas: ['Settings'] }],
    });

    expect(result).toEqual([{ id: 'fixed-with-docs', featureAreas: ['Settings'] }]);
  });

  it('機能領域タグが候補と大文字小文字違いや候補外のとき、候補の表記に揃えて候補外を捨てること', () => {
    const result = mergeChangelogItemInferences(items, {
      inferredItems: [{ id: 'with-docs', benefit }],
      featureAreaCorrections: [
        { id: 'with-docs', featureAreas: ['Ide', 'IDE', 'settings', 'UI'] },
        { id: 'without-docs', featureAreas: ['設定'] },
      ],
    });

    expect(result.map((item) => item.featureAreas)).toEqual([['IDE', 'Settings'], []]);
  });

  it('推論対象の項目が不足しているとき、AI 結果を受け付けないこと', () => {
    expect(() =>
      mergeChangelogItemInferences(items, {
        inferredItems: [],
        featureAreaCorrections: [],
      }),
    ).toThrow('AI 結果の項目 id が入力と一致しません (推論)');
  });

  it('バッチに含まれない項目に対する機能領域タグがあるとき、AI 結果を受け付けないこと', () => {
    expect(() =>
      mergeChangelogItemInferences(items, {
        inferredItems: [{ id: 'with-docs', benefit }],
        featureAreaCorrections: [{ id: 'unknown', featureAreas: ['Settings'] }],
      }),
    ).toThrow('AI 推論結果に未知の item id があります: unknown');
  });

  it('翻訳結果から入力の項目が欠けているとき、AI 結果を受け付けないこと', () => {
    expect(() =>
      verifyChangelogTranslations(items, [
        { id: 'with-docs', contentJa: '文書化された機能を追加した。' },
      ]),
    ).toThrow('AI 結果の項目 id が入力と一致しません (翻訳)');
  });
});
