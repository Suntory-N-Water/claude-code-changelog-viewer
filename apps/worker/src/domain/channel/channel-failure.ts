import type { Channel } from './channel';
import { deactivate } from './channel-lifecycle';

/** 恒久失敗がこの回数に達したらチャンネルをsystem理由で無効化する。 */
export const CHANNEL_FAILURE_THRESHOLD = 3;

/** 送信失敗を記録し、閾値に達した場合はチャンネルを無効化する。 */
export function recordFailure(channel: Channel, failedAt: Date): Channel {
  if (!isFailureRecordable(channel)) {
    return channel;
  }

  const failedChannel = {
    ...channel,
    failCount: channel.failCount + 1,
  };

  if (failedChannel.failCount < CHANNEL_FAILURE_THRESHOLD) {
    return failedChannel;
  }

  return deactivate(failedChannel, 'system', failedAt);
}

/** 送信成功時に失敗回数を0へ戻す。 */
export function resetFailure(channel: Channel): Channel {
  if (channel.failCount === 0) {
    return channel;
  }

  return {
    ...channel,
    failCount: 0,
  };
}

function isFailureRecordable(channel: Channel): boolean {
  return channel.status.type === 'active';
}
