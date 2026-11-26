import { workerLogger } from '../logger';
import { runWithLogContext, toError } from '@claude-code-changelog-viewer/common';
import { ClaudeCodeVersionSchema } from '@claude-code-changelog-viewer/types';
import { drizzle } from 'drizzle-orm/d1';
import { z } from 'zod';
import { dispatchChangelogNotifications } from '../usecases/dispatch-changelog-notifications';
import { createNotificationFrequency } from '../domain/channel/notification-frequency';
import { createChannelNotifier } from '../infrastructure/channel-notifier';
import { createChannelRepository } from '../infrastructure/drizzle/channel-repository';
import { findNotificationAnalysis } from '../infrastructure/drizzle/notification-analysis-reader';

const logger = workerLogger('queue.consumer');

const SEND_INTERVAL_MS = 1000;

// Queue のメッセージは 128KB が上限で、項目の多いリリースの本文を含めると超える。
// バージョン番号だけを受け取り、通知内容は D1 から組み立てる
const NotificationMessageSchema = z.object({
  version: ClaudeCodeVersionSchema,
  traceId: z.string().optional(),
});

export const queueConsumer: ExportedHandler<CloudflareBindings>['queue'] = async (batch, env) => {
  for (const message of batch.messages) {
    const body = message.body;
    const traceId =
      typeof body === 'object' && body !== null && 'traceId' in body
        ? typeof body.traceId === 'string'
          ? body.traceId
          : crypto.randomUUID()
        : crypto.randomUUID();

    await runWithLogContext({ trace_id: traceId, 'message.id': message.id }, async () => {
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
        const { version } = bodyResult.data;

        const analysis = await findNotificationAnalysis(drizzle(env.DB), version);
        if (analysis === null) {
          // D1 に無いバージョンは再試行しても見つからないため、キューから取り除く
          logger.error('通知対象のバージョンが D1 にありません', {
            'notification.version': version,
          });
          message.ack();
          return;
        }

        const repository = createChannelRepository(env.DB, env.EMAIL_ENCRYPTION_KEY);
        const notifier = createChannelNotifier(env);
        const result = await dispatchChangelogNotifications(repository, notifier, {
          analysis,
          version,
          frequency: createNotificationFrequency('IMM'),
          failedAt: new Date(),
          sendIntervalMs: SEND_INTERVAL_MS,
        });

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
    });
  }
};
