import type { DiscordWebhookUrl } from './discord-webhook-url';
import type { EmailAddress } from './email-address';
import type { SlackWebhookUrl } from './slack-webhook-url';

/** 通知先を識別するためのドメイン上のアドレス表現。 */
export type ChannelAddress =
  | { type: 'DSC'; value: DiscordWebhookUrl }
  | { type: 'SLK'; value: SlackWebhookUrl }
  | { type: 'EML'; value: EmailAddress };
