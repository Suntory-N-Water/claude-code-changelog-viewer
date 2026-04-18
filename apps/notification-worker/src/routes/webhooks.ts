import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { Hono } from 'hono';
import { z } from 'zod';
import {
  channels,
  discordChannels,
  notificationSettings,
  slackChannels,
} from '../db/schema';
import {
  buildUnsubscribeUrl,
  createTestMessage,
  sendToDiscord,
} from '../lib/discord';
import { createSlackTestMessage, sendToSlack } from '../lib/slack';
import { verifyTurnstileToken } from '../lib/turnstile';
import {
  isValidDiscordWebhookUrl,
  isValidSlackWebhookUrl,
} from '../lib/validation';

const RequestSchema = z.object({
  webhook_url: z.string(),
  turnstile_token: z.string(),
  frequency: z.enum(['IMM', 'WEK']),
  channel_type: z.enum(['DSC', 'SLK']),
});

export const webhooksRoute = new Hono<{ Bindings: CloudflareBindings }>().post(
  '/',
  async (c) => {
    const parseResult = RequestSchema.safeParse(await c.req.json());
    if (!parseResult.success) {
      return c.json({ error: 'リクエストが不正です' }, 400);
    }
    const { webhook_url, turnstile_token, frequency, channel_type } =
      parseResult.data;

    // Turnstile トークン検証
    const turnstileValid = await verifyTurnstileToken(
      turnstile_token,
      c.env.TURNSTILE_SECRET_KEY,
    );
    if (!turnstileValid) {
      return c.json({ error: 'Turnstile検証に失敗しました' }, 403);
    }

    // Webhook URL 検証
    if (channel_type === 'DSC' && !isValidDiscordWebhookUrl(webhook_url)) {
      return c.json({ error: 'Discord Webhook URLの形式が不正です' }, 400);
    }
    if (channel_type === 'SLK' && !isValidSlackWebhookUrl(webhook_url)) {
      return c.json({ error: 'Slack Webhook URLの形式が不正です' }, 400);
    }

    const db = drizzle(c.env.DB);
    const workerUrl = c.env.WORKER_URL;

    if (channel_type === 'DSC') {
      // 既存 URL の確認
      const rows = await db
        .select({
          channelId: channels.id,
          token: channels.token,
          isActive: channels.isActive,
        })
        .from(discordChannels)
        .innerJoin(channels, eq(discordChannels.channelId, channels.id))
        .where(eq(discordChannels.webhookUrl, webhook_url));
      const existing = rows[0] ?? null;

      if (existing?.isActive === 1) {
        return c.json({ error: '既に登録済みです' }, 409);
      }

      const token = existing?.token ?? crypto.randomUUID();
      const unsubscribeUrl = buildUnsubscribeUrl(workerUrl, token);

      const testResult = await sendToDiscord(
        webhook_url,
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
        .values({ channelId: id, webhookUrl: webhook_url });
      await db
        .insert(notificationSettings)
        .values({ id: `ns_${id}`, channelId: id, frequency });

      return c.json({ success: true });
    }

    // Slack 登録
    const rows = await db
      .select({
        channelId: channels.id,
        token: channels.token,
        isActive: channels.isActive,
      })
      .from(slackChannels)
      .innerJoin(channels, eq(slackChannels.channelId, channels.id))
      .where(eq(slackChannels.webhookUrl, webhook_url));
    const existing = rows[0] ?? null;

    if (existing?.isActive === 1) {
      return c.json({ error: '既に登録済みです' }, 409);
    }

    const token = existing?.token ?? crypto.randomUUID();
    const unsubscribeUrl = buildUnsubscribeUrl(workerUrl, token);

    const testResult = await sendToSlack(
      webhook_url,
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
      .values({ channelId: id, webhookUrl: webhook_url });
    await db
      .insert(notificationSettings)
      .values({ id: `ns_${id}`, channelId: id, frequency });

    return c.json({ success: true });
  },
);
