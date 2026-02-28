import { describe, expect, it } from 'bun:test';
import { truncateForDiscord } from '../discord';

describe('truncateForDiscord', () => {
  it('2000文字以下はそのまま返す', () => {
    const content = 'a'.repeat(2000);
    expect(truncateForDiscord(content, '...')).toBe(content);
  });

  it('2001文字で suffix 付きに切り詰められる', () => {
    const content = 'a'.repeat(2001);
    const suffix = '...cut';
    const result = truncateForDiscord(content, suffix);

    expect(result.length).toBe(2000);
    expect(result).toBe(`${'a'.repeat(2000 - suffix.length)}${suffix}`);
  });
});
