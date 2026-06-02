import type { Channel } from '../domain/channel/channel';
import type { ChannelNotifier } from '../domain/channel/channel-notifier';
import type { ChannelRepository } from '../domain/channel/channel-repository';
import type { ChannelToken } from '../domain/channel/channel-token';
import { deactivate, isActive } from '../domain/channel/channel-lifecycle';

/** 配信停止ユースケースへ渡す入力。routes層で外部入力を値オブジェクトへ変換してから渡す。 */
export type UnsubscribeInput = {
  readonly token: ChannelToken;
  readonly unsubscribedAt: Date;
};

/** 配信停止ユースケースの実行結果。HTTPレスポンスへの変換はroutes層で行う。 */
export type UnsubscribeResult =
  | { readonly ok: true; readonly channel: Channel }
  | {
      readonly ok: false;
      readonly error: 'not_found' | 'already_deactivated';
    };

/**
 * tokenに対応する有効チャンネルをユーザー理由で停止する。
 *
 * 停止状態を保存した後、停止完了通知を送信する。
 */
export async function unsubscribe(
  repository: ChannelRepository,
  notifier: ChannelNotifier,
  input: UnsubscribeInput,
): Promise<UnsubscribeResult> {
  const channel = await repository.findByToken(input.token);
  if (!channel) {
    return { ok: false, error: 'not_found' };
  }

  if (!isActive(channel)) {
    return { ok: false, error: 'already_deactivated' };
  }

  const deactivatedChannel = deactivate(channel, 'user', input.unsubscribedAt);
  await repository.save(deactivatedChannel);

  await notifier.sendUnsubscribeNotification(deactivatedChannel);

  return { ok: true, channel: deactivatedChannel };
}
