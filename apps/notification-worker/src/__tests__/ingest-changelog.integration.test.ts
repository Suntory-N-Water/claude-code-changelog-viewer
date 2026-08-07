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
  IngestChangelogVersion,
  IngestSetting,
} from '@claude-code-changelog-viewer/types';
import { app } from '../index';
import { FakeD1Database } from './support/fake-d1';
import { createTestEnv } from './support/notification-test-support';

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
    slug: 'advisor-model',
    source: 'settings',
    description_en: 'Model for the server-side advisor tool.',
    description_ja: 'アドバイザーツールのモデルを指定します。',
    use_case_ja: 'アドバイザー機能のモデルを選択します。',
    official_doc_urls: ['https://code.claude.com/docs/en/advisor'],
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
    it('新規の設定キーを送ると、説明と公式ドキュメント URL(JSON テキスト)が保存されること', async () => {
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
        slug: 'advisor-model',
        source: 'settings',
        description_en: 'Model for the server-side advisor tool.',
        description_ja: 'アドバイザーツールのモデルを指定します。',
        use_case_ja: 'アドバイザー機能のモデルを選択します。',
        official_doc_urls: '["https://code.claude.com/docs/en/advisor"]',
      });
      db.close();
    });

    it('use_case_ja と official_doc_urls がない設定でも取り込めること', async () => {
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
            'SELECT use_case_ja, official_doc_urls FROM settings_reference',
          )
          .first(),
      ).toEqual({ use_case_ja: null, official_doc_urls: null });
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
      db.close();
    });
  });
});
