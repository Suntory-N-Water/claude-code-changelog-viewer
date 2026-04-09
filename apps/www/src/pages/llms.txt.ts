import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { SITE_TITLE } from '../lib/constants';
import { semverCompareDesc } from '../lib/semver';
import {
  MIN_ITEMS_FOR_PAGE,
  aggregateByFeatureArea,
  extractChangelogData,
  getFeatureAreaLabel,
  toFeatureAreaSlug,
} from '../lib/feature-area';

export async function GET(context: APIContext) {
  const site = context.site?.href.replace(/\/$/, '') ?? '';

  const [changelogs, docsDiffEntries] = await Promise.all([
    getCollection('changelog'),
    getCollection('docsDiff'),
  ]);

  // changelog: バージョン降順
  const sortedChangelogs = [...changelogs].sort((a, b) =>
    semverCompareDesc(a.data.version, b.data.version),
  );

  // feature areas: アイテム数降順・閾値以上のみ
  const areaMap = aggregateByFeatureArea(extractChangelogData(changelogs));
  const areas = [...areaMap.entries()]
    .filter(([, items]) => items.length >= MIN_ITEMS_FOR_PAGE)
    .sort(([, a], [, b]) => b.length - a.length)
    .map(([area]) => ({
      slug: toFeatureAreaSlug(area),
      label: getFeatureAreaLabel(area),
    }));

  // docs diff entries: 新しい順
  const allDocEntries = docsDiffEntries
    .map((col) => col.data)
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

  const lines: string[] = [
    `# ${SITE_TITLE}`,
    '',
    '> A viewer for the official Claude Code CHANGELOG with Japanese translations and summaries. Browse changes by version, feature area, and official documentation diffs.',
    '',
    '## Main Pages',
    '',
    `- [Home](${site}/): Latest changelog entries`,
    `- [Feature Areas](${site}/features): Browse changelog history by feature category`,
    `- [Docs Diff](${site}/docs): Official documentation change history`,
    `- [About](${site}/about): About this service`,
    `- [Notifications](${site}/notify): Subscribe to update notifications via LINE Notify`,
    '',
    '## Changelog Versions',
    '',
  ];

  for (const entry of sortedChangelogs) {
    const v = entry.data.version;
    const summary = entry.data.summary ? `: ${entry.data.summary}` : '';
    lines.push(`- [v${v}](${site}/changelog/v${v})${summary}`);
  }

  lines.push('', '## Feature Areas', '');
  for (const { slug, label } of areas) {
    lines.push(`- [${label}](${site}/features/${slug})`);
  }

  lines.push('', '## Docs Diff', '');
  for (const entry of allDocEntries) {
    const summary = entry.aiSummary ? `: ${entry.aiSummary}` : '';
    lines.push(`- [${entry.id}](${site}/docs/${entry.id})${summary}`);
  }

  // TextEncoder でエンコードしないと Astro dev サーバーで日本語が文字化けする
  const encoder = new TextEncoder();
  return new Response(encoder.encode(lines.join('\n')), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
