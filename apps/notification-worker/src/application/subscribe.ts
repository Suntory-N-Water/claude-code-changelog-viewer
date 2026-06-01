import type { Channel } from '../domain/channel/channel';
import { createChannelId } from '../domain/channel/channel';
import type { ChannelNotifier } from '../domain/channel/channel-notifier';
import type {
  ChannelAddress,
  ChannelRepository,
} from '../domain/channel/channel-repository';
import { createChannelToken } from '../domain/channel/channel-token';
import { prepareExistingChannelForSubscription } from '../domain/channel/channel-lifecycle';
import type { NotificationFrequency } from '../domain/channel/notification-frequency';

export type SubscribeInput = {
  readonly address: ChannelAddress;
  readonly frequency: NotificationFrequency;
};

export type SubscribeResult =
  | {
      readonly ok: true;
      readonly channel: Channel;
      readonly status: 'created' | 'reactivated';
    }
  | {
      readonly ok: false;
      readonly error: 'already_registered' | 'invalid_notification_destination';
    };

export async function subscribe(
  repository: ChannelRepository,
  notifier: ChannelNotifier,
  input: SubscribeInput,
): Promise<SubscribeResult> {
  const existing = await repository.findByAddress(input.address);
  if (existing) {
    const subscription = prepareExistingChannelForSubscription(existing);
    if (subscription.type === 'already_active') {
      return { ok: false, error: 'already_registered' };
    }

    const channel = subscription.channel;
    const testResult = await notifier.sendTestNotification(channel);
    if (!testResult.ok) {
      return { ok: false, error: 'invalid_notification_destination' };
    }

    await repository.save(channel);
    return { ok: true, channel, status: 'reactivated' };
  }

  const channel = createNewChannel(input.address, input.frequency);
  const testResult = await notifier.sendTestNotification(channel);
  if (!testResult.ok) {
    return { ok: false, error: 'invalid_notification_destination' };
  }

  await repository.save(channel);
  return { ok: true, channel, status: 'created' };
}

function createNewChannel(
  address: ChannelAddress,
  notificationFrequency: NotificationFrequency,
): Channel {
  const base = {
    id: createChannelId(crypto.randomUUID()),
    token: createChannelToken(crypto.randomUUID()),
    notificationFrequency,
    status: { type: 'active' },
    failCount: 0,
  } as const;

  switch (address.type) {
    case 'DSC':
      return {
        ...base,
        type: 'DSC',
        webhookUrl: address.value,
      };
    case 'SLK':
      return {
        ...base,
        type: 'SLK',
        webhookUrl: address.value,
      };
    case 'EML':
      return {
        ...base,
        type: 'EML',
        emailAddress: address.value,
      };
  }
}
