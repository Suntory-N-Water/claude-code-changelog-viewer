import { afterEach, describe, expect, it } from 'vitest';
import { cleanupInactiveChannels } from './cleanup';
import { createChannelRepository } from '../infrastructure/drizzle/channel-repository';
import { cleanupInactiveChannels as cleanupInactiveChannelsUsecase } from '../usecases/cleanup-inactive-channels';
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

    await cleanupInactiveChannels(env, new Date('2026-02-01T00:00:00.000Z'));

    expect(await findChannelByToken(db, 'expired-token')).toBeNull();
    expect(await findChannelByToken(db, 'boundary-token')).not.toBeNull();
  });

  it('削除したチャンネル数を返すこと', async () => {
    db = new FakeD1Database();
    const env = createTestEnv(db);
    await insertDiscordWebhook(db, {
      id: 'expired-id',
      webhookUrl: 'https://discord.com/api/webhooks/123456/expired-count',
      token: 'expired-count-token',
      deactivatedAt: '2026-01-01 00:00:00',
      deactivatedReason: 'user',
    });
    const repository = createChannelRepository(
      env.DB,
      env.EMAIL_ENCRYPTION_KEY,
    );

    const result = await cleanupInactiveChannelsUsecase(repository, {
      cutoffDate: new Date('2026-01-02T00:00:00.000Z'),
    });

    expect(result).toEqual({ deletedCount: 1 });
  });
});
