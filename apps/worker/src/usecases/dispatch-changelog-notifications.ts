import { getLogger } from '@claude-code-changelog-viewer/common';
import type { NotificationAnalysis } from '@claude-code-changelog-viewer/types';
import type { Channel } from '../domain/channel/channel';
import type { ChannelRepository } from '../domain/channel/channel-repository';
import { recordFailure, resetFailure } from '../domain/channel/channel-failure';
import type { NotificationFrequency } from '../domain/channel/notification-frequency';
import type { ChannelNotifier } from './channel-notifier';

const logger = getLogger({
  name: 'usecases.dispatch-changelog-notifications',
  serviceName: 'changelog-viewer-worker',
  level: 'INFO',
  format: 'json',
});

export type DispatchChangelogNotificationsInput = {
  analysis: NotificationAnalysis;
  version: string;
  frequency: NotificationFrequency;
  failedAt: Date;
  sendIntervalMs: number;
};

export type DispatchChangelogNotificationsResult = {
  channelCount: number;
  skippedCount: number;
  shouldRetry: boolean;
  failures: DispatchFailure[];
};

export type DispatchFailure =
  | {
      type: 'rate_limit';
      channel: Channel;
    }
  | {
      type: 'temporary_failure';
      channel: Channel;
    }
  | {
      type: 'exception';
      channel: Channel;
      error: unknown;
    };

/**
 * 指定頻度の有効チャンネルへchangelog通知を配信する。
 *
 * 通知先取得、通知送信、成功/恒久失敗時のChannel更新を進行管理する。
 * Queue固有のack/retry判断は、返却結果をもとに呼び出し側で行う。
 */
export async function dispatchChangelogNotifications(
  repository: ChannelRepository,
  notifier: ChannelNotifier,
  input: DispatchChangelogNotificationsInput,
): Promise<DispatchChangelogNotificationsResult> {
  const channels = await repository.findActiveByFrequency(input.frequency);
  const failures: DispatchFailure[] = [];
  let skippedCount = 0;

  for (const [index, channel] of channels.entries()) {
    if (await repository.hasDelivered(input.version, channel.id)) {
      skippedCount += 1;
      continue;
    }
    let shouldStop = false;

    let notificationResult:
      | Awaited<ReturnType<ChannelNotifier['sendChangelogNotification']>>
      | undefined;
    try {
      notificationResult = await notifier.sendChangelogNotification(channel, {
        analysis: input.analysis,
        version: input.version,
      });
    } catch (error) {
      failures.push({ type: 'exception', channel, error });
    }

    if (notificationResult !== undefined) {
      if (
        !notificationResult.ok &&
        notificationResult.failureKind === 'rate_limit'
      ) {
        failures.push({ type: 'rate_limit', channel });
        shouldStop = true;
      } else if (
        !notificationResult.ok &&
        notificationResult.failureKind === 'permanent'
      ) {
        await repository.save(recordFailure(channel, input.failedAt));
      } else if (!notificationResult.ok) {
        failures.push({ type: 'temporary_failure', channel });
      } else {
        await repository.recordDelivered(input.version, channel.id);
        const resetChannel = resetFailure(channel);
        if (channel !== resetChannel) {
          await repository.save(resetChannel);
        }
      }
    }

    if (shouldStop) {
      break;
    }

    if (index < channels.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, input.sendIntervalMs));
    }
  }

  const result = {
    channelCount: channels.length,
    skippedCount,
    shouldRetry: failures.length > 0,
    failures,
  };
  logger.info('通知配信の結果を集計しました', {
    'notification.channel_count': result.channelCount,
    'notification.skipped_count': result.skippedCount,
    'notification.failure_count': result.failures.length,
    'notification.should_retry': result.shouldRetry,
    'notification.version': input.version,
  });
  return result;
}
