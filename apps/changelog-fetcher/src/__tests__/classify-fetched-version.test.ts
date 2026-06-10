import { describe, expect, it } from 'vitest';
import { classifyFetchedVersion } from '../domain/changelog/classify-fetched-version';

describe('取得済みバージョンの分類', () => {
  it('ローカルファイルが存在しない時、新規として扱うこと', () => {
    const result = classifyFetchedVersion({
      remoteHash: 'remote-content-hash',
      existingLocalHash: null,
      existsLocally: false,
    });

    expect(result).toBe('new');
  });

  it('ローカルファイルが存在しハッシュが変わった時、更新として扱うこと', () => {
    const result = classifyFetchedVersion({
      remoteHash: 'remote-content-hash',
      existingLocalHash: 'previous-content-hash',
      existsLocally: true,
    });

    expect(result).toBe('updated');
  });

  it('ローカルファイルが存在しハッシュが同じ時、変更なしとして扱うこと', () => {
    const result = classifyFetchedVersion({
      remoteHash: 'same-content-hash',
      existingLocalHash: 'same-content-hash',
      existsLocally: true,
    });

    expect(result).toBe('unchanged');
  });
});
