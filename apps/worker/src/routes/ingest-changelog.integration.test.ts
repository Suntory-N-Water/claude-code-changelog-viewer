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

function createRequest(
  payload: unknown,
  secret = 'dispatch-secret',
): RequestInit {
  return {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  };
}

function createVersion(
  overrides: Partial<IngestChangelogVersion> = {},
): IngestChangelogVersion {
  return {
    version: '2.1.98',
    summary: 'Vertex AI のセットアップウィザードが追加されました。',
    items: [
      {
        id: 'f595cf9fcf9b',
        content: '- Added interactive Google Vertex AI setup wizard',
        content_ja:
          'Google Vertex AI 用のセットアップウィザードを追加しました。',
        prefix: 'Added',
        feature_areas: ['Settings', 'Model'],
        inference: {
          before: '手動で環境変数を構成する必要がありました。',
          after: 'ウィザード形式で設定を進められるようになりました。',
          benefit: '素早く確実に使い始めることができます。',
        },
      },
    ],
    ...overrides,
  };
}

function createSetting(overrides: Partial<IngestSetting> = {}): IngestSetting {
  return {
    key: 'advisorModel',
    leaf_name: 'advisorModel',
    slug: 'advisor-model',
    source: 'settings',
    description_en: 'Model for the server-side advisor tool.',
    description_ja: 'アドバイザーツールのモデルを指定します。',
    use_case_ja: 'アドバイザー機能のモデルを選択します。',
    fetched_at: '2026-08-16',
    official_doc_urls: ['https://code.claude.com/docs/en/advisor'],
    ...overrides,
  };
}

function createDiffEvent(
  overrides: Partial<IngestChangelogDiffEvent> = {},
): IngestChangelogDiffEvent {
  return {
    detected_at: '2026-08-16T00:00:00.000Z',
    version: 'v2.1.98',
    type: 'items_changed',
    items_added: ['- Added a new item'],
    items_removed: ['- Removed an old item'],
    ...overrides,
  };
}

async function countAllRows(db: FakeD1Database) {
  const [versions, items, featureAreas, settings] = await Promise.all([
    db.prepare('SELECT count(*) AS c FROM changelog_versions').first<{
      c: number;
    }>(),
    db.prepare('SELECT count(*) AS c FROM changelog_items').first<{
      c: number;
    }>(),
    db.prepare('SELECT count(*) AS c FROM changelog_item_feature_areas').first<{
      c: number;
    }>(),
    db.prepare('SELECT count(*) AS c FROM settings_reference').first<{
      c: number;
    }>(),
  ]);
  return {
    versions: versions?.c,
    items: items?.c,
    featureAreas: featureAreas?.c,
    settings: settings?.c,
  };
}

const emptyCounts = { versions: 0, items: 0, featureAreas: 0, settings: 0 };

