import { afterEach, describe, expect, it, mock } from 'bun:test';

const mockedVerifyTurnstile = mock();
const mockedCreateTestMessage = mock(() => ({ content: 'テスト通知' }));
const mockedSendToDiscord = mock();

mock.module('../lib/turnstile', () => ({
  verifyTurnstileToken: mockedVerifyTurnstile,
}));

mock.module('../lib/discord', () => ({
  buildUnsubscribeUrl: (workerUrl: string, token: string) =>
    `${workerUrl}/api/unsubscribe?token=${token}`,
  createTestMessage: mockedCreateTestMessage,
  sendToDiscord: mockedSendToDiscord,
}));

import { app } from '../index';
import { FakeD1Database } from './support/fake-d1';
import {
  createTestEnv,
  findWebhookByUrl,
  insertWebhook,
} from './support/notification-test-support';

function createRequestInit(
  body: Record<string, string> = {
    webhook_url: 'https://discord.com/api/webhooks/123456/abcdef',
    turnstile_token: 'valid-token',
  },
): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

describe('POST /api/webhooks integration', () => {
  let db: FakeD1Database | null = null;

  afterEach(() => {
    mockedVerifyTurnstile.mockReset();
    mockedCreateTestMessage.mockClear();
    mockedSendToDiscord.mockReset();
    db?.close();
    db = null;
  });

  it('有効な認証情報と Webhook URL を送るとテスト通知成功後に登録が保存される', async () => {
    // Arrange(準備)
    db = new FakeD1Database();
    const sut = app;
    const request = createRequestInit();
    const env = createTestEnv(db);
    mockedVerifyTurnstile.mockResolvedValue(true);
    mockedSendToDiscord.mockResolvedValue({ ok: true, status: 204 });

    // Act(実行)
    const response = await sut.request('/api/webhooks', request, env);

    // Assert(確認)
    expect(response.status).toBe(200);

    const saved = await findWebhookByUrl(
      db,
      'https://discord.com/api/webhooks/123456/abcdef',
    );

    expect(saved).toEqual({
      id: expect.any(String),
      webhook_url: 'https://discord.com/api/webhooks/123456/abcdef',
      active: 1,
      fail_count: 0,
      token: expect.any(String),
    });
  });

  it('既に有効な Webhook URL を送ると重複登録せず競合エラーになる', async () => {
    // Arrange(準備)
    db = new FakeD1Database();
    const sut = app;
    const request = createRequestInit();
    const env = createTestEnv(db);
    await insertWebhook(db, {
      id: 'existing-id',
      webhook_url: 'https://discord.com/api/webhooks/123456/abcdef',
      token: 'existing-token',
      active: 1,
    });
    mockedVerifyTurnstile.mockResolvedValue(true);

    // Act(実行)
    const response = await sut.request('/api/webhooks', request, env);

    // Assert(確認)
    expect(response.status).toBe(409);
    expect(
      await findWebhookByUrl(
        db,
        'https://discord.com/api/webhooks/123456/abcdef',
      ),
    ).toEqual({
      id: 'existing-id',
      webhook_url: 'https://discord.com/api/webhooks/123456/abcdef',
      token: 'existing-token',
      active: 1,
      fail_count: 0,
    });
  });

  it('停止済みの Webhook URL を送ると同じ token のまま再有効化される', async () => {
    // Arrange(準備)
    db = new FakeD1Database();
    const sut = app;
    const request = createRequestInit();
    const env = createTestEnv(db);
    await insertWebhook(db, {
      id: 'existing-id',
      webhook_url: 'https://discord.com/api/webhooks/123456/abcdef',
      token: 'existing-token',
      active: 0,
      fail_count: 2,
    });
    mockedVerifyTurnstile.mockResolvedValue(true);
    mockedSendToDiscord.mockResolvedValue({ ok: true, status: 204 });

    // Act(実行)
    const response = await sut.request('/api/webhooks', request, env);

    // Assert(確認)
    expect(response.status).toBe(200);
    expect(
      await findWebhookByUrl(
        db,
        'https://discord.com/api/webhooks/123456/abcdef',
      ),
    ).toEqual({
      id: 'existing-id',
      webhook_url: 'https://discord.com/api/webhooks/123456/abcdef',
      token: 'existing-token',
      active: 1,
      fail_count: 0,
    });
  });

  it('Turnstile 検証に失敗すると登録は保存されない', async () => {
    // Arrange(準備)
    db = new FakeD1Database();
    const sut = app;
    const request = createRequestInit();
    const env = createTestEnv(db);
    mockedVerifyTurnstile.mockResolvedValue(false);

    // Act(実行)
    const response = await sut.request('/api/webhooks', request, env);

    // Assert(確認)
    expect(response.status).toBe(403);
    expect(
      await findWebhookByUrl(
        db,
        'https://discord.com/api/webhooks/123456/abcdef',
      ),
    ).toBeNull();
  });

  it('Discord へのテスト通知が失敗すると登録は保存されない', async () => {
    // Arrange(準備)
    db = new FakeD1Database();
    const sut = app;
    const request = createRequestInit();
    const env = createTestEnv(db);
    mockedVerifyTurnstile.mockResolvedValue(true);
    mockedSendToDiscord.mockResolvedValue({ ok: false, status: 404 });

    // Act(実行)
    const response = await sut.request('/api/webhooks', request, env);

    // Assert(確認)
    expect(response.status).toBe(400);
    expect(
      await findWebhookByUrl(
        db,
        'https://discord.com/api/webhooks/123456/abcdef',
      ),
    ).toBeNull();
  });
});
