import * as path from 'node:path';
import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { searchDocs } from '../searchers/grep-executor';

const mockExecSync = mock();

mock.module('node:child_process', () => ({
  execSync: mockExecSync,
}));

// grep-executor.ts と同じパス構築
const PROJECT_ROOT = path.join(process.cwd(), '..', '..');
const DOCS_DIR = path.join(PROJECT_ROOT, 'apps', 'docs-tracker', 'docs', 'en');

function absPath(file: string): string {
  return path.join(DOCS_DIR, file);
}

function relPath(file: string): string {
  return path.relative(PROJECT_ROOT, absPath(file));
}

function grepOutput(...files: string[]): string {
  return files.map((f) => absPath(f)).join('\n');
}

function grepError(status = 1): Error {
  const error = new Error('grep: no matches') as Error & { status: number };
  error.status = status;
  return error;
}

beforeEach(() => {
  mockExecSync.mockReset();
});

describe('searchDocs', () => {
  describe('コマンド構築', () => {
    test('exactSearch は -l -F フラグと -- セパレータを使う', () => {
      mockExecSync.mockReturnValue(grepOutput('settings.md'));

      searchDocs({ original: ['CLAUDE_CODE'], normalized: ['CLAUDE', 'CODE'] });

      const firstCall = mockExecSync.mock.calls[0][0] as string;
      expect(firstCall).toContain('-l -F');
      expect(firstCall).toContain(' -- ');
    });

    test('exactSearch はキーワードをバッククォートで囲んで検索する', () => {
      mockExecSync.mockReturnValue(grepOutput('settings.md'));

      searchDocs({ original: ['foo_bar'], normalized: ['foo', 'bar'] });

      const firstCall = mockExecSync.mock.calls[0][0] as string;
      expect(firstCall).toContain("'`foo_bar`'");
    });

    test('normalizedSearch は -l -iE フラグで | 結合パターンを使う', () => {
      // exactSearch を空にしてフォールバック
      mockExecSync.mockImplementation((cmd: string) => {
        if ((cmd as string).includes('-l -F')) {
          throw grepError();
        }
        return grepOutput('settings.md');
      });

      searchDocs({
        original: ['foo'],
        normalized: ['CLAUDE', 'CODE'],
      });

      const normalizedCall = mockExecSync.mock.calls.find((c) =>
        (c[0] as string).includes('-l -iE'),
      );
      expect(normalizedCall).toBeDefined();
      expect(normalizedCall?.[0] as string).toContain("'CLAUDE|CODE'");
    });

    test('multiSearch は original と normalized を結合して検索する', () => {
      // exactSearch, normalizedSearch 両方空にしてフォールバック
      mockExecSync.mockImplementation((cmd: string) => {
        const cmdStr = cmd as string;
        // exactSearch, normalizedSearch は空
        if (cmdStr.includes('-l -F') || !cmdStr.includes('original_kw')) {
          throw grepError();
        }
        return grepOutput('settings.md');
      });

      searchDocs({
        original: ['original_kw'],
        normalized: ['norm1', 'norm2'],
      });

      // multiSearch のコマンドを確認
      const multiCall = mockExecSync.mock.calls.find(
        (c) =>
          (c[0] as string).includes('-l -iE') &&
          (c[0] as string).includes('original_kw'),
      );
      expect(multiCall).toBeDefined();
      expect(multiCall?.[0] as string).toContain("'original_kw|norm1|norm2'");
    });
  });

  describe('フォールバック戦略', () => {
    test('戦略1 でヒットした場合はそれを返す(戦略2 は呼ばれない)', () => {
      mockExecSync.mockReturnValue(grepOutput('settings.md'));

      const result = searchDocs({
        original: ['keyword'],
        normalized: ['keyword'],
      });

      expect(result.files).toEqual([relPath('settings.md')]);
      // exactSearch だけで解決するため、-iE は呼ばれない
      const iECalls = mockExecSync.mock.calls.filter((c) =>
        (c[0] as string).includes('-iE'),
      );
      expect(iECalls).toHaveLength(0);
    });

    test('戦略1 が 50件超の場合は戦略2 にフォールバックする', () => {
      const manyFiles = Array.from({ length: 51 }, (_, i) => `doc${i}.md`);

      mockExecSync.mockImplementation((cmd: string) => {
        if ((cmd as string).includes('-l -F')) {
          return grepOutput(...manyFiles);
        }
        return grepOutput('best-match.md');
      });

      const result = searchDocs({
        original: ['common_word'],
        normalized: ['common', 'word'],
      });

      expect(result.files).toEqual([relPath('best-match.md')]);
    });

    test('戦略1, 2 ともに空の場合は戦略3 にフォールバックする', () => {
      let callCount = 0;
      mockExecSync.mockImplementation((_cmd: string) => {
        callCount++;
        // 3回目(multiSearch)のみ結果を返す
        if (callCount >= 3) {
          return grepOutput('fallback.md');
        }
        throw grepError();
      });

      const result = searchDocs({
        original: ['rare_term'],
        normalized: ['rare', 'term'],
      });

      expect(result.files).toEqual([relPath('fallback.md')]);
    });

    test('全戦略でヒットなしの場合は空配列を返す', () => {
      mockExecSync.mockImplementation((_cmd: string) => {
        throw grepError();
      });

      const result = searchDocs({
        original: ['nonexistent'],
        normalized: ['nonexistent'],
      });

      expect(result.files).toEqual([]);
    });

    test('original が空の場合は exactSearch をスキップして戦略2 に進む', () => {
      mockExecSync.mockReturnValue(grepOutput('result.md'));

      const result = searchDocs({
        original: [],
        normalized: ['keyword'],
      });

      expect(result.files).toEqual([relPath('result.md')]);
      // -l -F (exactSearch) は呼ばれない
      const fixedCalls = mockExecSync.mock.calls.filter((c) =>
        (c[0] as string).includes('-l -F'),
      );
      expect(fixedCalls).toHaveLength(0);
    });

    test('normalized が空の場合は normalizedSearch をスキップする', () => {
      // exactSearch も空、normalizedSearch もスキップ → multiSearch
      mockExecSync.mockImplementation((cmd: string) => {
        if ((cmd as string).includes('-l -F')) {
          throw grepError();
        }
        // multiSearch には original のキーワードが含まれる
        if ((cmd as string).includes('keyword')) {
          return grepOutput('result.md');
        }
        throw grepError();
      });

      const result = searchDocs({
        original: ['keyword'],
        normalized: [],
      });

      expect(result.files).toEqual([relPath('result.md')]);
    });

    test('全キーワードが空の場合は即座に空配列を返す', () => {
      const result = searchDocs({ original: [], normalized: [] });

      expect(result.files).toEqual([]);
      expect(mockExecSync).not.toHaveBeenCalled();
    });
  });

  describe('結果のフィルタリング', () => {
    test('changelog.md は結果から除外される', () => {
      mockExecSync.mockReturnValue(
        grepOutput('settings.md', 'changelog.md', 'hooks.md'),
      );

      const result = searchDocs({
        original: ['keyword'],
        normalized: ['keyword'],
      });

      expect(result.files).not.toContain(
        expect.stringContaining('changelog.md'),
      );
      expect(result.files).toHaveLength(2);
    });

    test('重複ファイルは exactSearch で排除される', () => {
      // 2つの original キーワードが同じファイルにヒット
      mockExecSync.mockReturnValue(grepOutput('settings.md'));

      const result = searchDocs({
        original: ['key1', 'key2'],
        normalized: ['key1', 'key2'],
      });

      expect(result.files).toEqual([relPath('settings.md')]);
    });
  });

  describe('シングルクォートのエスケープ', () => {
    test('キーワードにシングルクォートが含まれる場合にエスケープされる', () => {
      mockExecSync.mockReturnValue(grepOutput('settings.md'));

      searchDocs({ original: ["it's"], normalized: ['its'] });

      const cmd = mockExecSync.mock.calls[0][0] as string;
      // 'it'\''s' という形式でエスケープされる
      expect(cmd).toContain("'`it'\\''s`'");
    });
  });

  describe('ハイフンで始まるパターン(v2.1.51 バグ)', () => {
    test('`-l` のようなフラグ風パターンが -- セパレータで保護される', () => {
      mockExecSync.mockReturnValue(grepOutput('bash-tool.md'));

      searchDocs({ original: ['-l'], normalized: ['l'] });

      const cmd = mockExecSync.mock.calls[0][0] as string;
      // -- がパターンの前にあることを確認
      expect(cmd).toMatch(/-- +'.*-l.*'/);
    });

    test('`--help` のようなロングオプション風パターンも安全に検索される', () => {
      mockExecSync.mockReturnValue(grepOutput('cli.md'));

      searchDocs({ original: ['--help'], normalized: ['help'] });

      const cmd = mockExecSync.mock.calls[0][0] as string;
      expect(cmd).toContain(' -- ');
      expect(cmd).toContain('--help');
    });

    test('`-E` (grepフラグと同名) パターンも安全に検索される', () => {
      mockExecSync.mockReturnValue(grepOutput('regex.md'));

      searchDocs({ original: ['-E'], normalized: [] });

      const cmd = mockExecSync.mock.calls[0][0] as string;
      expect(cmd).toContain(' -- ');
    });
  });

  describe('正規表現メタ文字を含むキーワード', () => {
    test('exactSearch (-F) では正規表現メタ文字はリテラルとして扱われる', () => {
      mockExecSync.mockReturnValue(grepOutput('api.md'));

      searchDocs({ original: ['fn()'], normalized: ['fn'] });

      const cmd = mockExecSync.mock.calls[0][0] as string;
      // -F (fixed string) なのでメタ文字は問題ない
      expect(cmd).toContain('-l -F');
      expect(cmd).toContain('fn()');
    });

    test('multiSearch (-iE) に original キーワードが渡された場合、正規表現として解釈される(既知の制限)', () => {
      // exactSearch, normalizedSearch を空にしてフォールバック
      mockExecSync.mockImplementation((cmd: string) => {
        const cmdStr = cmd as string;
        if (cmdStr.includes('-l -F')) {
          throw grepError();
        }
        if (cmdStr.includes('-l -iE') && !cmdStr.includes('fn()')) {
          throw grepError();
        }
        // multiSearch: fn() を含むパターンで -iE
        // fn() は正規表現として解釈され「fn の後に空文字列の0回以上繰り返し」になる
        return grepOutput('api.md');
      });

      searchDocs({ original: ['fn()'], normalized: ['fn'] });

      // multiSearch のコマンドを確認
      const multiCall = mockExecSync.mock.calls.find(
        (c) =>
          (c[0] as string).includes('-l -iE') &&
          (c[0] as string).includes('fn()'),
      );
      expect(multiCall).toBeDefined();
      // fn() は正規表現エスケープされていない(既知の制限)
      expect(multiCall?.[0] as string).toContain("'fn()|fn'");
    });

    test('パイプ | を含む original キーワードは multiSearch で意図しない分割を起こす(既知の制限)', () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if ((cmd as string).includes('-l -F')) {
          throw grepError();
        }
        return grepOutput('result.md');
      });

      searchDocs({
        original: ['stdin|stdout'],
        normalized: ['stdin', 'stdout'],
      });

      // normalizedSearch のコマンドを確認
      const iECall = mockExecSync.mock.calls.find((c) =>
        (c[0] as string).includes('-l -iE'),
      );
      expect(iECall).toBeDefined();
      // "stdin|stdout" がパターンに含まれる場合、
      // `|` が正規表現のOR演算子として解釈される
      // normalized に分解されているので normalizedSearch で stdin|stdout がパターンに入る
    });
  });

  describe('grep エラーハンドリング', () => {
    test('exit code 1(マッチなし)は空配列として処理される', () => {
      mockExecSync.mockImplementation((_cmd: string) => {
        throw grepError(1);
      });

      const result = searchDocs({
        original: ['nonexistent'],
        normalized: ['nonexistent'],
      });

      expect(result.files).toEqual([]);
    });

    test('exit code 2(エラー)は例外として再スローされる', () => {
      mockExecSync.mockImplementation((_cmd: string) => {
        throw grepError(2);
      });

      expect(() =>
        searchDocs({ original: ['keyword'], normalized: ['keyword'] }),
      ).toThrow();
    });
  });
});
