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

/** inference 情報を含む HTML コンテンツを生成 */
function buildContentHtml(
  item: {
    content: string;
    content_ja?: string;
    inference?: { before: string; after: string; benefit: string };
  },
  version: string,
): string {
  const text = item.content_ja ?? item.content;
  const parts: string[] = [`<p>${escapeHtml(text)}</p>`];

  if (item.inference) {
    parts.push(
      '<hr/>',
      `<h4>変更前</h4><p>${escapeHtml(item.inference.before)}</p>`,
      `<h4>変更後</h4><p>${escapeHtml(item.inference.after)}</p>`,
      `<h4>利点</h4><p>${escapeHtml(item.inference.benefit)}</p>`,
    );
  }

  parts.push('<hr/>', `<p><small>v${escapeHtml(version)}</small></p>`);
  return parts.join('\n');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function GET(context: APIContext) {
  const changelogs = await getCollection('changelog');
  const pubDate = loadLastFetchTime();

  const sorted = changelogs.sort((a, b) =>
    semverCompare(a.data.version, b.data.version),
  );
  const latest = sorted.slice(0, 5);

  const items = latest.flatMap((entry) => {
    const version = entry.data.version;
    // importance_score 降順でソート
    const sortedItems = [...entry.data.items].sort(
      (a, b) => b.importance_score - a.importance_score,
    );

    return sortedItems.map((item, itemIndex) => ({
      title: `[v${version}] [${item.prefix}] ${item.content_ja ?? item.content}`,
      link: `${context.site}changelog/v${version}#item-${itemIndex}`,
      pubDate,
      description: item.content_ja ?? item.content,
      content: buildContentHtml(item, version),
    }));
  });

  return rss({
    title: 'Claude Code Changelog',
    description: 'Claude Code の更新履歴',
    site: context.site ?? '',
    items,
    customData: '<language>ja</language>',
  });
}
