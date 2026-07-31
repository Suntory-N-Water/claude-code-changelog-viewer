import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { loadAllInferred } from '../infrastructure/settings-reference/settings-related-context';

describe('設定参照用の inferred JSON 読み込み', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('破損した JSON がある時、正常な項目を返しつつファイル名付きで警告すること', async () => {
    const inferredDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'settings-inferred-'),
    );
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await fs.writeFile(
      path.join(inferredDir, 'inferred_v1.0.0.json'),
      JSON.stringify({
        version: '1.0.0',
        summary: 'summary',
        items: [
          {
            id: '123456789abc',
            content: 'Added a setting',
            prefix: 'Added',
            related_docs: [],
          },
        ],
      }),
    );
    const brokenPath = path.join(inferredDir, 'inferred_v1.0.1.json');
    await fs.writeFile(brokenPath, '{broken');

    try {
      const result = await loadAllInferred(inferredDir);

      expect(result).toEqual([
        {
          version: '1.0.0',
          content: 'Added a setting',
        },
      ]);
      expect(warning).toHaveBeenCalledOnce();
      expect(warning.mock.calls[0]?.[0]).toContain(brokenPath);
    } finally {
      await fs.rm(inferredDir, { recursive: true, force: true });
    }
  });
});
