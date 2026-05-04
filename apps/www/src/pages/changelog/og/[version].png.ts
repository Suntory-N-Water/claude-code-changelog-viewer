import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { SITE_TITLE } from '@/lib/constants';
import { createPngResponse, generateVersionPageOgp } from '@/lib/ogp';

export const prerender = false;

export async function GET({ params }: APIContext) {
  const versionParam = params.version;
  if (!versionParam) {
    return new Response('Bad Request', { status: 400 });
  }

  const versionNumber = versionParam.replace(/^v/, '');

  const allChangelogs = await getCollection('changelog');
  const entry = allChangelogs.find((e) => e.data.version === versionNumber);

  if (!entry) {
    return new Response('Not Found', { status: 404 });
  }

  const png = await generateVersionPageOgp(
    SITE_TITLE,
    `v${entry.data.version}`,
    entry.data.items.length,
  );
  return createPngResponse(png);
}
