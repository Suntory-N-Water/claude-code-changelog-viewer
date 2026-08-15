import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockedSendChangelogNotification } = vi.hoisted(() => ({
  mockedSendChangelogNotification: vi.fn(),
}));

vi.mock('../infrastructure/channel-notifier', () => ({
  createChannelNotifier: () => ({
    sendTestNotification: vi.fn(),
    sendChangelogNotification: mockedSendChangelogNotification,
    sendUnsubscribeNotification: vi.fn(),
  }),
}));

import type { NotificationAnalysis } from '@claude-code-changelog-viewer/types';
import { queueConsumer } from './consumer';
import { FakeD1Database } from '../test-support/fake-d1';
import {
  createQueueBatch,
  createQueueMessage,
  createTestEnv,
  findChannelByToken,
  insertDiscordWebhook,
} from '../test-support/notification-test-support';

const validAnalysis: NotificationAnalysis = {
  version: 'v1.0.0',
  summary: 'テスト用サマリー',
  items: [
    { content: 'Added new feature', content_ja: '新機能', prefix: 'feat' },
  ],
};

function buildBody(version = 'v1.0.0') {
  return { version, analysis: { ...validAnalysis, version } };
}

async function runWithTimers(promise: Promise<void>) {
  const result = promise;
  await vi.runAllTimersAsync();
  return result;
}

function callConsumer(batch: MessageBatch<unknown>, env: CloudflareBindings) {
  return queueConsumer?.(batch, env, {} as ExecutionContext) as Promise<void>;
}

