import { afterEach, describe, expect, it } from 'vitest';
import { createChannel } from '../../domain/channel/channel';
import { createDiscordWebhookUrl } from '../../domain/channel/discord-webhook-url';
import { createNotificationFrequency } from '../../domain/channel/notification-frequency';
import { FakeD1Database } from '../../test-support/fake-d1';
import { createChannelRepository } from './channel-repository';

const EMAIL_ENCRYPTION_KEY = 'test-email-encryption-key-32bytes!!';

describe('DrizzleChannelRepository integration', () => {
  let db: FakeD1Database | null = null;

  afterEach(() => {
    db?.close();
    db = null;
  });

  it('サブタイプの保存に失敗したとき、Channel 集約を部分保存しないこと', async () => {
    db = new FakeD1Database();
    const repository = createChannelRepository(
      db as unknown as D1Database,
      EMAIL_ENCRYPTION_KEY,
    );
    const address = {
      type: 'DSC',
      value: createDiscordWebhookUrl(
        'https://discord.com/api/webhooks/123456/duplicate',
      ),
    } as const;
    const first = createChannel(address, createNotificationFrequency('IMM'));
    const duplicate = createChannel(
      address,
      createNotificationFrequency('IMM'),
    );
    await repository.save(first);

    await expect(repository.save(duplicate)).rejects.toThrow();

    const commonRow = await db
      .prepare('SELECT id FROM channels WHERE id = ?')
      .bind(duplicate.id)
      .first();
    const settingRow = await db
      .prepare('SELECT id FROM notification_settings WHERE channel_id = ?')
      .bind(duplicate.id)
      .first();
    expect({ commonRow, settingRow }).toEqual({
      commonRow: null,
      settingRow: null,
    });
  });
});
