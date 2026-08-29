import { describe, expect, test } from 'vitest';
import { buildDiffMap } from './changelog-diff';

describe('buildDiffMap', () => {
  test('同一バージョンの複数イベントを1つの配列にまとめる', () => {
    const first = {
      id: 'v1.0.0-2026-08-16T00:00:00.000Z',
      data: {
        detected_at: '2026-08-16T00:00:00.000Z',
        version: 'v1.0.0',
        type: 'items_changed' as const,
        items_added: ['- Added first'],
        items_removed: [],
      },
    };
    const second = {
      id: 'v1.0.0-2026-08-16T01:00:00.000Z',
      data: {
        detected_at: '2026-08-16T01:00:00.000Z',
        version: 'v1.0.0',
        type: 'version_removed' as const,
        items_added: [],
        items_removed: [],
      },
    };

    const result = buildDiffMap([first, second] as never);

    expect(result.get('v1.0.0')).toEqual([first.data, second.data]);
  });
});
