import { Hono } from 'hono';
import { z } from 'zod';
import { createTestMessage, sendToDiscord } from '../lib/discord';
import { verifyTurnstileToken } from '../lib/turnstile';
import { isValidDiscordWebhookUrl } from '../lib/validation';
import type { WebhookRow } from '../types';

const RequestSchema = z.object({
  webhook_url: z.string(),
  turnstile_token: z.string(),
});

export const webhooksRoute = new Hono<{ Bindings: CloudflareBindings }>().post(
  '/',
  async (c) => {
    // リクエストボディのパース
    const parseResult = RequestSchema.safeParse(await c.req.json());
    if (!parseResult.success) {
      return c.json({ error: 'リクエストが不正です' }, 400);
    }
    const { webhook_url, turnstile_token } = parseResult.data;

    // Turnstileトークン検証
    const turnstileValid = await verifyTurnstileToken(
      turnstile_token,
      c.env.TURNSTILE_SECRET_KEY,
    );
    if (!turnstileValid) {
      return c.json({ error: 'Turnstile検証に失敗しました' }, 403);
    }

    // Webhook URL検証
    if (!isValidDiscordWebhookUrl(webhook_url)) {
      return c.json({ error: 'Discord Webhook URLの形式が不正です' }, 400);
    }

    // 既存URLの確認
    const existing = await c.env.DB.prepare(
      'SELECT * FROM webhooks WHERE webhook_url = ?',
    )
      .bind(webhook_url)
      .first<WebhookRow>();

    if (existing?.active === 1) {
      return c.json({ error: '既に登録済みです' }, 409);
    }

    // テスト通知を送信
    const testPayload = createTestMessage();
    const testResult = await sendToDiscord(webhook_url, testPayload);
    if (!testResult.ok) {
      return c.json({ error: 'Webhook URLが無効です' }, 400);
    }

    // 非アクティブの既存レコードがある場合は再有効化
    if (existing) {
      await c.env.DB.prepare(
        "UPDATE webhooks SET active = 1, fail_count = 0, updated_at = datetime('now') WHERE id = ?",
      )
        .bind(existing.id)
        .run();

      return c.json({ success: true });
    }

    // 新規登録
    const id = crypto.randomUUID();
    const token = crypto.randomUUID();
    await c.env.DB.prepare(
      'INSERT INTO webhooks (id, webhook_url, token) VALUES (?, ?, ?)',
    )
      .bind(id, webhook_url, token)
      .run();

    return c.json({ success: true });
  },
);
