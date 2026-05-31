import type { Channel, ChannelId } from './channel';
import type { DiscordWebhookUrl } from './discord-webhook-url';
import type { EmailAddress } from './email-address';
import type { NotificationFrequency } from './notification-frequency';
import type { SlackWebhookUrl } from './slack-webhook-url';

export type ChannelAddress =
  | { readonly type: 'DSC'; readonly value: DiscordWebhookUrl }
  | { readonly type: 'SLK'; readonly value: SlackWebhookUrl }
  | { readonly type: 'EML'; readonly value: EmailAddress };

export type ChannelRepository = {
  findById(id: ChannelId): Promise<Channel | null>;
  findByAddress(address: ChannelAddress): Promise<Channel | null>;
  save(channel: Channel): Promise<void>;
  findActiveByFrequency(frequency: NotificationFrequency): Promise<Channel[]>;
  findDeactivatedBefore(date: Date): Promise<Channel[]>;
  delete(id: ChannelId): Promise<void>;
};
