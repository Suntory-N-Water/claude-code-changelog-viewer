// @ts-check

import { readFileSync } from 'node:fs';
import { unified } from '@astrojs/markdown-remark';
import sitemap, { ChangeFreqEnum } from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import pagefind from 'astro-pagefind';
import remarkLinkCardPlus from 'remark-link-card-plus';
import { seoValidate } from './src/integrations/seo-validate.ts';
import { getReleaseMap } from './src/lib/release-map.ts';

// 週次記事の本文中で段落単独の URL をリンクカード化する。
// リンク先の OG 画像を使い、取得できない/相対パスのときだけプレースホルダーにフォールバックする。
// 自サイトの OG 画像を使うと他サイトのカードが自サイトの記事に見えるため、専用の画像を置いている。
const commonThumbnail = 'https://claude-code-log.com/link-card-placeholder.svg';
const linkCardOptions = {
  shortenUrl: true,
  /** @param {import('remark-link-card-plus').OgData} og */
  ogTransformer: (og) => ({
    ...og,
    imageUrl:
      og.imageUrl && URL.canParse(og.imageUrl) ? og.imageUrl : commonThumbnail,
  }),
};

// ルート package.json からアプリバージョンを取得
const rootPkg = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf-8'),
);
const appVersion = rootPkg.version;

// https://astro.build/config
export default defineConfig({
  trailingSlash: 'never',
  build: { format: 'file' },
  site: 'https://claude-code-log.com',
  cacheDir: './node_modules/.astro',
  vite: {
    plugins: [tailwindcss()],
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
  },
  output: 'static',
  markdown: {
    processor: unified({
      remarkPlugins: [[remarkLinkCardPlus, linkCardOptions]],
    }),
  },
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
        if (path.startsWith('/admin/')) {
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
        if (path === '/changelog') {
          return { ...item, changefreq: ChangeFreqEnum.DAILY, priority: 0.9 };
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
