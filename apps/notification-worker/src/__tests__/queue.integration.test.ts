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

const mockFetch = vi.spyOn(globalThis, 'fetch');

import type { Analysis } from '@claude-code-changelog-viewer/types';
import { queueConsumer } from '../queue/consumer';
import { FakeD1Database } from './support/fake-d1';
import {
  createQueueBatch,
  createQueueMessage,
  createTestEnv,
  findChannelByToken,
  insertDiscordWebhook,
} from './support/notification-test-support';

const validAnalysis: Analysis = {
  version: 'v1.0.0',
  summary: 'テスト用サマリー',
  items: [
    {
      content: 'Added new feature',
      content_ja: '新機能を追加',
      prefix: 'feat',
      importance_score: 8,
      related_docs: [],
    },
  ],
};

function setupFetchSuccess() {
  const impl: typeof fetch = Object.assign(
    () => Promise.resolve(Response.json(validAnalysis)),
    // biome-ignore lint/suspicious/noExplicitAny: mock
    { preconnect: (globalThis.fetch as any).preconnect },
  );
  mockFetch.mockImplementation(impl);
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
    // Arrange(準備)
    db = new FakeD1Database();
    const message = createQueueMessage({ version: 'v1.0.0' });
    const batch = createQueueBatch([message]);
    const env = createTestEnv(db);
    setupFetchSuccess();
    await insertDiscordWebhook(db, {
      id: 'active-id',
      webhookUrl: 'https://discord.com/api/webhooks/123456/abcdef',
      token: 'active-token',
      failCount: 2,
    });
    mockedSendChangelogNotification.mockResolvedValue({ ok: true });

    // Act(実行)
    await runWithTimers(callConsumer(batch, env));

    // Assert(確認)
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
    // Arrange(準備)
    db = new FakeD1Database();
    const message = createQueueMessage({ version: 'v1.0.0' });
    const batch = createQueueBatch([message]);
    const env = createTestEnv(db);
    setupFetchSuccess();
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

    // Act(実行)
    await runWithTimers(callConsumer(batch, env));

    // Assert(確認)
    expect(message.ack).toHaveBeenCalled();
    expect(await findChannelByToken(db, 'active-token')).toMatchObject({
      id: 'active-id',
      deactivated_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}/),
      deactivated_reason: 'system',
      fail_count: 3,
    });
  });

  it('複数チャンネル配信中に一部が失敗しても各チャンネルの最終状態が正しく反映される', async () => {
    // Arrange(準備)
    db = new FakeD1Database();
    const message = createQueueMessage({ version: 'v1.0.0' });
    const batch = createQueueBatch([message]);
    const env = createTestEnv(db);
    setupFetchSuccess();
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

    // Act(実行)
    await runWithTimers(callConsumer(batch, env));

    // Assert(確認)
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
    // Arrange(準備)
    db = new FakeD1Database();
    const message = createQueueMessage({ version: 'v1.0.0' });
    const batch = createQueueBatch([message]);
    const env = createTestEnv(db);
    setupFetchSuccess();
    await insertDiscordWebhook(db, {
      id: 'wek-id',
      webhookUrl: 'https://discord.com/api/webhooks/123456/wek',
      token: 'wek-token',
      frequency: 'WEK',
    });

    // Act(実行)
    await runWithTimers(callConsumer(batch, env));

    // Assert(確認)
    expect(mockedSendChangelogNotification).not.toHaveBeenCalled();
    expect(message.ack).toHaveBeenCalled();
  });

  it('通知で 429 が返ると message.retry が呼ばれる', async () => {
    // Arrange(準備)
    db = new FakeD1Database();
    const message = createQueueMessage({ version: 'v1.0.0' });
    const batch = createQueueBatch([message]);
    const env = createTestEnv(db);
    setupFetchSuccess();
    await insertDiscordWebhook(db, {
      id: 'active-id',
      webhookUrl: 'https://discord.com/api/webhooks/123456/abcdef',
      token: 'active-token',
    });
    mockedSendChangelogNotification.mockResolvedValue({
      ok: false,
      failureKind: 'rate_limit',
    });

    // Act(実行)
    await runWithTimers(callConsumer(batch, env));

    // Assert(確認)
    expect(message.retry).toHaveBeenCalled();
    expect(message.ack).not.toHaveBeenCalled();
  });

  it('一部チャンネルで例外が発生しても他のチャンネルの DB 状態が正しく更新される', async () => {
    // Arrange(準備)
    db = new FakeD1Database();
    const message = createQueueMessage({ version: 'v1.0.0' });
    const batch = createQueueBatch([message]);
    const env = createTestEnv(db);
    setupFetchSuccess();
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

    // Act(実行)
    await runWithTimers(callConsumer(batch, env));

    // Assert(確認)
    expect(message.ack).toHaveBeenCalled();
    expect(await findChannelByToken(db, 'success-token')).toMatchObject({
      fail_count: 0,
      deactivated_at: '9999-12-31',
    });
  });
});
