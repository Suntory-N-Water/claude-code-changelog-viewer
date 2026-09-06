import type { Channel } from '../domain/channel/channel';
import type {
  ChannelNotifier,
  NotificationResult,
} from '../usecases/channel-notifier';
import {
  createChangelogMessage,
  createTestMessage,
  createUnsubscribeNotification,
} from './notification/discord';
import {
  createEmailChangelogMessage,
  createEmailTestMessage,
  createEmailUnsubscribeNotification,
  sendToEmail,
} from './notification/email';
import {
  createSlackChangelogMessage,
  createSlackTestMessage,
  createSlackUnsubscribeNotification,
} from './notification/slack';
import { postWebhook } from './notification/webhook';

/** Cloudflare BindingsからChannelNotifier portの実装を作成する。 */
export function createChannelNotifier(
  bindings: CloudflareBindings,
): ChannelNotifier {
  const unsubscribeUrl = (channel: Channel) =>
    `${bindings.WORKER_URL}/api/unsubscribe?token=${channel.token}`;

  return {
    async sendTestNotification(channel) {
      switch (channel.type) {
        case 'DSC':
          return postWebhook(
            channel.webhookUrl,
            createTestMessage(unsubscribeUrl(channel)),
            'DSC',
          );
        case 'SLK':
          return postWebhook(
            channel.webhookUrl,
            createSlackTestMessage(unsubscribeUrl(channel)),
            'SLK',
          );
        case 'EML':
          return sendToEmail(bindings.SEND_EMAIL, {
            fromAddress: bindings.EMAIL_FROM,
            toAddress: channel.emailAddress,
            payload: createEmailTestMessage(unsubscribeUrl(channel)),
          });
      }
    },

    async sendChangelogNotification(channel, input) {
      const messageOptions = {
        unsubscribeUrl: unsubscribeUrl(channel),
        siteUrl: bindings.SITE_URL,
      };
      switch (channel.type) {
        case 'DSC':
          return toNotificationResult(
            await postWebhook(
              channel.webhookUrl,
              createChangelogMessage(
                input.analysis,
                input.version,
                messageOptions,
              ),
              'DSC',
            ),
          );
        case 'SLK':
          return toNotificationResult(
            await postWebhook(
              channel.webhookUrl,
              createSlackChangelogMessage(
                input.analysis,
                input.version,
                messageOptions,
              ),
              'SLK',
            ),
          );
        case 'EML':
          return toNotificationResult(
            await sendToEmail(bindings.SEND_EMAIL, {
              fromAddress: bindings.EMAIL_FROM,
              toAddress: channel.emailAddress,
              payload: createEmailChangelogMessage(
                input.analysis,
                input.version,
                messageOptions,
              ),
            }),
          );
      }
    },

    async sendUnsubscribeNotification(channel) {
      switch (channel.type) {
        case 'DSC':
          return toNotificationResult(
            await postWebhook(
              channel.webhookUrl,
              createUnsubscribeNotification(),
              'DSC',
            ),
          );
        case 'SLK':
          return toNotificationResult(
            await postWebhook(
              channel.webhookUrl,
              createSlackUnsubscribeNotification(),
              'SLK',
            ),
          );
        case 'EML':
          return toNotificationResult(
            await sendToEmail(bindings.SEND_EMAIL, {
              fromAddress: bindings.EMAIL_FROM,
              toAddress: channel.emailAddress,
              payload: createEmailUnsubscribeNotification(),
            }),
          );
      }
    },
  };
}

/** HTTPステータスをドメインの失敗種別に変換する。 */
function toNotificationResult(raw: {
  ok: boolean;
  status: number;
}): NotificationResult {
  if (raw.ok) {
    return { ok: true };
  }
  if (raw.status === 429) {
    return { ok: false, failureKind: 'rate_limit' };
  }
  if (raw.status === 401 || raw.status === 403 || raw.status === 404) {
    return { ok: false, failureKind: 'permanent' };
  }
  return { ok: false, failureKind: 'temporary' };
}
