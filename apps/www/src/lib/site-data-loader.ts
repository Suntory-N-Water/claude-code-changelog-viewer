import { getOfficialDocUrl } from '@claude-code-changelog-viewer/common';
import type { Loader } from 'astro/loaders';

const SITE_DATA_ORIGIN =
  process.env.SITE_DATA_ORIGIN ?? 'https://claude-code-log.com';

type ChangelogResponse = {
  versions: {
    version: string;
    summary?: string;
    items: {
      id: string;
      content: string;
      content_ja?: string;
      prefix: string;
      feature_areas: string[];
      related_docs: { doc_path: string }[];
      inference?: {
        before: string;
        after: string;
        benefit: string;
      };
    }[];
  }[];
};

type SettingsResponse = {
  settings: {
    key: string;
    leaf_name?: string;
    slug: string;
    source: 'settings' | 'env';
    description_en: string;
    description_ja: string;
    use_case_ja?: string;
    value_type?: string;
    default_value?: string;
    fetched_at: string;
    official_docs: { doc_path: string }[];
  }[];
};

type DiffResponse = {
  events: {
    detected_at: string;
    version: string;
    type: 'items_changed' | 'version_removed';
    items_added: string[];
    items_removed: string[];
  }[];
};

async function fetchSiteData<T>(path: string): Promise<T> {
  const response = await fetch(new URL(path, SITE_DATA_ORIGIN));
  if (!response.ok) {
    throw new Error(
      `サイトデータの取得に失敗しました: HTTP ${response.status}`,
    );
  }
  return (await response.json()) as T;
}

export const changelogLoader: Loader = {
  name: 'site-data-changelog',
  async load({ store, parseData }) {
    if (process.env.SITE_DATA_SKIP_FETCH) {
      console.warn(
        'SITE_DATA_SKIP_FETCH が設定されているため、サイトデータの取得を省略します',
      );
      return;
    }

    store.clear();
    const response = await fetchSiteData<ChangelogResponse>(
      '/api/site-data/changelog',
    );
    for (const version of response.versions) {
      const id = `v${version.version}`;
      const data = await parseData({
        id,
        data: {
          version: version.version,
          ...(version.summary === undefined
            ? {}
            : { summary: version.summary }),
          items: version.items.map((item) => ({
            id: item.id,
            content: item.content,
            ...(item.content_ja === undefined
              ? {}
              : { content_ja: item.content_ja }),
            prefix: item.prefix,
            feature_areas: item.feature_areas,
            related_docs: item.related_docs.map(({ doc_path }) => ({
              file: `docs/en/${doc_path}`,
            })),
            ...(item.inference === undefined
              ? {}
              : { inference: item.inference }),
          })),
        },
      });
      store.set({ id, data });
    }
  },
};

export const settingsReferenceLoader: Loader = {
  name: 'site-data-settings-reference',
  async load({ store, parseData }) {
    if (process.env.SITE_DATA_SKIP_FETCH) {
      console.warn(
        'SITE_DATA_SKIP_FETCH が設定されているため、サイトデータの取得を省略します',
      );
      return;
    }

    store.clear();
    const response = await fetchSiteData<SettingsResponse>(
      '/api/site-data/settings',
    );

    for (const setting of response.settings) {
      const { official_docs: officialDocs, ...dataWithoutDocs } = setting;
      const data = await parseData({
        id: setting.slug,
        data: {
          ...dataWithoutDocs,
          official_doc_urls: officialDocs.map(({ doc_path }) =>
            getOfficialDocUrl(`docs/en/${doc_path}`),
          ),
        },
      });
      store.set({ id: setting.slug, data });
    }
  },
};

export const diffLoader: Loader = {
  name: 'site-data-diff',
  async load({ store, parseData }) {
    if (process.env.SITE_DATA_SKIP_FETCH) {
      console.warn(
        'SITE_DATA_SKIP_FETCH が設定されているため、サイトデータの取得を省略します',
      );
      return;
    }

    store.clear();
    const response = await fetchSiteData<DiffResponse>('/api/site-data/diff');

    for (const event of response.events) {
      const id = `${event.version}-${event.detected_at}`;
      const data = await parseData({ id, data: event });
      store.set({ id, data });
    }
  },
};
