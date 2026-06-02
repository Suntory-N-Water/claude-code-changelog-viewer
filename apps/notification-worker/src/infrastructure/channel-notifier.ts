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
      case 'DSC':
        return sendToDiscord(
          channel.webhookUrl,
          createUnsubscribeNotification(),
        );
      case 'SLK':
        return sendToSlack(
          channel.webhookUrl,
          createSlackUnsubscribeNotification(),
        );
      case 'EML':
        return sendToEmail(this.config.sendEmail, {
          fromAddress: this.config.emailFrom,
          toAddress: channel.emailAddress,
          payload: createEmailUnsubscribeNotification(),
        });
    }
  }

  private async sendDiscordChangelogNotification(
    channel: DiscordChannel,
    input: ChangelogNotificationInput,
  ): Promise<NotificationResult> {
    return sendToDiscord(
      channel.webhookUrl,
      createChangelogMessage(input.analysis, input.version, {
        unsubscribeUrl: this.createUnsubscribeUrl(channel),
        siteUrl: this.config.siteUrl,
      }),
    );
  }

  private async sendSlackChangelogNotification(
    channel: SlackChannel,
    input: ChangelogNotificationInput,
  ): Promise<NotificationResult> {
    return sendToSlack(
      channel.webhookUrl,
      createSlackChangelogMessage(input.analysis, input.version, {
        unsubscribeUrl: this.createUnsubscribeUrl(channel),
        siteUrl: this.config.siteUrl,
      }),
    );
  }

  private async sendEmailChangelogNotification(
    channel: EmailChannel,
    input: ChangelogNotificationInput,
  ): Promise<NotificationResult> {
    return sendToEmail(this.config.sendEmail, {
      fromAddress: this.config.emailFrom,
      toAddress: channel.emailAddress,
      payload: createEmailChangelogMessage(input.analysis, input.version, {
        unsubscribeUrl: this.createUnsubscribeUrl(channel),
        siteUrl: this.config.siteUrl,
      }),
    });
  }

  private createUnsubscribeUrl(channel: Channel): string {
    return `${this.config.workerUrl}/api/unsubscribe?token=${channel.token}`;
  }
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
