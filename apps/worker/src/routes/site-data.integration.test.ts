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
import { FakeD1Database, FakeDocsD1Database } from '../test-support/fake-d1';
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
  related_docs: [{ file: 'docs/en/zeta.md' }, { file: 'docs/en/alpha.md' }],
};

const secondItem = {
  id: 'bbbbbbbbbbbb',
  content: '- Fixed second item',
  prefix: 'Fixed',
  feature_areas: ['Permissions'],
  related_docs: [{ file: 'docs/en/permissions.md' }],
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
            related_docs: [{ file: 'docs/en/cli.md' }],
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
    const docsDb = new FakeDocsD1Database();
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
      createTestEnv(db, docsDb),
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
    docsDb.close();
  });

  it('公式の型と既定値を持つキーのとき、その項目だけを応答に含めること', async () => {
    const db = new FakeD1Database();
    const docsDb = new FakeDocsD1Database();
    await seedSettingSchema(docsDb, [
      { key: 'model', valueType: 'string', defaultValue: '"latest"' },
      { key: 'permissions.allow', valueType: 'string[]', defaultValue: null },
      { key: 'CLAUDE_CODE_TEST', valueType: '', defaultValue: '""' },
    ]);
    await seed(db, {
      settings: [
        createSetting('CLAUDE_CODE_TEST', 'env'),
        createSetting('model', 'settings'),
        createSetting('permissions.allow', 'settings'),
      ],
    });

    const response = await app.request(
      '/api/site-data/settings',
      {},
      createTestEnv(db, docsDb),
    );

    expect(await response.json()).toEqual({
      settings: [
        {
          key: 'CLAUDE_CODE_TEST',
          leaf_name: 'CLAUDE_CODE_TEST',
          slug: 'claude-code-test',
          source: 'env',
          description_en: 'CLAUDE_CODE_TEST',
          description_ja: 'CLAUDE_CODE_TEST の説明',
          fetched_at: '2026-08-16',
          official_docs: [],
        },
        {
          key: 'model',
          leaf_name: 'model',
          slug: 'model',
          source: 'settings',
          description_en: 'model',
          description_ja: 'model の説明',
          value_type: 'string',
          default_value: 'latest',
          fetched_at: '2026-08-16',
          official_docs: [],
        },
        {
          key: 'permissions.allow',
          leaf_name: 'allow',
          slug: 'permissions-allow',
          source: 'settings',
          description_en: 'permissions.allow',
          description_ja: 'permissions.allow の説明',
          value_type: 'string[]',
          fetched_at: '2026-08-16',
          official_docs: [],
        },
      ],
    });
    db.close();
    docsDb.close();
  });

  it('公式の選択肢を持つキーのとき、その値の並びを応答に含めること', async () => {
    const db = new FakeD1Database();
    const docsDb = new FakeDocsD1Database();
    await seedSettingSchema(docsDb, [
      {
        key: 'model',
        valueType: 'string',
        defaultValue: '"latest"',
        enumValues: '["stable","latest"]',
      },
      { key: 'verbose', valueType: 'boolean', defaultValue: 'false' },
    ]);
    await seed(db, {
      settings: [
        createSetting('model', 'settings'),
        createSetting('verbose', 'settings'),
      ],
    });

    const response = await app.request(
      '/api/site-data/settings',
      {},
      createTestEnv(db, docsDb),
    );

    expect(await response.json()).toEqual({
      settings: [
        {
          key: 'model',
          leaf_name: 'model',
          slug: 'model',
          source: 'settings',
          description_en: 'model',
          description_ja: 'model の説明',
          value_type: 'string',
          default_value: 'latest',
          enum_values: ['stable', 'latest'],
          fetched_at: '2026-08-16',
          official_docs: [],
        },
        {
          key: 'verbose',
          leaf_name: 'verbose',
          slug: 'verbose',
          source: 'settings',
          description_en: 'verbose',
          description_ja: 'verbose の説明',
          value_type: 'boolean',
          default_value: 'false',
          fetched_at: '2026-08-16',
          official_docs: [],
        },
      ],
    });
    db.close();
    docsDb.close();
  });
});

function createSetting(key: string, source: 'settings' | 'env'): IngestSetting {
  return {
    key,
    leaf_name: key.split('.').at(-1) ?? key,
    slug: key.toLowerCase().replaceAll(/[._]/g, '-'),
    source,
    description_en: key,
    description_ja: `${key} の説明`,
    fetched_at: '2026-08-16',
    official_doc_urls: [],
  };
}

async function seedSettingSchema(
  docsDb: FakeDocsD1Database,
  entries: {
    key: string;
    valueType: string;
    defaultValue: string | null;
    enumValues?: string;
  }[],
) {
  for (const entry of entries) {
    await docsDb
      .prepare(
        `INSERT INTO setting_schema_entries
           (key, source, description, parent_descriptions, value_type, default_value, enum_values)
         VALUES (?, 'settings', '', '[]', ?, ?, ?)`,
      )
      .bind(
        entry.key,
        entry.valueType,
        entry.defaultValue,
        entry.enumValues ?? null,
      )
      .run();
  }
}