describe('queueConsumer integration', () => {
  let db: FakeD1Database | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    db?.close();
    db = null;
  });

  it('送信成功時は過去の fail_count が 0 に戻る', async () => {
    db = new FakeD1Database();
    const message = createQueueMessage(buildBody());
    const batch = createQueueBatch([message]);
    const env = createTestEnv(db);
    await insertDiscordWebhook(db, {
      id: 'active-id',
      webhookUrl: 'https://discord.com/api/webhooks/123456/abcdef',
      token: 'active-token',
      failCount: 2,
    });
    mockedSendChangelogNotification.mockResolvedValue({ ok: true });

    await runWithTimers(callConsumer(batch, env));

    expect(message.ack).toHaveBeenCalled();
    expect(await findChannelByToken(db, 'active-token')).toEqual({
      id: 'active-id',
      webhook_url: 'https://discord.com/api/webhooks/123456/abcdef',
      token: 'active-token',
      deactivated_at: '9999-12-31',
      deactivated_reason: 'none',
      fail_count: 0,
    });
  });

  it('恒久失敗が続くと fail_count が増えしきい値到達でチャンネルがシステム停止される', async () => {
    db = new FakeD1Database();
    const message = createQueueMessage(buildBody());
    const batch = createQueueBatch([message]);
    const env = createTestEnv(db);
    await insertDiscordWebhook(db, {
      id: 'active-id',
      webhookUrl: 'https://discord.com/api/webhooks/123456/abcdef',
      token: 'active-token',
      failCount: 2,
    });
    mockedSendChangelogNotification.mockResolvedValue({
      ok: false,
      failureKind: 'permanent',
    });

    await runWithTimers(callConsumer(batch, env));

    expect(message.ack).toHaveBeenCalled();
    expect(await findChannelByToken(db, 'active-token')).toMatchObject({
      id: 'active-id',
      deactivated_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}/),
      deactivated_reason: 'system',
      fail_count: 3,
    });
  });

  it('複数チャンネル配信中に一部が失敗しても各チャンネルの最終状態が正しく反映される', async () => {
    db = new FakeD1Database();
    const message = createQueueMessage(buildBody());
    const batch = createQueueBatch([message]);
    const env = createTestEnv(db);
    await insertDiscordWebhook(db, {
      id: 'success-id',
      webhookUrl: 'https://discord.com/api/webhooks/123456/success',
      token: 'success-token',
      failCount: 1,
    });
    await insertDiscordWebhook(db, {
      id: 'fail-id',
      webhookUrl: 'https://discord.com/api/webhooks/123456/fail',
      token: 'fail-token',
      failCount: 2,
    });
    mockedSendChangelogNotification
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, failureKind: 'permanent' });

    await runWithTimers(callConsumer(batch, env));

    expect(message.ack).toHaveBeenCalled();
    expect(await findChannelByToken(db, 'success-token')).toEqual({
      id: 'success-id',
      webhook_url: 'https://discord.com/api/webhooks/123456/success',
      token: 'success-token',
      deactivated_at: '9999-12-31',
      deactivated_reason: 'none',
      fail_count: 0,
    });
    expect(await findChannelByToken(db, 'fail-token')).toMatchObject({
      id: 'fail-id',
      deactivated_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}/),
      deactivated_reason: 'system',
      fail_count: 3,
    });
  });

  it('frequency が WEK のチャンネルはキュー配信時に個別通知が送信されない', async () => {
    db = new FakeD1Database();
    const message = createQueueMessage(buildBody());
    const batch = createQueueBatch([message]);
    const env = createTestEnv(db);
    await insertDiscordWebhook(db, {
      id: 'wek-id',
      webhookUrl: 'https://discord.com/api/webhooks/123456/wek',
      token: 'wek-token',
      frequency: 'WEK',
    });

    await runWithTimers(callConsumer(batch, env));

    expect(mockedSendChangelogNotification).not.toHaveBeenCalled();
    expect(message.ack).toHaveBeenCalled();
  });

  it('通知で 429 が返ると message.retry が呼ばれる', async () => {
    db = new FakeD1Database();
    const message = createQueueMessage(buildBody());
    const batch = createQueueBatch([message]);
    const env = createTestEnv(db);
    await insertDiscordWebhook(db, {
      id: 'active-id',
      webhookUrl: 'https://discord.com/api/webhooks/123456/abcdef',
      token: 'active-token',
    });
    mockedSendChangelogNotification.mockResolvedValue({
      ok: false,
      failureKind: 'rate_limit',
    });

    await runWithTimers(callConsumer(batch, env));

    expect(message.retry).toHaveBeenCalled();
    expect(message.ack).not.toHaveBeenCalled();
  });

  it('一時障害の時、失敗回数を記録して message.retry が呼ばれる', async () => {
    db = new FakeD1Database();
    const message = createQueueMessage(buildBody());
    const env = createTestEnv(db);
    await insertDiscordWebhook(db, {
      id: 'temporary-id',
      webhookUrl: 'https://discord.com/api/webhooks/123456/temporary',
      token: 'temporary-token',
    });
    mockedSendChangelogNotification.mockResolvedValue({
      ok: false,
      failureKind: 'temporary',
    });

    await runWithTimers(callConsumer(createQueueBatch([message]), env));

    expect(message.retry).toHaveBeenCalled();
    expect(message.ack).not.toHaveBeenCalled();
    expect(await findChannelByToken(db, 'temporary-token')).toMatchObject({
      fail_count: 1,
    });
  });

  it('同じバージョンを再試行する時、成功済みチャンネルへ重複送信しない', async () => {
    db = new FakeD1Database();
    const env = createTestEnv(db);
    await insertDiscordWebhook(db, {
      id: 'success-id',
      webhookUrl: 'https://discord.com/api/webhooks/123456/success',
      token: 'success-token',
    });
    await insertDiscordWebhook(db, {
      id: 'temporary-id',
      webhookUrl: 'https://discord.com/api/webhooks/123456/temporary',
      token: 'temporary-token',
    });
    mockedSendChangelogNotification
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, failureKind: 'temporary' })
      .mockResolvedValueOnce({ ok: true });
    const firstMessage = createQueueMessage(buildBody());
    const retryMessage = createQueueMessage(buildBody());

    await runWithTimers(callConsumer(createQueueBatch([firstMessage]), env));
    await runWithTimers(callConsumer(createQueueBatch([retryMessage]), env));

    expect(firstMessage.retry).toHaveBeenCalled();
    expect(retryMessage.ack).toHaveBeenCalled();
    expect(mockedSendChangelogNotification).toHaveBeenCalledTimes(3);
    expect(
      mockedSendChangelogNotification.mock.calls.filter(
        ([channel]) => channel.id === 'success-id',
      ),
    ).toHaveLength(1);
  });

  it('一部チャンネルで例外が発生しても他のチャンネルの DB 状態が正しく更新される', async () => {
    db = new FakeD1Database();
    const message = createQueueMessage(buildBody());
    const batch = createQueueBatch([message]);
    const env = createTestEnv(db);
    await insertDiscordWebhook(db, {
      id: 'error-id',
      webhookUrl: 'https://discord.com/api/webhooks/123456/error',
      token: 'error-token',
    });
    await insertDiscordWebhook(db, {
      id: 'success-id',
      webhookUrl: 'https://discord.com/api/webhooks/123456/success',
      token: 'success-token',
      failCount: 1,
    });
    mockedSendChangelogNotification
      .mockRejectedValueOnce(new Error('ネットワーク障害'))
      .mockResolvedValueOnce({ ok: true });

    await runWithTimers(callConsumer(batch, env));

    expect(message.retry).toHaveBeenCalled();
    expect(message.ack).not.toHaveBeenCalled();
    expect(await findChannelByToken(db, 'error-token')).toMatchObject({
      fail_count: 1,
    });
    expect(await findChannelByToken(db, 'success-token')).toMatchObject({
      fail_count: 0,
      deactivated_at: '9999-12-31',
    });
  });
});
