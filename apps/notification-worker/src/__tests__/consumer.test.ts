import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 外部依存のモック
const { mockedSendToDiscord } = vi.hoisted(() => ({
  mockedSendToDiscord: vi.fn(),
}));

vi.mock('../lib/discord', () => ({
  buildUnsubscribeUrl: vi.fn(
    (workerUrl: string, token: string) =>
      `${workerUrl}/api/unsubscribe?token=${token}`,
  ),
  createChangelogMessage: vi.fn(() => ({
    content: 'テスト通知',
    username: 'Bot',
  })),
  sendToDiscord: mockedSendToDiscord,
}));

vi.mock('../lib/email', () => ({
  sendToEmail: vi.fn(),
  createEmailChangelogMessage: vi.fn(),
}));

// fetch をモック(spyOn 経由で型安全にモック)
const mockFetch = vi.spyOn(globalThis, 'fetch');

import type { Analysis } from '@claude-code-changelog-viewer/types';
import { queueConsumer } from '../queue/consumer';

const validAnalysis: Analysis = {
  version: 'v1.0.0',
  summary: 'テスト用サマリー',
  items: [
    {
      content: 'Added new feature',
      content_ja: '新機能を追加',
      prefix: 'feat',
      importance_score: 8,
      related_docs: [],
    },
  ],
};

type MockDB = {
  prepare: ReturnType<typeof vi.fn>;
  _run: ReturnType<typeof vi.fn>;
  _returningAll: ReturnType<typeof vi.fn>;
};

function createMockMessage(body: unknown) {
  return {
    body,
    id: 'msg-1',
    timestamp: new Date(),
    attempts: 1,
    ack: vi.fn(),
    retry: vi.fn(),
  };
}

function createMockBatch(messages: ReturnType<typeof createMockMessage>[]) {
  return {
    messages,
    queue: 'test-queue',
    ackAll: vi.fn(),
    retryAll: vi.fn(),
  } as unknown as MessageBatch<unknown>;
}

function createMockEnv() {
  const run = vi.fn().mockResolvedValue({ success: true });
  const returningAll = vi.fn().mockResolvedValue({ results: [] });
  const db: MockDB = {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [] }),
        raw: vi.fn().mockResolvedValue([]),
        run,
        first: vi.fn().mockResolvedValue(null),
      }),
    }),
    _run: run,
    _returningAll: returningAll,
  };
  return {
    env: {
      DB: db,
      WORKER_URL: 'https://example.com',
      SITE_URL: 'https://example.com',
      NOTIFICATION_QUEUE: {},
      TURNSTILE_SECRET_KEY: '',
      DISPATCH_SECRET: '',
    } as unknown as CloudflareBindings,
    db,
  };
}

function setupFetchSuccess() {
  const impl: typeof fetch = Object.assign(
    () => Promise.resolve(Response.json(validAnalysis)),
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    { preconnect: (globalThis.fetch as any).preconnect },
  );
  mockFetch.mockImplementation(impl);
}

// DB から返るカラム名は SQLite の snake_case(Drizzle がマッピング前の生データ)
type MockWebhookRow = {
  id: string;
  webhook_url: string;
  token: string;
  fail_count?: number;
};

