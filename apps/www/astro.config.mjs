// @ts-check

import sitemap, { ChangeFreqEnum } from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import pagefind from 'astro-pagefind';
import { seoValidate } from './src/integrations/seo-validate.ts';

// GitHub Releases の公開日時キャッシュ(ビルド中に1回だけ fetch)
/** @type {Map<string, string> | null} */
let releaseMap = null;

/** @returns {Promise<Map<string, string>>} */
async function getReleaseMap() {
  if (releaseMap) {
    return releaseMap;
  }
  try {
    const res = await fetch(
      'https://api.github.com/repos/anthropics/claude-code/releases?per_page=100',
      { headers: { 'User-Agent': 'claude-code-changelog-viewer' } },
    );
    if (!res.ok) {
      throw new Error(`GitHub API: ${res.status}`);
    }
    /** @type {Array<{ tag_name: string; published_at: string }>} */
    const releases = await res.json();
    releaseMap = new Map(
      releases.map((r) => [r.tag_name.replace(/^v/, ''), r.published_at]),
    );
  } catch (e) {
    console.warn('[sitemap] GitHub API fetch failed:', e);
    releaseMap = new Map();
  }
  return releaseMap;
}

// https://astro.build/config
export default defineConfig({
  trailingSlash: 'never',
  build: { format: 'file' },
  site: 'https://claude-code-log.com',
  cacheDir: './node_modules/.astro',
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      exclude: ['@resvg/resvg-js'],
    },
    ssr: {
      noExternal: ['satori'],
      external: ['@resvg/resvg-js'],
    },
  },
  output: 'static',
  integrations: [
    sitemap({
      // OG 画像・RSS・llms.txt・robots.txt 等を除外
      filter: (page) => {
        const path = new URL(page).pathname;
        if (path.match(/\.(png|xml|txt)$/)) {
          return false;
        }
        if (path.startsWith('/schema/')) {
          return false;
        }
        return true;
      },
      // changefreq・priority・lastmod を付与
      serialize: async (item) => {
        const path = new URL(item.url).pathname;

        // changelog バージョンページ: GitHub Release の公開日時を lastmod に
        const versionMatch = path.match(/^\/changelog\/v([\d.]+)$/);
        if (versionMatch) {
          const map = await getReleaseMap();
          const published = map.get(versionMatch[1]);
          return {
            ...item,
            changefreq: ChangeFreqEnum.MONTHLY,
            priority: 0.8,
            ...(published ? { lastmod: published } : {}),
          };
        }

        if (path === '/') {
          return { ...item, changefreq: ChangeFreqEnum.DAILY, priority: 1.0 };
        }
        if (path.startsWith('/features')) {
          return { ...item, changefreq: ChangeFreqEnum.WEEKLY, priority: 0.7 };
        }
        if (path.startsWith('/docs')) {
          return { ...item, changefreq: ChangeFreqEnum.WEEKLY, priority: 0.6 };
        }
        return { ...item, changefreq: ChangeFreqEnum.MONTHLY, priority: 0.5 };
      },
    }),
    pagefind(),
    seoValidate({ failOnError: false }),
  ],
});
