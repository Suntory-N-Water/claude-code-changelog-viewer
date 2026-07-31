import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import { buildArticleNode } from '../../lib/json-ld';

export const GET: APIRoute = async ({ site }) => {
  const siteUrl =
    site?.toString().replace(/\/$/, '') ?? 'https://claude-code-log.com';

  const changelogs = await getCollection('changelog');

  const graph = changelogs.map((entry) =>
    buildArticleNode({
      siteUrl,
      title: `Claude Code v${entry.data.version} の変更点`,
      description: entry.data.summary ?? '',
      url: `${siteUrl}/changelog/v${entry.data.version}`,
      image: `${siteUrl}/og-image.png`,
    }),
  );

  const body = JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@graph': graph,
    },
    null,
    2,
  );

  return new Response(body, {
    headers: {
      'Content-Type': 'application/ld+json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
