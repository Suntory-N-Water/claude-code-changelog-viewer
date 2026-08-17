import type { ChannelToken } from '../domain/channel/channel-token';
import type { ChannelRepository } from '../domain/channel/channel-repository';
import { isActive } from '../domain/channel/channel-lifecycle';

export type PrepareUnsubscribeInput = {
  token: ChannelToken;
};

export type PrepareUnsubscribeResult =
  | { ok: true; token: ChannelToken }
  | {
      ok: false;
      error: 'not_found' | 'already_deactivated';
    };

/** 配信停止確認画面を表示できる有効チャンネルか確認する。 */
export async function prepareUnsubscribe(
  repository: ChannelRepository,
  input: PrepareUnsubscribeInput,
): Promise<PrepareUnsubscribeResult> {
  const channel = await repository.findByToken(input.token);
  if (!channel) {
    return { ok: false, error: 'not_found' };
  }

  if (!isActive(channel)) {
    return { ok: false, error: 'already_deactivated' };
  }

  return { ok: true, token: channel.token };
}
