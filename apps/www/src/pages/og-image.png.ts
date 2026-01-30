import type { APIRoute } from 'astro';
import { generateTopPageOgp } from '@/lib/ogp';

/**
 * トップページ用OGP画像を生成するAPIルート
 */
export const GET: APIRoute = async () => {
  const title = 'Claude Code Changelog Viewer';
  const description = '更新履歴を分かりやすく表示';

  const png = await generateTopPageOgp(title, description);

  return new Response(Buffer.from(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
