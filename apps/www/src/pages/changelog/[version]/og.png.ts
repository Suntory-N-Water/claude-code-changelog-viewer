import type { APIContext, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { generateVersionPageOgp } from '@/lib/ogp';

/**
 * 静的生成用のパスを生成
 * ビルド時に全バージョンのOGP画像を事前生成
 */
export const getStaticPaths: GetStaticPaths = async () => {
  const allChangelogs = await getCollection('changelog');

  return allChangelogs.map(
    (entry: { data: { version: string; items: unknown[] } }) => ({
      params: { version: `v${entry.data.version}` },
      props: {
        version: entry.data.version,
        itemCount: entry.data.items.length,
      },
    }),
  );
};

/**
 * バージョンページ用OGP画像を生成するAPIルート
 */
export async function GET({ props }: APIContext) {
  const { version, itemCount } = props as {
    version: string;
    itemCount: number;
  };

  const siteTitle = 'Claude Code Changelog Viewer';
  const versionLabel = `v${version}`;

  const png = await generateVersionPageOgp(siteTitle, versionLabel, itemCount);

  return new Response(Buffer.from(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
