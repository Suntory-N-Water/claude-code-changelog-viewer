import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { SITE_TITLE } from '../lib/constants';
import { sortDocsDiffEntries } from '../lib/docs-diff';
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

  const [changelogs, docsDiffEntries, posts, columns, settings] =
    await Promise.all([
      getCollection('changelog'),
      getCollection('docsDiff'),
      getCollection('postsWeekly'),
      getCollection('column'),
      getCollection('settingsReference'),
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
  const allDocEntries = sortDocsDiffEntries(docsDiffEntries);

  // 週次まとめ・コラム: 投稿日降順
  const weeklyPosts = [...posts].sort((a, b) =>
    b.data.date.localeCompare(a.data.date),
  );
  const columnPosts = [...columns].sort((a, b) =>
    b.data.date.localeCompare(a.data.date),
  );

  // 設定リファレンス: key 昇順(settings → env)
  const sortedSettings = [...settings].sort((a, b) => {
    if (a.data.source !== b.data.source) {
      return a.data.source === 'settings' ? -1 : 1;
    }
    return a.data.key.localeCompare(b.data.key);
  });

  const lines: string[] = [
    `# ${SITE_TITLE}`,
    '',
    '> A viewer for the official Claude Code CHANGELOG with Japanese translations and summaries. Browse changes by version, feature area, and official documentation diffs.',
    '',
    '## Main Pages',
    '',
    `- [Home](${site}/): Latest changelog entries`,
    `- [Feature Areas](${site}/features): Browse changelog history by feature category`,
    `- [Weekly Posts](${site}/posts/weekly): Weekly roundups of notable Claude Code updates`,
    `- [Columns](${site}/posts/column): Hands-on articles about using and operating Claude Code`,
    `- [Settings Reference](${site}/reference/settings): Look up Claude Code settings and environment variables`,
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

  lines.push('', '## Weekly Posts', '');
  for (const entry of weeklyPosts) {
    const slug = entry.id.split('/').pop();
    const summary = entry.data.description ? `: ${entry.data.description}` : '';
    lines.push(
      `- [${entry.data.title}](${site}/posts/weekly/${slug})${summary}`,
    );
  }

  lines.push('', '## Columns', '');
  for (const entry of columnPosts) {
    lines.push(
      `- [${entry.data.title}](${site}/posts/column/${entry.data.slug}): ${entry.data.description}`,
    );
  }

  lines.push('', '## Settings Reference', '');
  for (const entry of sortedSettings) {
    const summary = entry.data.description_ja
      ? `: ${entry.data.description_ja}`
      : '';
    lines.push(
      `- [${entry.data.key}](${site}/reference/settings/${entry.data.slug})${summary}`,
    );
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
