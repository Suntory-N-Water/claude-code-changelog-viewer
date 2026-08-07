// @ts-check

import { readFileSync } from 'node:fs';
import { unified } from '@astrojs/markdown-remark';
import sitemap, { ChangeFreqEnum } from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import astroExpressiveCode from 'astro-expressive-code';
import pagefind from 'astro-pagefind';
import { remarkAlert } from 'remark-github-blockquote-alert';
import remarkLinkCardPlus from 'remark-link-card-plus';
import { seoValidate } from './src/integrations/seo-validate.ts';
import { getReleaseMap } from './src/lib/release-map.ts';

// 週次記事の本文中で段落単独の URL をリンクカード化する。
// リンク先の OG 画像を使い、取得できない/相対パスのときだけプレースホルダーにフォールバックする。
// 自サイトの OG 画像を使うと他サイトのカードが自サイトの記事に見えるため、専用の画像を置いている。
const commonThumbnail = 'https://claude-code-log.com/link-card-placeholder.svg';

// remark-link-card-plus はリンク先サイトが返す og:image/favicon を
// `<img src="...">` へエスケープなしで埋め込む。href は javascript: や data: など
// opaque scheme では `"` をエンコードしない。
/**
 * @param {string | undefined} value
 * @param {string | URL} [base]
 */
const toNormalizedUrl = (value, base) => {
  if (!value) {
    return;
  }
  try {
    const normalized = new URL(value, base).href;
    return /["'<>`]/.test(normalized) ? undefined : normalized;
  } catch {
    return;
  }
};

const linkCardOptions = {
  shortenUrl: true,
  /**
   * @param {import('remark-link-card-plus').OgData} og
   * @param {URL} url
   */
  ogTransformer: (og, url) => ({
    ...og,
    imageUrl: toNormalizedUrl(og.imageUrl) ?? commonThumbnail,
    faviconUrl: toNormalizedUrl(og.faviconUrl, url.origin),
  }),
};

const rootPkg = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf-8'),
);
const appVersion = rootPkg.version;

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
      remarkPlugins: [remarkAlert, [remarkLinkCardPlus, linkCardOptions]],
    }),
  },
  integrations: [
    astroExpressiveCode({
      themes: ['github-dark'],
      defaultProps: { wrap: true },
      styleOverrides: {
        borderColor: 'hsl(var(--cc-main-black) / 0.22)',
        borderRadius: '0.75rem',
        borderWidth: '1px',
        codeFontSize: '0.8125rem',
        codeLineHeight: '1.7',
        codePaddingBlock: '1rem',
        codePaddingInline: '1rem',
        focusBorder: 'hsl(var(--cc-main-orange))',
        frames: {
          frameBoxShadowCssValue: 'none',
          inlineButtonBackground: 'hsl(var(--cc-main-white))',
          inlineButtonBackgroundIdleOpacity: '0.12',
          inlineButtonBorder: 'hsl(var(--cc-main-white))',
          inlineButtonBorderOpacity: '0.55',
          inlineButtonForeground: 'hsl(var(--cc-main-white))',
          tooltipSuccessBackground: 'hsl(var(--cc-link-orange))',
          tooltipSuccessForeground: 'hsl(var(--cc-main-white))',
        },
      },
    }),
    sitemap({
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
        if (path.startsWith('/posts')) {
          return { ...item, changefreq: ChangeFreqEnum.WEEKLY, priority: 0.7 };
        }
        if (path.startsWith('/features')) {
          return { ...item, changefreq: ChangeFreqEnum.WEEKLY, priority: 0.7 };
        }
        return { ...item, changefreq: ChangeFreqEnum.MONTHLY, priority: 0.5 };
      },
    }),
    pagefind(),
    seoValidate({ failOnError: false }),
  ],
});
