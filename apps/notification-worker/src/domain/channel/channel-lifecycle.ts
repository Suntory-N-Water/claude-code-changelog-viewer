import type { Channel, DeactivationReason } from './channel';

export function isActive(channel: Channel): boolean {
  return channel.status.type === 'active';
}

export function deactivate(
  channel: Channel,
  reason: DeactivationReason,
  deactivatedAt: Date,
): Channel {
  return {
    ...channel,
    status: {
      type: 'deactivated',
      reason,
      deactivatedAt,
    },
  };
}

export function reactivate(channel: Channel): Channel {
  return {
    ...channel,
    status: { type: 'active' },
    failCount: 0,
  };
}
