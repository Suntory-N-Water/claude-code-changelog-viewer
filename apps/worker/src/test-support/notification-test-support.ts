import { vi } from 'vitest';
import { CHANNEL_ACTIVE_SENTINEL } from '../db/constants';
import type { FakeD1Database } from './fake-d1';

export type ChannelRow = {
  id: string;
  webhook_url: string;
  token: string;
  deactivated_at: string;
  deactivated_reason: string;
  fail_count: number;
};

const TEST_EMAIL_ENCRYPTION_KEY = 'test-email-encryption-key-32bytes!!';

export function createTestEnv(db: FakeD1Database) {
  return {
    DB: db,
    DISPATCH_SECRET: 'dispatch-secret',
    NOTIFICATION_QUEUE: {
      send: vi.fn(() => Promise.resolve(undefined)),
    },
    WEBHOOK_RATE_LIMITER: {
      limit: vi.fn(() => Promise.resolve({ success: true })),
    },
    MCP_RATE_LIMITER: {
      limit: vi.fn(() => Promise.resolve({ success: true })),
    },
    SITE_DATA_RATE_LIMITER: {
      limit: vi.fn(() => Promise.resolve({ success: true })),
    },
    SEND_EMAIL: { send: vi.fn(() => Promise.resolve(undefined)) },
    EMAIL_FROM: 'noreply@claude-code-log.com',
    SITE_URL: 'https://claude-code-log.com',
    TURNSTILE_SECRET_KEY: 'turnstile-secret',
    WORKER_URL: 'https://notification.example.workers.dev',
    EMAIL_ENCRYPTION_KEY: TEST_EMAIL_ENCRYPTION_KEY,
  } as unknown as CloudflareBindings;
}

type InsertDiscordWebhookParams = {
  id: string;
  webhookUrl: string;
  token: string;
  deactivatedAt?: string;
  deactivatedReason?: string;
  failCount?: number;
  frequency?: 'IMM' | 'WEK';
};

export async function insertDiscordWebhook(
  db: FakeD1Database,
  params: InsertDiscordWebhookParams,
) {
  const {
    id,
    webhookUrl,
    token,
    deactivatedAt = CHANNEL_ACTIVE_SENTINEL,
    deactivatedReason = 'none',
    failCount = 0,
    frequency = 'IMM',
  } = params;

  await db
    .prepare(
      `INSERT INTO channels (id, channel_type, token, deactivated_at, deactivated_reason, fail_count, created_at, updated_at)
       VALUES (?, 'DSC', ?, ?, ?, ?, '2026-01-01 00:00:00', '2026-01-01 00:00:00')`,
    )
    .bind(id, token, deactivatedAt, deactivatedReason, failCount)
    .run();

  await db
    .prepare(
      'INSERT INTO discord_channels (channel_id, webhook_url) VALUES (?, ?)',
    )
    .bind(id, webhookUrl)
    .run();

  await db
    .prepare(
      `INSERT INTO notification_settings (id, channel_id, frequency, created_at)
       VALUES (?, ?, ?, '2026-01-01 00:00:00')`,
    )
    .bind(`ns_${id}`, id, frequency)
    .run();
}

export async function findChannelByWebhookUrl(
  db: FakeD1Database,
  webhookUrl: string,
): Promise<ChannelRow | null> {
  return db
    .prepare(
      `SELECT c.id, d.webhook_url, c.token, c.deactivated_at, c.deactivated_reason, c.fail_count
       FROM channels c
       INNER JOIN discord_channels d ON c.id = d.channel_id
       WHERE d.webhook_url = ?`,
    )
    .bind(webhookUrl)
    .first<ChannelRow>();
}

export async function findChannelByToken(
  db: FakeD1Database,
  token: string,
): Promise<ChannelRow | null> {
  return db
    .prepare(
      `SELECT c.id, d.webhook_url, c.token, c.deactivated_at, c.deactivated_reason, c.fail_count
       FROM channels c
       INNER JOIN discord_channels d ON c.id = d.channel_id
       WHERE c.token = ?`,
    )
    .bind(token)
    .first<ChannelRow>();
}

export async function findNotificationSettings(
  db: FakeD1Database,
  channelId: string,
): Promise<{ id: string; channel_id: string; frequency: string } | null> {
  return db
    .prepare(
      'SELECT id, channel_id, frequency FROM notification_settings WHERE channel_id = ?',
    )
    .bind(channelId)
    .first();
}

export function createQueueMessage(body: unknown) {
  return {
    body,
    id: 'msg-1',
    timestamp: new Date(),
    attempts: 1,
    ack: vi.fn(),
    retry: vi.fn(),
  };
}

export function createQueueBatch(
  messages: ReturnType<typeof createQueueMessage>[],
) {
  return {
    messages,
    queue: 'test-queue',
    ackAll: vi.fn(),
    retryAll: vi.fn(),
  } as unknown as MessageBatch<unknown>;
}
