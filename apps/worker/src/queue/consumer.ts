import {
  getLogger,
  runWithLogContext,
  toError,
} from '@claude-code-changelog-viewer/common';
import {
  ClaudeCodeVersionSchema,
  NotificationAnalysisSchema,
} from '@claude-code-changelog-viewer/types';
import { z } from 'zod';
import { dispatchChangelogNotifications } from '../usecases/dispatch-changelog-notifications';
import { createNotificationFrequency } from '../domain/channel/notification-frequency';
import { createChannelNotifier } from '../infrastructure/channel-notifier';
import { createChannelRepository } from '../infrastructure/drizzle/channel-repository';

const logger = getLogger({
  name: 'queue.consumer',
  serviceName: 'changelog-viewer-worker',
  level: 'INFO',
  format: 'json',
});

const SEND_INTERVAL_MS = 1000;

const NotificationMessageSchema = z.object({
  version: ClaudeCodeVersionSchema,
  analysis: NotificationAnalysisSchema,
  traceId: z.string().optional(),
});

export const queueConsumer: ExportedHandler<CloudflareBindings>['queue'] =
  async (batch, env) => {
    for (const message of batch.messages) {
      const body = message.body;
      const traceId =
        typeof body === 'object' && body !== null && 'traceId' in body
          ? typeof body.traceId === 'string'
            ? body.traceId
            : crypto.randomUUID()
          : crypto.randomUUID();

      await runWithLogContext(
        { trace_id: traceId, 'message.id': message.id },
        async () => {
          try {
            const bodyResult = NotificationMessageSchema.safeParse(body);
            if (!bodyResult.success) {
              // 同じメッセージを何度処理しても同じ結果になるため、再試行せずキューから取り除く
              logger.error('不正なキューメッセージ', {
                error: bodyResult.error,
              });
              message.ack();
              return;
            }
            const { version, analysis } = bodyResult.data;

            const repository = createChannelRepository(
              env.DB,
              env.EMAIL_ENCRYPTION_KEY,
            );
            const notifier = createChannelNotifier(env);
            const result = await dispatchChangelogNotifications(
              repository,
              notifier,
              {
                analysis,
                version,
                frequency: createNotificationFrequency('IMM'),
                failedAt: new Date(),
                sendIntervalMs: SEND_INTERVAL_MS,
              },
            );

            if (result.channelCount === 0) {
              logger.info('アクティブなチャンネルが存在しません');
              message.ack();
              return;
            }

            if (result.shouldRetry) {
              message.retry();
            } else {
              message.ack();
            }
          } catch (error) {
            logger.error('メッセージ処理中に例外が発生', {
              error: toError(error),
            });
            message.retry();
          }
        },
      );
    }
  };
