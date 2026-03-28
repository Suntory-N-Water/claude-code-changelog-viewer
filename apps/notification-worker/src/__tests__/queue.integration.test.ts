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

const mockedSendToDiscord = mock();

mock.module('../lib/discord', () => ({
  buildUnsubscribeUrl: (workerUrl: string, token: string) =>
    `${workerUrl}/api/unsubscribe?token=${token}`,
  createChangelogMessage: () => ({
    content: 'テスト通知',
    username: 'Bot',
  }),
  sendToDiscord: mockedSendToDiscord,
}));

const mockFetch = spyOn(globalThis, 'fetch');

import type { Analysis } from '@claude-code-changelog-viewer/types';
import { queueConsumer } from '../queue/consumer';
import { FakeD1Database } from './support/fake-d1';
import {
  createQueueBatch,
  createQueueMessage,
  createTestEnv,
  findWebhookByToken,
  insertWebhook,
} from './support/notification-test-support';

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

function setupFetchSuccess() {
  const impl: typeof fetch = Object.assign(
    () => Promise.resolve(Response.json(validAnalysis)),
    { preconnect: globalThis.fetch.preconnect },
  );
  mockFetch.mockImplementation(impl);
}

async function runWithTimers(promise: Promise<void>) {
  const result = promise;
  for (let i = 0; i < 50; i++) {
    vi.advanceTimersByTime(1000);
    await Promise.resolve();
  }
  return result;
}

function callConsumer(batch: MessageBatch<unknown>, env: CloudflareBindings) {
  return queueConsumer?.(batch, env, {} as ExecutionContext) as Promise<void>;
}

describe('queueConsumer integration', () => {
  let db: FakeD1Database | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    db?.close();
    db = null;
  });

  it('送信成功時は過去の fail_count が 0 に戻る', async () => {
    // Arrange(準備)
    db = new FakeD1Database();
    const message = createQueueMessage({ version: 'v1.0.0' });
    const batch = createQueueBatch([message]);
    const env = createTestEnv(db);
    setupFetchSuccess();
    await insertWebhook(db, {
      id: 'active-id',
      webhook_url: 'https://discord.com/api/webhooks/123456/abcdef',
      token: 'active-token',
      fail_count: 2,
    });
    mockedSendToDiscord.mockResolvedValue({ ok: true, status: 204 });

    // Act(実行)
    await runWithTimers(callConsumer(batch, env));

    // Assert(確認)
    expect(message.ack).toHaveBeenCalled();
    expect(await findWebhookByToken(db, 'active-token')).toEqual({
      id: 'active-id',
      webhook_url: 'https://discord.com/api/webhooks/123456/abcdef',
      token: 'active-token',
      active: 1,
      fail_count: 0,
    });
  });

  it('恒久失敗が続くと fail_count が増えしきい値到達で自動停止される', async () => {
    // Arrange(準備)
    db = new FakeD1Database();
    const message = createQueueMessage({ version: 'v1.0.0' });
    const batch = createQueueBatch([message]);
    const env = createTestEnv(db);
    setupFetchSuccess();
    await insertWebhook(db, {
      id: 'active-id',
      webhook_url: 'https://discord.com/api/webhooks/123456/abcdef',
      token: 'active-token',
      fail_count: 2,
    });
    mockedSendToDiscord.mockResolvedValue({ ok: false, status: 404 });

    // Act(実行)
    await runWithTimers(callConsumer(batch, env));

    // Assert(確認)
    expect(message.ack).toHaveBeenCalled();
    expect(await findWebhookByToken(db, 'active-token')).toEqual({
      id: 'active-id',
      webhook_url: 'https://discord.com/api/webhooks/123456/abcdef',
      token: 'active-token',
      active: 0,
      fail_count: 3,
    });
  });

  it('複数 webhook 配信中に一部が失敗しても各 Webhook の最終状態が正しく反映される', async () => {
    // Arrange(準備)
    db = new FakeD1Database();
    const message = createQueueMessage({ version: 'v1.0.0' });
    const batch = createQueueBatch([message]);
    const env = createTestEnv(db);
    setupFetchSuccess();
    await insertWebhook(db, {
      id: 'success-id',
      webhook_url: 'https://discord.com/api/webhooks/123456/success',
      token: 'success-token',
      fail_count: 1,
    });
    await insertWebhook(db, {
      id: 'fail-id',
      webhook_url: 'https://discord.com/api/webhooks/123456/fail',
      token: 'fail-token',
      fail_count: 2,
    });
    mockedSendToDiscord
      .mockResolvedValueOnce({ ok: true, status: 204 })
      .mockResolvedValueOnce({ ok: false, status: 401 });

    // Act(実行)
    await runWithTimers(callConsumer(batch, env));

    // Assert(確認)
    expect(message.ack).toHaveBeenCalled();
    expect(await findWebhookByToken(db, 'success-token')).toEqual({
      id: 'success-id',
      webhook_url: 'https://discord.com/api/webhooks/123456/success',
      token: 'success-token',
      active: 1,
      fail_count: 0,
    });
    expect(await findWebhookByToken(db, 'fail-token')).toEqual({
      id: 'fail-id',
      webhook_url: 'https://discord.com/api/webhooks/123456/fail',
      token: 'fail-token',
      active: 0,
      fail_count: 3,
    });
  });
});
