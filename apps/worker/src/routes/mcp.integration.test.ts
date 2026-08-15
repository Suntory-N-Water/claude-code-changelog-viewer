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
import worker, { app } from '../index';
import { FakeD1Database } from '../test-support/fake-d1';
import { createTestEnv } from '../test-support/notification-test-support';

// 2026-07-28 仕様では params._meta の envelope
// (protocolVersion / clientCapabilities)と Mcp-* ヘッダーが必須
const ENVELOPE_META = {
  'io.modelcontextprotocol/protocolVersion': '2026-07-28',
  'io.modelcontextprotocol/clientCapabilities': {},
};

async function postMcp(
  env: CloudflareBindings,
  {
    method,
    params,
    toolName,
  }: { method: string; params: Record<string, unknown>; toolName?: string },
) {
  return app.request(
    '/api/mcp',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'MCP-Protocol-Version': '2026-07-28',
        'Mcp-Method': method,
        ...(toolName === undefined ? {} : { 'Mcp-Name': toolName }),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method,
        params: { ...params, _meta: ENVELOPE_META },
      }),
    },
    env,
  );
}

// ツール結果の content[0].text(JSON 文字列)を parse して返す
async function callTool(
  db: FakeD1Database,
  name: string,
  args: Record<string, unknown>,
) {
  const response = await postMcp(createTestEnv(db), {
    method: 'tools/call',
    params: { name, arguments: args },
    toolName: name,
  });
  if (response.status !== 200) {
    throw new Error(`status=${response.status} body=${await response.text()}`);
  }
  const body = (await response.json()) as {
    result: { content: [{ text: string }]; isError?: boolean };
  };
  const isError = body.result.isError ?? false;
  const text = body.result.content[0].text;
  // エラー結果の text は JSON ではなくプレーンな日本語メッセージ
  return { isError, payload: isError ? text : JSON.parse(text) };
}

// search_text 生成を含む実際の取り込み経路でテストデータを投入する
async function seed(
  db: FakeD1Database,
  data: { versions?: IngestChangelogVersion[]; settings?: IngestSetting[] },
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
  summary?: string,
): IngestChangelogVersion {
  return summary === undefined
    ? { version, items }
    : { version, summary, items };
}

const vertexItem = {
  id: 'f595cf9fcf9b',
  content: '- Added interactive Google Vertex AI setup wizard',
  content_ja: 'Google Vertex AI 用のセットアップウィザードを追加しました。',
  prefix: 'Added',
  feature_areas: ['Settings', 'Model'],
  inference: {
    before: '手動で環境変数を構成する必要がありました。',
    after: 'ウィザード形式で設定を進められるようになりました。',
    benefit: '素早く確実に使い始めることができます。',
  },
};

const advisorSetting: IngestSetting = {
  key: 'advisorModel',
  slug: 'advisor-model',
  source: 'settings',
  description_en: 'Model for the server-side advisor tool.',
  description_ja: 'アドバイザーツールのモデルを指定します。',
  use_case_ja: 'アドバイザー機能のモデルを選択します。',
  official_doc_urls: ['https://code.claude.com/docs/en/advisor'],
};

