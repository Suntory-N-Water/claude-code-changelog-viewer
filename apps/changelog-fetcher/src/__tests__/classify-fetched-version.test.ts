import { describe, expect, test } from 'vitest';
import { classifyFetchedVersion } from '../domain/changelog/classify-fetched-version';

describe('classifyFetchedVersion', () => {
  test('ローカルに無いとき new を返す', () => {
    expect(
      classifyFetchedVersion({
        remoteHash: 'remote-a',
        existingLocalHash: null,
        existsLocally: false,
      }),
    ).toBe('new');
  });

  test('ローカルに有り、ハッシュが異なるとき updated を返す', () => {
    expect(
      classifyFetchedVersion({
        remoteHash: 'remote-b',
        existingLocalHash: 'local-a',
        existsLocally: true,
      }),
    ).toBe('updated');
  });

  test('ローカルに有り、ハッシュが一致するとき unchanged を返す', () => {
    expect(
      classifyFetchedVersion({
        remoteHash: 'same-hash',
        existingLocalHash: 'same-hash',
        existsLocally: true,
      }),
    ).toBe('unchanged');
  });
});
