import { describe, expect, test } from 'vitest';
import { getTopDocs } from '../scorers/context-scorer';
import type { SnippetResult } from '../types';

describe('getTopDocs', () => {
  describe('スニペットスコア計算', () => {
    test('基本スコアは 1', () => {
      const results: SnippetResult[] = [
        {
          file: 'docs/basic.md',
          snippets: ['plain text content'],
          hit_count: 1,
        },
      ];
      const docs = getTopDocs(results);

      // context_score = 1(基本スコアのみ)
      // total_score = hit_count(1) × context_score(1) = 1
      expect(docs[0].context_score).toBe(1);
      expect(docs[0].total_score).toBe(1);
    });

    test('見出しを含むスニペットは +5', () => {
      const results: SnippetResult[] = [
        {
          file: 'docs/heading.md',
          snippets: ['## Configuration\nSome config details'],
          hit_count: 1,
        },
      ];
      const docs = getTopDocs(results);

      // 基本(1) + 見出し(5) = 6
      expect(docs[0].context_score).toBe(6);
    });

    test('コードブロックを含むスニペットは +3', () => {
      const results: SnippetResult[] = [
        {
          file: 'docs/code.md',
          snippets: ['Install:\n```bash\nnpm install\n```'],
          hit_count: 1,
        },
      ];
      const docs = getTopDocs(results);

      // 基本(1) + コードブロック(3) = 4
      expect(docs[0].context_score).toBe(4);
    });

    test('解説キーワードを含むスニペットは +2', () => {
      const results: SnippetResult[] = [
        {
          file: 'docs/howto.md',
          snippets: ['how to configure the settings'],
          hit_count: 1,
        },
      ];
      const docs = getTopDocs(results);

      // 基本(1) + 解説(2) = 3
      expect(docs[0].context_score).toBe(3);
    });

    test('日本語の解説キーワード(説明/使い方)もマッチする', () => {
      const results: SnippetResult[] = [
        {
          file: 'docs/jp.md',
          snippets: ['設定の説明'],
          hit_count: 1,
        },
      ];
      const docs = getTopDocs(results);

      // 基本(1) + 解説(2) = 3
      expect(docs[0].context_score).toBe(3);
    });

    test('複数ボーナスが加算される', () => {
      const results: SnippetResult[] = [
        {
          file: 'docs/full.md',
          snippets: [
            '## Usage\nhere is an example:\n```js\nconsole.log("hello")\n```',
          ],
          hit_count: 1,
        },
      ];
      const docs = getTopDocs(results);

      // 基本(1) + 見出し(5) + コードブロック(3) + 解説(2) = 11
      expect(docs[0].context_score).toBe(11);
    });
  });

  describe('コンテキストスコア合算', () => {
    test('複数スニペットのスコアを合計する', () => {
      const results: SnippetResult[] = [
        {
          file: 'docs/multi.md',
          snippets: [
            'plain text', // 1
            '## Heading', // 1 + 5 = 6
            '```code```', // 1 + 3 = 4
          ],
          hit_count: 1,
        },
      ];
      const docs = getTopDocs(results);

      // 1 + 6 + 4 = 11
      expect(docs[0].context_score).toBe(11);
    });

    test('スニペットが空の場合、コンテキストスコアは 0', () => {
      const results: SnippetResult[] = [
        {
          file: 'docs/empty.md',
          snippets: [],
          hit_count: 5,
        },
      ];
      const docs = getTopDocs(results);

      expect(docs[0].context_score).toBe(0);
      expect(docs[0].total_score).toBe(0);
    });
  });

  describe('総合スコアとソート', () => {
    test('total_score = hit_count × context_score', () => {
      const results: SnippetResult[] = [
        {
          file: 'docs/test.md',
          snippets: ['plain text'], // context_score = 1
          hit_count: 10,
        },
      ];
      const docs = getTopDocs(results);

      expect(docs[0].total_score).toBe(10); // 10 × 1
    });

    test('上位 N 件を返す', () => {
      const results: SnippetResult[] = [
        { file: 'docs/a.md', snippets: ['text'], hit_count: 1 },
        { file: 'docs/b.md', snippets: ['text'], hit_count: 5 },
        { file: 'docs/c.md', snippets: ['text'], hit_count: 3 },
        { file: 'docs/d.md', snippets: ['text'], hit_count: 2 },
        { file: 'docs/e.md', snippets: ['text'], hit_count: 4 },
      ];
      const docs = getTopDocs(results, 3);

      expect(docs).toHaveLength(3);
      expect(docs[0].file).toBe('docs/b.md'); // hit_count: 5
      expect(docs[1].file).toBe('docs/e.md'); // hit_count: 4
      expect(docs[2].file).toBe('docs/c.md'); // hit_count: 3
    });

    test('デフォルトは上位 3 件', () => {
      const results: SnippetResult[] = [
        { file: 'docs/a.md', snippets: ['text'], hit_count: 1 },
        { file: 'docs/b.md', snippets: ['text'], hit_count: 2 },
        { file: 'docs/c.md', snippets: ['text'], hit_count: 3 },
        { file: 'docs/d.md', snippets: ['text'], hit_count: 4 },
      ];
      const docs = getTopDocs(results);

      expect(docs).toHaveLength(3);
    });

    test('結果が N 件未満の場合はすべて返す', () => {
      const results: SnippetResult[] = [
        { file: 'docs/a.md', snippets: ['text'], hit_count: 1 },
      ];
      const docs = getTopDocs(results, 3);

      expect(docs).toHaveLength(1);
    });

    test('空の入力は空配列を返す', () => {
      expect(getTopDocs([], 3)).toEqual([]);
    });
  });

  describe('出力形式', () => {
    test('RelatedDoc 形式で返す', () => {
      const results: SnippetResult[] = [
        {
          file: 'docs/test.md',
          snippets: ['example content'],
          hit_count: 5,
        },
      ];
      const docs = getTopDocs(results);

      // "example" は解説キーワードにもマッチするため +2 ボーナス
      expect(docs[0]).toEqual({
        file: 'docs/test.md',
        snippets: ['example content'],
        hit_count: 5,
        context_score: 3, // 基本(1) + 解説(2)
        total_score: 15, // 5 × 3
      });
    });
  });
});
