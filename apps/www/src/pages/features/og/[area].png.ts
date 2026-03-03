import { getCollection } from 'astro:content';
import type { APIContext, GetStaticPaths } from 'astro';
import {
  MIN_ITEMS_FOR_PAGE,
  aggregateByFeatureArea,
  extractChangelogData,
  getFeatureAreaLabel,
  toFeatureAreaSlug,
} from '@/lib/feature-area';
import { SITE_TITLE } from '@/lib/constants';
import { createPngResponse, generateFeatureAreaOgp } from '@/lib/ogp';

export const getStaticPaths: GetStaticPaths = async () => {
  const allChangelogs = await getCollection('changelog');
  const areaMap = aggregateByFeatureArea(extractChangelogData(allChangelogs));

  return [...areaMap.entries()]
    .filter(([, items]) => items.length >= MIN_ITEMS_FOR_PAGE)
    .map(([area, items]) => ({
      params: { area: toFeatureAreaSlug(area) },
      props: {
        areaLabel: getFeatureAreaLabel(area),
        itemCount: items.length,
        versionCount: new Set(items.map((i) => i.version)).size,
      },
    }));
};

export async function GET({ props }: APIContext) {
  const { areaLabel, itemCount, versionCount } = props as {
    areaLabel: string;
    itemCount: number;
    versionCount: number;
  };

  const png = await generateFeatureAreaOgp(
    SITE_TITLE,
    areaLabel,
    itemCount,
    versionCount,
  );
  return createPngResponse(png);
}
