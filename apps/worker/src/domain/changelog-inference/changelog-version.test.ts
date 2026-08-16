import { describe, expect, it } from 'vitest';
import {
  formatChangelogVersion,
  normalizeChangelogVersion,
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
