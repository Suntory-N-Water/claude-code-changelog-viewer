import { describe, expect, it, vi } from 'vitest';
import { inferChangelogItemBatch } from './changelog-inference';

describe('CHANGELOG 推論のバッチ処理', () => {
  it('バッチに変更後を求める項目がないとき、AI を呼ばずに全項目を変更後なしで返すこと', async () => {
    const inferItems = vi.fn();

    const result = await inferChangelogItemBatch(
      { inferItems },
      {
        version: 'v2.1.234',
        items: [
          {
            id: 'fixed-with-docs',
            content: '- Fixed a crash in the documented feature',
            prefix: 'Fixed',
            relatedDocs: [{ file: 'features.md', snippets: ['The feature automates the setup.'] }],
          },
          {
            id: 'without-docs',
            content: '- Added a small option',
            prefix: 'Added',
            relatedDocs: [],
          },
        ],
      },
    );

    expect(result).toEqual([{ id: 'fixed-with-docs' }, { id: 'without-docs' }]);
    expect(inferItems).not.toHaveBeenCalled();
  });
});
