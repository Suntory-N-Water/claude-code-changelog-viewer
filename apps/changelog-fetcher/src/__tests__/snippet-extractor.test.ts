import { afterAll, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { extractSnippets } from '../searchers/snippet-extractor';

// snippet-extractor 内の PROJECT_ROOT と同じ計算
const PROJECT_ROOT = path.join(process.cwd(), '..', '..');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snippet-test-'));

/**
 * テスト用ファイルを作成し、extractSnippets に渡せる相対パスを返す
 */
async function writeTestFile(name: string, content: string): Promise<string> {
  await Bun.write(path.join(tmpDir, name), content);
  return path.relative(PROJECT_ROOT, path.join(tmpDir, name));
}

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('extractSnippets', () => {
  describe('スニペット抽出', () => {
    test('マッチ行の前後3行を含むスニペットを返す', async () => {
      const lines = [
        'line 0',
        'line 1',
        'line 2',
        'line 3',
        'keyword match',
        'line 5',
        'line 6',
        'line 7',
        'line 8',
      ];
      const rel = await writeTestFile('context.md', lines.join('\n'));

      const results = await extractSnippets([rel], {
        original: ['keyword'],
        normalized: ['keyword'],
      });

      const snippet = results[0].snippets[0];
      expect(snippet).toContain('line 1');
      expect(snippet).toContain('keyword match');
      expect(snippet).toContain('line 7');
      expect(snippet).not.toContain('line 0');
    });

    test('近接するマッチは1つのスニペットにマージされる', async () => {
      const lines = [
        'line 0',
        'keyword match 1',
        'line 2',
        'line 3',
        'keyword match 2',
        'line 5',
      ];
      const rel = await writeTestFile('merge.md', lines.join('\n'));

      const results = await extractSnippets([rel], {
        original: ['keyword'],
        normalized: ['keyword'],
      });

      expect(results[0].snippets).toHaveLength(1);
      expect(results[0].snippets[0]).toContain('keyword match 1');
      expect(results[0].snippets[0]).toContain('keyword match 2');
    });

    test('離れたマッチは別々のスニペットになる', async () => {
      const lines = [
        'keyword match 1',
        'line 1',
        'line 2',
        'line 3',
        'line 4',
        'line 5',
        'line 6',
        'line 7',
        'line 8',
        'line 9',
        'keyword match 2',
      ];
      const rel = await writeTestFile('separate.md', lines.join('\n'));

      const results = await extractSnippets([rel], {
        original: ['keyword'],
        normalized: ['keyword'],
      });

      expect(results[0].snippets).toHaveLength(2);
      expect(results[0].snippets[0]).toContain('keyword match 1');
      expect(results[0].snippets[1]).toContain('keyword match 2');
    });

    test('スニペットは最大 5 件に制限される', async () => {
      const lines: string[] = [];
      for (let i = 0; i < 8; i++) {
        lines.push(`keyword match ${i}`);
        for (let j = 0; j < 10; j++) {
          lines.push(`filler line ${i}-${j}`);
        }
      }
      const rel = await writeTestFile('many.md', lines.join('\n'));

      const results = await extractSnippets([rel], {
        original: ['keyword'],
        normalized: ['keyword'],
      });

      expect(results[0].snippets).toHaveLength(5);
    });

    test('hit_count はマッチした行数を返す', async () => {
      const rel = await writeTestFile(
        'count.md',
        'keyword here\nno match\nkeyword again\nstill keyword',
      );

      const results = await extractSnippets([rel], {
        original: ['keyword'],
        normalized: ['keyword'],
      });

      expect(results[0].hit_count).toBe(3);
    });

    test('キーワードに正規表現メタ文字が含まれてもマッチ件数を正しく数える', async () => {
      const rel = await writeTestFile(
        'regex-meta.md',
        '$ARGUMENTS[0] here\nno match\n$ARGUMENTS[0] again',
      );

      const results = await extractSnippets([rel], {
        original: ['$ARGUMENTS[0]'],
        normalized: ['ARGUMENTS'],
      });

      expect(results[0].hit_count).toBe(2);
    });

    test('同一行に複数キーワードがあっても hit_count は1件として数える', async () => {
      const rel = await writeTestFile(
        'single-line-multi.md',
        'foo keyword bar',
      );

      const results = await extractSnippets([rel], {
        original: ['foo', 'keyword'],
        normalized: [],
      });

      expect(results[0].hit_count).toBe(1);
    });

    test('original と normalized の重複語があっても過剰マッチしない', async () => {
      const rel = await writeTestFile(
        'duplicate-keywords.md',
        'keyword only once',
      );

      const results = await extractSnippets([rel], {
        original: ['keyword'],
        normalized: ['keyword'],
      });

      expect(results[0].hit_count).toBe(1);
    });

    test('複数ファイルをそれぞれ処理する', async () => {
      const relA = await writeTestFile('a.md', 'keyword in a');
      const relB = await writeTestFile('b.md', 'keyword in b');
      const relC = await writeTestFile('c.md', 'keyword in c');

      const results = await extractSnippets([relA, relB, relC], {
        original: ['keyword'],
        normalized: ['keyword'],
      });

      expect(results).toHaveLength(3);
      for (const r of results) {
        expect(r.hit_count).toBe(1);
      }
    });
  });

  describe('エッジケース', () => {
    test('空のファイルリストは空配列を返す', async () => {
      const results = await extractSnippets([], {
        original: ['keyword'],
        normalized: ['keyword'],
      });

      expect(results).toEqual([]);
    });

    test('キーワードが空の場合は hit_count: 0 と空 snippets を返す', async () => {
      const rel = await writeTestFile('empty-kw.md', 'some content');

      const results = await extractSnippets([rel], {
        original: [],
        normalized: [],
      });

      expect(results[0].hit_count).toBe(0);
      expect(results[0].snippets).toEqual([]);
    });

    test('マッチなしの場合は hit_count: 0 と空 snippets を返す', async () => {
      const rel = await writeTestFile('no-match.md', 'Nothing relevant here');

      const results = await extractSnippets([rel], {
        original: ['nonexistent'],
        normalized: ['nonexistent'],
      });

      expect(results[0].hit_count).toBe(0);
      expect(results[0].snippets).toEqual([]);
    });

    test('ファイル先頭のマッチでも安全にスニペットを取得する', async () => {
      const rel = await writeTestFile(
        'start.md',
        'keyword at start\nline 1\nline 2',
      );

      const results = await extractSnippets([rel], {
        original: ['keyword'],
        normalized: ['keyword'],
      });

      expect(results[0].snippets[0]).toContain('keyword at start');
    });

    test('ファイル末尾のマッチでも安全にスニペットを取得する', async () => {
      const rel = await writeTestFile(
        'end.md',
        'line 0\nline 1\nkeyword at end',
      );

      const results = await extractSnippets([rel], {
        original: ['keyword'],
        normalized: ['keyword'],
      });

      expect(results[0].snippets[0]).toContain('keyword at end');
    });

    test('スニペット候補が5件を超えても hit_count は全件数を保持する', async () => {
      const lines: string[] = [];
      for (let i = 0; i < 8; i++) {
        lines.push(`keyword line ${i}`);
        for (let j = 0; j < 10; j++) {
          lines.push(`filler ${i}-${j}`);
        }
      }

      const rel = await writeTestFile('hit-count-many.md', lines.join('\n'));

      const results = await extractSnippets([rel], {
        original: ['keyword'],
        normalized: ['keyword'],
      });

      expect(results[0].snippets).toHaveLength(5);
      expect(results[0].hit_count).toBe(8);
    });

    test('存在しないファイルパスを渡した場合に例外がスローされる', async () => {
      const nonExistent = path.relative(
        PROJECT_ROOT,
        path.join(tmpDir, 'does-not-exist.md'),
      );

      await expect(
        extractSnippets([nonExistent], {
          original: ['keyword'],
          normalized: ['keyword'],
        }),
      ).rejects.toThrow();
    });
  });
});
