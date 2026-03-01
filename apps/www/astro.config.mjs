// @ts-check

import partytown from '@astrojs/partytown';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
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
    sitemap(),
    partytown({
      config: {
        forward: ['dataLayer.push'],
      },
    }),
  ],
});
