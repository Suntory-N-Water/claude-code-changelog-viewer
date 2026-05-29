import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
vi.mock('../lib/email', () => ({
  sendToEmail: vi.fn(),
  createEmailTestMessage: vi.fn(),
  createEmailUnsubscribeNotification: vi.fn().mockReturnValue({}),
}));
vi.mock('../lib/discord', () => ({
  sendToDiscord: vi.fn().mockResolvedValue({ ok: true, status: 200 }),
  createUnsubscribeNotification: vi.fn().mockReturnValue({}),
  buildUnsubscribeUrl: vi
    .fn()
    .mockReturnValue('https://example.com/unsubscribe'),
}));
vi.mock('../lib/slack', () => ({
  sendToSlack: vi.fn().mockResolvedValue({ ok: true, status: 200 }),
  createSlackUnsubscribeNotification: vi.fn().mockReturnValue({}),
}));

import { app } from '../index';
import { FakeD1Database } from './support/fake-d1';
import {
  createTestEnv,
  findChannelByToken,
  insertDiscordWebhook,
} from './support/notification-test-support';
import { sendToDiscord } from '../lib/discord';

describe('/api/unsubscribe integration', () => {
  let db: FakeD1Database | null = null;

  beforeEach(() => {
    vi.mocked(sendToDiscord).mockResolvedValue({ ok: true, status: 200 });
  });

  afterEach(() => {
    db?.close();
    db = null;
    vi.clearAllMocks();
  });

  it('有効な token で確認画面を開くと停止前の確認 HTML が返り channels.deactivated_at は変わらない', async () => {
    // Arrange(準備)
    db = new FakeD1Database();
    const env = createTestEnv(db);
    await insertDiscordWebhook(db, {
      id: 'active-id',
      webhookUrl: 'https://discord.com/api/webhooks/123456/abcdef',
      token: 'active-token',
      deactivatedAt: '9999-12-31',
    });

    // Act(実行)
    const response = await app.request(
      '/api/unsubscribe?token=active-token',
      {},
      env,
    );

    // Assert(確認)
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('通知停止の確認');
    expect(await findChannelByToken(db, 'active-token')).toEqual({
      id: 'active-id',
      webhook_url: 'https://discord.com/api/webhooks/123456/abcdef',
      token: 'active-token',
      deactivated_at: '9999-12-31',
      deactivated_reason: 'none',
      fail_count: 0,
    });
  });

  it('有効な token で停止を実行するとチャンネルがユーザー停止になり停止通知が送信される', async () => {
    // Arrange(準備)
    db = new FakeD1Database();
    const env = createTestEnv(db);
    const request = {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: 'active-token' }).toString(),
    } satisfies RequestInit;
    await insertDiscordWebhook(db, {
      id: 'active-id',
      webhookUrl: 'https://discord.com/api/webhooks/123456/abcdef',
      token: 'active-token',
      deactivatedAt: '9999-12-31',
    });

    // Act(実行)
    const response = await app.request('/api/unsubscribe', request, env);

    // Assert(確認)
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('通知を停止しました');
    expect(await findChannelByToken(db, 'active-token')).toEqual({
      id: 'active-id',
      webhook_url: 'https://discord.com/api/webhooks/123456/abcdef',
      token: 'active-token',
      deactivated_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}/),
      deactivated_reason: 'user',
      fail_count: 0,
    });
    expect(sendToDiscord).toHaveBeenCalledOnce();
    expect(sendToDiscord).toHaveBeenCalledWith(
      'https://discord.com/api/webhooks/123456/abcdef',
      expect.anything(),
    );
  });

  it('停止通知の送信が失敗しても停止 HTML が返りチャンネルはユーザー停止になる', async () => {
    // Arrange(準備)
    db = new FakeD1Database();
    const env = createTestEnv(db);
    vi.mocked(sendToDiscord).mockRejectedValueOnce(new Error('network error'));
    const request = {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: 'active-token' }).toString(),
    } satisfies RequestInit;
    await insertDiscordWebhook(db, {
      id: 'active-id',
      webhookUrl: 'https://discord.com/api/webhooks/123456/abcdef',
      token: 'active-token',
      deactivatedAt: '9999-12-31',
    });

    // Act(実行)
    const response = await app.request('/api/unsubscribe', request, env);

    // Assert(確認)
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('通知を停止しました');
    expect(await findChannelByToken(db, 'active-token')).toMatchObject({
      deactivated_reason: 'user',
    });
  });

  it('存在しない token では 404 エラー画面が返り DB は変更されない', async () => {
    // Arrange(準備)
    db = new FakeD1Database();
    const env = createTestEnv(db);

    // Act(実行)
    const response = await app.request(
      '/api/unsubscribe?token=missing-token',
      {},
      env,
    );

    // Assert(確認)
    expect(response.status).toBe(404);
    expect(await response.text()).toContain('該当する登録が見つかりません');
  });

  it('GET で token クエリパラメータがない場合は 400 を返す', async () => {
    // Arrange(準備)
    db = new FakeD1Database();
    const env = createTestEnv(db);

    // Act(実行)
    const response = await app.request('/api/unsubscribe', {}, env);

    // Assert(確認)
    expect(response.status).toBe(400);
    expect(await response.text()).toContain('トークンが指定されていません');
  });

  it('既に停止済みの token では停止済み画面が返り deactivated_at は変わらない', async () => {
    // Arrange(準備)
    db = new FakeD1Database();
    const env = createTestEnv(db);
    const request = {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: 'inactive-token' }).toString(),
    } satisfies RequestInit;
    await insertDiscordWebhook(db, {
      id: 'inactive-id',
      webhookUrl: 'https://discord.com/api/webhooks/123456/abcdef',
      token: 'inactive-token',
      deactivatedAt: '2026-01-01 00:00:00',
    });

    // Act(実行)
    const response = await app.request('/api/unsubscribe', request, env);

    // Assert(確認)
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('通知停止済み');
    expect(await findChannelByToken(db, 'inactive-token')).toEqual({
      id: 'inactive-id',
      webhook_url: 'https://discord.com/api/webhooks/123456/abcdef',
      token: 'inactive-token',
      deactivated_at: '2026-01-01 00:00:00',
      deactivated_reason: 'none',
      fail_count: 0,
    });
  });
});
