import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { SITE_TITLE } from '@/lib/constants';
import {
  aggregateByFeatureArea,
  extractChangelogData,
  getFeatureAreaLabel,
  MIN_ITEMS_FOR_PAGE,
  toFeatureAreaSlug,
} from '@/lib/feature-area';
import { createPngResponse, generateFeatureAreaOgp } from '@/lib/ogp';

export const prerender = false;

export async function GET({ params, request, locals }: APIContext) {
  const areaParam = params.area;
  if (!areaParam) {
    return new Response('Bad Request', { status: 400 });
  }

  const cache = caches.default;
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  const allChangelogs = await getCollection('changelog');
  const areaMap = aggregateByFeatureArea(extractChangelogData(allChangelogs));

  const matchedEntry = [...areaMap.entries()].find(
    ([area]) => toFeatureAreaSlug(area) === areaParam,
  );

  if (!matchedEntry || matchedEntry[1].length < MIN_ITEMS_FOR_PAGE) {
    return new Response('Not Found', { status: 404 });
  }

  const [featureArea, items] = matchedEntry;
  const areaLabel = getFeatureAreaLabel(featureArea);
  const itemCount = items.length;
  const versionCount = new Set(items.map((i) => i.version)).size;

  const png = await generateFeatureAreaOgp(SITE_TITLE, areaLabel, {
    itemCount,
    versionCount,
  });
  const response = createPngResponse(png);

  locals.cfContext.waitUntil(cache.put(request, response.clone()));

  return response;
}
