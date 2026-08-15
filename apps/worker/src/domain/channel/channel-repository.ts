import type { Channel, ChannelId } from './channel';
import type { ChannelToken } from './channel-token';
import type { DiscordWebhookUrl } from './discord-webhook-url';
import type { EmailAddress } from './email-address';
import type { NotificationFrequency } from './notification-frequency';
import type { SlackWebhookUrl } from './slack-webhook-url';

/** リポジトリが通知先の重複検索に使うアドレス表現。 */
export type ChannelAddress =
  | { readonly type: 'DSC'; readonly value: DiscordWebhookUrl }
  | { readonly type: 'SLK'; readonly value: SlackWebhookUrl }
  | { readonly type: 'EML'; readonly value: EmailAddress };

/** Channel集約の永続化を抽象化するport。実装はinfrastructure層に置く。 */
export type ChannelRepository = {
  /** IDでチャンネルを取得する。 */
  findById(id: ChannelId): Promise<Channel | null>;
  /** 配信停止URLなどに含まれるtokenでチャンネルを取得する。 */
  findByToken(token: ChannelToken): Promise<Channel | null>;
  /** 通知先アドレスで既存チャンネルを取得する。 */
  findByAddress(address: ChannelAddress): Promise<Channel | null>;
  /** Channel集約と集約内の通知設定をまとめて保存する。 */
  save(channel: Channel): Promise<void>;
  /** 指定頻度で配信対象となる有効チャンネルを取得する。 */
  findActiveByFrequency(frequency: NotificationFrequency): Promise<Channel[]>;
  /** 指定バージョンの通知がチャンネルへ配信済みかを返す。 */
  hasDelivered(version: string, channelId: ChannelId): Promise<boolean>;
  /** 指定バージョンの通知がチャンネルへ配信済みであることを記録する。 */
  recordDelivered(version: string, channelId: ChannelId): Promise<void>;
  /** 指定日時より前に停止されたチャンネルを取得する。 */
  findDeactivatedBefore(date: Date): Promise<Channel[]>;
  /** Channel集約を削除する。 */
  delete(id: ChannelId): Promise<void>;
};
