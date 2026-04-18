import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { Hono } from 'hono';
import { z } from 'zod';
import { channels, discordChannels, notificationSettings } from '../db/schema';
import {
  buildUnsubscribeUrl,
  createTestMessage,
  sendToDiscord,
} from '../lib/discord';
import { verifyTurnstileToken } from '../lib/turnstile';
import { isValidDiscordWebhookUrl } from '../lib/validation';

const RequestSchema = z.object({
  webhook_url: z.string(),
  turnstile_token: z.string(),
  frequency: z.enum(['IMM', 'WEK']),
});

export const webhooksRoute = new Hono<{ Bindings: CloudflareBindings }>().post(
  '/',
  async (c) => {
    const parseResult = RequestSchema.safeParse(await c.req.json());
    if (!parseResult.success) {
      return c.json({ error: 'リクエストが不正です' }, 400);
    }
    const { webhook_url, turnstile_token, frequency } = parseResult.data;

    // Turnstile トークン検証
    const turnstileValid = await verifyTurnstileToken(
      turnstile_token,
      c.env.TURNSTILE_SECRET_KEY,
    );
    if (!turnstileValid) {
      return c.json({ error: 'Turnstile検証に失敗しました' }, 403);
    }

    // Webhook URL 検証
    if (!isValidDiscordWebhookUrl(webhook_url)) {
      return c.json({ error: 'Discord Webhook URLの形式が不正です' }, 400);
    }

    // 既存 URL の確認
    const db = drizzle(c.env.DB);
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

    // トークンを決定(既存レコードがあればそのまま、なければ新規生成)
    const token = existing?.token ?? crypto.randomUUID();
    const unsubscribeUrl = buildUnsubscribeUrl(c.env.WORKER_URL, token);

    // テスト通知を送信
    const testPayload = createTestMessage(unsubscribeUrl);
    const testResult = await sendToDiscord(webhook_url, testPayload);
    if (!testResult.ok) {
      return c.json({ error: 'Webhook URLが無効です' }, 400);
    }

    // 非アクティブの既存レコードがある場合は再有効化
    if (existing) {
      await db
        .update(channels)
        .set({ isActive: 1, failCount: 0, updatedAt: sql`datetime('now')` })
        .where(eq(channels.id, existing.channelId));
      return c.json({ success: true });
    }

    // 新規登録
    const id = crypto.randomUUID();
    await db.insert(channels).values({ id, channelType: 'DSC', token });
    await db
      .insert(discordChannels)
      .values({ channelId: id, webhookUrl: webhook_url });
    await db
      .insert(notificationSettings)
      .values({ id: `ns_${id}`, channelId: id, frequency });

    return c.json({ success: true });
  },
);
