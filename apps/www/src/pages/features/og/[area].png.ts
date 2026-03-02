import { getCollection } from 'astro:content';
import type { APIContext, GetStaticPaths } from 'astro';
import {
  MIN_ITEMS_FOR_PAGE,
  aggregateByFeatureArea,
  getFeatureAreaLabel,
  toFeatureAreaSlug,
} from '@/lib/feature-area';
import { SITE_TITLE } from '@/lib/constants';
import { createPngResponse, generateFeatureAreaOgp } from '@/lib/ogp';

export const getStaticPaths: GetStaticPaths = async () => {
  const allChangelogs = await getCollection('changelog');
  const data = allChangelogs.map((e) => ({
    version: e.data.version,
    items: e.data.items,
  }));
  const areaMap = aggregateByFeatureArea(data);

  return [...areaMap.entries()]
    .filter(([, items]) => items.length >= MIN_ITEMS_FOR_PAGE)
    .map(([area, items]) => {
      const versionSet = new Set(items.map((i) => i.version));
      return {
        params: { area: toFeatureAreaSlug(area) },
        props: {
          areaLabel: getFeatureAreaLabel(area),
          itemCount: items.length,
          versionCount: versionSet.size,
        },
      };
    });
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
