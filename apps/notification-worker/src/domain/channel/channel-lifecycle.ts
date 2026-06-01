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

export type ExistingChannelSubscription =
  | { readonly type: 'already_active' }
  | { readonly type: 'reactivated'; readonly channel: Channel };

export function prepareExistingChannelForSubscription(
  channel: Channel,
): ExistingChannelSubscription {
  if (isActive(channel)) {
    return { type: 'already_active' };
  }

  return {
    type: 'reactivated',
    channel: reactivate(channel),
  };
}
