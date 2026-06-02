import { getLogger, toError } from '@claude-code-changelog-viewer/common';
import { AnalysisSchema } from '@claude-code-changelog-viewer/types';
import { z } from 'zod';
import { dispatchChangelogNotifications } from '../application/dispatch-changelog-notifications';
import { createNotificationFrequency } from '../domain/channel/notification-frequency';
import { createChannelNotifier } from '../infrastructure/channel-notifier';
import { createChannelRepository } from '../infrastructure/drizzle/channel-repository';

const logger = getLogger({
  name: 'notification-worker',
  level: 'INFO',
  format: 'json',
});

const GITHUB_RAW_BASE =
  'https://raw.githubusercontent.com/Suntory-N-Water/claude-code-changelog-viewer/main/apps/changelog-fetcher/inferred';

const SEND_INTERVAL_MS = 1000;

const NotificationMessageSchema = z.object({
  version: z.string().startsWith('v'),
});

export const queueConsumer: ExportedHandler<CloudflareBindings>['queue'] =
  async (batch, env) => {
    for (const message of batch.messages) {
      try {
        const bodyResult = NotificationMessageSchema.safeParse(message.body);
        if (!bodyResult.success) {
          logger.error('不正なキューメッセージ', {
            error: bodyResult.error.message,
          });
          message.ack();
          continue;
        }
        const { version } = bodyResult.data;

        // GitHub Raw URL から inferred JSON を取得
        const inferredUrl = `${GITHUB_RAW_BASE}/inferred_${version}.json`;
        const response = await fetch(inferredUrl);
        if (!response.ok) {
          logger.error('inferred JSONの取得に失敗', {
            url: inferredUrl,
            status: response.status,
          });
          message.retry();
          continue;
        }

        const rawData = await response.json();
        const parseResult = AnalysisSchema.safeParse(rawData);
        if (!parseResult.success) {
          logger.error('inferred JSONのパースに失敗', {
            error: parseResult.error.message,
          });
          message.retry();
          continue;
        }
        const data = parseResult.data;

        const repository = createChannelRepository(
          env.DB,
          env.EMAIL_ENCRYPTION_KEY,
        );
        const notifier = createChannelNotifier(env);
        const result = await dispatchChangelogNotifications(
          repository,
          notifier,
          {
            analysis: data,
            version,
            frequency: createNotificationFrequency('IMM'),
            failedAt: new Date(),
            sendIntervalMs: SEND_INTERVAL_MS,
          },
        );

        if (result.channelCount === 0) {
          logger.info('アクティブなチャンネルが存在しません');
          message.ack();
          continue;
        }

        for (const failure of result.failures) {
          switch (failure.type) {
            case 'rate_limit':
              logger.warn('レート制限を受信', {
                channelId: failure.channel.id,
              });
              break;
            case 'temporary_failure':
              logger.error('送信失敗', {
                channelId: failure.channel.id,
                status: failure.status,
              });
              break;
            case 'exception':
              logger.error('webhook送信中に例外が発生', {
                channelId: failure.channel.id,
                error: toError(failure.error),
              });
              break;
          }
        }

        if (result.shouldRetry) {
          message.retry();
        } else {
          message.ack();
        }
      } catch (error) {
        logger.error('メッセージ処理中に例外が発生', {
          messageId: message.id,
          error: toError(error),
        });
        message.retry();
      }
    }
  };
