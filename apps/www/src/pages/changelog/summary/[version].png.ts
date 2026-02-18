import { getCollection } from 'astro:content';
import type { ChangelogItem } from '@claude-code-changelog-viewer/types';
import type { APIContext, GetStaticPaths } from 'astro';
import { generateTwitterChangelogImage } from '@/lib/ogp';

/**
 * 静的生成用のパスを生成
 * summaryが存在するバージョンのみ対象
 */
export const getStaticPaths: GetStaticPaths = async () => {
  const allChangelogs = await getCollection('changelog');

  return allChangelogs
    .filter((entry) => !!entry.data.summary)
    .map((entry) => ({
      params: { version: `v${entry.data.version}` },
      props: {
        version: entry.data.version,
        summary: entry.data.summary as string,
        items: entry.data.items as ChangelogItem[],
      },
    }));
};

/**
 * 投稿用画像を生成するAPIルート
 */
export async function GET({ props }: APIContext) {
  const { version, summary, items } = props as {
    version: string;
    summary: string;
    items: ChangelogItem[];
  };

  const siteTitle = 'Claude Code Changelog Viewer';

  const png = await generateTwitterChangelogImage(
    siteTitle,
    version,
    summary,
    items,
  );

  return new Response(Buffer.from(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
