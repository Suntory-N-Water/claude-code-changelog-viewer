import type { Channel } from './channel';
import { deactivate } from './channel-lifecycle';

export const CHANNEL_FAILURE_THRESHOLD = 3;

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
