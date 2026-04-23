import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { html } from 'hono/html';
import {
  channels,
  discordChannels,
  emailChannels,
  slackChannels,
} from '../db/schema';
import { createUnsubscribeNotification, sendToDiscord } from '../lib/discord';
import { createEmailUnsubscribeNotification, sendToEmail } from '../lib/email';
import { decryptEmail } from '../lib/email-crypto';
import { createSlackUnsubscribeNotification, sendToSlack } from '../lib/slack';

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

async function findActiveChannel(
  token: string | null | undefined,
  c: Context<{ Bindings: CloudflareBindings }>,
) {
  if (!token) {
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

  const db = drizzle(c.env.DB);
  const rows = await db
    .select({ isActive: channels.isActive })
    .from(channels)
    .where(eq(channels.token, token));
  const row = rows[0] ?? null;

  if (!row) {
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

  if (row.isActive === 0) {
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

  return { ok: true as const, token };
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

    const db = drizzle(c.env.DB);

    const [channelRow] = await db
      .select({ id: channels.id, channelType: channels.channelType })
      .from(channels)
      .where(eq(channels.token, lookup.token));

    await db
      .update(channels)
      .set({ isActive: 0, updatedAt: sql`datetime('now')` })
      .where(eq(channels.token, lookup.token));

    try {
      if (channelRow?.channelType === 'DSC') {
        const [dscRow] = await db
          .select({ webhookUrl: discordChannels.webhookUrl })
          .from(discordChannels)
          .where(eq(discordChannels.channelId, channelRow.id));
        if (dscRow?.webhookUrl) {
          await sendToDiscord(
            dscRow.webhookUrl,
            createUnsubscribeNotification(),
          );
        }
      } else if (channelRow?.channelType === 'SLK') {
        const [slkRow] = await db
          .select({ webhookUrl: slackChannels.webhookUrl })
          .from(slackChannels)
          .where(eq(slackChannels.channelId, channelRow.id));
        if (slkRow?.webhookUrl) {
          await sendToSlack(
            slkRow.webhookUrl,
            createSlackUnsubscribeNotification(),
          );
        }
      } else if (channelRow?.channelType === 'EML') {
        const [emlRow] = await db
          .select({ emailEncrypted: emailChannels.emailEncrypted })
          .from(emailChannels)
          .where(eq(emailChannels.channelId, channelRow.id));
        if (emlRow?.emailEncrypted) {
          const toAddress = await decryptEmail(
            emlRow.emailEncrypted,
            c.env.EMAIL_ENCRYPTION_KEY,
          );
          await sendToEmail(c.env.SEND_EMAIL, {
            fromAddress: c.env.EMAIL_FROM,
            toAddress,
            payload: createEmailUnsubscribeNotification(),
          });
        }
      }
    } catch {
      // 停止処理は完了しているため通知失敗は無視
    }

    return c.html(
      renderResult(
        c.env.SITE_URL,
        '通知を停止しました',
        '今後、更新通知は送信されません。',
      ),
    );
  });
