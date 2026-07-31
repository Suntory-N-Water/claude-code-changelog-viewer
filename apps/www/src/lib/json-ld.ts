import { SITE_TITLE } from './constants';

const COPYRIGHT_YEAR = 2026;

// --- 型定義 ---

export type FAQItem = {
  question: string;
  answer: string;
};

export type BreadcrumbItem = {
  name: string;
  url: string;
};

type WebSiteNodeParams = {
  siteUrl: string;
  title: string;
  description: string;
};

type WebPageNodeParams = WebSiteNodeParams & {
  url: string;
};

type ArticleNodeParams = WebPageNodeParams & {
  image: string;
  datePublished?: string;
  dateModified?: string;
};

export type JsonLdGraphParams =
  | ({ type: 'website' } & WebSiteNodeParams)
  | ({ type: 'article' } & ArticleNodeParams)
  | ({ type: 'collection' } & WebPageNodeParams)
  | ({ type: 'page' } & WebPageNodeParams);

// --- 内部ノードビルダー (@context なし・@id 付き) ---

const ABOUT_SOFTWARE = {
  '@type': 'SoftwareApplication',
  name: 'Claude Code',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'macOS, Linux, Windows',
} as const;

function buildOrganizationNode(siteUrl: string) {
  return {
    '@type': 'Organization',
    '@id': `${siteUrl}/#organization`,
    name: SITE_TITLE,
    url: siteUrl,
    publishingPrinciples: `${siteUrl}/about`,
  };
}

function buildWebSiteNode(params: WebSiteNodeParams) {
  return {
    '@type': 'WebSite',
    '@id': `${params.siteUrl}/#website`,
    name: params.title,
    url: params.siteUrl,
    description: params.description,
    inLanguage: 'ja',
    publisher: { '@id': `${params.siteUrl}/#organization` },
    copyrightHolder: { '@id': `${params.siteUrl}/#organization` },
    copyrightYear: COPYRIGHT_YEAR,
    knowsAbout: [
      'Claude Code',
      'Anthropic',
      'AI coding assistant',
      'changelog',
    ],
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${params.siteUrl}/?highlight={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

function buildWebPageNode(params: WebPageNodeParams) {
  return {
    '@type': 'WebPage',
    '@id': `${params.url}#webpage`,
    url: params.url,
    name: params.title,
    description: params.description,
    inLanguage: 'ja',
    isPartOf: { '@id': `${params.siteUrl}/#website` },
    publisher: { '@id': `${params.siteUrl}/#organization` },
  };
}

export function buildArticleNode(params: ArticleNodeParams) {
  return {
    '@type': 'TechArticle',
    '@id': `${params.url}#article`,
    headline: params.title,
    description: params.description,
    url: params.url,
    inLanguage: 'ja',
    image: params.image,
    author: { '@id': `${params.siteUrl}/#organization` },
    publisher: { '@id': `${params.siteUrl}/#organization` },
    about: ABOUT_SOFTWARE,
    isPartOf: { '@id': `${params.siteUrl}/#website` },
    ...(params.datePublished
      ? {
          datePublished: params.datePublished,
          dateModified: params.dateModified ?? params.datePublished,
        }
      : {}),
  };
}

function buildCollectionPageNode(params: WebPageNodeParams) {
  return {
    '@type': 'CollectionPage',
    '@id': `${params.url}#webpage`,
    url: params.url,
    name: params.title,
    description: params.description,
    inLanguage: 'ja',
    isPartOf: { '@id': `${params.siteUrl}/#website` },
    publisher: { '@id': `${params.siteUrl}/#organization` },
    about: ABOUT_SOFTWARE,
  };
}

function buildBreadcrumbNode(items: BreadcrumbItem[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

function buildFAQNode(items: FAQItem[]) {
  return {
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

// --- 公開 API: 単一 @graph を返す ---

export function generateGraphJsonLd(
  params: JsonLdGraphParams,
  breadcrumbs?: BreadcrumbItem[],
  faqItems?: FAQItem[],
): object {
  const graph: object[] = [];

  graph.push(buildOrganizationNode(params.siteUrl));

  if (params.type === 'website') {
    graph.push(buildWebSiteNode(params));
    if (faqItems && faqItems.length > 0) {
      graph.push(buildFAQNode(faqItems));
    }
  } else if (params.type === 'article') {
    graph.push(
      buildWebSiteNode({
        siteUrl: params.siteUrl,
        title: SITE_TITLE,
        description: '',
      }),
    );
    graph.push(buildArticleNode(params));
  } else if (params.type === 'collection') {
    graph.push(
      buildWebSiteNode({
        siteUrl: params.siteUrl,
        title: SITE_TITLE,
        description: '',
      }),
    );
    graph.push(buildCollectionPageNode(params));
  } else {
    graph.push(
      buildWebSiteNode({
        siteUrl: params.siteUrl,
        title: SITE_TITLE,
        description: '',
      }),
    );
    graph.push(buildWebPageNode(params));
  }

  if (breadcrumbs && breadcrumbs.length > 0) {
    graph.push(buildBreadcrumbNode(breadcrumbs));
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}
