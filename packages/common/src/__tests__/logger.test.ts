import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLogger, runWithLogContext } from '../logger';

afterEach(() => {
  vi.restoreAllMocks();
});

function captureJson(
  method: 'log' | 'error',
  action: () => void,
): Record<string, unknown> {
  const output = vi.spyOn(console, method).mockImplementation(() => undefined);

  action();

  const line = output.mock.calls.at(-1)?.[0];
  return JSON.parse(String(line)) as Record<string, unknown>;
}

async function captureJsonAsync(
  method: 'log' | 'error',
  action: () => Promise<void>,
): Promise<Record<string, unknown>> {
  const output = vi.spyOn(console, method).mockImplementation(() => undefined);

  await action();

  const line = output.mock.calls.at(-1)?.[0];
  return JSON.parse(String(line)) as Record<string, unknown>;
}

function createLogger() {
  return getLogger({ name: 'logger-test', level: 'INFO', format: 'json' });
}

describe('logger', () => {
  it('webhookUrl をマスキングする', () => {
    const logger = createLogger();

    const record = captureJson('log', () =>
      logger.info('x', {
        webhookUrl: 'https://discord.com/api/webhooks/x',
      }),
    );

    expect(record['webhookUrl']).toBe('***');
  });

  it('ネストした webhookUrl をマスキングし、id は残す', () => {
    const logger = createLogger();

    const record = captureJson('log', () =>
      logger.info('x', {
        channel: { id: 'c1', webhookUrl: 'https://example.test/webhook' },
      }),
    );

    expect(record['channel']).toEqual({ id: 'c1', webhookUrl: '***' });
  });

  it('emailAddress をマスキングする', () => {
    const logger = createLogger();

    const record = captureJson('log', () =>
      logger.info('x', { emailAddress: 'a@example.com' }),
    );

    expect(record['emailAddress']).toBe('***');
  });

  it('prompt_tokens は token の部分一致でマスキングしない', () => {
    const logger = createLogger();

    const record = captureJson('log', () =>
      logger.info('x', { 'ai.usage.prompt_tokens': 1200 }),
    );

    expect(record['ai.usage.prompt_tokens']).toBe(1200);
  });

  it('属性内の Error を exception 属性へ展開する', () => {
    const logger = createLogger();

    const record = captureJson('error', () =>
      logger.error('x', { channelId: 'c1', error: new Error('boom') }),
    );

    expect(record['exception.message']).toBe('boom');
    expect(record['exception.type']).toBe('Error');
    expect(record['exception.stack_trace']).toBeTypeOf('string');
    expect(record['error']).toBeUndefined();
    expect(record['channelId']).toBe('c1');
  });

  it('第2引数の Error を exception 属性へ展開する', () => {
    const logger = createLogger();

    const record = captureJson('error', () =>
      logger.error('x', new Error('boom')),
    );

    expect(record['exception.message']).toBe('boom');
    expect(record['exception.type']).toBe('Error');
    expect(record['exception.stack_trace']).toBeTypeOf('string');
  });

  it('ERROR の JSON にスタックトレースを含める', () => {
    const logger = createLogger();

    const record = captureJson('error', () =>
      logger.error('x', new Error('boom')),
    );

    expect(record).toHaveProperty('exception.stack_trace');
  });

  it('コンテキストの属性をログへ付与する', () => {
    const logger = createLogger();

    const record = captureJson('log', () =>
      runWithLogContext({ trace_id: 'T1' }, () => logger.info('x')),
    );

    expect(record['trace_id']).toBe('T1');
  });

  it('await の後もコンテキストの属性を保持する', async () => {
    const logger = createLogger();

    const record = await captureJsonAsync('log', async () =>
      runWithLogContext({ trace_id: 'T1' }, async () => {
        await Promise.resolve();
        logger.info('x');
      }),
    );

    expect(record['trace_id']).toBe('T1');
  });

  it('コンテキストの外では属性を付与しない', () => {
    const logger = createLogger();

    const record = captureJson('log', () => logger.info('x'));

    expect(record['trace_id']).toBeUndefined();
  });

  it('カタログメッセージを固定文で出力する', () => {
    const logger = createLogger();

    const record = captureJson('log', () =>
      logger.msg('APLG0001', { attrs: { 'job.name': 'sync' } }),
    );

    expect(record['message']).toBe('ジョブを開始します');
    expect(record['message']).not.toContain('$0');
    expect(record['job.name']).toBe('sync');
    expect(record['log.id']).toBe('APLG0001');
  });
});
