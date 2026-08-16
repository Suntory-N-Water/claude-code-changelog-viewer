import { describe, expect, it } from 'vitest';
import { parseChangelogReleases } from './changelog-markdown-parser';

describe('CHANGELOG Markdown parser', () => {
  it('バージョンと複数行の項目がある時、ドメイン入力へ変換すること', async () => {
    const result = await parseChangelogReleases(`
# Changelog

## 2.1.234

- Added a new workflow
  with multiline details.
- Fixed a typo

## 2.1.233

- Changed an older behavior
`);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      version: 'v2.1.234',
      items: [
        {
          content: '- Added a new workflow with multiline details.',
          prefix: 'Added',
        },
        { content: '- Fixed a typo', prefix: 'Fixed' },
      ],
    });
    expect(result[0]?.items.every((item) => item.id.length === 12)).toBe(true);
    expect(result[1]).toMatchObject({
      version: 'v2.1.233',
      items: [{ content: '- Changed an older behavior', prefix: 'Changed' }],
    });
  });

  it('項目のないバージョンの時、空の項目配列として返すこと', async () => {
    await expect(
      parseChangelogReleases('## 2.1.234\n\nNo bullet here'),
    ).resolves.toEqual([{ version: 'v2.1.234', items: [] }]);
  });
});
