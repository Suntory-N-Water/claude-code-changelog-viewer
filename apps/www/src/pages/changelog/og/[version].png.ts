import { getCollection } from 'astro:content';
import type { APIContext, GetStaticPaths } from 'astro';
import { SITE_TITLE } from '@/lib/constants';
import { createPngResponse, generateVersionPageOgp } from '@/lib/ogp';
import { isLegacyVersion } from '@/lib/semver';

/**
 * 静的生成用のパスを生成
 * v2.1.0 以降のバージョンのみ個別OGP画像を生成
 * それより古いバージョンはサイト共通の /og-image.png を使用
 */
export const getStaticPaths: GetStaticPaths = async () => {
  const allChangelogs = await getCollection('changelog');

  return allChangelogs
    .filter((entry) => !isLegacyVersion(entry.data.version))
    .map((entry) => ({
      params: { version: `v${entry.data.version}` },
      props: {
        version: entry.data.version,
        itemCount: entry.data.items.length,
      },
    }));
};

/**
 * バージョンページ用OGP画像を生成するAPIルート
 */
export async function GET({ props }: APIContext) {
  const { version, itemCount } = props as {
    version: string;
    itemCount: number;
  };

  const png = await generateVersionPageOgp(
    SITE_TITLE,
    `v${version}`,
    itemCount,
  );
  return createPngResponse(png);
}
