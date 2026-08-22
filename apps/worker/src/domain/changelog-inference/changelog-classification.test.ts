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
  it('新規・更新・過去のバージョンがある時、新しいバージョンだけを通知対象にすること', () => {
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

    const result = classifyChangelogReleases({
      releases,
      existingRows: existing,
      recordedRemovedVersions: [],
      detectedAt: '2026-08-16T00:00:00.000Z',
    });

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

  it('項目の並び順だけが変わった時、変更扱いしないこと', () => {
    const result = classifyChangelogReleases({
      releases: [release('v2.1.234', 'first', 'second')],
      existingRows: [
        { version: '2.1.234', itemId: 'v2.1.234-1', content: 'second' },
        { version: '2.1.234', itemId: 'v2.1.234-0', content: 'first' },
      ],
      recordedRemovedVersions: [],
      detectedAt: '2026-08-16T00:00:00.000Z',
    });

    expect(result).toEqual({
      versions: [],
      diffEvents: [],
      notifiableVersions: [],
    });
  });

  it('削除済みバージョンを記録済みの時、同じ CHANGELOG を再処理しても差分イベントを積まないこと', () => {
    const existing: ExistingChangelogItem[] = [
      { version: '2.1.234', itemId: 'v2.1.234-0', content: 'same item' },
      { version: '2.1.231', itemId: 'removed-0', content: 'removed item' },
    ];

    const result = classifyChangelogReleases({
      releases: [release('v2.1.234', 'same item')],
      existingRows: existing,
      recordedRemovedVersions: ['v2.1.231'],
      detectedAt: '2026-08-17T00:00:00.000Z',
    });

    expect(result.diffEvents).toEqual([]);
  });

  it('別のバージョンが記録済みでも、新しく消えたバージョンは1件記録すること', () => {
    const existing: ExistingChangelogItem[] = [
      { version: '2.1.231', itemId: 'removed-0', content: 'removed item' },
      { version: '2.1.230', itemId: 'newly-removed-0', content: 'gone item' },
    ];

    const result = classifyChangelogReleases({
      releases: [],
      existingRows: existing,
      recordedRemovedVersions: ['v2.1.231'],
      detectedAt: '2026-08-17T00:00:00.000Z',
    });

    expect(result.diffEvents).toEqual([
      {
        detectedAt: '2026-08-17T00:00:00.000Z',
        version: 'v2.1.230',
        type: 'version_removed',
        itemsAdded: [],
        itemsRemoved: [],
      },
    ]);
  });
});
