import { TZDate } from '@date-fns/tz';
import { addDays } from 'date-fns/addDays';
import { addWeeks } from 'date-fns/addWeeks';
import { format } from 'date-fns/format';
import { startOfISOWeekYear } from 'date-fns/startOfISOWeekYear';

declare const isoWeekBrand: unique symbol;

export type IsoWeek = string & { [isoWeekBrand]: unknown };

export type WeekDateRange = {
  start: Date;
  end: Date;
};

export type WeekPostPeriod = {
  start: string;
  end: string;
};

export function createIsoWeek(value: string): IsoWeek {
  if (!/^\d{4}-w(0[1-9]|[1-4]\d|5[0-3])$/.test(value)) {
    throw new Error(`ISO週の形式が不正です: ${value}`);
  }

  return value as IsoWeek;
}

export function toWeekDateRange(week: IsoWeek): WeekDateRange {
  const [, yearValue, weekValue] = week.match(/^(\d{4})-w(\d{2})$/) ?? [];
  if (yearValue === undefined || weekValue === undefined) {
    throw new Error(`ISO週の形式が不正です: ${week}`);
  }

  const year = Number(yearValue);
  const weekNumber = Number(weekValue);
  const start = addWeeks(
    startOfISOWeekYear(new TZDate(year, 0, 4, 'UTC')),
    weekNumber - 1,
  );

  if (format(start, 'RRRR') !== yearValue) {
    throw new Error(`指定年に存在しないISO週です: ${week}`);
  }

  return {
    start: new Date(start.getTime()),
    end: new Date(addDays(start, 7).getTime()),
  };
}

export function includesInWeekRange(range: WeekDateRange, date: Date): boolean {
  return range.start <= date && date < range.end;
}

export function toWeekPostPeriod(range: WeekDateRange): WeekPostPeriod {
  return {
    start: format(range.start, 'yyyy-MM-dd'),
    end: format(addDays(range.end, -1), 'yyyy-MM-dd'),
  };
}
