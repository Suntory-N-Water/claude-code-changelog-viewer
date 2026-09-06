import { afterEach, describe, expect, it } from 'vitest';
import { createChannelRepository } from '../infrastructure/drizzle/channel-repository';
import { cleanupInactiveChannels } from './cleanup-inactive-channels';
import { FakeD1Database } from '../test-support/fake-d1';
import {
  createTestEnv,
  findChannelByToken,
  insertDiscordWebhook,
} from '../test-support/notification-test-support';

describe('休眠チャンネルの削除', () => {
  let db: FakeD1Database | null = null;

  afterEach(() => {
    db?.close();
    db = null;
  });

  it('30日前より前に停止したチャンネルだけを削除すること', async () => {
    db = new FakeD1Database();
    const env = createTestEnv(db);
    await insertDiscordWebhook(db, {
      id: 'expired-id',
      webhookUrl: 'https://discord.com/api/webhooks/123456/expired',
      token: 'expired-token',
      deactivatedAt: '2026-01-01 00:00:00',
      deactivatedReason: 'user',
    });
    await insertDiscordWebhook(db, {
      id: 'boundary-id',
      webhookUrl: 'https://discord.com/api/webhooks/123456/boundary',
      token: 'boundary-token',
      deactivatedAt: '2026-01-02 00:00:00',
      deactivatedReason: 'user',
    });

    const result = await cleanupInactiveChannels(
      createChannelRepository(env.DB, env.EMAIL_ENCRYPTION_KEY),
      { now: new Date('2026-02-01T00:00:00.000Z') },
    );

    expect(result).toEqual({ deletedCount: 1 });
    expect(await findChannelByToken(db, 'expired-token')).toBeNull();
    expect(await findChannelByToken(db, 'boundary-token')).not.toBeNull();
  });
});
