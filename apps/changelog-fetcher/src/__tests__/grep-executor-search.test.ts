import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { searchDocs } from '../searchers/grep-executor';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'grep-test-'));

beforeAll(async () => {
  await Bun.write(
    path.join(tmpDir, 'settings.md'),
    'Use `keyword` for `key1` and `key2` configuration\nSETTINGS info',
  );
  await Bun.write(
    path.join(tmpDir, 'hooks.md'),
    '`keyword` hook documentation',
  );
  await Bun.write(
    path.join(tmpDir, 'changelog.md'),
    '`keyword` changelog entry',
  );
  await Bun.write(path.join(tmpDir, 'unrelated.md'), 'Nothing relevant here');
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('searchDocs', () => {
  describe('フォールバック戦略', () => {
    test('戦略1 でヒットした場合はそれを返す', async () => {
      const result = await searchDocs(
        { original: ['keyword'], normalized: ['keyword'] },
        tmpDir,
      );

      expect(result.files).toHaveLength(2);
      expect(result.files.some((f) => f.includes('settings.md'))).toBe(true);
      expect(result.files.some((f) => f.includes('hooks.md'))).toBe(true);
    });

    test('戦略1 が 50件超の場合は戦略2 にフォールバックする', async () => {
      const manyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'grep-many-'));
      try {
        for (let i = 0; i < 51; i++) {
          await Bun.write(
            path.join(manyDir, `doc${i}.md`),
            '`common_word` content',
          );
        }
        // 戦略2 で "specific" にマッチするのは1件だけ
        await Bun.write(
          path.join(manyDir, 'best-match.md'),
          '`common_word` specific content',
        );

        const result = await searchDocs(
          { original: ['common_word'], normalized: ['specific'] },
          manyDir,
        );

        expect(result.files).toHaveLength(1);
        expect(result.files[0]).toContain('best-match.md');
      } finally {
        fs.rmSync(manyDir, { recursive: true, force: true });
      }
    });

    test('戦略1, 2 ともに空の場合は戦略3 にフォールバックする', async () => {
      const result = await searchDocs(
        { original: ['rare_term_xyz'], normalized: [] },
        tmpDir,
      );

      // バッククォート完全一致なし、normalized 空 → 戦略3 で original を使用
      expect(result.files).toEqual([]);
    });

    test('全戦略でヒットなしの場合は空配列を返す', async () => {
      const result = await searchDocs(
        { original: ['nonexistent_abc'], normalized: ['nonexistent_abc'] },
        tmpDir,
      );

      expect(result.files).toEqual([]);
    });

    test('original が空の場合は戦略2 に進む', async () => {
      const result = await searchDocs(
        { original: [], normalized: ['SETTINGS'] },
        tmpDir,
      );

      expect(result.files).toHaveLength(1);
      expect(result.files[0]).toContain('settings.md');
    });

    test('全キーワードが空の場合は即座に空配列を返す', async () => {
      const result = await searchDocs({ original: [], normalized: [] }, tmpDir);

      expect(result.files).toEqual([]);
    });
  });

  describe('結果のフィルタリング', () => {
    test('changelog.md は結果から除外される', async () => {
      const result = await searchDocs(
        { original: ['keyword'], normalized: ['keyword'] },
        tmpDir,
      );

      for (const file of result.files) {
        expect(file).not.toContain('changelog.md');
      }
    });

    test('重複ファイルは排除される', async () => {
      // key1 と key2 の両方が settings.md にある
      const result = await searchDocs(
        { original: ['key1', 'key2'], normalized: [] },
        tmpDir,
      );

      const settingsFiles = result.files.filter((f) =>
        f.includes('settings.md'),
      );
      expect(settingsFiles).toHaveLength(1);
    });
  });

  describe('大文字小文字の無視', () => {
    test('regexSearch は大文字小文字を無視する', async () => {
      const result = await searchDocs(
        { original: [], normalized: ['settings'] },
        tmpDir,
      );

      expect(result.files).toHaveLength(1);
      expect(result.files[0]).toContain('settings.md');
    });
  });

  describe('正規表現特殊文字のエスケープ', () => {
    let specialCharsDir: string;

    beforeAll(async () => {
      specialCharsDir = fs.mkdtempSync(
        path.join(os.tmpdir(), 'grep-special-chars-'),
      );
      // イシュー #72 で報告された実際の特殊文字列
      await Bun.write(
        path.join(specialCharsDir, 'terminal-codes.md'),
        'ANSI escape code: [27;2;13~ is used for terminal control',
      );
      // その他の正規表現特殊文字
      await Bun.write(
        path.join(specialCharsDir, 'brackets.md'),
        'Array syntax [1, 2, 3] and object {key: value}',
      );
      await Bun.write(
        path.join(specialCharsDir, 'regex-chars.md'),
        'Special chars: (test) $var *wildcard +plus ?optional .dot ^start',
      );
      await Bun.write(
        path.join(specialCharsDir, 'pipe.md'),
        'Pipe operator: a|b is used in regex',
      );
      await Bun.write(
        path.join(specialCharsDir, 'backslash.md'),
        'Backslash: \\n and \\t are escape sequences',
      );
      await Bun.write(
        path.join(specialCharsDir, 'no-match.md'),
        'This file has no special chars content',
      );
    });

    afterAll(() => {
      fs.rmSync(specialCharsDir, { recursive: true, force: true });
    });

    test('角括弧を含むキーワードで検索できる（イシュー #72）', async () => {
      const result = await searchDocs(
        { original: [], normalized: ['[27;2;13~'] },
        specialCharsDir,
      );

      expect(result.files).toHaveLength(1);
      expect(result.files[0]).toContain('terminal-codes.md');
    });

    test('配列記法 [1, 2, 3] で検索できる', async () => {
      const result = await searchDocs(
        { original: [], normalized: ['[1, 2, 3]'] },
        specialCharsDir,
      );

      expect(result.files).toHaveLength(1);
      expect(result.files[0]).toContain('brackets.md');
    });

    test('波括弧 {key: value} で検索できる', async () => {
      const result = await searchDocs(
        { original: [], normalized: ['{key: value}'] },
        specialCharsDir,
      );

      expect(result.files).toHaveLength(1);
      expect(result.files[0]).toContain('brackets.md');
    });

    test('丸括弧 (test) で検索できる', async () => {
      const result = await searchDocs(
        { original: [], normalized: ['(test)'] },
        specialCharsDir,
      );

      expect(result.files).toHaveLength(1);
      expect(result.files[0]).toContain('regex-chars.md');
    });

    test('ドル記号 $var で検索できる', async () => {
      const result = await searchDocs(
        { original: [], normalized: ['$var'] },
        specialCharsDir,
      );

      expect(result.files).toHaveLength(1);
      expect(result.files[0]).toContain('regex-chars.md');
    });

    test('アスタリスク *wildcard で検索できる', async () => {
      const result = await searchDocs(
        { original: [], normalized: ['*wildcard'] },
        specialCharsDir,
      );

      expect(result.files).toHaveLength(1);
      expect(result.files[0]).toContain('regex-chars.md');
    });

    test('プラス記号 +plus で検索できる', async () => {
      const result = await searchDocs(
        { original: [], normalized: ['+plus'] },
        specialCharsDir,
      );

      expect(result.files).toHaveLength(1);
      expect(result.files[0]).toContain('regex-chars.md');
    });

    test('疑問符 ?optional で検索できる', async () => {
      const result = await searchDocs(
        { original: [], normalized: ['?optional'] },
        specialCharsDir,
      );

      expect(result.files).toHaveLength(1);
      expect(result.files[0]).toContain('regex-chars.md');
    });

    test('ドット .dot で検索できる', async () => {
      const result = await searchDocs(
        { original: [], normalized: ['.dot'] },
        specialCharsDir,
      );

      expect(result.files).toHaveLength(1);
      expect(result.files[0]).toContain('regex-chars.md');
    });

    test('キャレット ^start で検索できる', async () => {
      const result = await searchDocs(
        { original: [], normalized: ['^start'] },
        specialCharsDir,
      );

      expect(result.files).toHaveLength(1);
      expect(result.files[0]).toContain('regex-chars.md');
    });

    test('パイプ記号 a|b で検索できる', async () => {
      const result = await searchDocs(
        { original: [], normalized: ['a|b'] },
        specialCharsDir,
      );

      expect(result.files).toHaveLength(1);
      expect(result.files[0]).toContain('pipe.md');
    });

    test('バックスラッシュ \\n で検索できる', async () => {
      const result = await searchDocs(
        { original: [], normalized: ['\\n'] },
        specialCharsDir,
      );

      expect(result.files).toHaveLength(1);
      expect(result.files[0]).toContain('backslash.md');
    });

    test('複数の特殊文字を含むキーワードで同時に検索できる', async () => {
      const result = await searchDocs(
        { original: [], normalized: ['[27;2;13~', '$var', 'a|b'] },
        specialCharsDir,
      );

      expect(result.files).toHaveLength(3);
      expect(result.files.some((f) => f.includes('terminal-codes.md'))).toBe(
        true,
      );
      expect(result.files.some((f) => f.includes('regex-chars.md'))).toBe(true);
      expect(result.files.some((f) => f.includes('pipe.md'))).toBe(true);
    });
  });
});
