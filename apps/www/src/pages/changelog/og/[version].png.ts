import { getCollection } from 'astro:content';
import type { APIContext, GetStaticPaths } from 'astro';
import { SITE_TITLE } from '@/lib/constants';
import { createPngResponse, generateVersionPageOgp } from '@/lib/ogp';

/**
 * 静的生成用のパスを生成
 * ビルド時に全バージョンのOGP画像を事前生成
 */
export const getStaticPaths: GetStaticPaths = async () => {
  const allChangelogs = await getCollection('changelog');

  return allChangelogs.map((entry) => ({
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
