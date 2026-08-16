import { describe, expect, it } from 'vitest';
import {
  classifyChangelogReleases,
  type ExistingChangelogItem,
} from './changelog-classification';

function release(version: string, ...items: string[]) {
  return {
    version,
    items: items.map((content, index) => ({
      id: `${version}-${index}`,
      content,
      prefix: 'Changed',
    })),
  };
}

describe('CHANGELOG 差分判定', () => {
  it('新規・更新・過去の新規バージョンを処理し、新しいバージョンだけ通知対象にすること', () => {
    const releases = [
      release('v2.1.234', 'new item'),
      release('v2.1.233', 'updated item'),
      release('v2.1.232', 'same item'),
      release('v2.1.100', 'old new item'),
    ];
    const existing: ExistingChangelogItem[] = [
      { version: '2.1.233', itemId: 'old-item-0', content: 'old item' },
      { version: '2.1.232', itemId: 'v2.1.232-0', content: 'same item' },
      { version: '2.1.231', itemId: 'removed-0', content: 'removed item' },
    ];

    const result = classifyChangelogReleases(
      releases,
      existing,
      '2026-08-16T00:00:00.000Z',
    );

    expect(result.versions.map((item) => item.version)).toEqual([
      'v2.1.234',
      'v2.1.233',
      'v2.1.100',
    ]);
    expect(result.notifiableVersions).toEqual(['v2.1.234']);
    expect(result.diffEvents).toEqual([
      {
        detectedAt: '2026-08-16T00:00:00.000Z',
        version: 'v2.1.233',
        type: 'items_changed',
        itemsAdded: ['updated item'],
        itemsRemoved: ['old item'],
      },
      {
        detectedAt: '2026-08-16T00:00:00.000Z',
        version: 'v2.1.231',
        type: 'version_removed',
        itemsAdded: [],
        itemsRemoved: [],
      },
    ]);
  });

  it('項目の並び順だけが変わったバージョンを変更扱いしないこと', () => {
    const result = classifyChangelogReleases(
      [release('v2.1.234', 'first', 'second')],
      [
        { version: '2.1.234', itemId: 'v2.1.234-1', content: 'second' },
        { version: '2.1.234', itemId: 'v2.1.234-0', content: 'first' },
      ],
      '2026-08-16T00:00:00.000Z',
    );

    expect(result).toEqual({
      versions: [],
      diffEvents: [],
      notifiableVersions: [],
    });
  });
});
