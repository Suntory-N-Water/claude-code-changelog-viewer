import { mock } from 'bun:test';
import type { WebhookRow } from '../../types';
import type { FakeD1Database } from './fake-d1';

export function createTestEnv(db: FakeD1Database) {
  return {
    DB: db,
    DISPATCH_SECRET: 'dispatch-secret',
    NOTIFICATION_QUEUE: {
      sendBatch: mock(() => Promise.resolve(undefined)),
    },
    SITE_URL: 'https://claude-code-log.com',
    TURNSTILE_SECRET_KEY: 'turnstile-secret',
    WORKER_URL: 'https://notification.example.workers.dev',
  } as unknown as CloudflareBindings;
}

export async function insertWebhook(
  db: FakeD1Database,
  webhook: Partial<WebhookRow> &
    Pick<WebhookRow, 'id' | 'webhook_url' | 'token'>,
) {
  await db
    .prepare(
      `INSERT INTO webhooks (
        id,
        webhook_url,
        token,
        active,
        fail_count,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      webhook.id,
      webhook.webhook_url,
      webhook.token,
      webhook.active ?? 1,
      webhook.fail_count ?? 0,
      webhook.created_at ?? '2026-01-01 00:00:00',
      webhook.updated_at ?? '2026-01-01 00:00:00',
    )
    .run();
}

export async function findWebhookByUrl(db: FakeD1Database, webhookUrl: string) {
  return db
    .prepare(
      'SELECT id, webhook_url, token, active, fail_count FROM webhooks WHERE webhook_url = ?',
    )
    .bind(webhookUrl)
    .first<
      Pick<WebhookRow, 'id' | 'webhook_url' | 'token' | 'active' | 'fail_count'>
    >();
}

export async function findWebhookByToken(db: FakeD1Database, token: string) {
  return db
    .prepare(
      'SELECT id, webhook_url, token, active, fail_count FROM webhooks WHERE token = ?',
    )
    .bind(token)
    .first<
      Pick<WebhookRow, 'id' | 'webhook_url' | 'token' | 'active' | 'fail_count'>
    >();
}

export function createQueueMessage(body: unknown) {
  return {
    body,
    id: 'msg-1',
    timestamp: new Date(),
    attempts: 1,
    ack: mock(),
    retry: mock(),
  };
}

export function createQueueBatch(
  messages: ReturnType<typeof createQueueMessage>[],
) {
  return {
    messages,
    queue: 'test-queue',
    ackAll: mock(),
    retryAll: mock(),
  } as unknown as MessageBatch<unknown>;
}
