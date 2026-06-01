import type { Channel } from '../domain/channel/channel';
import type { ChannelNotifier } from '../domain/channel/channel-notifier';
import type { ChannelRepository } from '../domain/channel/channel-repository';
import { createChannelToken } from '../domain/channel/channel-token';
import { deactivate, isActive } from '../domain/channel/channel-lifecycle';

/** 配信停止ユースケースへ渡す入力。tokenは外部入力の文字列として受け取る。 */
export type UnsubscribeInput = {
  readonly token: string;
  readonly unsubscribedAt: Date;
};

/** 配信停止ユースケースの実行結果。HTTPレスポンスへの変換はroutes層で行う。 */
export type UnsubscribeResult =
  | { readonly ok: true; readonly channel: Channel }
  | {
      readonly ok: false;
      readonly error: 'missing_token' | 'not_found' | 'already_deactivated';
    };

/**
 * tokenに対応する有効チャンネルをユーザー理由で停止する。
 *
 * 停止状態の保存を優先し、停止通知の送信失敗はユースケース失敗として扱わない。
 */
export async function unsubscribe(
  repository: ChannelRepository,
  notifier: ChannelNotifier,
  input: UnsubscribeInput,
): Promise<UnsubscribeResult> {
  const tokenText = input.token.trim();
  if (tokenText === '') {
    return { ok: false, error: 'missing_token' };
  }

  const token = createChannelToken(tokenText);

  const channel = await repository.findByToken(token);
  if (!channel) {
    return { ok: false, error: 'not_found' };
  }

  if (!isActive(channel)) {
    return { ok: false, error: 'already_deactivated' };
  }

  const deactivatedChannel = deactivate(channel, 'user', input.unsubscribedAt);
  await repository.save(deactivatedChannel);

  try {
    await notifier.sendUnsubscribeNotification(deactivatedChannel);
  } catch {
    // 停止処理は保存済みのため、停止通知の失敗はユーザー操作を失敗扱いにしない。
  }

  return { ok: true, channel: deactivatedChannel };
}
