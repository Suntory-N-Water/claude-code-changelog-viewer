import type { Channel, DeactivationReason } from './channel';

/** チャンネルが配信有効状態か判定する。 */
export function isActive(channel: Channel): boolean {
  return channel.status.type === 'active';
}

/** チャンネルを指定理由で停止状態にする。 */
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

/** 停止済みチャンネルを再有効化し、失敗回数を0に戻す。 */
export function reactivate(channel: Channel): Channel {
  return {
    ...channel,
    status: { type: 'active' },
    failCount: 0,
  };
}
