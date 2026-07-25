#!/usr/bin/env node

import { getLogger, toError } from '@claude-code-changelog-viewer/common';
import { BlogFetcher } from './lib/blog-fetcher';

const logger = getLogger({ name: 'docs-tracker' });

async function main() {
  const rootDir = process.cwd();
  const fetchers = [
    new BlogFetcher(rootDir, {
      source: 'claude-blog',
      sitemapUrl: 'https://claude.com/sitemap.xml',
      urlPrefix: 'https://claude.com/blog/',
      bodySelector: '.blog_post_content_wrap .u-rich-text-blog',
      removeSelectors: ['script', 'style', '.w-embed'],
    }),
    new BlogFetcher(rootDir, {
      source: 'anthropic-news',
      sitemapUrl: 'https://www.anthropic.com/sitemap.xml',
      urlPrefix: 'https://www.anthropic.com/news/',
      // CSS Modules のハッシュ付きクラス名はビルドごとに変わるため使わない。
      // 記事ページでは、内側に article を持たない article が本文コンテナ 1 つだけになる。
      bodySelector: 'article:not(:has(article))',
      removeSelectors: ['script', 'style', 'figure img'],
    }),
    new BlogFetcher(rootDir, {
      source: 'anthropic-engineering',
      sitemapUrl: 'https://www.anthropic.com/sitemap.xml',
      urlPrefix: 'https://www.anthropic.com/engineering/',
      bodySelector: 'article:not(:has(article))',
      removeSelectors: ['script', 'style', 'figure img'],
    }),
  ];

  // 同一 sitemap URL を共有する fetcher (anthropic-news / anthropic-engineering) で
  // 重複 HTTP 取得を避けるため、URL ごとに 1 回だけ取得して結果を共有する。
  const sitemapByUrl = new Map<string, Promise<string[]>>();
  const results = await Promise.allSettled(
    fetchers.map((fetcher) => {
      let cached = sitemapByUrl.get(fetcher.sitemapUrl);
      if (!cached) {
        cached = fetcher.fetchAllSitemapLocs();
        sitemapByUrl.set(fetcher.sitemapUrl, cached);
      }
      return cached.then((locs) => fetcher.fetchNewArticles(locs));
    }),
  );

  let shouldFail = false;
  for (const result of results) {
    if (result.status === 'fulfilled') {
      logger.info('blog source の取得が完了しました', result.value);
      continue;
    }

    shouldFail = true;
    logger.error('blog source の取得に失敗しました', {
      'exception.message':
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason),
    });
  }

  process.exit(shouldFail ? 1 : 0);
}

void main().catch((error) => {
  logger.error('fetch-blog の実行に失敗しました', toError(error));
  process.exit(1);
});
