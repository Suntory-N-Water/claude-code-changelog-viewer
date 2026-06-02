import type { Context } from 'hono';
import { Hono } from 'hono';
import { html } from 'hono/html';
import { unsubscribe } from '../application/unsubscribe';
import { createChannelToken } from '../domain/channel/channel-token';
import { isActive } from '../domain/channel/channel-lifecycle';
import { createChannelNotifier } from '../infrastructure/channel-notifier';
import { createChannelRepository } from '../infrastructure/drizzle/channel-repository';

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

const renderResult = (siteUrl: string, title: string, message: string) => html`
  <!doctype html>
  <html lang="ja">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${title} - CCログ超訳</title>
      <style>${baseStyle}</style>
    </head>
    <body>
      <div class="card">
        <h1>${title}</h1>
        <p>${message}</p>
        <a href="${siteUrl}/">トップページに戻る</a>
      </div>
    </body>
  </html>
`;

const renderConfirm = (siteUrl: string, token: string) => html`
  <!doctype html>
  <html lang="ja">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>通知停止の確認 - CCログ超訳</title>
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
        <a href="${siteUrl}/">キャンセル</a>
      </div>
    </body>
  </html>
`;

const unsubscribeErrorMessages = {
  missing_token: {
    title: 'エラー',
    message: 'トークンが指定されていません。',
  },
  not_found: {
    title: 'エラー',
    message: '該当する登録が見つかりません。',
  },
  already_deactivated: {
    title: '通知停止済み',
    message: 'この通知は既に停止されています。',
  },
} as const;

type UnsubscribeError = keyof typeof unsubscribeErrorMessages;

async function findActiveChannel(
  token: string | null | undefined,
  c: Context<{ Bindings: CloudflareBindings }>,
) {
  const tokenText = token?.trim() ?? '';
  if (tokenText === '') {
    return {
      ok: false as const,
      response: c.html(
        renderResult(
          c.env.SITE_URL,
          'エラー',
          'トークンが指定されていません。',
        ),
        400,
      ),
    };
  }

  const repository = createChannelRepository(
    c.env.DB,
    c.env.EMAIL_ENCRYPTION_KEY,
  );
  const channel = await repository.findByToken(createChannelToken(tokenText));

  if (!channel) {
    return {
      ok: false as const,
      response: c.html(
        renderResult(
          c.env.SITE_URL,
          'エラー',
          '該当する登録が見つかりません。',
        ),
        404,
      ),
    };
  }

  if (!isActive(channel)) {
    return {
      ok: false as const,
      response: c.html(
        renderResult(
          c.env.SITE_URL,
          '通知停止済み',
          'この通知は既に停止されています。',
        ),
      ),
    };
  }

  return { ok: true as const, token: channel.token };
}

export const unsubscribeRoute = new Hono<{
  Bindings: CloudflareBindings;
}>()
  // GET: 確認ページを表示(クローラー対策で実際の停止処理は行わない)
  .get('/', async (c) => {
    const lookup = await findActiveChannel(c.req.query('token'), c);
    if (!lookup.ok) {
      return lookup.response;
    }
    return c.html(renderConfirm(c.env.SITE_URL, lookup.token));
  })
  // POST: 実際に配信停止を実行
  .post('/', async (c) => {
    const body = await c.req.parseBody();
    const token = typeof body['token'] === 'string' ? body['token'] : null;

    const lookup = await findActiveChannel(token, c);
    if (!lookup.ok) {
      return lookup.response;
    }

    const repository = createChannelRepository(
      c.env.DB,
      c.env.EMAIL_ENCRYPTION_KEY,
    );
    const notifier = createChannelNotifier(c.env);
    const result = await unsubscribe(repository, notifier, {
      token: lookup.token,
      unsubscribedAt: new Date(),
    });

    if (!result.ok) {
      return c.html(renderUnsubscribeError(c.env.SITE_URL, result.error));
    }

    return c.html(
      renderResult(
        c.env.SITE_URL,
        '通知を停止しました',
        '今後、更新通知は送信されません。',
      ),
    );
  });

function renderUnsubscribeError(siteUrl: string, error: UnsubscribeError) {
  const content = unsubscribeErrorMessages[error];
  return renderResult(siteUrl, content.title, content.message);
}
