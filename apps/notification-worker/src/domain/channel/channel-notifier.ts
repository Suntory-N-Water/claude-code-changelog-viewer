import type { Analysis } from '@claude-code-changelog-viewer/types';
import type { Channel } from './channel';

export type NotificationUrls = {
  readonly unsubscribeUrl: string;
  readonly siteUrl: string;
};

export type NotificationResult = {
  readonly ok: boolean;
  readonly status: number;
};

export type ChannelNotifier = {
  sendTestNotification(channel: Channel): Promise<{ readonly ok: boolean }>;
  sendChangelogNotification(
    channel: Channel,
    analysis: Analysis,
    version: string,
    urls: NotificationUrls,
  ): Promise<NotificationResult>;
  sendUnsubscribeNotification(channel: Channel): Promise<void>;
};
