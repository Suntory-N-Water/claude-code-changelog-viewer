import { Hono } from 'hono';
import { z } from 'zod';
import { subscribe, type SubscribeInput } from '../usecases/subscribe';
import {
  createDiscordWebhookUrl,
  isValidDiscordWebhookUrl,
} from '../domain/channel/discord-webhook-url';
import {
  createEmailAddress,
  isValidEmailAddress,
} from '../domain/channel/email-address';
import {
  createNotificationFrequency,
  type NotificationFrequency,
} from '../domain/channel/notification-frequency';
import {
  createSlackWebhookUrl,
  isValidSlackWebhookUrl,
} from '../domain/channel/slack-webhook-url';
import { createChannelNotifier } from '../infrastructure/channel-notifier';
import { createChannelRepository } from '../infrastructure/drizzle/channel-repository';
import { verifyTurnstileToken } from '../infrastructure/turnstile';

const RequestSchema = z.discriminatedUnion('channel_type', [
  z.object({
    channel_type: z.literal('DSC'),
    webhook_url: z.string().refine(isValidDiscordWebhookUrl),
    turnstile_token: z.string(),
    frequency: z.enum(['IMM', 'WEK']),
  }),
  z.object({
    channel_type: z.literal('SLK'),
    webhook_url: z.string().refine(isValidSlackWebhookUrl),
    turnstile_token: z.string(),
    frequency: z.enum(['IMM', 'WEK']),
  }),
  z.object({
    channel_type: z.literal('EML'),
    email_address: z.string().refine(isValidEmailAddress),
    turnstile_token: z.string(),
    frequency: z.enum(['IMM', 'WEK']),
  }),
]);

export const webhooksRoute = new Hono<{ Bindings: CloudflareBindings }>().post(
  '/',
  async (c) => {
    const clientKey = c.req.header('CF-Connecting-IP') ?? 'unknown-client';
    const rateLimit = await c.env.WEBHOOK_RATE_LIMITER.limit({
      key: `webhook-registration:${clientKey}`,
    });
    if (!rateLimit.success) {
      c.header('Retry-After', '60');
      return c.json({ error: '登録リクエストが多すぎます' }, 429);
    }

    const parseResult = RequestSchema.safeParse(await c.req.json());
    if (!parseResult.success) {
      return c.json({ error: 'リクエストが不正です' }, 400);
    }
    const data = parseResult.data;

    const turnstileValid = await verifyTurnstileToken(
      data.turnstile_token,
      c.env.TURNSTILE_SECRET_KEY,
    );
    if (!turnstileValid) {
      return c.json({ error: 'Turnstile検証に失敗しました' }, 403);
    }

    const repository = createChannelRepository(
      c.env.DB,
      c.env.EMAIL_ENCRYPTION_KEY,
    );
    const notifier = createChannelNotifier(c.env);
    const frequency = createNotificationFrequency(data.frequency);
    const input = createSubscribeInput(data, frequency);

    const result = await subscribe(repository, notifier, input);

    if (!result.ok) {
      switch (result.error) {
        case 'already_registered':
          return c.json({ error: '既に登録済みです' }, 409);
        case 'invalid_notification_destination':
          return c.json({ error: '通知先が無効です' }, 400);
      }
    }

    return c.json({ success: true });
  },
);

function createSubscribeInput(
  data: z.infer<typeof RequestSchema>,
  frequency: NotificationFrequency,
): SubscribeInput {
  switch (data.channel_type) {
    case 'DSC':
      return {
        address: {
          type: 'DSC',
          value: createDiscordWebhookUrl(data.webhook_url),
        },
        frequency,
      };
    case 'SLK':
      return {
        address: {
          type: 'SLK',
          value: createSlackWebhookUrl(data.webhook_url),
        },
        frequency,
      };
    case 'EML':
      return {
        address: {
          type: 'EML',
          value: createEmailAddress(data.email_address),
        },
        frequency,
      };
  }
}
