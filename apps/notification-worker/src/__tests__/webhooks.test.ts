import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { Hono } from 'hono';
import { webhooksRoute } from '../routes/webhooks';
import type { WebhookRow } from '../types';

// 外部依存のモック
const mockedVerifyTurnstile = mock();
const mockedSendToDiscord = mock();

mock.module('../lib/turnstile', () => ({
  verifyTurnstileToken: mockedVerifyTurnstile,
}));

mock.module('../lib/discord', () => ({
  createTestMessage: mock(() => ({ content: 'テスト通知' })),
  sendToDiscord: mockedSendToDiscord,
}));

const validWebhookUrl = 'https://discord.com/api/webhooks/123456/abcdef';

const activeRow: WebhookRow = {
  id: 'existing-id',
  webhook_url: validWebhookUrl,
  token: 'existing-token',
  active: 1,
  fail_count: 0,
  created_at: '2026-01-01 00:00:00',
  updated_at: '2026-01-01 00:00:00',
};

const inactiveRow: WebhookRow = { ...activeRow, active: 0 };

function createMockDB(row: WebhookRow | null = null) {
  const run = mock().mockResolvedValue({ success: true });
  return {
    prepare: mock().mockReturnValue({
      bind: mock().mockReturnValue({
        first: mock().mockResolvedValue(row),
        run,
      }),
    }),
    _run: run,
  };
}

function createApp() {
  return new Hono<{ Bindings: CloudflareBindings }>()
    .basePath('/api')
    .route('/webhooks', webhooksRoute);
}

function postJSON(
  app: ReturnType<typeof createApp>,
  body: unknown,
  env: unknown,
) {
  return app.request(
    '/api/webhooks',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    env as CloudflareBindings,
  );
}

function createEnv(db: ReturnType<typeof createMockDB>) {
  return {
    DB: db,
    TURNSTILE_SECRET_KEY: 'turnstile-secret',
  };
}

describe('POST /api/webhooks', () => {
  const app = createApp();

  beforeEach(() => {
    mockedVerifyTurnstile.mockClear();
    mockedSendToDiscord.mockClear();
  });

  it('新規 Webhook を登録できる', async () => {
    const db = createMockDB(null);
    mockedVerifyTurnstile.mockResolvedValue(true);
    mockedSendToDiscord.mockResolvedValue({ ok: true, status: 204 });

    const res = await postJSON(
      app,
      { webhook_url: validWebhookUrl, turnstile_token: 'valid-token' },
      createEnv(db),
    );

    expect(res.status).toBe(200);
    expect(await res.json<unknown>()).toEqual({ success: true });
    // INSERT が呼ばれることを確認
    expect(db.prepare).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO webhooks'),
    );
    expect(db._run).toHaveBeenCalled();
  });

  it('既に登録済み(active)の場合 409 を返す', async () => {
    const db = createMockDB(activeRow);
    mockedVerifyTurnstile.mockResolvedValue(true);

    const res = await postJSON(
      app,
      { webhook_url: validWebhookUrl, turnstile_token: 'valid-token' },
      createEnv(db),
    );

    expect(res.status).toBe(409);
    expect(await res.json<unknown>()).toEqual({ error: '既に登録済みです' });
  });

  it('非アクティブな既存レコードを再有効化する', async () => {
    const db = createMockDB(inactiveRow);
    mockedVerifyTurnstile.mockResolvedValue(true);
    mockedSendToDiscord.mockResolvedValue({ ok: true, status: 204 });

    const res = await postJSON(
      app,
      { webhook_url: validWebhookUrl, turnstile_token: 'valid-token' },
      createEnv(db),
    );

    expect(res.status).toBe(200);
    expect(await res.json<unknown>()).toEqual({ success: true });
    // UPDATE が呼ばれることを確認
    expect(db.prepare).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE webhooks SET active = 1'),
    );
  });

  it('Turnstile 検証失敗で 403 を返す', async () => {
    const db = createMockDB();
    mockedVerifyTurnstile.mockResolvedValue(false);

    const res = await postJSON(
      app,
      { webhook_url: validWebhookUrl, turnstile_token: 'invalid-token' },
      createEnv(db),
    );

    expect(res.status).toBe(403);
    expect(await res.json<unknown>()).toEqual({
      error: 'Turnstile検証に失敗しました',
    });
  });

  it('不正な Webhook URL で 400 を返す', async () => {
    const db = createMockDB();
    mockedVerifyTurnstile.mockResolvedValue(true);

    const res = await postJSON(
      app,
      {
        webhook_url: 'https://example.com/not-a-webhook',
        turnstile_token: 'valid-token',
      },
      createEnv(db),
    );

    expect(res.status).toBe(400);
    expect(await res.json<unknown>()).toEqual({
      error: 'Discord Webhook URLの形式が不正です',
    });
  });

  it('リクエストボディが不正で 400 を返す', async () => {
    const db = createMockDB();

    const res = await postJSON(app, { invalid: 'body' }, createEnv(db));

    expect(res.status).toBe(400);
    expect(await res.json<unknown>()).toEqual({
      error: 'リクエストが不正です',
    });
  });

  it('webhook_url が空文字で 400 を返す(バリデーション失敗)', async () => {
    const db = createMockDB();
    mockedVerifyTurnstile.mockResolvedValue(true);

    const res = await postJSON(
      app,
      { webhook_url: '', turnstile_token: 'valid-token' },
      createEnv(db),
    );

    expect(res.status).toBe(400);
    expect(await res.json<unknown>()).toEqual({
      error: 'Discord Webhook URLの形式が不正です',
    });
  });

  it('Discord へのテスト通知が失敗した場合 400 を返す', async () => {
    const db = createMockDB(null);
    mockedVerifyTurnstile.mockResolvedValue(true);
    mockedSendToDiscord.mockResolvedValue({ ok: false, status: 404 });

    const res = await postJSON(
      app,
      { webhook_url: validWebhookUrl, turnstile_token: 'valid-token' },
      createEnv(db),
    );

    expect(res.status).toBe(400);
    expect(await res.json<unknown>()).toEqual({
      error: 'Webhook URLが無効です',
    });
    // DB への INSERT は行われない
    expect(db._run).not.toHaveBeenCalled();
  });
});
