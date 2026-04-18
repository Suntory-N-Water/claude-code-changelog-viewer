import type { APIRoute } from 'astro';

const getRobotsTxt = (sitemapURL: URL, schemamapURL: URL) => `\
User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${sitemapURL.href}
Schemamap: ${schemamapURL.href}
`;

export const GET: APIRoute = ({ site }) => {
  const sitemapURL = new URL('sitemap-index.xml', site);
  const schemamapURL = new URL('schemamap.xml', site);
  return new Response(getRobotsTxt(sitemapURL, schemamapURL));
};
