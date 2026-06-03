import type {
  Channel,
  DiscordChannel,
  EmailChannel,
  SlackChannel,
} from '../domain/channel/channel';
import type {
  ChangelogNotificationInput,
  ChannelNotifier,
  NotificationResult,
} from '../domain/channel/channel-notifier';
import {
  createChangelogMessage,
  createTestMessage,
  createUnsubscribeNotification,
  sendToDiscord,
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
  sendToSlack,
} from './notification/slack';

export type ChannelNotifierConfig = {
  readonly sendEmail: SendEmail;
  readonly emailFrom: string;
  readonly workerUrl: string;
  readonly siteUrl: string;
};

/** Discord/Slack/Email の送信処理をChannelNotifier portとして実装する。 */
export class InfrastructureChannelNotifier implements ChannelNotifier {
  constructor(private readonly config: ChannelNotifierConfig) {}

  /** 登録時のテスト通知を送信する。 */
  async sendTestNotification(
    channel: Channel,
  ): Promise<{ readonly ok: boolean }> {
    const unsubscribeUrl = this.createUnsubscribeUrl(channel);

    switch (channel.type) {
      case 'DSC':
        return sendToDiscord(
          channel.webhookUrl,
          createTestMessage(unsubscribeUrl),
        );
      case 'SLK':
        return sendToSlack(
          channel.webhookUrl,
          createSlackTestMessage(unsubscribeUrl),
        );
      case 'EML':
        return sendToEmail(this.config.sendEmail, {
          fromAddress: this.config.emailFrom,
          toAddress: channel.emailAddress,
          payload: createEmailTestMessage(unsubscribeUrl),
        });
    }
  }

  /** changelog更新通知を送信する。 */
  async sendChangelogNotification(
    channel: Channel,
    input: ChangelogNotificationInput,
  ): Promise<NotificationResult> {
    switch (channel.type) {
      case 'DSC':
        return this.sendDiscordChangelogNotification(channel, input);
      case 'SLK':
        return this.sendSlackChangelogNotification(channel, input);
      case 'EML':
        return this.sendEmailChangelogNotification(channel, input);
    }
  }

  /** 配信停止完了通知を送信する。 */
  async sendUnsubscribeNotification(
    channel: Channel,
  ): Promise<NotificationResult> {
    switch (channel.type) {
      case 'DSC': {
        const raw = await sendToDiscord(
          channel.webhookUrl,
          createUnsubscribeNotification(),
        );
        return toNotificationResult(raw);
      }
      case 'SLK': {
        const raw = await sendToSlack(
          channel.webhookUrl,
          createSlackUnsubscribeNotification(),
        );
        return toNotificationResult(raw);
      }
      case 'EML': {
        const raw = await sendToEmail(this.config.sendEmail, {
          fromAddress: this.config.emailFrom,
          toAddress: channel.emailAddress,
          payload: createEmailUnsubscribeNotification(),
        });
        return toNotificationResult(raw);
      }
    }
  }

  private async sendDiscordChangelogNotification(
    channel: DiscordChannel,
    input: ChangelogNotificationInput,
  ): Promise<NotificationResult> {
    const raw = await sendToDiscord(
      channel.webhookUrl,
      createChangelogMessage(input.analysis, input.version, {
        unsubscribeUrl: this.createUnsubscribeUrl(channel),
        siteUrl: this.config.siteUrl,
      }),
    );
    return toNotificationResult(raw);
  }

  private async sendSlackChangelogNotification(
    channel: SlackChannel,
    input: ChangelogNotificationInput,
  ): Promise<NotificationResult> {
    const raw = await sendToSlack(
      channel.webhookUrl,
      createSlackChangelogMessage(input.analysis, input.version, {
        unsubscribeUrl: this.createUnsubscribeUrl(channel),
        siteUrl: this.config.siteUrl,
      }),
    );
    return toNotificationResult(raw);
  }

  private async sendEmailChangelogNotification(
    channel: EmailChannel,
    input: ChangelogNotificationInput,
  ): Promise<NotificationResult> {
    const raw = await sendToEmail(this.config.sendEmail, {
      fromAddress: this.config.emailFrom,
      toAddress: channel.emailAddress,
      payload: createEmailChangelogMessage(input.analysis, input.version, {
        unsubscribeUrl: this.createUnsubscribeUrl(channel),
        siteUrl: this.config.siteUrl,
      }),
    });
    return toNotificationResult(raw);
  }

  private createUnsubscribeUrl(channel: Channel): string {
    return `${this.config.workerUrl}/api/unsubscribe?token=${channel.token}`;
  }
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

/** Cloudflare BindingsからChannelNotifier portの実装を作成する。 */
export function createChannelNotifier(
  bindings: CloudflareBindings,
): ChannelNotifier {
  return new InfrastructureChannelNotifier({
    sendEmail: bindings.SEND_EMAIL,
    emailFrom: bindings.EMAIL_FROM,
    workerUrl: bindings.WORKER_URL,
    siteUrl: bindings.SITE_URL,
  });
}
