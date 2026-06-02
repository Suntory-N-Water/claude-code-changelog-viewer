import type { Analysis } from '@claude-code-changelog-viewer/types';
import type { Channel } from './channel';

/** 外部通知APIへの送信結果。 */
export type NotificationResult = {
  readonly ok: boolean;
  readonly status: number;
};

/** changelog通知に必要な入力。URL生成はinfrastructure層のNotifier実装が担う。 */
export type ChangelogNotificationInput = {
  readonly analysis: Analysis;
  readonly version: string;
};

/** Channelへの外部通知送信を抽象化するport。実装はinfrastructure層に置く。 */
export type ChannelNotifier = {
  /** 登録時に通知先が実際に送信可能か確認するテスト通知を送る。 */
  sendTestNotification(channel: Channel): Promise<{ readonly ok: boolean }>;
  /** changelog更新通知を送る。 */
  sendChangelogNotification(
    channel: Channel,
    input: ChangelogNotificationInput,
  ): Promise<NotificationResult>;
  /** ユーザーによる配信停止完了通知を送る。 */
  sendUnsubscribeNotification(channel: Channel): Promise<NotificationResult>;
};
