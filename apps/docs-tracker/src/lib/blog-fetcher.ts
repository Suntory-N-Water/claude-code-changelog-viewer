import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';
import { XMLParser } from 'fast-xml-parser';
import {
  getLogger,
  type AppLogger,
} from '@claude-code-changelog-viewer/common';
import { z } from 'zod';
import { atomicWriteFile } from './atomic-write';
import { fetchWithRetry } from './fetch-with-retry';
import {
  type BlogFrontmatter,
  loadSourceFrontmatters,
  serializeSourceDocument,
} from './source-frontmatter';

type BlogFetcherConfig = {
  bodySelector: string;
  removeSelectors?: string[];
  sitemapUrl: string;
  source: BlogFrontmatter['source'];
  urlPrefix: string;
};

type BlogFetchResult = {
  discoveredCount: number;
  failedCount: number;
  newCount: number;
  source: BlogFrontmatter['source'];
};

const turndownService = new TurndownService({
  codeBlockStyle: 'fenced',
  headingStyle: 'atx',
});

turndownService.remove(['script', 'style']);

function toIsoStringOrNull(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

export class BlogFetcher {
  private readonly config: BlogFetcherConfig;
  private readonly log: AppLogger;
  private readonly parser = new XMLParser();
  private readonly rootDir: string;

  constructor(rootDir: string, config: BlogFetcherConfig) {
    this.rootDir = rootDir;
    this.config = config;
    this.log = getLogger({ name: 'docs-tracker' }).child({
      component: 'BlogFetcher',
      source: config.source,
    });
  }

  get sitemapUrl(): string {
    return this.config.sitemapUrl;
  }

  async fetchNewArticles(
    sitemapLocs?: readonly string[],
  ): Promise<BlogFetchResult> {
    const allLocs = sitemapLocs ?? (await this.fetchAllSitemapLocs());
    const urls = allLocs.filter((url) => this.isTargetArticleUrl(url));
    if (urls.length === 0) {
      throw new Error(
        `sitemap から記事 URL を 0 件しか取得できませんでした: ${this.config.sitemapUrl}`,
      );
    }

    const sourceDir = path.join(this.rootDir, 'sources', this.config.source);
    await fs.mkdir(sourceDir, { recursive: true });

    const existingRecords = await loadSourceFrontmatters(sourceDir);
    const knownUrls = new Set(existingRecords.map((record) => record.url));
    const newUrls = urls.filter((url) => !knownUrls.has(url));

    let newCount = 0;
    let failedCount = 0;
    const batchSize = 5;

    for (let index = 0; index < newUrls.length; index += batchSize) {
      const batch = newUrls.slice(index, index + batchSize);
      const results = await Promise.allSettled(
        batch.map((url) => this.fetchAndWriteArticle(url, sourceDir)),
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          newCount += 1;
          continue;
        }

        failedCount += 1;
        if (result.status === 'rejected') {
          this.log.error('blog 記事の取得に失敗しました', {
            'exception.message':
              result.reason instanceof Error
                ? result.reason.message
                : String(result.reason),
          });
        }
      }

      if (index + batchSize < newUrls.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    return {
      source: this.config.source,
      discoveredCount: urls.length,
      newCount,
      failedCount,
    };
  }

  async fetchAllSitemapLocs(): Promise<string[]> {
    const response = await fetchWithRetry({
      accept: 'application/xml, text/xml, */*',
      url: this.config.sitemapUrl,
    });
    const xml = await response.text();
    const parsed = this.parser.parse(xml);

    const rawUrls = parsed['urlset']?.['url'];
    const urlEntries = Array.isArray(rawUrls)
      ? rawUrls
      : rawUrls
        ? [rawUrls]
        : [];
    if (urlEntries.length === 0) {
      return [];
    }

    return urlEntries
      .map((item) => item?.['loc'])
      .filter((value): value is string => typeof value === 'string');
  }

  private isTargetArticleUrl(url: string): boolean {
    if (!url.startsWith(this.config.urlPrefix)) {
      return false;
    }

    const pathname = new URL(url).pathname.replace(/\/$/, '');
    const prefixPathname = new URL(this.config.urlPrefix).pathname.replace(
      /\/$/,
      '',
    );

    if (pathname === prefixPathname) {
      return false;
    }

    return pathname.startsWith(`${prefixPathname}/`);
  }

  private async fetchAndWriteArticle(
    url: string,
    sourceDir: string,
  ): Promise<boolean> {
    const response = await fetchWithRetry({
      accept: 'text/html, application/xhtml+xml, */*',
      url,
    });
    const html = await response.text();
    const article = this.extractArticle(html, url);
    const contentHash = createHash('sha256')
      .update(article.bodyMarkdown)
      .digest('hex');
    const frontmatter: BlogFrontmatter = {
      source: this.config.source,
      url,
      title: article.title,
      published_at: article.publishedAt,
      content_hash: contentHash,
      lang: 'en',
    };

    const fileName = `${article.publishedAt.slice(0, 10)}_${article.slug}.md`;
    const filePath = path.join(sourceDir, fileName);

    await atomicWriteFile(
      filePath,
      serializeSourceDocument(frontmatter, article.bodyMarkdown),
    );
    this.log.info('blog 記事を保存しました', {
      'file.path': filePath,
      'source.url': url,
    });
    return true;
  }

  private extractArticle(html: string, url: string) {
    const dom = new JSDOM(html, { url });
    const document = dom.window.document;
    const bodyRoot = document.querySelector(this.config.bodySelector);

    if (!bodyRoot) {
      throw new Error(
        `本文セレクタが見つかりませんでした: ${this.config.bodySelector}`,
      );
    }

    const clone = bodyRoot.cloneNode(true);
    if (!(clone instanceof dom.window.HTMLElement)) {
      throw new Error('本文ノードの複製に失敗しました');
    }

    for (const selector of this.config.removeSelectors ?? []) {
      for (const node of clone.querySelectorAll(selector)) {
        node.remove();
      }
    }

    for (const anchor of clone.querySelectorAll('a[href]')) {
      const href = anchor.getAttribute('href');
      if (!href) {
        continue;
      }
      anchor.setAttribute('href', new URL(href, url).toString());
    }

    const rawTitle =
      document
        .querySelector('meta[property="og:title"]')
        ?.getAttribute('content') ?? document.querySelector('h1')?.textContent;
    const title = rawTitle
      ?.replace(/\s+[|\\]\s+(Claude|Anthropic)$/, '')
      .trim();
    if (!title) {
      throw new Error('記事タイトルを取得できませんでした');
    }

    const publishedAt = this.extractPublishedAt(document);
    if (!publishedAt) {
      throw new Error('公開日時を取得できませんでした');
    }

    const bodyMarkdown = turndownService
      .turndown(clone.innerHTML)
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!bodyMarkdown) {
      throw new Error('本文 Markdown が空です');
    }

    return {
      title,
      publishedAt,
      bodyMarkdown,
      slug: this.buildSlug(url),
    };
  }

  private extractPublishedAt(document: Document): string | null {
    const metaPublishedAt =
      document
        .querySelector('meta[property="article:published_time"]')
        ?.getAttribute('content')
        ?.trim() ??
      document
        .querySelector('time[datetime]')
        ?.getAttribute('datetime')
        ?.trim();
    const metaIso = toIsoStringOrNull(metaPublishedAt);
    if (metaIso) {
      return metaIso;
    }

    for (const script of document.querySelectorAll(
      'script[type="application/ld+json"]',
    )) {
      const content = script.textContent?.trim();
      if (!content) {
        continue;
      }

      const parsedDate = this.findDatePublishedInJsonLd(content);
      if (parsedDate) {
        return parsedDate;
      }
    }

    const rawDate =
      Array.from(document.querySelectorAll('p, div, span'))
        .map((element) => element.textContent?.trim() ?? '')
        .find((text) =>
          /^Published\s+[A-Z][a-z]{2,8}\s+\d{1,2},\s+\d{4}$/.test(text),
        )
        ?.replace(/^Published\s+/, '') ??
      Array.from(document.querySelectorAll('p, div, span'))
        .map((element) => element.textContent?.trim() ?? '')
        .find((text) => /^[A-Z][a-z]{2,8}\s+\d{1,2},\s+\d{4}$/.test(text));
    return toIsoStringOrNull(rawDate);
  }

  private findDatePublishedInJsonLd(json: string): string | null {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(json);
    } catch {
      return null;
    }

    const parsed = z
      .union([z.record(z.string(), z.unknown()), z.array(z.unknown())])
      .safeParse(parsedJson);
    if (!parsed.success) {
      return null;
    }

    const stack: unknown[] = [parsed.data];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) {
        continue;
      }

      if (Array.isArray(current)) {
        stack.push(...current);
        continue;
      }

      for (const [key, value] of Object.entries(current)) {
        if (key === 'datePublished' && typeof value === 'string') {
          const iso = toIsoStringOrNull(value);
          if (iso) {
            return iso;
          }
          continue;
        }
        stack.push(value);
      }
    }

    return null;
  }

  private buildSlug(url: string): string {
    const pathname = new URL(url).pathname.replace(/\/$/, '');
    const slug = pathname.split('/').at(-1);
    if (!slug) {
      throw new Error(`slug を組み立てられませんでした: ${url}`);
    }
    return slug;
  }
}

export type { BlogFetchResult, BlogFetcherConfig };
