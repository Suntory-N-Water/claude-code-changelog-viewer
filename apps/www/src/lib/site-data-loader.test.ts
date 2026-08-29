import { describe, expect, test, vi } from 'vitest';
import {
  changelogLoader,
  diffLoader,
  settingsReferenceLoader,
} from './site-data-loader';

function createLoaderContext() {
  const entries = new Map<string, unknown>();
  const store = {
    clear: vi.fn(() => entries.clear()),
    set: vi.fn(({ id, data }: { id: string; data: unknown }) => {
      entries.set(id, data);
    }),
  };
  const parseData = vi.fn(({ data }: { data: unknown }) =>
    Promise.resolve(data),
  );
  return { entries, store, parseData };
}

describe('site data loader', () => {
  test('changelog の全件を1回のリクエストで読み込む', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          versions: [
            {
              version: '1.0.0',
              items: [],
            },
            {
              version: '1.0.1',
              items: [],
            },
          ],
        }),
      ),
    );
    const context = createLoaderContext();

    await changelogLoader.load(context as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.map(([request]) => String(request))).toEqual([
      'https://claude-code-log.com/api/site-data/changelog',
    ]);
    expect([...context.entries.keys()]).toEqual(['v1.0.0', 'v1.0.1']);
    fetchMock.mockRestore();
  });

  test('doc_path から related_docs.file と official_doc_urls を復元する', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          versions: [
            {
              version: '1.0.0',
              items: [
                {
                  id: 'aaaaaaaaaaaa',
                  content: '- Added item',
                  prefix: 'Added',
                  feature_areas: [],
                  related_docs: [{ doc_path: 'hooks.md' }],
                },
              ],
            },
          ],
        }),
      ),
    );
    const changelogContext = createLoaderContext();
    await changelogLoader.load(changelogContext as never);

    expect(changelogContext.entries.get('v1.0.0')).toEqual({
      version: '1.0.0',
      items: [
        {
          id: 'aaaaaaaaaaaa',
          content: '- Added item',
          prefix: 'Added',
          feature_areas: [],
          related_docs: [{ file: 'docs/en/hooks.md' }],
        },
      ],
    });

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          settings: [
            {
              key: 'model',
              slug: 'model',
              source: 'settings',
              description_en: 'Model',
              description_ja: 'モデル',
              fetched_at: '2026-08-16',
              official_docs: [{ doc_path: 'model-config' }],
            },
          ],
        }),
      ),
    );
    const settingsContext = createLoaderContext();
    await settingsReferenceLoader.load(settingsContext as never);

    expect(settingsContext.entries.get('model')).toEqual({
      key: 'model',
      slug: 'model',
      source: 'settings',
      description_en: 'Model',
      description_ja: 'モデル',
      fetched_at: '2026-08-16',
      official_doc_urls: ['https://code.claude.com/docs/en/model-config'],
    });
    fetchMock.mockRestore();
  });

  test('取得に失敗したら例外を投げる', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(new Response('失敗', { status: 503 }));
    const context = createLoaderContext();

    await expect(
      settingsReferenceLoader.load(context as never),
    ).rejects.toThrow('HTTP 503');
    fetchMock.mockRestore();
  });

  test('SITE_DATA_SKIP_FETCH が設定されている時、全 loader の取得を省略する', async () => {
    const original = process.env.SITE_DATA_SKIP_FETCH;
    process.env.SITE_DATA_SKIP_FETCH = '1';
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const warnMock = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      await changelogLoader.load(createLoaderContext() as never);
      await settingsReferenceLoader.load(createLoaderContext() as never);
      await diffLoader.load(createLoaderContext() as never);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(warnMock).toHaveBeenCalledTimes(3);
    } finally {
      if (original === undefined) {
        delete process.env.SITE_DATA_SKIP_FETCH;
      } else {
        process.env.SITE_DATA_SKIP_FETCH = original;
      }
      fetchMock.mockRestore();
      warnMock.mockRestore();
    }
  });
});
