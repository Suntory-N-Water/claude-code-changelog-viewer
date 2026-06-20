import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { NotificationAnalysis } from '@claude-code-changelog-viewer/types';
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
      send: vi.fn(() => Promise.resolve(undefined)),
    },
  };
}

const validAnalysis: NotificationAnalysis = {
  version: 'v1.0.0',
  summary: 'テスト用サマリー',
  items: [
    { content: 'Added new feature', content_ja: '新機能', prefix: 'feat' },
  ],
};

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

    const res = await postJSON(
      app,
      { version: 'v1.0.0', analysis: validAnalysis },
      env,
      { Authorization: 'Bearer test-secret' },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ success: true, queued: 'v1.0.0' });
    expect(env.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith({
      version: 'v1.0.0',
      analysis: validAnalysis,
    });
  });

  it('Authorization ヘッダーなしで 401 を返す', async () => {
    const env = createMockEnv();

    const res = await postJSON(
      app,
      { version: 'v1.0.0', analysis: validAnalysis },
      env,
    );

    expect(res.status).toBe(401);
    expect(await res.json<unknown>()).toEqual({ error: '認証に失敗しました' });
    expect(env.NOTIFICATION_QUEUE.send).not.toHaveBeenCalled();
  });

  it('不正なシークレットで 401 を返す', async () => {
    const env = createMockEnv();

    const res = await postJSON(
      app,
      { version: 'v1.0.0', analysis: validAnalysis },
      env,
      { Authorization: 'Bearer wrong-secret' },
    );

    expect(res.status).toBe(401);
    expect(await res.json<unknown>()).toEqual({ error: '認証に失敗しました' });
  });

  it('version が v で始まらない文字列で 400 を返す', async () => {
    const env = createMockEnv();

    const res = await postJSON(
      app,
      { version: '1.0.0', analysis: validAnalysis },
      env,
      { Authorization: 'Bearer test-secret' },
    );

    expect(res.status).toBe(400);
  });

  it('analysis が欠落している場合 400 を返す', async () => {
    const env = createMockEnv();

    const res = await postJSON(app, { version: 'v1.0.0' }, env, {
      Authorization: 'Bearer test-secret',
    });

    expect(res.status).toBe(400);
  });

  it('analysis.items の必須フィールドが欠落している場合 400 を返す', async () => {
    const env = createMockEnv();

    const res = await postJSON(
      app,
      {
        version: 'v1.0.0',
        analysis: { version: 'v1.0.0', items: [{ content_ja: '不正' }] },
      },
      env,
      { Authorization: 'Bearer test-secret' },
    );

    expect(res.status).toBe(400);
  });

  it('summary と content_ja が null でも受理する', async () => {
    const env = createMockEnv();

    const res = await postJSON(
      app,
      {
        version: 'v1.0.0',
        analysis: {
          version: 'v1.0.0',
          summary: null,
          items: [{ content: 'x', content_ja: null, prefix: 'feat' }],
        },
      },
      env,
      { Authorization: 'Bearer test-secret' },
    );

    expect(res.status).toBe(200);
  });
});
