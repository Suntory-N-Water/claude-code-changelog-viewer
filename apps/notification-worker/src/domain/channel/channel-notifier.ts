import type { Analysis } from '@claude-code-changelog-viewer/types';
import type { Channel } from './channel';

/** 通知本文生成に必要なURL群。 */
export type NotificationUrls = {
  readonly unsubscribeUrl: string;
  readonly siteUrl: string;
};

/** 外部通知APIへの送信結果。 */
export type NotificationResult = {
  readonly ok: boolean;
  readonly status: number;
};

/** Channelへの外部通知送信を抽象化するport。実装はinfrastructure層に置く。 */
export type ChannelNotifier = {
  /** 登録時に通知先が実際に送信可能か確認するテスト通知を送る。 */
  sendTestNotification(channel: Channel): Promise<{ readonly ok: boolean }>;
  /** changelog更新通知を送る。 */
  sendChangelogNotification(
    channel: Channel,
    analysis: Analysis,
    version: string,
    urls: NotificationUrls,
  ): Promise<NotificationResult>;
  /** ユーザーによる配信停止完了通知を送る。 */
  sendUnsubscribeNotification(channel: Channel): Promise<void>;
};