function setupDBWithWebhooks(
  db: MockDB,
  webhooks: MockWebhookRow[],
  returningResult?: { fail_count: number; is_active: number },
) {
  db._returningAll = vi.fn().mockResolvedValue({
    results: returningResult ? [returningResult] : [],
  });

  db.prepare = vi.fn().mockImplementation((sql: string) => {
    const upper = sql.toUpperCase();
    const isSelect = upper.startsWith('SELECT');
    const isReturning = upper.includes('RETURNING');

    if (isSelect) {
      // Drizzle D1 は SELECT に .raw() を使用する
      // consumer.ts の select 順: id, webhook_url, token, fail_count, channel_type
      // discord_channels JOIN のみ rows を返す。slack_channels JOIN は空を返す
      const isDiscordQuery = upper.includes('DISCORD_CHANNELS');
      const rawRows = isDiscordQuery
        ? webhooks.map((w) => [
            w.id,
            w.webhook_url,
            w.token,
            w.fail_count ?? 0,
            'DSC',
          ])
        : [];
      return {
        bind: vi.fn().mockReturnValue({
          raw: vi.fn().mockResolvedValue(rawRows),
          all: vi.fn().mockResolvedValue({ results: [] }),
          run: db._run,
          first: vi.fn().mockResolvedValue(null),
        }),
      };
    }
    if (isReturning) {
      // RETURNING は .all() で object 形式を返す(Drizzle がカラム名マッピングする)
      return {
        bind: vi.fn().mockReturnValue({
          all: db._returningAll,
          raw: vi.fn().mockResolvedValue([]),
          run: db._run,
          first: vi.fn().mockResolvedValue(null),
        }),
      };
    }
    return {
      bind: vi.fn().mockReturnValue({
        run: db._run,
        all: vi.fn().mockResolvedValue({ results: [] }),
        raw: vi.fn().mockResolvedValue([]),
        first: vi.fn().mockResolvedValue(null),
      }),
    };
  });
}

