import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../infrastructure/notification/discord', () => ({
  createChangelogMessage: vi.fn(() => ({
    content: 'テスト通知',
    username: 'Bot',
  })),
  sendToDiscord: vi.fn(),
}));

vi.mock('../infrastructure/notification/email', () => ({
  sendToEmail: vi.fn(),
  createEmailChangelogMessage: vi.fn(),
}));

const mockFetch = vi.spyOn(globalThis, 'fetch');

import type { Analysis } from '@claude-code-changelog-viewer/types';
import { queueConsumer } from '../queue/consumer';

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

function createMockMessage(body: unknown) {
  return {
    body,
    id: 'msg-1',
    timestamp: new Date(),
    attempts: 1,
    ack: vi.fn(),
    retry: vi.fn(),
  };
}

function createMockBatch(messages: ReturnType<typeof createMockMessage>[]) {
  return {
    messages,
    queue: 'test-queue',
    ackAll: vi.fn(),
    retryAll: vi.fn(),
  } as unknown as MessageBatch<unknown>;
}

function createMockEnv() {
  const db = {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [] }),
        raw: vi.fn().mockResolvedValue([]),
        run: vi.fn().mockResolvedValue({ success: true }),
        first: vi.fn().mockResolvedValue(null),
      }),
    }),
  };
  return {
    env: {
      DB: db,
      WORKER_URL: 'https://example.com',
      SITE_URL: 'https://example.com',
      NOTIFICATION_QUEUE: {},
      TURNSTILE_SECRET_KEY: '',
      DISPATCH_SECRET: '',
    } as unknown as CloudflareBindings,
  };
}

function setupFetchSuccess() {
  const impl: typeof fetch = Object.assign(
    () => Promise.resolve(Response.json(validAnalysis)),
    // biome-ignore lint/suspicious/noExplicitAny: mock
    { preconnect: (globalThis.fetch as any).preconnect },
  );
  mockFetch.mockImplementation(impl);
}

function callConsumer(batch: MessageBatch<unknown>, env: CloudflareBindings) {
  // biome-ignore lint/style/noNonNullAssertion: テスト用に queue handler の存在を前提とする
  return queueConsumer!(batch, env, {} as ExecutionContext) as Promise<void>;
}

describe('queueConsumer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('メッセージ検証', () => {
    it('不正なメッセージボディは ack して無視する', async () => {
      const message = createMockMessage({ invalid: 'body' });
      const batch = createMockBatch([message]);
      const { env } = createMockEnv();

      await callConsumer(batch, env);

      expect(message.ack).toHaveBeenCalled();
      expect(message.retry).not.toHaveBeenCalled();
    });

    it('version が v で始まらないメッセージは ack して無視する', async () => {
      const message = createMockMessage({ version: '1.0.0' });
      const batch = createMockBatch([message]);
      const { env } = createMockEnv();

      await callConsumer(batch, env);

      expect(message.ack).toHaveBeenCalled();
      expect(message.retry).not.toHaveBeenCalled();
    });
  });

  describe('inferred JSON 取得', () => {
    it('inferred JSON の取得に失敗した場合は retry する', async () => {
      const message = createMockMessage({ version: 'v1.0.0' });
      const batch = createMockBatch([message]);
      const { env } = createMockEnv();

      mockFetch.mockResolvedValue(new Response(null, { status: 404 }));

      await callConsumer(batch, env);

      expect(message.retry).toHaveBeenCalled();
      expect(message.ack).not.toHaveBeenCalled();
    });

    it('inferred JSON のパースに失敗した場合は retry する', async () => {
      const message = createMockMessage({ version: 'v1.0.0' });
      const batch = createMockBatch([message]);
      const { env } = createMockEnv();

      mockFetch.mockResolvedValue(Response.json({ invalid: 'data' }));

      await callConsumer(batch, env);

      expect(message.retry).toHaveBeenCalled();
      expect(message.ack).not.toHaveBeenCalled();
    });
  });

  it('アクティブなチャンネルがない場合は ack する', async () => {
    const message = createMockMessage({ version: 'v1.0.0' });
    const batch = createMockBatch([message]);
    const { env } = createMockEnv();

    setupFetchSuccess();

    await callConsumer(batch, env);

    expect(message.ack).toHaveBeenCalled();
  });

  it('複数メッセージを順次処理する', async () => {
    const message1 = createMockMessage({ version: 'v1.0.0' });
    const message2 = createMockMessage({ version: 'v2.0.0' });
    const batch = createMockBatch([message1, message2]);
    const { env } = createMockEnv();

    setupFetchSuccess();

    await callConsumer(batch, env);

    expect(message1.ack).toHaveBeenCalled();
    expect(message2.ack).toHaveBeenCalled();
  });
});
