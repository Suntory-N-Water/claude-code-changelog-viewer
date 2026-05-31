import type { ChannelToken } from './channel-token';
import type { DiscordWebhookUrl } from './discord-webhook-url';
import type { EmailAddress } from './email-address';
import type { NotificationFrequency } from './notification-frequency';
import type { SlackWebhookUrl } from './slack-webhook-url';

declare const channelIdBrand: unique symbol;

export type ChannelId = string & {
  readonly [channelIdBrand]: unknown;
};

export function createChannelId(value: string): ChannelId {
  if (value.trim() === '') {
    throw new Error('チャンネルIDが空です');
  }

  return value as ChannelId;
}

export type ChannelType = 'DSC' | 'SLK' | 'EML';

export type DeactivationReason = 'user' | 'system';

export type ActiveChannelStatus = {
  readonly type: 'active';
};

export type DeactivatedChannelStatus = {
  readonly type: 'deactivated';
  readonly reason: DeactivationReason;
  readonly deactivatedAt: Date;
};

export type ChannelStatus = ActiveChannelStatus | DeactivatedChannelStatus;

type ChannelBase<TType extends ChannelType> = {
  readonly id: ChannelId;
  readonly type: TType;
  readonly token: ChannelToken;
  readonly notificationFrequency: NotificationFrequency;
  readonly status: ChannelStatus;
  readonly failCount: number;
};

export type DiscordChannel = ChannelBase<'DSC'> & {
  readonly webhookUrl: DiscordWebhookUrl;
};

export type SlackChannel = ChannelBase<'SLK'> & {
  readonly webhookUrl: SlackWebhookUrl;
};

export type EmailChannel = ChannelBase<'EML'> & {
  readonly emailAddress: EmailAddress;
};

export type Channel = DiscordChannel | SlackChannel | EmailChannel;
