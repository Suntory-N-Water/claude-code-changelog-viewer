import { describe, expect, test } from 'vitest';
import { shouldSkipSearch } from '../searchers/grep-executor';

describe('shouldSkipSearch', () => {
  test('SDK タグを含む場合はスキップする', () => {
    expect(shouldSkipSearch(['SDK'])).toBe(true);
  });

  test('API タグを含む場合はスキップする', () => {
    expect(shouldSkipSearch(['API'])).toBe(true);
  });

  test('SDK と API の両方を含む場合もスキップする', () => {
    expect(shouldSkipSearch(['SDK', 'API'])).toBe(true);
  });

  test('他のタグと SDK を含む場合もスキップする', () => {
    expect(shouldSkipSearch(['VSCode', 'SDK'])).toBe(true);
  });

  test('SDK/API 以外のタグのみの場合はスキップしない', () => {
    expect(shouldSkipSearch(['VSCode'])).toBe(false);
    expect(shouldSkipSearch(['Breaking'])).toBe(false);
  });

  test('タグが空の場合はスキップしない', () => {
    expect(shouldSkipSearch([])).toBe(false);
  });
});
