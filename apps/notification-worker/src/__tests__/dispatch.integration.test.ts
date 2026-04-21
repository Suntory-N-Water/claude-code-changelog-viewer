import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/email', () => ({
  sendToEmail: vi.fn(),
  createEmailTestMessage: vi.fn(),
}));

import { app } from '../index';
import { FakeD1Database } from './support/fake-d1';
import { createTestEnv } from './support/notification-test-support';

function createQueueEnv(db: FakeD1Database) {
  const env = createTestEnv(db);
  const queued: { body: { version: string } }[][] = [];
  env.NOTIFICATION_QUEUE = {
    sendBatch: vi.fn(async (messages: { body: { version: string } }[]) => {
      queued.push(messages);
    }),
  } as unknown as Queue;
  return { env, queued };
}

describe('POST /api/dispatch integration', () => {
  it('正しい Bearer トークンで複数 version を送ると全 version が Queue に投入される', async () => {
    // Arrange(準備)
    const db = new FakeD1Database();
    const sut = app;
    const { env, queued } = createQueueEnv(db);
    const request = {
      method: 'POST',
      headers: {
        Authorization: 'Bearer dispatch-secret',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ versions: ['v1.0.0', 'v1.1.0'] }),
    } satisfies RequestInit;

    // Act(実行)
    const response = await sut.request('/api/dispatch', request, env);

    // Assert(確認)
    expect(response.status).toBe(200);
    expect(queued).toEqual([
      [{ body: { version: 'v1.0.0' } }, { body: { version: 'v1.1.0' } }],
    ]);
    db.close();
  });

  it('認証に失敗すると Queue に何も投入されない', async () => {
    // Arrange(準備)
    const db = new FakeD1Database();
    const sut = app;
    const { env, queued } = createQueueEnv(db);
    const request = {
      method: 'POST',
      headers: {
        Authorization: 'Bearer wrong-secret',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ versions: ['v1.0.0'] }),
    } satisfies RequestInit;

    // Act(実行)
    const response = await sut.request('/api/dispatch', request, env);

    // Assert(確認)
    expect(response.status).toBe(401);
    expect(queued).toEqual([]);
    db.close();
  });

  it('不正な versions 配列では Queue に何も投入されない', async () => {
    // Arrange(準備)
    const db = new FakeD1Database();
    const sut = app;
    const { env, queued } = createQueueEnv(db);
    const request = {
      method: 'POST',
      headers: {
        Authorization: 'Bearer dispatch-secret',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ versions: [] }),
    } satisfies RequestInit;

    // Act(実行)
    const response = await sut.request('/api/dispatch', request, env);

    // Assert(確認)
    expect(response.status).toBe(400);
    expect(queued).toEqual([]);
    db.close();
  });
});
