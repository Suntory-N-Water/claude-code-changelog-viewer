import type { NotificationAnalysis } from '@claude-code-changelog-viewer/types';
import type { Channel } from '../domain/channel/channel';

/** 外部通知APIへの送信結果。adapterがHTTPステータスを意味のある種別に変換して返す。 */
export type NotificationResult =
  | { ok: true }
  | {
      ok: false;
      failureKind: 'permanent' | 'rate_limit' | 'temporary';
    };

/** changelog通知に必要な入力。URL生成はinfrastructure層のNotifier実装が担う。 */
export type ChangelogNotificationInput = {
  analysis: NotificationAnalysis;
  version: string;
};

/** usecaseが必要とする外部通知能力を抽象化するapplication port。 */
export type ChannelNotifier = {
  /** 登録時に通知先が実際に送信可能か確認するテスト通知を送る。 */
  sendTestNotification(channel: Channel): Promise<{ ok: boolean }>;
  /** changelog更新通知を送る。 */
  sendChangelogNotification(
    channel: Channel,
    input: ChangelogNotificationInput,
  ): Promise<NotificationResult>;
  /** ユーザーによる配信停止完了通知を送る。 */
  sendUnsubscribeNotification(channel: Channel): Promise<NotificationResult>;
};
