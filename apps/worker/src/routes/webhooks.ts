import { workerLogger } from '../logger';
import { toError } from '@claude-code-changelog-viewer/common';
import { sValidator } from '@hono/standard-validator';
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
import { rateLimit } from './rate-limit';

const logger = workerLogger('routes.webhooks');

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
  rateLimit(
    (env) => env.WEBHOOK_RATE_LIMITER,
    'webhook-registration',
    '登録リクエストが多すぎます',
  ),
  sValidator('json', RequestSchema, (result, c) => {
    if (!result.success) {
      logger.warn('リクエストの検証に失敗しました', {
        route: 'webhooks',
        error: result.error,
      });
      return c.json({ error: 'リクエストが不正です' }, 400);
    }
    return;
  }),
  async (c) => {
    const data = c.req.valid('json');

    const turnstileValid = await verifyTurnstileToken(
      data.turnstile_token,
      c.env.TURNSTILE_SECRET_KEY,
    );
    if (!turnstileValid) {
      logger.warn('Turnstile の検証に失敗しました', {
        route: 'webhooks',
        channel_type: data.channel_type,
      });
      return c.json({ error: 'Turnstile検証に失敗しました' }, 403);
    }

    const repository = createChannelRepository(
      c.env.DB,
      c.env.EMAIL_ENCRYPTION_KEY,
    );
    const notifier = createChannelNotifier(c.env);
    const frequency = createNotificationFrequency(data.frequency);
    const input = createSubscribeInput(data, frequency);

    let result: Awaited<ReturnType<typeof subscribe>>;
    try {
      result = await subscribe(repository, notifier, input);
    } catch (error) {
      logger.error('購読登録に失敗しました', {
        route: 'webhooks',
        channel_type: data.channel_type,
        error: toError(error),
      });
      throw error;
    }

    if (!result.ok) {
      logger.warn('購読登録を受け付けませんでした', {
        route: 'webhooks',
        channel_type: data.channel_type,
        reason: result.error,
      });
      switch (result.error) {
        case 'already_registered':
          return c.json({ error: '既に登録済みです' }, 409);
        case 'invalid_notification_destination':
          return c.json({ error: '通知先が無効です' }, 400);
      }
    }

    logger.info('購読登録が完了しました', {
      route: 'webhooks',
      channel_type: data.channel_type,
      subscription_status: result.status,
    });

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
