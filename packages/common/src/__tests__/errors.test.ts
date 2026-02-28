import { describe, expect, it } from 'bun:test';
import { toError } from '../errors';

describe('toError', () => {
  it('Error インスタンスはそのまま返す', () => {
    const original = new Error('test');
    expect(toError(original)).toBe(original);
  });

  it('Error 以外は Error に変換する', () => {
    const result = toError('something went wrong');
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('something went wrong');
  });
});
