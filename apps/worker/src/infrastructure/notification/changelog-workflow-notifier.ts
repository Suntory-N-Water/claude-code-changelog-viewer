import type { ChangelogNotificationPort } from '../../usecases/changelog-inference-workflow';

type ChangelogNotificationMessage = Parameters<
  ChangelogNotificationPort['send']
>[0];

export function createChangelogWorkflowNotifier(
  queue: Queue<ChangelogNotificationMessage>,
): ChangelogNotificationPort {
  return {
    async send(message) {
      await queue.send(message);
    },
  };
}
