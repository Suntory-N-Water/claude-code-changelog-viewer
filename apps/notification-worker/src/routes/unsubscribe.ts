import { Hono } from 'hono';
import { html } from 'hono/html';
import type { WebhookRow } from '../types';

const baseStyle = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background: hsl(48 43% 97%);
    color: hsl(60 4% 8%);
    padding: 1rem;
  }
  .card {
    max-width: 360px;
    text-align: center;
  }
  h1 {
    font-size: 1.25rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }
  p {
    font-size: 0.875rem;
    line-height: 1.6;
    opacity: 0.7;
  }
  a {
    display: inline-block;
    margin-top: 1.5rem;
    font-size: 0.8125rem;
    color: hsl(15 62% 62%);
    text-decoration: none;
  }
  a:hover { text-decoration: underline; }
`;

const renderResult = (title: string, message: string) => html`
  <!doctype html>
  <html lang="ja">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${title} - Claude Code Changelog Viewer</title>
      <style>${baseStyle}</style>
    </head>
    <body>
      <div class="card">
        <h1>${title}</h1>
        <p>${message}</p>
        <a href="https://claude-code-changelog-viewer.ayasnppk00.workers.dev/">トップページに戻る</a>
      </div>
    </body>
  </html>
`;

const renderConfirm = (token: string) => html`
  <!doctype html>
  <html lang="ja">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>通知停止の確認 - Claude Code Changelog Viewer</title>
      <style>
        ${baseStyle}
        button {
          display: inline-block;
          margin-top: 1.5rem;
          padding: 0.625rem 1.5rem;
          font-size: 0.875rem;
          font-weight: 600;
          color: #fff;
          background: hsl(0 60% 55%);
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }
        button:hover { background: hsl(0 60% 45%); }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>通知停止の確認</h1>
        <p>Claude Code の更新通知を停止しますか？</p>
        <form method="POST" action="/api/unsubscribe">
          <input type="hidden" name="token" value="${token}" />
          <button type="submit">通知を停止する</button>
        </form>
        <a href="https://claude-code-changelog-viewer.ayasnppk00.workers.dev/">キャンセル</a>
      </div>
    </body>
  </html>
`;

export const unsubscribeRoute = new Hono<{
  Bindings: CloudflareBindings;
}>()
  // GET: 確認ページを表示(クローラー対策で実際の停止処理は行わない)
  .get('/', async (c) => {
    const token = c.req.query('token');
    if (!token) {
      return c.html(
        renderResult('エラー', 'トークンが指定されていません。'),
        400,
      );
    }

    const row = await c.env.DB.prepare('SELECT * FROM webhooks WHERE token = ?')
      .bind(token)
      .first<WebhookRow>();

    if (!row) {
      return c.html(
        renderResult('エラー', '該当する登録が見つかりません。'),
        404,
      );
    }

    if (row.active === 0) {
      return c.html(
        renderResult('通知停止済み', 'この通知は既に停止されています。'),
      );
    }

    return c.html(renderConfirm(token));
  })
  // POST: 実際に配信停止を実行
  .post('/', async (c) => {
    const body = await c.req.parseBody();
    const token = typeof body.token === 'string' ? body.token : null;

    if (!token) {
      return c.html(
        renderResult('エラー', 'トークンが指定されていません。'),
        400,
      );
    }

    const row = await c.env.DB.prepare('SELECT * FROM webhooks WHERE token = ?')
      .bind(token)
      .first<WebhookRow>();

    if (!row) {
      return c.html(
        renderResult('エラー', '該当する登録が見つかりません。'),
        404,
      );
    }

    if (row.active === 0) {
      return c.html(
        renderResult('通知停止済み', 'この通知は既に停止されています。'),
      );
    }

    await c.env.DB.prepare(
      "UPDATE webhooks SET active = 0, updated_at = datetime('now') WHERE token = ?",
    )
      .bind(token)
      .run();

    return c.html(
      renderResult('通知を停止しました', '今後、更新通知は送信されません。'),
    );
  });
