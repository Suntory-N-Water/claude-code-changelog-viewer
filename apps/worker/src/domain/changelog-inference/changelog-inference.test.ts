import { describe, expect, it } from 'vitest';
import { mergeChangelogInference } from './changelog-inference';

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
};

describe('CHANGELOG 推論の整合性', () => {
  it('関連ドキュメントの有無が異なる時、AI 結果を CHANGELOG 項目へ統合すること', () => {
    const result = mergeChangelogInference(input, {
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
      featureAreaCorrections: [
        { id: 'with-docs', featureAreas: ['Settings', 'Settings'] },
      ],
      summary: '文書化された機能が追加され、誤字が修正されました。',
    });

    expect(result).toEqual({
      version: 'v2.1.234',
      summary: '文書化された機能が追加され、誤字が修正されました。',
      items: [
        {
          id: 'with-docs',
          content: '- Added a documented feature',
          contentJa: '文書化された機能を追加しました。',
          prefix: 'Added',
          featureAreas: ['Settings'],
          relatedDocs: [
            {
              file: 'features.md',
              snippets: ['The feature automates the repeated setup.'],
            },
          ],
          inference: {
            before: '繰り返しの設定を手動で行う必要がありました。',
            after: '設定を自動化する機能が追加されました。',
            benefit: '繰り返しの設定作業を毎回行わずに済みます。',
          },
        },
        {
          id: 'without-docs',
          content: '- Fixed a small typo',
          contentJa: '小さな誤字を修正しました。',
          prefix: 'Fixed',
          featureAreas: [],
          relatedDocs: [],
        },
      ],
    });
  });

  it('推論対象の項目が不足している時、AI 結果を受け付けないこと', () => {
    expect(() =>
      mergeChangelogInference(input, {
        inferredItems: [],
        translatedItems: [
          { id: 'without-docs', contentJa: '小さな誤字を修正しました。' },
        ],
        featureAreaCorrections: [],
        summary: '要約',
      }),
    ).toThrow('AI 推論結果の推論項目数が一致しません');
  });

  it('未知の項目に対する機能領域タグがある時、AI 結果を受け付けないこと', () => {
    expect(() =>
      mergeChangelogInference(input, {
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
        featureAreaCorrections: [{ id: 'unknown', featureAreas: ['Settings'] }],
        summary: '要約',
      }),
    ).toThrow('AI 推論結果に未知の item id があります: unknown');
  });
});
