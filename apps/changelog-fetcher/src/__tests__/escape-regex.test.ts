import { describe, expect, test } from 'vitest';
import { escapeRegex } from '../searchers/escape-regex';

describe('escapeRegex', () => {
  test.each([
    ['.', '\\.'],
    ['*', '\\*'],
    ['+', '\\+'],
    ['?', '\\?'],
    ['^', '\\^'],
    ['$', '\\$'],
    ['{', '\\{'],
    ['}', '\\}'],
    ['(', '\\('],
    [')', '\\)'],
    ['|', '\\|'],
    ['[', '\\['],
    [']', '\\]'],
    ['\\', '\\\\'],
  ])('"%s" → "%s"', (input, expected) => {
    expect(escapeRegex(input)).toBe(expected);
  });

  test('複数メタ文字を含む文字列を一括エスケープする', () => {
    expect(escapeRegex('[27;2;13~')).toBe('\\[27;2;13~');
    expect(escapeRegex('fn()')).toBe('fn\\(\\)');
    expect(escapeRegex('a|b')).toBe('a\\|b');
  });

  test('メタ文字を含まない文字列はそのまま返す', () => {
    expect(escapeRegex('hello')).toBe('hello');
    expect(escapeRegex('CLAUDE_CODE')).toBe('CLAUDE_CODE');
  });

  test('空文字列はそのまま返す', () => {
    expect(escapeRegex('')).toBe('');
  });

  test('エスケープ済み文字列で new RegExp() がリテラルマッチする', () => {
    const dangerous = '$ARGS[0]';
    const pattern = new RegExp(escapeRegex(dangerous));

    expect(pattern.test('$ARGS[0]')).toBe(true);
    expect(pattern.test('xARGSx0x')).toBe(false);
  });

  test('連続するバックスラッシュを含む文字列も正しくエスケープする', () => {
    expect(escapeRegex('path\\to\\file')).toBe('path\\\\to\\\\file');
  });
});
