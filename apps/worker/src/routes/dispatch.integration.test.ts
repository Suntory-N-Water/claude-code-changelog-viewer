import { describe, expect, it, vi } from 'vitest';

vi.mock('../infrastructure/channel-notifier', () => ({
  createChannelNotifier: () => ({
    sendTestNotification: vi.fn(),
    sendChangelogNotification: vi.fn(),
    sendUnsubscribeNotification: vi.fn(),
  }),
}));

import { app } from '../index';
import { FakeD1Database } from '../test-support/fake-d1';
import { createTestEnv } from '../test-support/notification-test-support';

type QueuedMessage = { version: string; traceId: string };

function createQueueEnv(db: FakeD1Database) {
  const env = createTestEnv(db);
  const queued: QueuedMessage[] = [];
  env.NOTIFICATION_QUEUE = {
    send: vi.fn(async (message: QueuedMessage) => {
      queued.push(message);
    }),
  } as unknown as Queue;
  return { env, queued };
}

function dispatchRequest(body: string, secret = 'dispatch-secret') {
  return {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body,
  } satisfies RequestInit;
}

describe('POST /api/dispatch integration', () => {
  it('正しい認証でバージョン番号だけを POST したとき、Queue にそのバージョン番号を投入すること', async () => {
    const db = new FakeD1Database();
    const sut = app;
    const { env, queued } = createQueueEnv(db);

    const response = await sut.request(
      '/api/dispatch',
      dispatchRequest(JSON.stringify({ version: 'v1.0.0' })),
      env,
    );

    expect(response.status).toBe(200);
    expect(queued).toEqual([{ version: 'v1.0.0', traceId: expect.any(String) }]);
    db.close();
  });

  it('認証に失敗したとき、401を返して Queue を変更しないこと', async () => {
    const db = new FakeD1Database();
    const sut = app;
    const { env, queued } = createQueueEnv(db);

    const response = await sut.request(
      '/api/dispatch',
      dispatchRequest(JSON.stringify({ version: 'v1.0.0' }), 'wrong-secret'),
      env,
    );

    expect(response.status).toBe(401);
    expect(queued).toEqual([]);
    db.close();
  });

  it('version が v で始まらないとき、400を返して Queue を変更しないこと', async () => {
    const db = new FakeD1Database();
    const sut = app;
    const { env, queued } = createQueueEnv(db);

    const response = await sut.request(
      '/api/dispatch',
      dispatchRequest(JSON.stringify({ version: '1.0.0' })),
      env,
    );

    expect(response.status).toBe(400);
    expect(queued).toEqual([]);
    db.close();
  });

  it('JSON として解析できないとき、400を返して Queue を変更しないこと', async () => {
    const db = new FakeD1Database();
    const sut = app;
    const { env, queued } = createQueueEnv(db);

    const response = await sut.request('/api/dispatch', dispatchRequest('{'), env);

    expect(response.status).toBe(400);
    expect(queued).toEqual([]);
    db.close();
  });

  it('Queue への投入に失敗したとき、500を返すこと', async () => {
    const db = new FakeD1Database();
    const sut = app;
    const { env } = createQueueEnv(db);
    env.NOTIFICATION_QUEUE = {
      send: vi.fn(async () => {
        throw new Error('Queue unavailable');
      }),
    } as unknown as Queue;

    const response = await sut.request(
      '/api/dispatch',
      dispatchRequest(JSON.stringify({ version: 'v1.0.0' })),
      env,
    );

    expect(response.status).toBe(500);
    db.close();
  });
});
