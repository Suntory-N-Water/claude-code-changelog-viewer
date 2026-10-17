import { describe, expect, it } from 'vitest';
import {
  formatChangelogVersion,
  normalizeChangelogVersion,
  selectChangelogVersionsInRange,
} from './changelog-version';

describe('CHANGELOG バージョン', () => {
  it('v 付きのバージョンを正規化すると、v なしの形式を返すこと', () => {
    expect(normalizeChangelogVersion('v2.1.234')).toBe('2.1.234');
  });

  it('バージョンを外部形式へ変換すると、v 付きの形式を返すこと', () => {
    expect(formatChangelogVersion('2.1.234')).toBe('v2.1.234');
    expect(formatChangelogVersion('v2.1.234')).toBe('v2.1.234');
  });
});

describe('バージョン範囲の選択', () => {
  const versions = ['2.1.300', '2.1.10', '2.1.231', '2.1.9', '2.1.232', '2.1.8'];

  it('下限と上限を指定したとき、境界のバージョンを含めて範囲内だけを古い順に返すこと', () => {
    const selected = selectChangelogVersionsInRange(versions, {
      fromVersion: 'v2.1.9',
      toVersion: '2.1.232',
    });

    expect(selected).toEqual(['2.1.9', '2.1.10', '2.1.231', '2.1.232']);
  });

  it('上限を省略したとき、下限以上のすべてのバージョンを返すこと', () => {
    const selected = selectChangelogVersionsInRange(versions, { fromVersion: '2.1.232' });

    expect(selected).toEqual(['2.1.232', '2.1.300']);
  });
});
