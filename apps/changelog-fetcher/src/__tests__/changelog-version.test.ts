import { describe, expect, it } from 'vitest';
import { createChangelogVersion } from '../domain/changelog/changelog-version';

describe('createChangelogVersion', () => {
  it.each([
    ['v1.2.3', 'v1.2.3'],
    ['1.2.3', 'v1.2.3'],
  ])('外部入力 %s を v 付きへ正規化する', (input, expected) => {
    expect(createChangelogVersion(input)).toBe(expected);
  });

  it('不正な形式を拒否する', () => {
    expect(() => createChangelogVersion('1.2')).toThrow(
      'CHANGELOG バージョンの形式が不正です',
    );
  });
});