describe('POST /api/mcp integration', () => {
  describe('レート制限', () => {
    it('制限超過時、429 を返すこと', async () => {
      const db = new FakeD1Database();
      const env = createTestEnv(db);
      (
        env.MCP_RATE_LIMITER.limit as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ success: false });

      const response = await postMcp(env, { method: 'tools/list', params: {} });

      expect(response.status).toBe(429);
      db.close();
    });
  });

  describe('WebMCP ブリッジ向けの /mcp', () => {
    it('/api/mcp と同じ MCP ハンドラに転送されること', async () => {
      const db = new FakeD1Database();

      const response = await worker.fetch(
        new Request('https://claude-code-log.com/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
            'MCP-Protocol-Version': '2026-07-28',
            'Mcp-Method': 'tools/list',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/list',
            params: { _meta: ENVELOPE_META },
          }),
        }),
        createTestEnv(db),
        {} as ExecutionContext,
      );

      expect(response.status).toBe(200);
      // 公開ツールの内訳は /api/mcp の tools/list テストで検証済み
      const body = (await response.json()) as {
        result: { tools: { name: string }[] };
      };
      expect(body.result.tools.length).toBeGreaterThan(0);
      db.close();
    });
  });

  describe('tools/list', () => {
    it('search_changelog / get_changelog / get_settings_reference の 3 ツールが公開されること', async () => {
      const db = new FakeD1Database();

      const response = await postMcp(createTestEnv(db), {
        method: 'tools/list',
        params: {},
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        result: { tools: { name: string }[] };
      };
      expect(body.result.tools.map((tool) => tool.name).sort()).toEqual([
        'get_changelog',
        'get_settings_reference',
        'search_changelog',
      ]);
      db.close();
    });
  });

  describe('search_changelog', () => {
    it('キーワードに該当する item が、バージョン・変更種別・日本語内容・benefit 付きで返ること', async () => {
      const db = new FakeD1Database();
      await seed(db, { versions: [createVersion('2.1.98', [vertexItem])] });

      const { payload } = await callTool(db, 'search_changelog', {
        query: 'Vertex',
      });

      expect(payload).toEqual([
        {
          version: '2.1.98',
          prefix: 'Added',
          content:
            'Google Vertex AI 用のセットアップウィザードを追加しました。',
          benefit: '素早く確実に使い始めることができます。',
        },
      ]);
      db.close();
    });

    it('日本語訳がない item は英語原文で返ること', async () => {
      const db = new FakeD1Database();
      await seed(db, {
        versions: [
          createVersion('0.2.106', [
            {
              id: '12b4d4c67835',
              content:
                '- MCP SSE server configs can now specify custom headers',
              prefix: 'Added',
            },
          ]),
        ],
      });

      const { payload } = await callTool(db, 'search_changelog', {
        query: 'custom headers',
      });

      expect(payload).toEqual([
        {
          version: '0.2.106',
          prefix: 'Added',
          content: '- MCP SSE server configs can now specify custom headers',
        },
      ]);
      db.close();
    });

    it('全角・大文字のキーワードでも、半角・小文字のキーワードと同じ item が見つかること', async () => {
      const db = new FakeD1Database();
      await seed(db, { versions: [createVersion('2.1.98', [vertexItem])] });

      const upper = await callTool(db, 'search_changelog', {
        query: 'VERTEX',
      });
      const fullWidth = await callTool(db, 'search_changelog', {
        query: 'Ｖｅｒｔｅｘ',
      });

      expect(upper.payload).toEqual(fullWidth.payload);
      expect(upper.payload).toHaveLength(1);
      db.close();
    });

    it('prefix を指定すると、その変更種別の item だけが返ること', async () => {
      const db = new FakeD1Database();
      await seed(db, {
        versions: [
          createVersion('2.1.98', [
            vertexItem,
            {
              id: 'bbbbbbbbbbbb',
              content: '- Fixed Vertex AI region fallback',
              prefix: 'Fixed',
            },
          ]),
        ],
      });

      const { payload } = await callTool(db, 'search_changelog', {
        query: 'Vertex',
        prefix: 'Fixed',
      });

      expect(payload).toEqual([
        expect.objectContaining({
          content: '- Fixed Vertex AI region fallback',
        }),
      ]);
      db.close();
    });

    it('結果はバージョンの新しい順に並ぶこと(2.1.9 より 2.1.10 が先)', async () => {
      const db = new FakeD1Database();
      const item = (id: string) => ({
        id,
        content: '- Improved permission prompt',
        prefix: 'Improved' as const,
      });
      await seed(db, {
        versions: [
          createVersion('2.1.9', [item('aaaaaaaaaaaa')]),
          createVersion('2.1.10', [item('bbbbbbbbbbbb')]),
        ],
      });

      const { payload } = await callTool(db, 'search_changelog', {
        query: 'permission',
      });

      expect(
        (payload as { version: string }[]).map((row) => row.version),
      ).toEqual(['2.1.10', '2.1.9']);
      db.close();
    });

    it('該当件数が limit を超える場合、limit 件だけ返ること', async () => {
      const db = new FakeD1Database();
      await seed(db, {
        versions: [
          createVersion(
            '2.0.0',
            Array.from({ length: 5 }, (_, i) => ({
              id: `id${String(i).padStart(10, '0')}`,
              content: `- Fixed memory leak ${i}`,
              prefix: 'Fixed',
            })),
          ),
        ],
      });

      const { payload } = await callTool(db, 'search_changelog', {
        query: 'memory leak',
        limit: 3,
      });

      expect(payload).toHaveLength(3);
      db.close();
    });

    it('該当がない場合、空配列が返ること', async () => {
      const db = new FakeD1Database();
      await seed(db, { versions: [createVersion('2.1.98', [vertexItem])] });

      const { payload } = await callTool(db, 'search_changelog', {
        query: '存在しないキーワード',
      });

      expect(payload).toEqual([]);
      db.close();
    });
  });

  describe('get_changelog', () => {
    it('存在するバージョンを指定すると、summary と全 item(日本語)が返ること', async () => {
      const db = new FakeD1Database();
      await seed(db, {
        versions: [
          createVersion('2.1.98', [vertexItem], 'Vertex AI 対応のリリース。'),
        ],
      });

      const { isError, payload } = await callTool(db, 'get_changelog', {
        version: '2.1.98',
      });

      expect(isError).toBe(false);
      expect(payload).toEqual({
        version: '2.1.98',
        summary: 'Vertex AI 対応のリリース。',
        items: [
          {
            prefix: 'Added',
            content:
              'Google Vertex AI 用のセットアップウィザードを追加しました。',
            benefit: '素早く確実に使い始めることができます。',
          },
        ],
      });
      db.close();
    });

    it('lang=en を指定すると英語原文が返り、benefit を含まないこと', async () => {
      const db = new FakeD1Database();
      await seed(db, { versions: [createVersion('2.1.98', [vertexItem])] });

      const { payload } = await callTool(db, 'get_changelog', {
        version: '2.1.98',
        lang: 'en',
      });

      expect((payload as { items: unknown[] }).items).toEqual([
        {
          prefix: 'Added',
          content: '- Added interactive Google Vertex AI setup wizard',
        },
      ]);
      db.close();
    });

    it('存在しないバージョンを指定すると、isError の結果が返ること', async () => {
      const db = new FakeD1Database();

      const { isError } = await callTool(db, 'get_changelog', {
        version: '9.9.9',
      });

      expect(isError).toBe(true);
      db.close();
    });
  });

  describe('get_settings_reference', () => {
    it('key を指定すると、説明・ユースケース・公式ドキュメント URL が返ること', async () => {
      const db = new FakeD1Database();
      await seed(db, { settings: [advisorSetting] });

      const { isError, payload } = await callTool(
        db,
        'get_settings_reference',
        { key: 'advisorModel' },
      );

      expect(isError).toBe(false);
      expect(payload).toEqual({
        key: 'advisorModel',
        source: 'settings',
        description: 'アドバイザーツールのモデルを指定します。',
        useCase: 'アドバイザー機能のモデルを選択します。',
        officialDocUrls: ['https://code.claude.com/docs/en/advisor'],
      });
      db.close();
    });

    it('存在しない key を指定すると、isError の結果が返ること', async () => {
      const db = new FakeD1Database();

      const { isError } = await callTool(db, 'get_settings_reference', {
        key: 'unknownKey',
      });

      expect(isError).toBe(true);
      db.close();
    });

    it('query を指定すると、キー名・説明文に一致する設定が返ること', async () => {
      const db = new FakeD1Database();
      await seed(db, {
        settings: [
          advisorSetting,
          {
            key: 'ANTHROPIC_MODEL',
            slug: 'anthropic-model',
            source: 'env',
            description_en: 'Overrides the default model.',
            description_ja: '既定のモデルを上書きします。',
          },
        ],
      });

      const { payload } = await callTool(db, 'get_settings_reference', {
        query: 'アドバイザー',
      });

      expect(payload).toEqual([
        expect.objectContaining({ key: 'advisorModel' }),
      ]);
      db.close();
    });

    it('key も query も指定しない場合、source 別のキー名一覧だけが返ること', async () => {
      const db = new FakeD1Database();
      await seed(db, {
        settings: [
          advisorSetting,
          {
            key: 'ANTHROPIC_MODEL',
            slug: 'anthropic-model',
            source: 'env',
            description_en: 'Overrides the default model.',
            description_ja: '既定のモデルを上書きします。',
          },
        ],
      });

      const { payload } = await callTool(db, 'get_settings_reference', {});

      expect(payload).toEqual({
        settings: ['advisorModel'],
        env: ['ANTHROPIC_MODEL'],
      });
      db.close();
    });
  });
});
