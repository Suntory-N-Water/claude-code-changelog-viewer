import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { dispatchRoute } from '../routes/dispatch';

function createApp() {
  return new Hono<{ Bindings: CloudflareBindings }>()
    .basePath('/api')
    .route('/dispatch', dispatchRoute);
}

function createMockEnv(secret = 'test-secret') {
  return {
    DISPATCH_SECRET: secret,
    NOTIFICATION_QUEUE: {
      send: vi.fn().mockResolvedValue(undefined),
    },
  };
}

function postJSON(
  app: ReturnType<typeof createApp>,
  body: unknown,
  env: unknown,
  headers: Record<string, string> = {},
) {
  return app.request(
    '/api/dispatch',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    },
    env as CloudflareBindings,
  );
}

describe('POST /api/dispatch', () => {
  const app = createApp();

  it('有効なリクエストでバージョンをキューに投入する', async () => {
    const env = createMockEnv();

    const res = await postJSON(app, { versions: ['v1.0.0', 'v1.1.0'] }, env, {
      Authorization: 'Bearer test-secret',
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ success: true, queued: ['v1.0.0', 'v1.1.0'] });
    expect(env.NOTIFICATION_QUEUE.send).toHaveBeenCalledTimes(2);
    expect(env.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith({
      version: 'v1.0.0',
    });
    expect(env.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith({
      version: 'v1.1.0',
    });
  });

  it('Authorization ヘッダーなしで 401 を返す', async () => {
    const env = createMockEnv();

    const res = await postJSON(app, { versions: ['v1.0.0'] }, env);

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: '認証に失敗しました' });
    expect(env.NOTIFICATION_QUEUE.send).not.toHaveBeenCalled();
  });

  it('不正なシークレットで 401 を返す', async () => {
    const env = createMockEnv();

    const res = await postJSON(app, { versions: ['v1.0.0'] }, env, {
      Authorization: 'Bearer wrong-secret',
    });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: '認証に失敗しました' });
  });

  it('versions が空配列で 400 を返す', async () => {
    const env = createMockEnv();

    const res = await postJSON(app, { versions: [] }, env, {
      Authorization: 'Bearer test-secret',
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'リクエストが不正です' });
  });

  it('versions が v で始まらない文字列で 400 を返す', async () => {
    const env = createMockEnv();

    const res = await postJSON(app, { versions: ['1.0.0'] }, env, {
      Authorization: 'Bearer test-secret',
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'リクエストが不正です' });
  });

  it('リクエストボディが不正な場合 400 を返す', async () => {
    const env = createMockEnv();

    const res = await postJSON(app, { invalid: 'body' }, env, {
      Authorization: 'Bearer test-secret',
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'リクエストが不正です' });
  });

  it('単一バージョンでもキューに投入できる', async () => {
    const env = createMockEnv();

    const res = await postJSON(app, { versions: ['v2.0.0'] }, env, {
      Authorization: 'Bearer test-secret',
    });

    expect(res.status).toBe(200);
    expect(env.NOTIFICATION_QUEUE.send).toHaveBeenCalledTimes(1);
    expect(env.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith({
      version: 'v2.0.0',
    });
  });
});
