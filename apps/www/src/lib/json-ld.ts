import { SITE_TITLE } from './constants';

type WebSiteParams = {
  siteUrl: string;
  title: string;
  description: string;
};

type ArticleParams = {
  siteUrl: string;
  title: string;
  description: string;
  url: string;
  version: string;
};

type BreadcrumbItem = {
  name: string;
  url: string;
};

function createPublisher(siteUrl: string) {
  return { '@type': 'Organization', name: SITE_TITLE, url: siteUrl } as const;
}

const ABOUT_SOFTWARE = {
  '@type': 'SoftwareApplication',
  name: 'Claude Code',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'macOS, Linux, Windows',
} as const;

export function generateWebSiteJsonLd(params: WebSiteParams): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: params.title,
    url: params.siteUrl,
    description: params.description,
    inLanguage: 'ja',
    publisher: createPublisher(params.siteUrl),
  };
}

export function generateArticleJsonLd(params: ArticleParams): object {
  const publisher = createPublisher(params.siteUrl);
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: params.title,
    description: params.description,
    url: params.url,
    inLanguage: 'ja',
    image: `${params.siteUrl}/changelog/og/v${params.version}.png`,
    author: publisher,
    publisher,
    about: ABOUT_SOFTWARE,
  };
}

type FAQItem = {
  question: string;
  answer: string;
};

export function generateFAQJsonLd(items: FAQItem[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

type CollectionPageParams = {
  siteUrl: string;
  title: string;
  description: string;
  url: string;
};

export function generateCollectionPageJsonLd(
  params: CollectionPageParams,
): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: params.title,
    description: params.description,
    url: params.url,
    inLanguage: 'ja',
    publisher: createPublisher(params.siteUrl),
    about: ABOUT_SOFTWARE,
  };
}

export function generateBreadcrumbJsonLd(items: BreadcrumbItem[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
