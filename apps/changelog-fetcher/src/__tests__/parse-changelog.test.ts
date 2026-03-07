import { describe, expect, test } from 'bun:test';
import { parseChangelog } from '../parse-changelog';

describe('parseChangelog', () => {
  test('単一バージョンの CHANGELOG を分割する', () => {
    const content = '## 2.1.0\n\n- Item A\n- Item B\n';
    const result = parseChangelog(content);

    expect(result).toEqual({ '2.1.0': '- Item A\n- Item B' });
  });

  test('複数バージョンを含む CHANGELOG を正しく分割する', () => {
    const content = [
      '## 2.1.1',
      '',
      '- Feature X',
      '',
      '## 2.1.0',
      '',
      '- Feature Y',
    ].join('\n');
    const result = parseChangelog(content);

    expect(Object.keys(result)).toEqual(['2.1.1', '2.1.0']);
    expect(result['2.1.1']).toBe('- Feature X');
    expect(result['2.1.0']).toBe('- Feature Y');
  });

  test('バージョンヘッダがない CHANGELOG は空オブジェクトを返す', () => {
    const content = '# Title\n\nSome text without version headers\n';
    const result = parseChangelog(content);

    expect(result).toEqual({});
  });

  test('最後のバージョンのコンテンツが欠落しない', () => {
    const content = '## 1.0.0\n\n- Only version\n- Last item';
    const result = parseChangelog(content);

    expect(result['1.0.0']).toContain('- Last item');
  });

  test('## X.Y.Z 以外の見出しはバージョンヘッダとして扱わない', () => {
    const content = [
      '# Changelog',
      '',
      '## 2.0.0',
      '',
      '### Breaking Changes',
      '',
      '- Removed API',
    ].join('\n');
    const result = parseChangelog(content);

    expect(Object.keys(result)).toEqual(['2.0.0']);
    expect(result['2.0.0']).toContain('### Breaking Changes');
    expect(result['2.0.0']).toContain('- Removed API');
  });
});
