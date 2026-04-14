import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const siteUrl =
    site?.toString().replace(/\/$/, '') ?? 'https://claude-code-log.com';

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<schemamapindex>
  <schemamap>
    <loc>${siteUrl}/schema/changelog.json</loc>
    <type>application/ld+json</type>
    <description>Claude Code changelog JSON-LD graph - all version entries</description>
  </schemamap>
</schemamapindex>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=86400',
    },
  });
};
