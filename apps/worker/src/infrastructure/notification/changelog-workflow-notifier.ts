import { workerLogger } from '../../logger';
import { toError } from '@claude-code-changelog-viewer/common';
import { ClaudeCodeVersionSchema } from '@claude-code-changelog-viewer/types';
import { formatChangelogVersion } from '../../domain/changelog-inference/changelog-version';
import type { ChangelogNotificationPort } from '../../usecases/changelog-inference-workflow';

type NotificationQueueMessage = {
  version: string;
};

const logger = workerLogger('infrastructure.notification.changelog-workflow-notifier');

export function createChangelogWorkflowNotifier(
  queue: Queue<NotificationQueueMessage>,
): ChangelogNotificationPort {
  return {
    async send(version) {
      const notificationVersion = ClaudeCodeVersionSchema.parse(formatChangelogVersion(version));
      try {
        await queue.send({ version: notificationVersion });
      } catch (error) {
        logger.error('通知をキューに投入できませんでした', {
          'notification.version': notificationVersion,
          error: toError(error),
        });
        throw error;
      }
      logger.info('通知をキューに投入しました', {
        'notification.version': notificationVersion,
      });
    },
  };
}
