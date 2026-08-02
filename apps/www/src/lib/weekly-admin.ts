import { TZDate } from '@date-fns/tz';
import { type CollectionEntry, getCollection } from 'astro:content';
import {
  endOfISOWeek,
  format,
  getISOWeek,
  getISOWeekYear,
  startOfISOWeek,
  subWeeks,
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

/** ISO 週キー(例: 2026-w31)を返す */
function toWeekKey(date: TZDate): string {
  return `${getISOWeekYear(date)}-w${String(getISOWeek(date)).padStart(2, '0')}`;
}

/**
 * 選定画面に表示する週を新しい順に返す(GENERATED_WEEK_COUNT 週)
 * 対象週はビルド時点の日付を起点に決める。リリースがない週でも選定画面の対象週にするため
 * GitHub Releases の公開日が引けないバージョンは週を確定できないため除外する
 */
export async function getWeeklyAdminWeeks(): Promise<WeeklyAdminWeek[]> {
  const releaseMap = await getReleaseMap();
  const changelogs = await getCollection('changelog');

  const today = new TZDate(Date.now(), 'Asia/Tokyo');
  const weeks = new Map<string, WeeklyAdminWeek>();
  for (let offset = 0; offset < GENERATED_WEEK_COUNT; offset += 1) {
    const date = subWeeks(today, offset);
    weeks.set(toWeekKey(date), {
      week: toWeekKey(date),
      periodStart: format(startOfISOWeek(date), 'yyyy-MM-dd'),
      periodEnd: format(endOfISOWeek(date), 'yyyy-MM-dd'),
      items: [],
    });
  }

  for (const entry of changelogs) {
    const publishedAt = releaseMap.get(entry.data.version);
    if (!publishedAt) {
      continue;
    }

    const current = weeks.get(toWeekKey(new TZDate(publishedAt, 'Asia/Tokyo')));
    if (!current) {
      continue;
    }
    for (const item of entry.data.items) {
      current.items.push({ item, version: entry.data.version });
    }
  }

  // Map は新しい週から順に構築しているため、挿入順がそのまま新しい順になる
  return [...weeks.values()].map((week) => ({
    ...week,
    // 同一バージョン内の並びは JSON の記載順を保つ(toSorted は安定ソート)
    items: week.items.toSorted((a, b) =>
      semverCompareDesc(a.version, b.version),
    ),
  }));
}
