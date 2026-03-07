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

  describe('異常系', () => {
    test('.md ファイルが1件もないディレクトリでは空配列を返す', async () => {
      const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'grep-empty-'));
      try {
        const result = await searchDocs(
          { original: ['keyword'], normalized: ['keyword'] },
          emptyDir,
        );

        expect(result.files).toEqual([]);
      } finally {
        fs.rmSync(emptyDir, { recursive: true, force: true });
      }
    });
  });
});
