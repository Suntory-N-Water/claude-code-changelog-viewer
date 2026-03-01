import type { APIRoute } from 'astro';
import { SITE_TITLE } from '@/lib/constants';
import { createPngResponse, generateTopPageOgp } from '@/lib/ogp';

/**
 * トップページ用OGP画像を生成するAPIルート
 */
export const GET: APIRoute = async () => {
  const png = await generateTopPageOgp(
    SITE_TITLE,
    '更新履歴を分かりやすく表示',
  );
  return createPngResponse(png);
};
