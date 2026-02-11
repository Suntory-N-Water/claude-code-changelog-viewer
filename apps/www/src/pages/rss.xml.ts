import { getCollection } from 'astro:content';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import rss from '@astrojs/rss';
import type { APIContext } from 'astro';

function loadLastFetchTime(): Date {
  try {
    const raw = readFileSync(
      join(
        process.cwd(),
        '..',
        'changelog-fetcher',
        'metadata',
        'last_fetch.json',
      ),
      'utf-8',
    );
    const data = JSON.parse(raw) as { lastFetchTime: string };
    return new Date(data.lastFetchTime);
  } catch {
    return new Date();
  }
}

function semverCompare(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) {
      return (pb[i] ?? 0) - (pa[i] ?? 0);
    }
  }
  return 0;
}

export async function GET(context: APIContext) {
  const changelogs = await getCollection('changelog');
  const pubDate = loadLastFetchTime();

  const sorted = changelogs.sort((a, b) =>
    semverCompare(a.data.version, b.data.version),
  );
  const latest = sorted.slice(0, 5);

  const items = latest.flatMap((entry) =>
    entry.data.items.map((item, itemIndex) => ({
      title: `[${item.prefix}] ${item.content_ja ?? item.content}`,
      link: `${context.site}changelog/v${entry.data.version}#item-${itemIndex}`,
      pubDate,
      description: item.inference?.benefit ?? item.content_ja ?? item.content,
      categories: item.feature_areas ?? [],
    })),
  );

  return rss({
    title: 'Claude Code Changelog',
    description: 'Claude Code の更新履歴',
    site: context.site ?? '',
    items,
    customData: '<language>ja</language>',
  });
}
