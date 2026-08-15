import type { ChannelToken } from './channel-token';
import { createChannelToken } from './channel-token';
import type { ChannelAddress } from './channel-repository';
import type { DiscordWebhookUrl } from './discord-webhook-url';
import type { EmailAddress } from './email-address';
import type { NotificationFrequency } from './notification-frequency';
import type { SlackWebhookUrl } from './slack-webhook-url';

declare const channelIdBrand: unique symbol;

/** チャンネル集約を一意に識別するID。 */
export type ChannelId = string & {
  readonly [channelIdBrand]: unknown;
};

/** 空文字でない文字列からChannelIdを生成する。 */
export function createChannelId(value: string): ChannelId {
  if (value.trim() === '') {
    throw new Error('チャンネルIDが空です');
  }

  return value as ChannelId;
}

/** 通知チャンネル種別。DBの channel_type と対応する。 */
export type ChannelType = 'DSC' | 'SLK' | 'EML';

/** チャンネルが無効化された理由。 */
export type DeactivationReason = 'user' | 'system';

/** 通知配信が有効な状態。 */
export type ActiveChannelStatus = {
  readonly type: 'active';
};

/** 通知配信が停止されている状態。 */
export type DeactivatedChannelStatus = {
  readonly type: 'deactivated';
  readonly reason: DeactivationReason;
  readonly deactivatedAt: Date;
};

/** チャンネルの配信状態。 */
export type ChannelStatus = ActiveChannelStatus | DeactivatedChannelStatus;

type ChannelBase<TType extends ChannelType> = {
  readonly id: ChannelId;
  readonly type: TType;
  readonly token: ChannelToken;
  readonly notificationFrequency: NotificationFrequency;
  readonly status: ChannelStatus;
  readonly failCount: number;
};

/** Discord Webhook を通知先に持つチャンネル。 */
export type DiscordChannel = ChannelBase<'DSC'> & {
  readonly webhookUrl: DiscordWebhookUrl;
};

/** Slack Webhook を通知先に持つチャンネル。 */
export type SlackChannel = ChannelBase<'SLK'> & {
  readonly webhookUrl: SlackWebhookUrl;
};

/** Emailアドレスを通知先に持つチャンネル。 */
export type EmailChannel = ChannelBase<'EML'> & {
  readonly emailAddress: EmailAddress;
};

/** 通知チャンネル集約。通知設定は集約内の notificationFrequency として扱う。 */
export type Channel = DiscordChannel | SlackChannel | EmailChannel;

/**
 * 新しい通知チャンネル集約を作成する。
 *
 * ID/Tokenの採番、初期状態(active)、失敗回数0という生成時の不変条件をここに集約する。
 */
export function createChannel(
  address: ChannelAddress,
  notificationFrequency: NotificationFrequency,
): Channel {
  const base = {
    id: createChannelId(crypto.randomUUID()),
    token: createChannelToken(crypto.randomUUID()),
    notificationFrequency,
    status: { type: 'active' },
    failCount: 0,
  } as const;

  switch (address.type) {
    case 'DSC':
      return {
        ...base,
        type: 'DSC',
        webhookUrl: address.value,
      };
    case 'SLK':
      return {
        ...base,
        type: 'SLK',
        webhookUrl: address.value,
      };
    case 'EML':
      return {
        ...base,
        type: 'EML',
        emailAddress: address.value,
      };
  }
}
