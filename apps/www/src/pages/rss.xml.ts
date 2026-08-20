import { getCollection } from 'astro:content';
import type { InferredChangelogItem } from '@claude-code-changelog-viewer/types';
import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { SITE_TITLE } from '../lib/constants';
import { semverCompareDesc } from '../lib/semver';

/** inference 情報を含む HTML コンテンツを生成 */
function buildContentHtml(
  item: Pick<InferredChangelogItem, 'content' | 'content_ja' | 'inference'>,
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

/**
 * @astrojs/rss は content をエンティティエスケープで出力するが、
 * content:encoded は CDATA セクションで囲むのが慣例。
 * エスケープ済みの content:encoded を CDATA 形式に変換する。
 */
function convertContentToCdata(xml: string): string {
  return xml.replace(
    /<content:encoded>([\s\S]*?)<\/content:encoded>/g,
    (_match, escaped: string) => {
      const html = escaped
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&');
      return `<content:encoded><![CDATA[${html}]]></content:encoded>`;
    },
  );
}

export async function GET(context: APIContext) {
  const changelogs = await getCollection('changelog');
  const pubDate = new Date();

  const sorted = changelogs.sort((a, b) =>
    semverCompareDesc(a.data.version, b.data.version),
  );
  const latest = sorted.slice(0, 5);

  const items = latest.flatMap((entry) => {
    const version = entry.data.version;
    return entry.data.items.map((item) => ({
      title: `[v${version}] [${item.prefix}] ${item.content_ja ?? item.content}`,
      link: `${context.site}changelog/v${version}#item-${item.id}`,
      pubDate,
      description: item.content_ja ?? item.content,
      content: buildContentHtml(item, version),
    }));
  });

  const response = await rss({
    title: SITE_TITLE,
    description: 'Claude Code の更新履歴',
    site: context.site ?? '',
    items,
    customData: '<language>ja</language>',
  });

  const xml = await response.text();
  return new Response(convertContentToCdata(xml), {
    headers: response.headers,
  });
}
