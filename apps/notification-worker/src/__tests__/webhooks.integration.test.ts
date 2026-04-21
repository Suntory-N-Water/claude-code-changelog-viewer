import { describe, expect, it, vi, afterEach } from 'vitest';
const { mockedVerifyTurnstile, mockedCreateTestMessage, mockedSendToDiscord } =
  vi.hoisted(() => ({
    mockedVerifyTurnstile: vi.fn(),
    mockedCreateTestMessage: vi.fn(() => ({ content: 'テスト通知' })),
    mockedSendToDiscord: vi.fn(),
  }));

vi.mock('../lib/turnstile', () => ({
  verifyTurnstileToken: mockedVerifyTurnstile,
}));

vi.mock('../lib/discord', () => ({
  buildUnsubscribeUrl: (workerUrl: string, token: string) =>
    `${workerUrl}/api/unsubscribe?token=${token}`,
  createTestMessage: mockedCreateTestMessage,
  sendToDiscord: mockedSendToDiscord,
}));

vi.mock('../lib/email', () => ({
  sendToEmail: vi.fn(),
  createEmailTestMessage: vi.fn(),
}));

import { app } from '../index';
import { FakeD1Database } from './support/fake-d1';
import {
  createTestEnv,
  findChannelByWebhookUrl,
  findNotificationSettings,
  insertDiscordWebhook,
} from './support/notification-test-support';

const validWebhookUrl = 'https://discord.com/api/webhooks/123456/abcdef';

