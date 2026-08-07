import type { Channel } from '../domain/channel/channel';
import { createChannel } from '../domain/channel/channel';
import type { ChannelNotifier } from '../domain/channel/channel-notifier';
import type {
  ChannelAddress,
  ChannelRepository,
} from '../domain/channel/channel-repository';
import { isActive, reactivate } from '../domain/channel/channel-lifecycle';
import type { NotificationFrequency } from '../domain/channel/notification-frequency';

/** 通知購読ユースケースへ渡す入力。routes層でHTTP入力を値オブジェクトへ変換してから渡す。 */
export type SubscribeInput = {
  readonly address: ChannelAddress;
  readonly frequency: NotificationFrequency;
};

/** 通知購読ユースケースの実行結果。HTTPステータスや表示文言への変換はroutes層で行う。 */
export type SubscribeResult =
  | {
      readonly ok: true;
      readonly channel: Channel;
      readonly status: 'created' | 'reactivated';
    }
  | {
      readonly ok: false;
      readonly error: 'already_registered' | 'invalid_notification_destination';
    };

/**
 * 通知先を購読登録する。
 *
 * 既存の有効チャンネルがあれば登録済みとして失敗を返す。
 * 停止済みチャンネルはユーザーが明示的に停止したものでなければ再有効化し、
 * 新しい通知先ならChannelを新規作成する。
 * DB保存や外部通知の具体実装はRepository/Notifier portへ委譲する。
 */
export async function subscribe(
  repository: ChannelRepository,
  notifier: ChannelNotifier,
  input: SubscribeInput,
): Promise<SubscribeResult> {
  const existing = await repository.findByAddress(input.address);
  if (existing) {
    if (isActive(existing)) {
      return { ok: false, error: 'already_registered' };
    }

    // unsubscribeのtokenは宛先の受信者しか知り得ないため'user'停止は本人の意思表示だが、
    // 'system'停止は配信失敗の閾値超過にすぎず本人の意思とは無関係。
    if (
      existing.status.type === 'deactivated' &&
      existing.status.reason === 'user'
    ) {
      return { ok: false, error: 'already_registered' };
    }

    const channel = reactivate(existing);
    const testResult = await notifier.sendTestNotification(channel);
    if (!testResult.ok) {
      return { ok: false, error: 'invalid_notification_destination' };
    }

    await repository.save(channel);
    return { ok: true, channel, status: 'reactivated' };
  }

  const channel = createChannel(input.address, input.frequency);
  const testResult = await notifier.sendTestNotification(channel);
  if (!testResult.ok) {
    return { ok: false, error: 'invalid_notification_destination' };
  }

  await repository.save(channel);
  return { ok: true, channel, status: 'created' };
}
