import { describe, expect, it, vi, afterEach } from 'vitest';
const { mockedVerifyTurnstile, mockedSendTestNotification } = vi.hoisted(
  () => ({
    mockedVerifyTurnstile: vi.fn(),
    mockedSendTestNotification: vi.fn(),
  }),
);

vi.mock('../infrastructure/turnstile', () => ({
  verifyTurnstileToken: mockedVerifyTurnstile,
}));

vi.mock('../infrastructure/channel-notifier', () => ({
  createChannelNotifier: () => ({
    sendTestNotification: mockedSendTestNotification,
    sendChangelogNotification: vi.fn(),
    sendUnsubscribeNotification: vi.fn(),
  }),
}));

import { app } from '../index';
import { FakeD1Database } from '../test-support/fake-d1';
import {
  createTestEnv,
  findChannelByWebhookUrl,
  findNotificationSettings,
  insertDiscordWebhook,
} from '../test-support/notification-test-support';

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
    mockedSendTestNotification.mockReset();
    db?.close();
    db = null;
  });

  it('有効な認証情報と Webhook URL を送ると channels・discord_channels・notification_settings の3テーブルに登録される', async () => {
    db = new FakeD1Database();
    const env = createTestEnv(db);
    mockedVerifyTurnstile.mockResolvedValue(true);
    mockedSendTestNotification.mockResolvedValue({ ok: true });

    const response = await app.request(
      '/api/webhooks',
      createRequestInit(),
      env,
    );

    expect(response.status).toBe(200);
    const saved = await findChannelByWebhookUrl(db, validWebhookUrl);
    expect(saved).toEqual({
      id: expect.any(String),
      webhook_url: validWebhookUrl,
      deactivated_at: '9999-12-31',
      deactivated_reason: 'none',
      fail_count: 0,
      token: expect.any(String),
    });
  });

  it('frequency=IMM を指定して登録すると notification_settings に IMM で保存される', async () => {
    db = new FakeD1Database();
    const env = createTestEnv(db);
    mockedVerifyTurnstile.mockResolvedValue(true);
    mockedSendTestNotification.mockResolvedValue({ ok: true });

    await app.request('/api/webhooks', createRequestInit(), env);

    const saved = await findChannelByWebhookUrl(db, validWebhookUrl);
    const ns = saved ? await findNotificationSettings(db, saved.id) : null;
    expect(ns?.frequency).toBe('IMM');
  });

  it('frequency=WEK を指定して登録できる', async () => {
    db = new FakeD1Database();
    const env = createTestEnv(db);
    mockedVerifyTurnstile.mockResolvedValue(true);
    mockedSendTestNotification.mockResolvedValue({ ok: true });

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

    const saved = await findChannelByWebhookUrl(db, validWebhookUrl);
    const ns = saved ? await findNotificationSettings(db, saved.id) : null;
    expect(ns?.frequency).toBe('WEK');
  });

  it('既に有効な Webhook URL を送ると重複登録せず 409 になる', async () => {
    db = new FakeD1Database();
    const env = createTestEnv(db);
    await insertDiscordWebhook(db, {
      id: 'existing-id',
      webhookUrl: validWebhookUrl,
      token: 'existing-token',
      deactivatedAt: '9999-12-31',
    });
    mockedVerifyTurnstile.mockResolvedValue(true);

    const response = await app.request(
      '/api/webhooks',
      createRequestInit(),
      env,
    );

    expect(response.status).toBe(409);
    expect(await findChannelByWebhookUrl(db, validWebhookUrl)).toEqual({
      id: 'existing-id',
      webhook_url: validWebhookUrl,
      token: 'existing-token',
      deactivated_at: '9999-12-31',
      deactivated_reason: 'none',
      fail_count: 0,
    });
  });

  it('system停止済みの Webhook URL を送ると同じ token のまま再有効化される', async () => {
    db = new FakeD1Database();
    const env = createTestEnv(db);
    await insertDiscordWebhook(db, {
      id: 'existing-id',
      webhookUrl: validWebhookUrl,
      token: 'existing-token',
      deactivatedAt: '2026-01-01 00:00:00',
      deactivatedReason: 'system',
      failCount: 2,
    });
    mockedVerifyTurnstile.mockResolvedValue(true);
    mockedSendTestNotification.mockResolvedValue({ ok: true });

    const response = await app.request(
      '/api/webhooks',
      createRequestInit(),
      env,
    );

    expect(response.status).toBe(200);
    expect(await findChannelByWebhookUrl(db, validWebhookUrl)).toEqual({
      id: 'existing-id',
      webhook_url: validWebhookUrl,
      token: 'existing-token',
      deactivated_at: '9999-12-31',
      deactivated_reason: 'none',
      fail_count: 0,
    });
  });

  it('user停止済み(unsubscribe済み)の Webhook URL を送っても再有効化されず 409 になる', async () => {
    db = new FakeD1Database();
    const env = createTestEnv(db);
    await insertDiscordWebhook(db, {
      id: 'existing-id',
      webhookUrl: validWebhookUrl,
      token: 'existing-token',
      deactivatedAt: '2026-01-01 00:00:00',
      deactivatedReason: 'user',
      failCount: 0,
    });
    mockedVerifyTurnstile.mockResolvedValue(true);

    const response = await app.request(
      '/api/webhooks',
      createRequestInit(),
      env,
    );

    expect(response.status).toBe(409);
    expect(mockedSendTestNotification).not.toHaveBeenCalled();
    expect(await findChannelByWebhookUrl(db, validWebhookUrl)).toEqual({
      id: 'existing-id',
      webhook_url: validWebhookUrl,
      token: 'existing-token',
      deactivated_at: '2026-01-01 00:00:00',
      deactivated_reason: 'user',
      fail_count: 0,
    });
  });

  it('Turnstile 検証に失敗すると登録は保存されない', async () => {
    db = new FakeD1Database();
    const env = createTestEnv(db);
    mockedVerifyTurnstile.mockResolvedValue(false);

    const response = await app.request(
      '/api/webhooks',
      createRequestInit(),
      env,
    );

    expect(response.status).toBe(403);
    expect(await findChannelByWebhookUrl(db, validWebhookUrl)).toBeNull();
  });

  it('登録レート制限を超えた時、Turnstile 検証前に 429 を返す', async () => {
    db = new FakeD1Database();
    const env = createTestEnv(db);
    env.WEBHOOK_RATE_LIMITER = {
      limit: vi.fn(() => Promise.resolve({ success: false })),
    } as unknown as RateLimit;

    const response = await app.request(
      '/api/webhooks',
      createRequestInit(),
      env,
    );

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
    expect(mockedVerifyTurnstile).not.toHaveBeenCalled();
    expect(await findChannelByWebhookUrl(db, validWebhookUrl)).toBeNull();
  });

  it('Discord へのテスト通知が失敗すると登録は保存されない', async () => {
    db = new FakeD1Database();
    const env = createTestEnv(db);
    mockedVerifyTurnstile.mockResolvedValue(true);
    mockedSendTestNotification.mockResolvedValue({ ok: false });

    const response = await app.request(
      '/api/webhooks',
      createRequestInit(),
      env,
    );

    expect(response.status).toBe(400);
    expect(await findChannelByWebhookUrl(db, validWebhookUrl)).toBeNull();
  });

  it('不正な Webhook URL で 400 を返す', async () => {
    db = new FakeD1Database();
    const env = createTestEnv(db);
    mockedVerifyTurnstile.mockResolvedValue(true);

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

    expect(response.status).toBe(400);
  });

  it('webhook_url が空文字で 400 を返す', async () => {
    db = new FakeD1Database();
    const env = createTestEnv(db);
    mockedVerifyTurnstile.mockResolvedValue(true);

    const response = await app.request(
      '/api/webhooks',
      createRequestInit({ webhook_url: '', turnstile_token: 'valid-token' }),
      env,
    );

    expect(response.status).toBe(400);
  });

  it('リクエストボディが不正で 400 を返す', async () => {
    db = new FakeD1Database();
    const env = createTestEnv(db);

    const response = await app.request(
      '/api/webhooks',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invalid: 'body' }),
      },
      env,
    );

    expect(response.status).toBe(400);
  });
});
