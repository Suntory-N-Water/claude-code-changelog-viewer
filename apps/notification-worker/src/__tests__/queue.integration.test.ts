import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockedSendToDiscord } = vi.hoisted(() => ({
  mockedSendToDiscord: vi.fn(),
}));

vi.mock('../lib/discord', () => ({
  buildUnsubscribeUrl: (workerUrl: string, token: string) =>
    `${workerUrl}/api/unsubscribe?token=${token}`,
  createChangelogMessage: () => ({
    content: 'テスト通知',
    username: 'Bot',
  }),
  sendToDiscord: mockedSendToDiscord,
}));

vi.mock('../lib/email', () => ({
  sendToEmail: vi.fn(),
  createEmailChangelogMessage: vi.fn(),
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
  for (let i = 0; i < 50; i += 1) {
    vi.advanceTimersByTime(1000);
    await Promise.resolve();
  }
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
    mockedSendToDiscord.mockResolvedValue({ ok: true, status: 204 });

    // Act(実行)
    await runWithTimers(callConsumer(batch, env));

    // Assert(確認)
    expect(message.ack).toHaveBeenCalled();
    expect(await findChannelByToken(db, 'active-token')).toEqual({
      id: 'active-id',
      webhook_url: 'https://discord.com/api/webhooks/123456/abcdef',
      token: 'active-token',
      is_active: 1,
      fail_count: 0,
    });
  });

  it('恒久失敗が続くと fail_count が増えしきい値到達で channels.is_active が 0 になる', async () => {
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
    mockedSendToDiscord.mockResolvedValue({ ok: false, status: 404 });

    // Act(実行)
    await runWithTimers(callConsumer(batch, env));

    // Assert(確認)
    expect(message.ack).toHaveBeenCalled();
    expect(await findChannelByToken(db, 'active-token')).toEqual({
      id: 'active-id',
      webhook_url: 'https://discord.com/api/webhooks/123456/abcdef',
      token: 'active-token',
      is_active: 0,
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
    mockedSendToDiscord
      .mockResolvedValueOnce({ ok: true, status: 204 })
      .mockResolvedValueOnce({ ok: false, status: 401 });

    // Act(実行)
    await runWithTimers(callConsumer(batch, env));

    // Assert(確認)
    expect(message.ack).toHaveBeenCalled();
    expect(await findChannelByToken(db, 'success-token')).toEqual({
      id: 'success-id',
      webhook_url: 'https://discord.com/api/webhooks/123456/success',
      token: 'success-token',
      is_active: 1,
      fail_count: 0,
    });
    expect(await findChannelByToken(db, 'fail-token')).toEqual({
      id: 'fail-id',
      webhook_url: 'https://discord.com/api/webhooks/123456/fail',
      token: 'fail-token',
      is_active: 0,
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
    expect(mockedSendToDiscord).not.toHaveBeenCalled();
    expect(message.ack).toHaveBeenCalled();
  });
});
