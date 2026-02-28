import { describe, expect, it, mock } from 'bun:test';
import { Hono } from 'hono';
import { unsubscribeRoute } from '../routes/unsubscribe';
import type { WebhookRow } from '../types';

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
    .route('/unsubscribe', unsubscribeRoute);
}

function postForm(
  app: ReturnType<typeof createApp>,
  params: Record<string, string>,
  env: unknown,
) {
  return app.request(
    '/api/unsubscribe',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    },
    env as CloudflareBindings,
  );
}

const activeRow: WebhookRow = {
  id: 'test-id',
  webhook_url: 'https://discord.com/api/webhooks/123/abc',
  token: 'test-token',
  active: 1,
  fail_count: 0,
  created_at: '2026-01-01 00:00:00',
  updated_at: '2026-01-01 00:00:00',
};

const inactiveRow: WebhookRow = { ...activeRow, active: 0 };

describe('GET /api/unsubscribe', () => {
  const app = createApp();

  it('アクティブなWebhookに対して確認ページを返し、DBを更新しない', async () => {
    const db = createMockDB(activeRow);

    const res = await app.request('/api/unsubscribe?token=test-token', {}, {
      DB: db,
    } as unknown as CloudflareBindings);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toContain('通知停止の確認');
    expect(body).toContain('method="POST"');
    expect(body).toContain('<input type="hidden" name="token"');
    expect(db._run).not.toHaveBeenCalled();
  });

  it('token なしで 400 を返す', async () => {
    const db = createMockDB();

    const res = await app.request('/api/unsubscribe', {}, {
      DB: db,
    } as unknown as CloudflareBindings);

    expect(res.status).toBe(400);
    expect(await res.text()).toContain('トークンが指定されていません');
  });

  it('存在しない token で 404 を返す', async () => {
    const db = createMockDB(null);

    const res = await app.request('/api/unsubscribe?token=invalid', {}, {
      DB: db,
    } as unknown as CloudflareBindings);

    expect(res.status).toBe(404);
    expect(await res.text()).toContain('該当する登録が見つかりません');
  });

  it('既に停止済みの場合は停止済みメッセージを返す', async () => {
    const db = createMockDB(inactiveRow);

    const res = await app.request('/api/unsubscribe?token=test-token', {}, {
      DB: db,
    } as unknown as CloudflareBindings);

    expect(res.status).toBe(200);
    expect(await res.text()).toContain('通知停止済み');
    expect(db._run).not.toHaveBeenCalled();
  });
});

describe('POST /api/unsubscribe', () => {
  const app = createApp();

  it('有効な token で配信停止を実行し、DB を更新する', async () => {
    const db = createMockDB(activeRow);

    const res = await postForm(app, { token: 'test-token' }, { DB: db });
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toContain('通知を停止しました');
    expect(db._run).toHaveBeenCalled();
    expect(db.prepare).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE webhooks SET active = 0'),
    );
  });

  it('token なしで 400 を返す', async () => {
    const db = createMockDB();

    const res = await postForm(app, {}, { DB: db });

    expect(res.status).toBe(400);
    expect(await res.text()).toContain('トークンが指定されていません');
  });

  it('存在しない token で 404 を返す', async () => {
    const db = createMockDB(null);

    const res = await postForm(app, { token: 'invalid' }, { DB: db });

    expect(res.status).toBe(404);
    expect(await res.text()).toContain('該当する登録が見つかりません');
  });

  it('既に停止済みの場合は DB を更新しない', async () => {
    const db = createMockDB(inactiveRow);

    const res = await postForm(app, { token: 'test-token' }, { DB: db });

    expect(res.status).toBe(200);
    expect(await res.text()).toContain('通知停止済み');
    expect(db._run).not.toHaveBeenCalled();
  });
});
