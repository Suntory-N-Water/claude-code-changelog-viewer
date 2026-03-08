import { afterEach, describe, expect, it } from 'bun:test';
import { app } from '../index';
import { FakeD1Database } from './support/fake-d1';
import {
  createTestEnv,
  findWebhookByToken,
  insertWebhook,
} from './support/notification-test-support';

describe('/api/unsubscribe integration', () => {
  let db: FakeD1Database | null = null;

  afterEach(() => {
    db?.close();
    db = null;
  });

  it('有効な token で確認画面を開くと停止前の確認 HTML が返る', async () => {
    // Arrange(準備)
    db = new FakeD1Database();
    const sut = app;
    const env = createTestEnv(db);
    await insertWebhook(db, {
      id: 'active-id',
      webhook_url: 'https://discord.com/api/webhooks/123456/abcdef',
      token: 'active-token',
      active: 1,
    });

    // Act(実行)
    const response = await sut.request(
      '/api/unsubscribe?token=active-token',
      {},
      env,
    );

    // Assert(確認)
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('通知停止の確認');
    expect(await findWebhookByToken(db, 'active-token')).toEqual({
      id: 'active-id',
      webhook_url: 'https://discord.com/api/webhooks/123456/abcdef',
      token: 'active-token',
      active: 1,
      fail_count: 0,
    });
  });

  it('有効な token で停止を実行すると対象 Webhook が非アクティブ化される', async () => {
    // Arrange(準備)
    db = new FakeD1Database();
    const sut = app;
    const env = createTestEnv(db);
    const request = {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: 'active-token' }).toString(),
    } satisfies RequestInit;
    await insertWebhook(db, {
      id: 'active-id',
      webhook_url: 'https://discord.com/api/webhooks/123456/abcdef',
      token: 'active-token',
      active: 1,
    });

    // Act(実行)
    const response = await sut.request('/api/unsubscribe', request, env);

    // Assert(確認)
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('通知を停止しました');
    expect(await findWebhookByToken(db, 'active-token')).toEqual({
      id: 'active-id',
      webhook_url: 'https://discord.com/api/webhooks/123456/abcdef',
      token: 'active-token',
      active: 0,
      fail_count: 0,
    });
  });

  it('存在しない token では状態を変えず未登録エラー画面が返る', async () => {
    // Arrange(準備)
    db = new FakeD1Database();
    const sut = app;
    const env = createTestEnv(db);

    // Act(実行)
    const response = await sut.request(
      '/api/unsubscribe?token=missing-token',
      {},
      env,
    );

    // Assert(確認)
    expect(response.status).toBe(404);
    expect(await response.text()).toContain('該当する登録が見つかりません');
  });

  it('既に停止済みの token では状態を変えず停止済み画面が返る', async () => {
    // Arrange(準備)
    db = new FakeD1Database();
    const sut = app;
    const env = createTestEnv(db);
    const request = {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: 'inactive-token' }).toString(),
    } satisfies RequestInit;
    await insertWebhook(db, {
      id: 'inactive-id',
      webhook_url: 'https://discord.com/api/webhooks/123456/abcdef',
      token: 'inactive-token',
      active: 0,
    });

    // Act(実行)
    const response = await sut.request('/api/unsubscribe', request, env);

    // Assert(確認)
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('通知停止済み');
    expect(await findWebhookByToken(db, 'inactive-token')).toEqual({
      id: 'inactive-id',
      webhook_url: 'https://discord.com/api/webhooks/123456/abcdef',
      token: 'inactive-token',
      active: 0,
      fail_count: 0,
    });
  });
});
