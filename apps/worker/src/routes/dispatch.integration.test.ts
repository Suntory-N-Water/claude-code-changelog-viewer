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
  it('正しい Bearer トークンで version + analysis を送ると Queue に投入される', async () => {
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
    expect(queued).toEqual([{ version: 'v1.0.0', analysis: validAnalysis }]);
    db.close();
  });

  it('認証に失敗すると Queue に何も投入されない', async () => {
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

  it('不正なリクエストボディでは Queue に何も投入されない', async () => {
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
});
