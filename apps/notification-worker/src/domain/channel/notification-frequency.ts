declare const notificationFrequencyBrand: unique symbol;

export type NotificationFrequency = ('IMM' | 'WEK') & {
  readonly [notificationFrequencyBrand]: unknown;
};

export function createNotificationFrequency(
  value: string,
): NotificationFrequency {
  if (value !== 'IMM' && value !== 'WEK') {
    throw new Error('通知頻度の形式が不正です');
  }

  return value as NotificationFrequency;
}
