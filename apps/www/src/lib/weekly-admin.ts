import { TZDate } from '@date-fns/tz';
import { type CollectionEntry, getCollection } from 'astro:content';
import {
  endOfISOWeek,
  format,
  getISOWeek,
  getISOWeekYear,
  startOfISOWeek,
} from 'date-fns';
import { getReleaseMap } from './release-map';
import { semverCompareDesc } from './semver';

/**
 * 選定画面を生成する週数
 * 作業対象は最新週、多くても2週目までのため、それ以前の週はページを生成しない
 */
const GENERATED_WEEK_COUNT = 2;

type ChangelogItem = CollectionEntry<'changelog'>['data']['items'][number];

export type WeeklyAdminWeek = {
  /** ISO 週(例: 2026-w29) */
  week: string;
  periodStart: string;
  periodEnd: string;
  items: { item: ChangelogItem; version: string }[];
};

/**
 * 選定画面に表示する週を新しい順に返す(最大 GENERATED_WEEK_COUNT 週)
 * GitHub Releases の公開日が引けないバージョンは週を確定できないため除外する
 */
export async function getWeeklyAdminWeeks(): Promise<WeeklyAdminWeek[]> {
  const releaseMap = await getReleaseMap();
  const changelogs = await getCollection('changelog');

  const weeks = new Map<string, WeeklyAdminWeek>();
  for (const entry of changelogs) {
    const publishedAt = releaseMap.get(entry.data.version);
    if (!publishedAt) {
      continue;
    }

    const date = new TZDate(publishedAt, 'Asia/Tokyo');
    const week = `${getISOWeekYear(date)}-w${String(getISOWeek(date)).padStart(2, '0')}`;
    const current = weeks.get(week) ?? {
      week,
      periodStart: format(startOfISOWeek(date), 'yyyy-MM-dd'),
      periodEnd: format(endOfISOWeek(date), 'yyyy-MM-dd'),
      items: [],
    };
    for (const item of entry.data.items) {
      current.items.push({ item, version: entry.data.version });
    }
    weeks.set(week, current);
  }

  return [...weeks.values()]
    .toSorted((a, b) => b.week.localeCompare(a.week))
    .slice(0, GENERATED_WEEK_COUNT)
    .map((week) => ({
      ...week,
      // 同一バージョン内の並びは JSON の記載順を保つ(toSorted は安定ソート)
      items: week.items.toSorted((a, b) =>
        semverCompareDesc(a.version, b.version),
      ),
    }));
}