function createRequestInit(
  body: Record<string, string> = {
    webhook_url: validWebhookUrl,
    turnstile_token: 'valid-token',
    frequency: 'IMM',
    channel_type: 'DSC',
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

  it('有効な認証情報と Webhook URL を送ると channels・discord_channels・notification_settings の3テーブルに登録される', async () => {
    // Arrange(準備)
    db = new FakeD1Database();
    const env = createTestEnv(db);
    mockedVerifyTurnstile.mockResolvedValue(true);
    mockedSendToDiscord.mockResolvedValue({ ok: true, status: 204 });

    // Act(実行)
    const response = await app.request(
      '/api/webhooks',
      createRequestInit(),
      env,
    );

    // Assert(確認)
    expect(response.status).toBe(200);
    const saved = await findChannelByWebhookUrl(db, validWebhookUrl);
    expect(saved).toEqual({
      id: expect.any(String),
      webhook_url: validWebhookUrl,
      is_active: 1,
      fail_count: 0,
      token: expect.any(String),
    });
  });

  it('frequency=IMM を指定して登録すると notification_settings に IMM で保存される', async () => {
    // Arrange(準備)
    db = new FakeD1Database();
    const env = createTestEnv(db);
    mockedVerifyTurnstile.mockResolvedValue(true);
    mockedSendToDiscord.mockResolvedValue({ ok: true, status: 204 });

    // Act(実行)
    await app.request('/api/webhooks', createRequestInit(), env);

    // Assert(確認)
    const saved = await findChannelByWebhookUrl(db, validWebhookUrl);
    const ns = saved ? await findNotificationSettings(db, saved.id) : null;
    expect(ns?.frequency).toBe('IMM');
  });

  it('frequency=WEK を指定して登録できる', async () => {
    // Arrange(準備)
    db = new FakeD1Database();
    const env = createTestEnv(db);
    mockedVerifyTurnstile.mockResolvedValue(true);
    mockedSendToDiscord.mockResolvedValue({ ok: true, status: 204 });

    // Act(実行)
    await app.request(
      '/api/webhooks',
      createRequestInit({
        webhook_url: validWebhookUrl,
        turnstile_token: 'valid-token',
        frequency: 'WEK',
        channel_type: 'DSC',
      }),
      env,
    );

    // Assert(確認)
    const saved = await findChannelByWebhookUrl(db, validWebhookUrl);
    const ns = saved ? await findNotificationSettings(db, saved.id) : null;
    expect(ns?.frequency).toBe('WEK');
  });

  it('既に有効な Webhook URL を送ると重複登録せず 409 になる', async () => {
    // Arrange(準備)
    db = new FakeD1Database();
    const env = createTestEnv(db);
    await insertDiscordWebhook(db, {
      id: 'existing-id',
      webhookUrl: validWebhookUrl,
      token: 'existing-token',
      isActive: 1,
    });
    mockedVerifyTurnstile.mockResolvedValue(true);

    // Act(実行)
    const response = await app.request(
      '/api/webhooks',
      createRequestInit(),
      env,
    );

    // Assert(確認)
    expect(response.status).toBe(409);
    expect(await findChannelByWebhookUrl(db, validWebhookUrl)).toEqual({
      id: 'existing-id',
      webhook_url: validWebhookUrl,
      token: 'existing-token',
      is_active: 1,
      fail_count: 0,
    });
  });

  it('停止済みの Webhook URL を送ると同じ token のまま再有効化される', async () => {
    // Arrange(準備)
    db = new FakeD1Database();
    const env = createTestEnv(db);
    await insertDiscordWebhook(db, {
      id: 'existing-id',
      webhookUrl: validWebhookUrl,
      token: 'existing-token',
      isActive: 0,
      failCount: 2,
    });
    mockedVerifyTurnstile.mockResolvedValue(true);
    mockedSendToDiscord.mockResolvedValue({ ok: true, status: 204 });

    // Act(実行)
    const response = await app.request(
      '/api/webhooks',
      createRequestInit(),
      env,
    );

    // Assert(確認)
    expect(response.status).toBe(200);
    expect(await findChannelByWebhookUrl(db, validWebhookUrl)).toEqual({
      id: 'existing-id',
      webhook_url: validWebhookUrl,
      token: 'existing-token',
      is_active: 1,
      fail_count: 0,
    });
  });

  it('Turnstile 検証に失敗すると登録は保存されない', async () => {
    // Arrange(準備)
    db = new FakeD1Database();
    const env = createTestEnv(db);
    mockedVerifyTurnstile.mockResolvedValue(false);

    // Act(実行)
    const response = await app.request(
      '/api/webhooks',
      createRequestInit(),
      env,
    );

    // Assert(確認)
    expect(response.status).toBe(403);
    expect(await findChannelByWebhookUrl(db, validWebhookUrl)).toBeNull();
  });

  it('Discord へのテスト通知が失敗すると登録は保存されない', async () => {
    // Arrange(準備)
    db = new FakeD1Database();
    const env = createTestEnv(db);
    mockedVerifyTurnstile.mockResolvedValue(true);
    mockedSendToDiscord.mockResolvedValue({ ok: false, status: 404 });

    // Act(実行)
    const response = await app.request(
      '/api/webhooks',
      createRequestInit(),
      env,
    );

    // Assert(確認)
    expect(response.status).toBe(400);
    expect(await findChannelByWebhookUrl(db, validWebhookUrl)).toBeNull();
  });

  it('不正な Webhook URL で 400 を返す', async () => {
    // Arrange(準備)
    db = new FakeD1Database();
    const env = createTestEnv(db);
    mockedVerifyTurnstile.mockResolvedValue(true);

    // Act(実行)
    const response = await app.request(
      '/api/webhooks',
      createRequestInit({
        webhook_url: 'https://example.com/not-a-webhook',
        turnstile_token: 'valid-token',
        frequency: 'IMM',
        channel_type: 'DSC',
      }),
      env,
    );

    // Assert(確認)
    expect(response.status).toBe(400);
    expect(await response.json<unknown>()).toEqual({
      error: 'Discord Webhook URLの形式が不正です',
    });
  });

  it('webhook_url が空文字で 400 を返す', async () => {
    // Arrange(準備)
    db = new FakeD1Database();
    const env = createTestEnv(db);
    mockedVerifyTurnstile.mockResolvedValue(true);

    // Act(実行)
    const response = await app.request(
      '/api/webhooks',
      createRequestInit({ webhook_url: '', turnstile_token: 'valid-token' }),
      env,
    );

    // Assert(確認)
    expect(response.status).toBe(400);
  });

  it('リクエストボディが不正で 400 を返す', async () => {
    // Arrange(準備)
    db = new FakeD1Database();
    const env = createTestEnv(db);

    // Act(実行)
    const response = await app.request(
      '/api/webhooks',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invalid: 'body' }),
      },
      env,
    );

    // Assert(確認)
    expect(response.status).toBe(400);
    expect(await response.json<unknown>()).toEqual({
      error: 'リクエストが不正です',
    });
  });
});
