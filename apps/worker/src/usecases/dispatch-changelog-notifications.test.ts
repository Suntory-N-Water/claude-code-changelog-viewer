import { describe, expect, it, vi } from 'vitest';
import { createChannel } from '../domain/channel/channel';
import { createDiscordWebhookUrl } from '../domain/channel/discord-webhook-url';
import { createNotificationFrequency } from '../domain/channel/notification-frequency';
import { dispatchChangelogNotifications } from './dispatch-changelog-notifications';

describe('CHANGELOG 通知配信ユースケース', () => {
  it('配信記録の保存に失敗したとき、通知先の恒久失敗として記録しないこと', async () => {
    const channel = createChannel(
      {
        type: 'DSC',
        value: createDiscordWebhookUrl(
          'https://discord.com/api/webhooks/123456/database-error',
        ),
      },
      createNotificationFrequency('IMM'),
    );
    const save = vi.fn();
    const repository = {
      findById: vi.fn(),
      findByToken: vi.fn(),
      findByAddress: vi.fn(),
      save,
      findActiveByFrequency: vi.fn(async () => [channel]),
      hasDelivered: vi.fn(async () => false),
      recordDelivered: vi.fn(async () => {
        throw new Error('DB unavailable');
      }),
      findDeactivatedBefore: vi.fn(),
      delete: vi.fn(),
    };
    const notifier = {
      sendTestNotification: vi.fn(),
      sendChangelogNotification: vi.fn(async () => ({ ok: true }) as const),
      sendUnsubscribeNotification: vi.fn(),
    };

    await expect(
      dispatchChangelogNotifications(repository, notifier, {
        analysis: {
          version: 'v1.0.0',
          summary: '要約',
          items: [],
        },
        version: 'v1.0.0',
        frequency: createNotificationFrequency('IMM'),
        failedAt: new Date('2026-08-31T00:00:00.000Z'),
        sendIntervalMs: 0,
      }),
    ).rejects.toThrow('DB unavailable');
    expect(save).not.toHaveBeenCalled();
  });
});