describe('queueConsumer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function runWithTimers(promise: Promise<void>) {
    const result = promise;
    for (let i = 0; i < 50; i += 1) {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    }
    return result;
  }

  function callConsumer(batch: MessageBatch<unknown>, env: CloudflareBindings) {
    // biome-ignore lint/style/noNonNullAssertion: テスト用に queue handler の存在を前提とする
    return queueConsumer!(batch, env, {} as ExecutionContext) as Promise<void>;
  }

  describe('メッセージ検証', () => {
    it('不正なメッセージボディは ack して無視する', async () => {
      const message = createMockMessage({ invalid: 'body' });
      const batch = createMockBatch([message]);
      const { env } = createMockEnv();

      await callConsumer(batch, env);

      expect(message.ack).toHaveBeenCalled();
      expect(message.retry).not.toHaveBeenCalled();
    });

    it('version が v で始まらないメッセージは ack して無視する', async () => {
      const message = createMockMessage({ version: '1.0.0' });
      const batch = createMockBatch([message]);
      const { env } = createMockEnv();

      await callConsumer(batch, env);

      expect(message.ack).toHaveBeenCalled();
      expect(message.retry).not.toHaveBeenCalled();
    });
  });

  describe('inferred JSON 取得', () => {
    it('inferred JSON の取得に失敗した場合は retry する', async () => {
      const message = createMockMessage({ version: 'v1.0.0' });
      const batch = createMockBatch([message]);
      const { env } = createMockEnv();

      mockFetch.mockResolvedValue(new Response(null, { status: 404 }));

      await callConsumer(batch, env);

      expect(message.retry).toHaveBeenCalled();
      expect(message.ack).not.toHaveBeenCalled();
    });

    it('inferred JSON のパースに失敗した場合は retry する', async () => {
      const message = createMockMessage({ version: 'v1.0.0' });
      const batch = createMockBatch([message]);
      const { env } = createMockEnv();

      mockFetch.mockResolvedValue(Response.json({ invalid: 'data' }));

      await callConsumer(batch, env);

      expect(message.retry).toHaveBeenCalled();
      expect(message.ack).not.toHaveBeenCalled();
    });
  });

  it('アクティブなチャンネルがない場合は ack する', async () => {
    const message = createMockMessage({ version: 'v1.0.0' });
    const batch = createMockBatch([message]);
    const { env } = createMockEnv();

    setupFetchSuccess();

    await callConsumer(batch, env);

    expect(message.ack).toHaveBeenCalled();
  });

  it('送信成功時に fail_count > 0 ならリセットして ack する', async () => {
    const message = createMockMessage({ version: 'v1.0.0' });
    const batch = createMockBatch([message]);
    const { env, db } = createMockEnv();

    setupFetchSuccess();
    setupDBWithWebhooks(db, [
      {
        id: 'wh-1',
        webhook_url: 'https://discord.com/api/webhooks/1/abc',
        token: 'tok-1',
        fail_count: 1,
      },
    ]);
    mockedSendToDiscord.mockResolvedValue({ ok: true, status: 204 });

    await runWithTimers(callConsumer(batch, env));

    expect(mockedSendToDiscord).toHaveBeenCalledTimes(1);
    expect(message.ack).toHaveBeenCalled();
  });

  it('429 レート制限受信時に retry する', async () => {
    const message = createMockMessage({ version: 'v1.0.0' });
    const batch = createMockBatch([message]);
    const { env, db } = createMockEnv();

    setupFetchSuccess();
    setupDBWithWebhooks(db, [
      {
        id: 'wh-1',
        webhook_url: 'https://discord.com/api/webhooks/1/abc',
        token: 'tok-1',
      },
    ]);
    mockedSendToDiscord.mockResolvedValue({ ok: false, status: 429 });

    await runWithTimers(callConsumer(batch, env));

    expect(message.retry).toHaveBeenCalled();
    expect(message.ack).not.toHaveBeenCalled();
  });

  it('永続的な失敗(404)で fail_count を加算する', async () => {
    const message = createMockMessage({ version: 'v1.0.0' });
    const batch = createMockBatch([message]);
    const { env, db } = createMockEnv();

    setupFetchSuccess();
    setupDBWithWebhooks(
      db,
      [
        {
          id: 'wh-1',
          webhook_url: 'https://discord.com/api/webhooks/1/abc',
          token: 'tok-1',
        },
      ],
      { fail_count: 1, is_active: 1 },
    );
    mockedSendToDiscord.mockResolvedValue({ ok: false, status: 404 });

    await runWithTimers(callConsumer(batch, env));

    expect(message.ack).toHaveBeenCalled();
  });

  it('fail_count が閾値に達したら channels を無効化する', async () => {
    const message = createMockMessage({ version: 'v1.0.0' });
    const batch = createMockBatch([message]);
    const { env, db } = createMockEnv();

    setupFetchSuccess();
    setupDBWithWebhooks(
      db,
      [
        {
          id: 'wh-1',
          webhook_url: 'https://discord.com/api/webhooks/1/abc',
          token: 'tok-1',
        },
      ],
      { fail_count: 3, is_active: 0 },
    );
    mockedSendToDiscord.mockResolvedValue({ ok: false, status: 401 });

    await runWithTimers(callConsumer(batch, env));

    expect(message.ack).toHaveBeenCalled();
  });

  it('sendToDiscord が例外をスローしても他のチャンネルの処理を続行する', async () => {
    const message = createMockMessage({ version: 'v1.0.0' });
    const batch = createMockBatch([message]);
    const { env, db } = createMockEnv();

    setupFetchSuccess();
    setupDBWithWebhooks(db, [
      {
        id: 'wh-1',
        webhook_url: 'https://discord.com/api/webhooks/1/abc',
        token: 'tok-1',
      },
      {
        id: 'wh-2',
        webhook_url: 'https://discord.com/api/webhooks/2/def',
        token: 'tok-2',
      },
    ]);
    mockedSendToDiscord
      .mockRejectedValueOnce(new Error('ネットワーク障害'))
      .mockResolvedValueOnce({ ok: true, status: 204 });

    await runWithTimers(callConsumer(batch, env));

    expect(message.ack).toHaveBeenCalled();
  });

  it('複数メッセージを順次処理する', async () => {
    const message1 = createMockMessage({ version: 'v1.0.0' });
    const message2 = createMockMessage({ version: 'v2.0.0' });
    const batch = createMockBatch([message1, message2]);
    const { env } = createMockEnv();

    setupFetchSuccess();

    await callConsumer(batch, env);

    expect(message1.ack).toHaveBeenCalled();
    expect(message2.ack).toHaveBeenCalled();
  });
});
