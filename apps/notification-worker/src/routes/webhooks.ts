import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { Hono } from 'hono';
import { z } from 'zod';
import {
  channels,
  discordChannels,
  emailChannels,
  notificationSettings,
  slackChannels,
} from '../db/schema';
import {
  buildUnsubscribeUrl,
  createTestMessage,
  sendToDiscord,
} from '../lib/discord';
import { createEmailTestMessage, sendToEmail } from '../lib/email';
import { encryptEmail, hashEmail } from '../lib/email-crypto';
import { createSlackTestMessage, sendToSlack } from '../lib/slack';
import { verifyTurnstileToken } from '../lib/turnstile';
import {
  isValidDiscordWebhookUrl,
  isValidEmail,
  isValidSlackWebhookUrl,
} from '../lib/validation';

const RequestSchema = z.discriminatedUnion('channel_type', [
  z.object({
    channel_type: z.literal('DSC'),
    webhook_url: z.string(),
    turnstile_token: z.string(),
    frequency: z.enum(['IMM', 'WEK']),
  }),
  z.object({
    channel_type: z.literal('SLK'),
    webhook_url: z.string(),
    turnstile_token: z.string(),
    frequency: z.enum(['IMM', 'WEK']),
  }),
  z.object({
    channel_type: z.literal('EML'),
    email_address: z.string(),
    turnstile_token: z.string(),
    frequency: z.enum(['IMM', 'WEK']),
  }),
]);

export const webhooksRoute = new Hono<{ Bindings: CloudflareBindings }>().post(
  '/',
  async (c) => {
    const parseResult = RequestSchema.safeParse(await c.req.json());
    if (!parseResult.success) {
      return c.json({ error: 'リクエストが不正です' }, 400);
    }
    const data = parseResult.data;

    // Turnstile トークン検証
    const turnstileValid = await verifyTurnstileToken(
      data.turnstile_token,
      c.env.TURNSTILE_SECRET_KEY,
    );
    if (!turnstileValid) {
      return c.json({ error: 'Turnstile検証に失敗しました' }, 403);
    }

    const db = drizzle(c.env.DB);
    const workerUrl = c.env.WORKER_URL;

    if (data.channel_type === 'DSC') {
      if (!isValidDiscordWebhookUrl(data.webhook_url)) {
        return c.json({ error: 'Discord Webhook URLの形式が不正です' }, 400);
      }

      const rows = await db
        .select({
          channelId: channels.id,
          token: channels.token,
          isActive: channels.isActive,
        })
        .from(discordChannels)
        .innerJoin(channels, eq(discordChannels.channelId, channels.id))
        .where(eq(discordChannels.webhookUrl, data.webhook_url));
      const existing = rows[0] ?? null;

      if (existing?.isActive === 1) {
        return c.json({ error: '既に登録済みです' }, 409);
      }

      const token = existing?.token ?? crypto.randomUUID();
      const unsubscribeUrl = buildUnsubscribeUrl(workerUrl, token);

      const testResult = await sendToDiscord(
        data.webhook_url,
        createTestMessage(unsubscribeUrl),
      );
      if (!testResult.ok) {
        return c.json({ error: 'Webhook URLが無効です' }, 400);
      }

      if (existing) {
        await db
          .update(channels)
          .set({ isActive: 1, failCount: 0, updatedAt: sql`datetime('now')` })
          .where(eq(channels.id, existing.channelId));
        return c.json({ success: true });
      }

      const id = crypto.randomUUID();
      await db.insert(channels).values({ id, channelType: 'DSC', token });
      await db
        .insert(discordChannels)
        .values({ channelId: id, webhookUrl: data.webhook_url });
      await db
        .insert(notificationSettings)
        .values({ id: `ns_${id}`, channelId: id, frequency: data.frequency });

      return c.json({ success: true });
    }

    if (data.channel_type === 'SLK') {
      if (!isValidSlackWebhookUrl(data.webhook_url)) {
        return c.json({ error: 'Slack Webhook URLの形式が不正です' }, 400);
      }

      const rows = await db
        .select({
          channelId: channels.id,
          token: channels.token,
          isActive: channels.isActive,
        })
        .from(slackChannels)
        .innerJoin(channels, eq(slackChannels.channelId, channels.id))
        .where(eq(slackChannels.webhookUrl, data.webhook_url));
      const existing = rows[0] ?? null;

      if (existing?.isActive === 1) {
        return c.json({ error: '既に登録済みです' }, 409);
      }

      const token = existing?.token ?? crypto.randomUUID();
      const unsubscribeUrl = buildUnsubscribeUrl(workerUrl, token);

      const testResult = await sendToSlack(
        data.webhook_url,
        createSlackTestMessage(unsubscribeUrl),
      );
      if (!testResult.ok) {
        return c.json({ error: 'Webhook URLが無効です' }, 400);
      }

      if (existing) {
        await db
          .update(channels)
          .set({ isActive: 1, failCount: 0, updatedAt: sql`datetime('now')` })
          .where(eq(channels.id, existing.channelId));
        return c.json({ success: true });
      }

      const id = crypto.randomUUID();
      await db.insert(channels).values({ id, channelType: 'SLK', token });
      await db
        .insert(slackChannels)
        .values({ channelId: id, webhookUrl: data.webhook_url });
      await db
        .insert(notificationSettings)
        .values({ id: `ns_${id}`, channelId: id, frequency: data.frequency });

      return c.json({ success: true });
    }

    // Email 登録
    if (!isValidEmail(data.email_address)) {
      return c.json({ error: 'メールアドレスの形式が不正です' }, 400);
    }

    const emailHash = await hashEmail(
      data.email_address,
      c.env.EMAIL_ENCRYPTION_KEY,
    );
    const emailEncrypted = await encryptEmail(
      data.email_address,
      c.env.EMAIL_ENCRYPTION_KEY,
    );

    const rows = await db
      .select({
        channelId: channels.id,
        token: channels.token,
        isActive: channels.isActive,
      })
      .from(emailChannels)
      .innerJoin(channels, eq(emailChannels.channelId, channels.id))
      .where(eq(emailChannels.emailHash, emailHash));
    const existing = rows[0] ?? null;

    if (existing?.isActive === 1) {
      return c.json({ error: '既に登録済みです' }, 409);
    }

    const token = existing?.token ?? crypto.randomUUID();
    const unsubscribeUrl = buildUnsubscribeUrl(workerUrl, token);

    const testResult = await sendToEmail(c.env.SEND_EMAIL, {
      fromAddress: c.env.EMAIL_FROM,
      toAddress: data.email_address,
      payload: createEmailTestMessage(unsubscribeUrl),
    });
    if (!testResult.ok) {
      return c.json({ error: 'メールの送信に失敗しました' }, 400);
    }

    if (existing) {
      await db
        .update(channels)
        .set({ isActive: 1, failCount: 0, updatedAt: sql`datetime('now')` })
        .where(eq(channels.id, existing.channelId));
      return c.json({ success: true });
    }

    const id = crypto.randomUUID();
    await db.insert(channels).values({ id, channelType: 'EML', token });
    await db
      .insert(emailChannels)
      .values({ channelId: id, emailHash, emailEncrypted });
    await db
      .insert(notificationSettings)
      .values({ id: `ns_${id}`, channelId: id, frequency: data.frequency });

    return c.json({ success: true });
  },
);