describe('POST /api/ingest/changelog integration', () => {
  describe('認証', () => {
    it('Authorization ヘッダーがない場合、401 を返し DB は変更されないこと', async () => {
      const db = new FakeD1Database();
      const sut = app;
      const request = createRequest({ versions: [createVersion()] });
      delete (request.headers as Record<string, string>)['Authorization'];

      const response = await sut.request(
        '/api/ingest/changelog',
        request,
        createTestEnv(db),
      );

      expect(response.status).toBe(401);
      expect(await countAllRows(db)).toEqual(emptyCounts);
      db.close();
    });

    it('誤ったシークレットの場合、401 を返し DB は変更されないこと', async () => {
      const db = new FakeD1Database();
      const sut = app;

      const response = await sut.request(
        '/api/ingest/changelog',
        createRequest({ versions: [createVersion()] }, 'wrong-secret'),
        createTestEnv(db),
      );

      expect(response.status).toBe(401);
      expect(await countAllRows(db)).toEqual(emptyCounts);
      db.close();
    });
  });

  describe('ペイロード検証', () => {
    it('items を欠いた不正なペイロードの場合、400 を返し DB は変更されないこと', async () => {
      const db = new FakeD1Database();
      const sut = app;

      const response = await sut.request(
        '/api/ingest/changelog',
        createRequest({ versions: [{ version: '2.1.98' }] }),
        createTestEnv(db),
      );

      expect(response.status).toBe(400);
      expect(await countAllRows(db)).toEqual(emptyCounts);
      db.close();
    });

    it('JSON が壊れている場合、400 を返し DB は変更されないこと', async () => {
      const db = new FakeD1Database();
      const sut = app;

      const response = await sut.request(
        '/api/ingest/changelog',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer dispatch-secret',
            'Content-Type': 'application/json',
          },
          body: '{',
        },
        createTestEnv(db),
      );

      expect(response.status).toBe(400);
      expect(await countAllRows(db)).toEqual(emptyCounts);
      db.close();
    });
  });

  describe('changelog の取り込み', () => {
    it('新規バージョンを送ると、summary・items・feature areas が保存されること', async () => {
      const db = new FakeD1Database();
      const sut = app;

      const response = await sut.request(
        '/api/ingest/changelog',
        createRequest({ versions: [createVersion()] }),
        createTestEnv(db),
      );

      expect(response.status).toBe(200);
      expect(
        await db
          .prepare('SELECT version, summary FROM changelog_versions')
          .first(),
      ).toEqual({
        version: '2.1.98',
        summary: 'Vertex AI のセットアップウィザードが追加されました。',
      });
      expect(
        await db
          .prepare(
            `SELECT version, item_id, content, content_ja, prefix,
                    inference_before, inference_after, inference_benefit
             FROM changelog_items`,
          )
          .first(),
      ).toEqual({
        version: '2.1.98',
        item_id: 'f595cf9fcf9b',
        content: '- Added interactive Google Vertex AI setup wizard',
        content_ja:
          'Google Vertex AI 用のセットアップウィザードを追加しました。',
        prefix: 'Added',
        inference_before: '手動で環境変数を構成する必要がありました。',
        inference_after: 'ウィザード形式で設定を進められるようになりました。',
        inference_benefit: '素早く確実に使い始めることができます。',
      });
      const featureAreas = await db
        .prepare(
          'SELECT feature_area FROM changelog_item_feature_areas ORDER BY feature_area',
        )
        .all<{ feature_area: string }>();
      expect(featureAreas.results).toEqual([
        { feature_area: 'Model' },
        { feature_area: 'Settings' },
      ]);
      db.close();
    });

    it('summary・content_ja・inference を持たない旧形式でも取り込めること', async () => {
      const db = new FakeD1Database();
      const sut = app;
      const oldFormat: IngestChangelogVersion = {
        version: '0.2.106',
        items: [
          {
            id: '12b4d4c67835',
            content: '- MCP SSE server configs can now specify custom headers',
            prefix: 'Added',
          },
        ],
      };

      const response = await sut.request(
        '/api/ingest/changelog',
        createRequest({ versions: [oldFormat] }),
        createTestEnv(db),
      );

      expect(response.status).toBe(200);
      expect(
        await db
          .prepare(
            `SELECT summary, content_ja, inference_before
             FROM changelog_versions v JOIN changelog_items i ON v.version = i.version`,
          )
          .first(),
      ).toEqual({ summary: null, content_ja: null, inference_before: null });
      db.close();
    });

    it('同じバージョンを再取り込みすると、以前の items が新しい内容に置き換わること', async () => {
      const db = new FakeD1Database();
      const sut = app;
      const env = createTestEnv(db);
      await sut.request(
        '/api/ingest/changelog',
        createRequest({ versions: [createVersion()] }),
        env,
      );
      const replaced = createVersion({
        summary: '修正版のサマリー',
        items: [
          {
            id: 'aaaaaaaaaaaa',
            content: '- Replaced item',
            prefix: 'Fixed',
          },
        ],
      });

      const response = await sut.request(
        '/api/ingest/changelog',
        createRequest({ versions: [replaced] }),
        env,
      );

      expect(response.status).toBe(200);
      expect(await countAllRows(db)).toEqual({
        versions: 1,
        items: 1,
        featureAreas: 0,
        settings: 0,
      });
      expect(
        await db
          .prepare('SELECT item_id, content FROM changelog_items')
          .first(),
      ).toEqual({ item_id: 'aaaaaaaaaaaa', content: '- Replaced item' });
      db.close();
    });

    it('同じ item id が別バージョンに存在しても、両方保存されること', async () => {
      const db = new FakeD1Database();
      const sut = app;
      const item = {
        id: 'f595cf9fcf9b',
        content: '- Same content appears in two versions',
        prefix: 'Added',
      };

      const response = await sut.request(
        '/api/ingest/changelog',
        createRequest({
          versions: [
            { version: '1.0.0', items: [item] },
            { version: '1.0.1', items: [item] },
          ],
        }),
        createTestEnv(db),
      );

      expect(response.status).toBe(200);
      expect((await countAllRows(db)).items).toBe(2);
      db.close();
    });

    it('同一 item 内で feature_area が重複していても、一意化して取り込めること', async () => {
      const db = new FakeD1Database();
      const sut = app;
      const version = createVersion({
        items: [
          {
            id: 'f595cf9fcf9b',
            content: '- Added something',
            prefix: 'Added',
            feature_areas: ['Settings', 'Model', 'Settings'],
          },
        ],
      });

      const response = await sut.request(
        '/api/ingest/changelog',
        createRequest({ versions: [version] }),
        createTestEnv(db),
      );

      expect(response.status).toBe(200);
      const featureAreas = await db
        .prepare(
          'SELECT feature_area FROM changelog_item_feature_areas ORDER BY feature_area',
        )
        .all<{ feature_area: string }>();
      expect(featureAreas.results).toEqual([
        { feature_area: 'Model' },
        { feature_area: 'Settings' },
      ]);
      db.close();
    });

    it('関連ドキュメントを検索用の相対パスに変換し、空配列は行を作らないこと', async () => {
      const db = new FakeD1Database();
      const sut = app;
      const version = createVersion({
        items: [
          {
            id: 'aaaaaaaaaaaa',
            content: '- Added related docs',
            prefix: 'Added',
            related_docs: [
              { file: 'docs/en/mcp.md' },
              { file: 'docs/en/mcp.md' },
              { file: 'docs/en/agent-sdk/typescript.md' },
            ],
          },
          {
            id: 'bbbbbbbbbbbb',
            content: '- Added no related docs',
            prefix: 'Added',
            related_docs: [],
          },
        ],
      });

      const response = await sut.request(
        '/api/ingest/changelog',
        createRequest({ versions: [version] }),
        createTestEnv(db),
      );

      expect(response.status).toBe(200);
      const rows = await db
        .prepare(
          `SELECT version, item_id, doc_path
           FROM changelog_item_related_docs
           ORDER BY item_id, doc_path`,
        )
        .all();
      expect(rows.results).toEqual([
        {
          version: '2.1.98',
          item_id: 'aaaaaaaaaaaa',
          doc_path: 'agent-sdk/typescript.md',
        },
        {
          version: '2.1.98',
          item_id: 'aaaaaaaaaaaa',
          doc_path: 'mcp.md',
        },
      ]);
      db.close();
    });

    it('関連ドキュメントが 100 行を超えても分割して取り込めること', async () => {
      const db = new FakeD1Database();
      const sut = app;
      const relatedDocs = Array.from({ length: 101 }, (_, i) => ({
        file: `docs/en/generated/${i}.md`,
      }));

      const response = await sut.request(
        '/api/ingest/changelog',
        createRequest({
          versions: [
            createVersion({
              items: [
                {
                  id: 'cccccccccccc',
                  content: '- Added many related docs',
                  prefix: 'Added',
                  related_docs: relatedDocs,
                },
              ],
            }),
          ],
        }),
        createTestEnv(db),
      );

      expect(response.status).toBe(200);
      const count = await db
        .prepare('SELECT count(*) AS c FROM changelog_item_related_docs')
        .first<{ c: number }>();
      expect(count?.c).toBe(101);
      db.close();
    });

    it('差分イベントと追加・削除項目を取り込め、version_removed は項目を持たないこと', async () => {
      const db = new FakeD1Database();
      const sut = app;
      const events = [
        createDiffEvent(),
        createDiffEvent({
          detected_at: '2026-08-16T00:01:00.000Z',
          version: 'v2.1.88',
          type: 'version_removed',
          items_added: [],
          items_removed: [],
        }),
      ];

      const response = await sut.request(
        '/api/ingest/changelog',
        createRequest({ diff_events: events }),
        createTestEnv(db),
      );

      expect(response.status).toBe(200);
      expect(
        (
          await db
            .prepare(
              `SELECT version, detected_at, type
               FROM changelog_diff_events
               ORDER BY version`,
            )
            .all()
        ).results,
      ).toEqual([
        {
          version: 'v2.1.88',
          detected_at: '2026-08-16T00:01:00.000Z',
          type: 'version_removed',
        },
        {
          version: 'v2.1.98',
          detected_at: '2026-08-16T00:00:00.000Z',
          type: 'items_changed',
        },
      ]);
      expect(
        (
          await db
            .prepare(
              `SELECT version, detected_at, direction, seq, content
               FROM changelog_diff_event_items
               ORDER BY direction, seq`,
            )
            .all()
        ).results,
      ).toEqual([
        {
          version: 'v2.1.98',
          detected_at: '2026-08-16T00:00:00.000Z',
          direction: 'added',
          seq: 0,
          content: '- Added a new item',
        },
        {
          version: 'v2.1.98',
          detected_at: '2026-08-16T00:00:00.000Z',
          direction: 'removed',
          seq: 0,
          content: '- Removed an old item',
        },
      ]);

      await sut.request(
        '/api/ingest/changelog',
        createRequest({ diff_events: events }),
        createTestEnv(db),
      );
      const eventCount = await db
        .prepare('SELECT count(*) AS c FROM changelog_diff_events')
        .first<{ c: number }>();
      const itemCount = await db
        .prepare('SELECT count(*) AS c FROM changelog_diff_event_items')
        .first<{ c: number }>();
      expect(eventCount?.c).toBe(2);
      expect(itemCount?.c).toBe(2);
      db.close();
    });

    it('search_text が content・content_ja・summary の NFKC 正規化+小文字化で生成され、全角・大文字の揺れを吸収した検索ができること', async () => {
      const db = new FakeD1Database();
      const sut = app;
      const version = createVersion({
        summary: 'サマリー',
        items: [
          {
            id: 'f595cf9fcf9b',
            content: '- Added Vertex AI wizard',
            content_ja: 'Vertex AI ウィザード(GCP認証)を追加',
            prefix: 'Added',
          },
        ],
      });

      await sut.request(
        '/api/ingest/changelog',
        createRequest({ versions: [version] }),
        createTestEnv(db),
      );

      // 全角英字の 'ＧＣＰ' も大文字の 'Vertex' も、正規化済みの search_text を
      // 小文字・半角のキーワードで instr 検索できる
      const hit = await db
        .prepare(
          `SELECT count(*) AS c FROM changelog_items
           WHERE instr(search_text, ?) > 0 AND instr(search_text, ?) > 0 AND instr(search_text, ?) > 0`,
        )
        .bind('vertex', 'gcp認証', 'サマリー')
        .first<{ c: number }>();
      expect(hit?.c).toBe(1);
      db.close();
    });

    it('bound parameters の上限 100 を超える件数の items でも取り込めること', async () => {
      const db = new FakeD1Database();
      const sut = app;
      const items = Array.from({ length: 60 }, (_, i) => ({
        id: `id${String(i).padStart(10, '0')}`,
        content: `- Item ${i}`,
        prefix: 'Added',
        feature_areas: ['Settings'],
      }));

      const response = await sut.request(
        '/api/ingest/changelog',
        createRequest({ versions: [{ version: '2.0.0', items }] }),
        createTestEnv(db),
      );

      expect(response.status).toBe(200);
      expect(await countAllRows(db)).toEqual({
        versions: 1,
        items: 60,
        featureAreas: 60,
        settings: 0,
      });
      db.close();
    });
  });

  describe('settings の取り込み', () => {
    it('新規の設定キーを送ると、表示名・取得日時・公式ドキュメント参照が保存されること', async () => {
      const db = new FakeD1Database();
      const sut = app;

      const response = await sut.request(
        '/api/ingest/changelog',
        createRequest({ settings: [createSetting()] }),
        createTestEnv(db),
      );

      expect(response.status).toBe(200);
      expect(
        await db.prepare('SELECT * FROM settings_reference').first(),
      ).toEqual({
        key: 'advisorModel',
        leaf_name: 'advisorModel',
        slug: 'advisor-model',
        source: 'settings',
        description_en: 'Model for the server-side advisor tool.',
        description_ja: 'アドバイザーツールのモデルを指定します。',
        use_case_ja: 'アドバイザー機能のモデルを選択します。',
        fetched_at: '2026-08-16',
      });
      expect(
        await db
          .prepare('SELECT setting_key, doc_path FROM settings_official_docs')
          .all(),
      ).toMatchObject({
        results: [{ setting_key: 'advisorModel', doc_path: 'advisor.md' }],
      });
      db.close();
    });

    it('同じ公式ドキュメントを異なる形式で指定しても、正規化後に一意に保存すること', async () => {
      const db = new FakeD1Database();
      const sut = app;
      const setting = createSetting({
        official_doc_urls: [
          'https://code.claude.com/docs/en/advisor',
          'docs/en/advisor.md',
          'https://code.claude.com/docs/en/advisor?utm_source=test',
        ],
      });

      const response = await sut.request(
        '/api/ingest/changelog',
        createRequest({ settings: [setting] }),
        createTestEnv(db),
      );

      expect(response.status).toBe(200);
      expect(
        await db
          .prepare('SELECT setting_key, doc_path FROM settings_official_docs')
          .all(),
      ).toMatchObject({
        results: [{ setting_key: 'advisorModel', doc_path: 'advisor.md' }],
      });
      db.close();
    });

    it('use_case_ja と公式ドキュメント参照がない設定でも取り込めること', async () => {
      const db = new FakeD1Database();
      const sut = app;
      const setting = createSetting({
        use_case_ja: undefined,
        official_doc_urls: undefined,
      });

      const response = await sut.request(
        '/api/ingest/changelog',
        createRequest({ settings: [setting] }),
        createTestEnv(db),
      );

      expect(response.status).toBe(200);
      expect(
        await db
          .prepare(
            'SELECT use_case_ja, leaf_name, fetched_at FROM settings_reference',
          )
          .first(),
      ).toEqual({
        use_case_ja: null,
        leaf_name: 'advisorModel',
        fetched_at: '2026-08-16',
      });
      const docs = await db
        .prepare('SELECT count(*) AS c FROM settings_official_docs')
        .first<{ c: number }>();
      expect(docs?.c).toBe(0);
      db.close();
    });

    it('同じキーを再取り込みすると、内容が上書きされること', async () => {
      const db = new FakeD1Database();
      const sut = app;
      const env = createTestEnv(db);
      await sut.request(
        '/api/ingest/changelog',
        createRequest({ settings: [createSetting()] }),
        env,
      );
      const updated = createSetting({
        description_ja: '更新後の説明です。',
        official_doc_urls: ['https://code.claude.com/docs/en/model-config'],
      });

      const response = await sut.request(
        '/api/ingest/changelog',
        createRequest({ settings: [updated] }),
        env,
      );

      expect(response.status).toBe(200);
      const counts = await countAllRows(db);
      expect(counts.settings).toBe(1);
      expect(
        await db
          .prepare('SELECT description_ja FROM settings_reference')
          .first(),
      ).toEqual({ description_ja: '更新後の説明です。' });
      expect(
        await db.prepare('SELECT doc_path FROM settings_official_docs').all(),
      ).toMatchObject({ results: [{ doc_path: 'model-config.md' }] });
      db.close();
    });

    it('設定キーが 100 件を超えても D1 の batch 上限に合わせて取り込めること', async () => {
      const db = new FakeD1Database();
      const sut = app;
      const settings = Array.from({ length: 101 }, (_, i) =>
        createSetting({
          key: `setting-${i}`,
          leaf_name: `setting${i}`,
          official_doc_urls: [],
        }),
      );

      const response = await sut.request(
        '/api/ingest/changelog',
        createRequest({ settings }),
        createTestEnv(db),
      );

      expect(response.status).toBe(200);
      expect((await countAllRows(db)).settings).toBe(101);
      db.close();
    });
  });
});
