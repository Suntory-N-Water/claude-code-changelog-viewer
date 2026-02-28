import { beforeEach, describe, expect, mock, test } from 'bun:test';
import * as path from 'node:path';
import { extractSnippets } from '../searchers/snippet-extractor';

const mockExecSync = mock();

mock.module('node:child_process', () => ({
  execSync: mockExecSync,
}));

const PROJECT_ROOT = path.join(process.cwd(), '..', '..');

function grepError(status = 1): Error {
  const error = new Error('grep: no matches') as Error & { status: number };
  error.status = status;
  return error;
}

beforeEach(() => {
  mockExecSync.mockReset();
});

describe('extractSnippets', () => {
  describe('コマンド構築と正規表現エスケープ', () => {
    test('キーワードの正規表現メタ文字がエスケープされる', () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if ((cmd as string).includes('-c')) {
          return '3';
        }
        return 'snippet content';
      });

      extractSnippets(['docs/test.md'], {
        original: ['fn()'],
        normalized: ['fn'],
      });

      // countMatches のコマンドを確認
      const countCmd = mockExecSync.mock.calls.find((c) =>
        (c[0] as string).includes('-c'),
      )?.[0] as string;
      // () がエスケープされて \(\) になる
      expect(countCmd).toContain('fn\\(\\)');

      // extractSnippetsFromFile のコマンドも確認
      const snippetCmd = mockExecSync.mock.calls.find(
        (c) =>
          (c[0] as string).includes('-B 3') &&
          (c[0] as string).includes('-A 3'),
      )?.[0] as string;
      expect(snippetCmd).toContain('fn\\(\\)');
    });

    test('ドット . がエスケープされる(任意文字マッチを防ぐ)', () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if ((cmd as string).includes('-c')) {
          return '1';
        }
        return 'snippet';
      });

      extractSnippets(['docs/test.md'], {
        original: ['config.json'],
        normalized: ['config', 'json'],
      });

      const countCmd = mockExecSync.mock.calls.find((c) =>
        (c[0] as string).includes('-c'),
      )?.[0] as string;
      expect(countCmd).toContain('config\\.json');
    });

    test('角括弧 [] がエスケープされる', () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if ((cmd as string).includes('-c')) {
          return '1';
        }
        return 'snippet';
      });

      extractSnippets(['docs/test.md'], {
        original: ['$ARGS[0]'],
        normalized: ['ARGS', '0'],
      });

      const countCmd = mockExecSync.mock.calls.find((c) =>
        (c[0] as string).includes('-c'),
      )?.[0] as string;
      expect(countCmd).toContain('\\$ARGS\\[0\\]');
    });

    test('パイプ | がエスケープされる(OR演算子の意図しない解釈を防ぐ)', () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if ((cmd as string).includes('-c')) {
          return '1';
        }
        return 'snippet';
      });

      extractSnippets(['docs/test.md'], {
        original: ['stdin|stdout'],
        normalized: ['stdin', 'stdout'],
      });

      const countCmd = mockExecSync.mock.calls.find((c) =>
        (c[0] as string).includes('-c'),
      )?.[0] as string;
      // | がエスケープされて \| になる
      expect(countCmd).toContain('stdin\\|stdout');
    });

    test('アスタリスク * がエスケープされる', () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if ((cmd as string).includes('-c')) {
          return '1';
        }
        return 'snippet';
      });

      extractSnippets(['docs/test.md'], {
        original: ['*.md'],
        normalized: ['md'],
      });

      const countCmd = mockExecSync.mock.calls.find((c) =>
        (c[0] as string).includes('-c'),
      )?.[0] as string;
      expect(countCmd).toContain('\\*\\.md');
    });

    test('バックスラッシュ \\ がエスケープされる', () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if ((cmd as string).includes('-c')) {
          return '1';
        }
        return 'snippet';
      });

      extractSnippets(['docs/test.md'], {
        original: ['path\\to'],
        normalized: ['path', 'to'],
      });

      const countCmd = mockExecSync.mock.calls.find((c) =>
        (c[0] as string).includes('-c'),
      )?.[0] as string;
      // \ が \\\\ にエスケープされる
      expect(countCmd).toContain('path\\\\to');
    });

    test('プラス + とクエスチョン ? がエスケープされる', () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if ((cmd as string).includes('-c')) {
          return '1';
        }
        return 'snippet';
      });

      extractSnippets(['docs/test.md'], {
        original: ['a+b?c'],
        normalized: ['a', 'b', 'c'],
      });

      const countCmd = mockExecSync.mock.calls.find((c) =>
        (c[0] as string).includes('-c'),
      )?.[0] as string;
      expect(countCmd).toContain('a\\+b\\?c');
    });

    test('キャレット ^ とドル $ がエスケープされる', () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if ((cmd as string).includes('-c')) {
          return '1';
        }
        return 'snippet';
      });

      extractSnippets(['docs/test.md'], {
        original: ['$HOME'],
        normalized: ['HOME'],
      });

      const countCmd = mockExecSync.mock.calls.find((c) =>
        (c[0] as string).includes('-c'),
      )?.[0] as string;
      expect(countCmd).toContain('\\$HOME');
    });

    test('シングルクォートを含むキーワードがシェルエスケープされる', () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if ((cmd as string).includes('-c')) {
          return '1';
        }
        return 'snippet';
      });

      extractSnippets(['docs/test.md'], {
        original: ["it's"],
        normalized: ['its'],
      });

      const countCmd = mockExecSync.mock.calls.find((c) =>
        (c[0] as string).includes('-c'),
      )?.[0] as string;
      // シングルクォートのシェルエスケープ: ' → '\''
      expect(countCmd).toContain("it'\\''s");
    });
  });

  describe('スニペット抽出', () => {
    test('-- 区切りでスニペットを分割する', () => {
      // 1回目: countMatches → "5"、2回目: extractSnippetsFromFile → スニペット
      mockExecSync
        .mockReturnValueOnce('5' as never)
        .mockReturnValueOnce(
          'snippet 1\n--\nsnippet 2\n--\nsnippet 3' as never,
        );

      const results = extractSnippets(['docs/test.md'], {
        original: ['keyword'],
        normalized: ['keyword'],
      });

      expect(results[0].snippets).toHaveLength(3);
      expect(results[0].snippets[0]).toBe('snippet 1');
      expect(results[0].snippets[1]).toBe('snippet 2');
      expect(results[0].snippets[2]).toBe('snippet 3');
    });

    test('スニペットは最大 5 件に制限される', () => {
      const manySnippets = Array.from(
        { length: 8 },
        (_, i) => `snippet ${i}`,
      ).join('\n--\n');

      // 1回目: countMatches → "20"、2回目: extractSnippetsFromFile → スニペット
      mockExecSync
        .mockReturnValueOnce('20' as never)
        .mockReturnValueOnce(manySnippets as never);

      const results = extractSnippets(['docs/test.md'], {
        original: ['common'],
        normalized: ['common'],
      });

      expect(results[0].snippets).toHaveLength(5);
    });

    test('hit_count を数値として返す', () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if ((cmd as string).includes('-c')) {
          return '42\n';
        }
        return 'snippet';
      });

      const results = extractSnippets(['docs/test.md'], {
        original: ['keyword'],
        normalized: ['keyword'],
      });

      expect(results[0].hit_count).toBe(42);
    });

    test('複数ファイルをそれぞれ処理する', () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if ((cmd as string).includes('-c')) {
          return '1';
        }
        return 'snippet';
      });

      const results = extractSnippets(['docs/a.md', 'docs/b.md', 'docs/c.md'], {
        original: ['keyword'],
        normalized: ['keyword'],
      });

      expect(results).toHaveLength(3);
      expect(results[0].file).toBe('docs/a.md');
      expect(results[1].file).toBe('docs/b.md');
      expect(results[2].file).toBe('docs/c.md');
    });
  });

  describe('エッジケース', () => {
    test('空のファイルリストは空配列を返す', () => {
      const results = extractSnippets([], {
        original: ['keyword'],
        normalized: ['keyword'],
      });

      expect(results).toEqual([]);
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    test('キーワードが空の場合は hit_count: 0 と空 snippets を返す', () => {
      const results = extractSnippets(['docs/test.md'], {
        original: [],
        normalized: [],
      });

      expect(results[0].hit_count).toBe(0);
      expect(results[0].snippets).toEqual([]);
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    test('grep がマッチなし (exit code 1) の場合は 0 件として扱う', () => {
      mockExecSync.mockImplementation((_cmd: string) => {
        throw grepError(1);
      });

      const results = extractSnippets(['docs/test.md'], {
        original: ['nonexistent'],
        normalized: ['nonexistent'],
      });

      expect(results[0].hit_count).toBe(0);
      expect(results[0].snippets).toEqual([]);
    });

    test('grep がエラー (exit code 2) の場合は例外を再スローする', () => {
      mockExecSync.mockImplementation((_cmd: string) => {
        throw grepError(2);
      });

      expect(() =>
        extractSnippets(['docs/test.md'], {
          original: ['keyword'],
          normalized: ['keyword'],
        }),
      ).toThrow();
    });

    test('ハイフンで始まるキーワード `-l` がエスケープされて検索される', () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if ((cmd as string).includes('-c')) {
          return '1';
        }
        return 'BashTool skips `-l` flag';
      });

      const results = extractSnippets(['docs/test.md'], {
        original: ['-l'],
        normalized: ['l'],
      });

      expect(results[0].hit_count).toBe(1);

      // snippet-extractor は escapeRegex でエスケープするが、
      // `-` は正規表現メタ文字ではないのでそのまま
      // ただしシェルコマンド内で問題ないことを確認
      const countCmd = mockExecSync.mock.calls.find((c) =>
        (c[0] as string).includes('-c'),
      )?.[0] as string;
      expect(countCmd).toContain('-l');
    });

    test('hit_count が非数値の場合は 0 を返す', () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if ((cmd as string).includes('-c')) {
          return 'not-a-number\n';
        }
        return 'snippet';
      });

      const results = extractSnippets(['docs/test.md'], {
        original: ['keyword'],
        normalized: ['keyword'],
      });

      expect(results[0].hit_count).toBe(0);
    });
  });

  describe('ファイルパス構築', () => {
    test('相対パスが絶対パスに変換されてコマンドに渡される', () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if ((cmd as string).includes('-c')) {
          return '1';
        }
        return 'snippet';
      });

      const relativePath = 'apps/docs-tracker/docs/en/settings.md';
      extractSnippets([relativePath], {
        original: ['keyword'],
        normalized: ['keyword'],
      });

      const countCmd = mockExecSync.mock.calls.find((c) =>
        (c[0] as string).includes('-c'),
      )?.[0] as string;
      const expectedAbsPath = path.join(PROJECT_ROOT, relativePath);
      expect(countCmd).toContain(`"${expectedAbsPath}"`);
    });
  });
});
