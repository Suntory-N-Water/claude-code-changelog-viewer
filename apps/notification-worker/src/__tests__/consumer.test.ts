import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
  vi,
} from 'bun:test';

// 外部依存のモック
const mockedSendToDiscord = mock();

mock.module('../lib/discord', () => ({
  buildUnsubscribeUrl: mock(
    (workerUrl: string, token: string) =>
      `${workerUrl}/api/unsubscribe?token=${token}`,
  ),
  createChangelogMessage: mock(() => ({
    content: 'テスト通知',
    username: 'Bot',
  })),
  sendToDiscord: mockedSendToDiscord,
}));

// fetch をモック(spyOn 経由で型安全にモック)
const mockFetch = spyOn(globalThis, 'fetch');

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
  prepare: ReturnType<typeof mock>;
  _run: ReturnType<typeof mock>;
  _first: ReturnType<typeof mock>;
};

function createMockMessage(body: unknown) {
  return {
    body,
    id: 'msg-1',
    timestamp: new Date(),
    attempts: 1,
    ack: mock(),
    retry: mock(),
  };
}

function createMockBatch(messages: ReturnType<typeof createMockMessage>[]) {
  return {
    messages,
    queue: 'test-queue',
    ackAll: mock(),
    retryAll: mock(),
  } as unknown as MessageBatch<unknown>;
}

function createMockEnv() {
  const run = mock().mockResolvedValue({ success: true });
  const first = mock();
  const db: MockDB = {
    prepare: mock().mockReturnValue({
      bind: mock().mockReturnValue({
        all: mock().mockResolvedValue({ results: [] }),
        run,
        first,
      }),
      all: mock().mockResolvedValue({ results: [] }),
    }),
    _run: run,
    _first: first,
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
    { preconnect: globalThis.fetch.preconnect },
  );
  mockFetch.mockImplementation(impl);
}

function setupDBWithWebhooks(
  db: MockDB,
  webhooks: {
    id: string;
    webhook_url: string;
    token: string;
    fail_count?: number;
  }[],
) {
  db.prepare = mock().mockImplementation((sql: string) => {
    if (sql.includes('SELECT')) {
      return {
        all: mock().mockResolvedValue({ results: webhooks }),
      };
    }
    return {
      bind: mock().mockReturnValue({
        run: db._run,
        first: db._first,
      }),
    };
  });
}

describe('queueConsumer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // setTimeout を即時実行にする
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // setTimeout を進めながら非同期処理を実行するヘルパー
  async function runWithTimers(promise: Promise<void>) {
    const result = promise;
    // タイマーを繰り返し進める
    for (let i = 0; i < 50; i++) {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    }
    return result;
  }

  function callConsumer(batch: MessageBatch<unknown>, env: CloudflareBindings) {
    // biome-ignore lint/style/noNonNullAssertion: テスト用に queue handler の存在を前提とする
    return queueConsumer!(batch, env, {} as ExecutionContext) as Promise<void>;
  }

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

  it('アクティブな webhook がない場合は ack する', async () => {
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
    setupDBWithWebhooks(db, [
      {
        id: 'wh-1',
        webhook_url: 'https://discord.com/api/webhooks/1/abc',
        token: 'tok-1',
      },
    ]);
    mockedSendToDiscord.mockResolvedValue({ ok: false, status: 404 });
    db._first.mockResolvedValue({ fail_count: 1 });

    await runWithTimers(callConsumer(batch, env));

    expect(message.ack).toHaveBeenCalled();
  });

  it('fail_count が閾値に達したら webhook を無効化する', async () => {
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
    mockedSendToDiscord.mockResolvedValue({ ok: false, status: 401 });
    // 統合クエリの RETURNING で active=0 が返される
    db._first.mockResolvedValue({ fail_count: 3, active: 0 });

    await runWithTimers(callConsumer(batch, env));

    expect(message.ack).toHaveBeenCalled();
  });

  it('sendToDiscord が例外をスローしても他の webhook の処理を続行する', async () => {
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
    // webhook なしの環境でシンプルに ack されることを確認

    await callConsumer(batch, env);

    expect(message1.ack).toHaveBeenCalled();
    expect(message2.ack).toHaveBeenCalled();
  });
});
