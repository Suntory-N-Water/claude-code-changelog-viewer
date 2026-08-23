import { describe, expect, it, vi } from 'vitest';

vi.mock('../infrastructure/channel-notifier', () => ({
  createChannelNotifier: () => ({
    sendTestNotification: vi.fn(),
    sendChangelogNotification: vi.fn(),
    sendUnsubscribeNotification: vi.fn(),
  }),
}));

import type { NotificationAnalysis } from '@claude-code-changelog-viewer/types';
import { app } from '../index';
import { FakeD1Database } from '../test-support/fake-d1';
import { createTestEnv } from '../test-support/notification-test-support';

type QueuedMessage = { version: string; analysis: NotificationAnalysis };

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

const validAnalysis: NotificationAnalysis = {
  version: 'v1.0.0',
  summary: 'テスト用サマリー',
  items: [
    { content: 'Added new feature', content_ja: '新機能', prefix: 'feat' },
  ],
};

describe('POST /api/dispatch integration', () => {
  it('正しい認証と有効な payload のとき、Queue に通知メッセージが投入されること', async () => {
    const db = new FakeD1Database();
    const sut = app;
    const { env, queued } = createQueueEnv(db);
    const request = {
      method: 'POST',
      headers: {
        Authorization: 'Bearer dispatch-secret',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ version: 'v1.0.0', analysis: validAnalysis }),
    } satisfies RequestInit;

    const response = await sut.request('/api/dispatch', request, env);

    expect(response.status).toBe(200);
    expect(queued).toEqual([
      {
        version: 'v1.0.0',
        analysis: validAnalysis,
        traceId: expect.any(String),
      },
    ]);
    db.close();
  });

  it('認証に失敗したとき、401を返して Queue を変更しないこと', async () => {
    const db = new FakeD1Database();
    const sut = app;
    const { env, queued } = createQueueEnv(db);
    const request = {
      method: 'POST',
      headers: {
        Authorization: 'Bearer wrong-secret',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ version: 'v1.0.0', analysis: validAnalysis }),
    } satisfies RequestInit;

    const response = await sut.request('/api/dispatch', request, env);

    expect(response.status).toBe(401);
    expect(queued).toEqual([]);
    db.close();
  });

  it('payload が不正なとき、400を返して Queue を変更しないこと', async () => {
    const db = new FakeD1Database();
    const sut = app;
    const { env, queued } = createQueueEnv(db);
    const request = {
      method: 'POST',
      headers: {
        Authorization: 'Bearer dispatch-secret',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ version: 'v1.0.0' }),
    } satisfies RequestInit;

    const response = await sut.request('/api/dispatch', request, env);

    expect(response.status).toBe(400);
    expect(queued).toEqual([]);
    db.close();
  });

  it('日本語要約と翻訳が null のとき、有効な payload として Queue に投入されること', async () => {
    const db = new FakeD1Database();
    const sut = app;
    const { env, queued } = createQueueEnv(db);
    const analysis: NotificationAnalysis = {
      version: 'v1.0.0',
      summary: null,
      items: [{ content: 'Raw content', content_ja: null, prefix: 'Added' }],
    };
    const request = {
      method: 'POST',
      headers: {
        Authorization: 'Bearer dispatch-secret',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ version: 'v1.0.0', analysis }),
    } satisfies RequestInit;

    const response = await sut.request('/api/dispatch', request, env);

    expect(response.status).toBe(200);
    expect(queued).toEqual([
      {
        version: 'v1.0.0',
        analysis,
        traceId: expect.any(String),
      },
    ]);
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
    const request = {
      method: 'POST',
      headers: {
        Authorization: 'Bearer dispatch-secret',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ version: 'v1.0.0', analysis: validAnalysis }),
    } satisfies RequestInit;

    const response = await sut.request('/api/dispatch', request, env);

    expect(response.status).toBe(500);
    db.close();
  });
});
