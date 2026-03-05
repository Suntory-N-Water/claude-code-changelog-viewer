import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { getLogger } from '@claude-code-changelog-viewer/common';
import { GeminiClient } from '../ai/gemini-client';

describe('GeminiClient エラーハンドリング', () => {
  const mockLogger = getLogger({ name: 'test' });

  beforeEach(() => {
    // ロガーのメソッドをモック化
    mock.module('@claude-code-changelog-viewer/common', () => ({
      getLogger: () => ({
        info: mock(() => {}),
        error: mock(() => {}),
        msg: mock(() => {}),
        child: () => mockLogger,
      }),
    }));
  });

  test('isRetryableError は 429 エラーを検知する', () => {
    const client = new GeminiClient('test-api-key', mockLogger);
    const error429 = new Error(
      'API request failed with status 429: Rate limit exceeded',
    );

    // プライベートメソッドのテストのため、型アサーションを使用
    const isRetryable = (client as any).isRetryableError(error429);
    expect(isRetryable).toBe(true);
  });

  test('isRetryableError は 503 エラーを検知する', () => {
    const client = new GeminiClient('test-api-key', mockLogger);
    const error503 = new Error(
      JSON.stringify({
        error: {
          code: 503,
          message:
            'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.',
          status: 'UNAVAILABLE',
        },
      }),
    );

    const isRetryable = (client as any).isRetryableError(error503);
    expect(isRetryable).toBe(true);
  });

  test('isRetryableError は UNAVAILABLE ステータスを検知する', () => {
    const client = new GeminiClient('test-api-key', mockLogger);
    const errorUnavailable = new Error('Service UNAVAILABLE');

    const isRetryable = (client as any).isRetryableError(errorUnavailable);
    expect(isRetryable).toBe(true);
  });

  test('isRetryableError はリトライ不可能なエラーを正しく判定する', () => {
    const client = new GeminiClient('test-api-key', mockLogger);
    const errorOther = new Error('Invalid API key');

    const isRetryable = (client as any).isRetryableError(errorOther);
    expect(isRetryable).toBe(false);
  });

  test('isRetryableError は 500 エラーをリトライ不可能と判定する', () => {
    const client = new GeminiClient('test-api-key', mockLogger);
    const error500 = new Error('Internal server error 500');

    const isRetryable = (client as any).isRetryableError(error500);
    expect(isRetryable).toBe(false);
  });
});
