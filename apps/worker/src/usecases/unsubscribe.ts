import { workerLogger } from '../logger';
import type { Channel } from '../domain/channel/channel';
import type { ChannelRepository } from '../domain/channel/channel-repository';
import type { ChannelToken } from '../domain/channel/channel-token';
import { deactivate, isActive } from '../domain/channel/channel-lifecycle';
import type { ChannelNotifier } from './channel-notifier';

const logger = workerLogger('usecases.unsubscribe');

/** 配信停止ユースケースへ渡す入力。routes層で外部入力を値オブジェクトへ変換してから渡す。 */
export type UnsubscribeInput = {
  token: ChannelToken;
  unsubscribedAt: Date;
};

/** 配信停止ユースケースの実行結果。HTTPレスポンスへの変換はroutes層で行う。 */
export type UnsubscribeResult =
  | {
      ok: true;
      channel: Channel;
      notification: 'sent' | 'failed';
    }
  | {
      ok: false;
      error: 'not_found' | 'already_deactivated';
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
    logger.warn('配信停止対象が見つかりませんでした', {
      reason: 'not_found',
    });
    return { ok: false, error: 'not_found' };
  }

  if (!isActive(channel)) {
    logger.warn('配信停止対象は既に停止しています', {
      reason: 'already_deactivated',
      channel_type: channel.type,
    });
    return { ok: false, error: 'already_deactivated' };
  }

  const deactivatedChannel = deactivate(channel, 'user', input.unsubscribedAt);
  await repository.save(deactivatedChannel);

  const notificationResult =
    await notifier.sendUnsubscribeNotification(deactivatedChannel);
  if (!notificationResult.ok) {
    logger.warn('配信停止通知に失敗しました', {
      channel_type: deactivatedChannel.type,
      notification: 'failed',
    });
    return {
      ok: true,
      channel: deactivatedChannel,
      notification: 'failed',
    };
  }

  logger.info('配信停止が完了しました', {
    channel_type: deactivatedChannel.type,
    notification: 'sent',
  });

  return { ok: true, channel: deactivatedChannel, notification: 'sent' };
}
