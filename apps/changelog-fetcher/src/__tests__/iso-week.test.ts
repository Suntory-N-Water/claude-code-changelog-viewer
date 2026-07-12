import { describe, expect, test } from 'vitest';
import { createIsoWeek, toWeekDateRange } from '../domain/weekly-post/iso-week';

describe('createIsoWeek', () => {
  test('YYYY-wWW 形式のISO週を受け付ける', () => {
    expect(createIsoWeek('2026-w28')).toBe('2026-w28');
    expect(createIsoWeek('2026-W28')).toBe('2026-w28');
    expect(createIsoWeek('2026-07-12')).toBe('2026-w28');
  });

  test('不正な形式と範囲外の週を拒否する', () => {
    expect(() => createIsoWeek('2026-w00')).toThrow();
    expect(() => createIsoWeek('2026-w54')).toThrow();
    expect(() => createIsoWeek('2026-02-31')).toThrow();
  });
});

describe('toWeekDateRange', () => {
  test('月曜00:00 UTCから翌月曜00:00 UTCの範囲を返す', () => {
    const range = toWeekDateRange(createIsoWeek('2026-w28'));

    expect(range.start.toISOString()).toBe('2026-07-06T00:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-07-13T00:00:00.000Z');
  });

  test('年末年始をまたぐISO週を計算する', () => {
    const range = toWeekDateRange(createIsoWeek('2020-w53'));

    expect(range.start.toISOString()).toBe('2020-12-28T00:00:00.000Z');
    expect(range.end.toISOString()).toBe('2021-01-04T00:00:00.000Z');
  });

  test('存在しない第53週を拒否する', () => {
    expect(() => toWeekDateRange(createIsoWeek('2021-w53'))).toThrow();
  });
});
