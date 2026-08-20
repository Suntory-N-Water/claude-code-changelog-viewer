import { describe, expect, it, vi } from 'vitest';

// index.ts 経由で cloudflare:email が import され Node では解決できないためモックする
vi.mock('../infrastructure/channel-notifier', () => ({
  createChannelNotifier: () => ({
    sendTestNotification: vi.fn(),
    sendChangelogNotification: vi.fn(),
    sendUnsubscribeNotification: vi.fn(),
  }),
}));

import type {
  IngestChangelogDiffEvent,
  IngestChangelogVersion,
  IngestSetting,
} from '@claude-code-changelog-viewer/types';
import { app } from '../index';
import { FakeD1Database } from '../test-support/fake-d1';
import { createTestEnv } from '../test-support/notification-test-support';

async function seed(
  db: FakeD1Database,
  data: {
    versions?: IngestChangelogVersion[];
    settings?: IngestSetting[];
    diff_events?: IngestChangelogDiffEvent[];
  },
) {
  const response = await app.request(
    '/api/ingest/changelog',
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer dispatch-secret',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    },
    createTestEnv(db),
  );
  expect(response.status).toBe(200);
}

function createVersion(
  version: string,
  items: IngestChangelogVersion['items'],
): IngestChangelogVersion {
  return { version, items };
}

const firstItem = {
  id: 'aaaaaaaaaaaa',
  content: '- Added first item',
  prefix: 'Added',
  feature_areas: ['Settings', 'Model'],
  related_docs: [
    { file: 'apps/docs-tracker/docs/en/zeta.md' },
    { file: 'apps/docs-tracker/docs/en/alpha.md' },
  ],
};

const secondItem = {
  id: 'bbbbbbbbbbbb',
  content: '- Fixed second item',
  prefix: 'Fixed',
  feature_areas: ['Permissions'],
  related_docs: [{ file: 'apps/docs-tracker/docs/en/permissions.md' }],
};

describe('GET /api/site-data integration', () => {
  it('全バージョンと item の関連データを返すこと', async () => {
    const db = new FakeD1Database();
    await seed(db, {
      versions: [
        createVersion('1.0.0', [firstItem, secondItem]),
        createVersion('1.0.1', [
          {
            id: 'cccccccccccc',
            content: '- Added third item',
            prefix: 'Added',
            feature_areas: ['CLI'],
            related_docs: [{ file: 'apps/docs-tracker/docs/en/cli.md' }],
          },
        ]),
        createVersion('1.0.2', []),
      ],
    });

    const response = await app.request(
      '/api/site-data/changelog',
      {},
      createTestEnv(db),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      versions: [
        {
          version: '1.0.0',
          items: [
            {
              id: 'aaaaaaaaaaaa',
              content: '- Added first item',
              prefix: 'Added',
              feature_areas: ['Model', 'Settings'],
              related_docs: [{ doc_path: 'alpha.md' }, { doc_path: 'zeta.md' }],
            },
            {
              id: 'bbbbbbbbbbbb',
              content: '- Fixed second item',
              prefix: 'Fixed',
              feature_areas: ['Permissions'],
              related_docs: [{ doc_path: 'permissions.md' }],
            },
          ],
        },
        {
          version: '1.0.1',
          items: [
            {
              id: 'cccccccccccc',
              content: '- Added third item',
              prefix: 'Added',
              feature_areas: ['CLI'],
              related_docs: [{ doc_path: 'cli.md' }],
            },
          ],
        },
        {
          version: '1.0.2',
          items: [],
        },
      ],
    });
    db.close();
  });

  it('差分イベントを seq 順で added / removed に分けて返すこと', async () => {
    const db = new FakeD1Database();
    await seed(db, {
      diff_events: [
        {
          detected_at: '2026-08-16T00:00:00.000Z',
          version: 'v1.0.0',
          type: 'items_changed',
          items_added: ['- Added first', '- Added second'],
          items_removed: ['- Removed first'],
        },
      ],
    });

    const response = await app.request(
      '/api/site-data/diff',
      {},
      createTestEnv(db),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      events: [
        {
          detected_at: '2026-08-16T00:00:00.000Z',
          version: 'v1.0.0',
          type: 'items_changed',
          items_added: ['- Added first', '- Added second'],
          items_removed: ['- Removed first'],
        },
      ],
    });
    db.close();
  });

  it('設定リファレンスと公式ドキュメントを key / doc_path 順で返すこと', async () => {
    const db = new FakeD1Database();
    await seed(db, {
      settings: [
        {
          key: 'zeta',
          leaf_name: 'zeta',
          slug: 'zeta',
          source: 'env',
          description_en: 'Zeta',
          description_ja: 'ゼータ',
          fetched_at: '2026-08-16',
          official_doc_urls: [
            'https://code.claude.com/docs/en/zeta',
            'https://code.claude.com/docs/en/alpha',
          ],
        },
        {
          key: 'alpha',
          leaf_name: 'alpha',
          slug: 'alpha',
          source: 'settings',
          description_en: 'Alpha',
          description_ja: 'アルファ',
          fetched_at: '2026-08-16',
          official_doc_urls: ['https://code.claude.com/docs/en/model'],
        },
      ],
    });

    const response = await app.request(
      '/api/site-data/settings',
      {},
      createTestEnv(db),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      settings: [
        {
          key: 'alpha',
          leaf_name: 'alpha',
          slug: 'alpha',
          source: 'settings',
          description_en: 'Alpha',
          description_ja: 'アルファ',
          fetched_at: '2026-08-16',
          official_docs: [{ doc_path: 'model.md' }],
        },
        {
          key: 'zeta',
          leaf_name: 'zeta',
          slug: 'zeta',
          source: 'env',
          description_en: 'Zeta',
          description_ja: 'ゼータ',
          fetched_at: '2026-08-16',
          official_docs: [{ doc_path: 'alpha.md' }, { doc_path: 'zeta.md' }],
        },
      ],
    });
    db.close();
  });
});
