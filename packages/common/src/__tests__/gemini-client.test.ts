import { ApiError } from '@google/genai';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppLogger } from '../logger';
import {
  GEMINI_FALLBACK_MODELS,
  GeminiClient,
  type GeminiApi,
} from '../gemini-client';

function createLogger(): AppLogger {
  return {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    msg: vi.fn(),
    child: vi.fn(),
  };
}

function createApi(
  generateContent: GeminiApi['models']['generateContent'],
): GeminiApi {
  return {
    models: {
      generateContent,
      countTokens: vi.fn().mockResolvedValue({ totalTokens: 10 }),
    },
  };
}

describe('Gemini共通クライアント', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('無料枠対象のFlash系モデルを新しい順に利用すること', () => {
    expect(GEMINI_FALLBACK_MODELS).toEqual([
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
    ]);
  });

  it('先頭モデルが成功した時、その結果を返すこと', async () => {
    const generateContent = vi.fn().mockResolvedValue({
      text: '{"result":"成功"}',
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
    });
    const logger = createLogger();
    const sut = new GeminiClient('test-api-key', logger, {
      api: createApi(generateContent),
    });

    const result = await sut.generate({
      prompt: 'テスト',
      method: 'test',
      config: {},
      parse: (text) => JSON.parse(text) as { result: string },
    });

    expect(result).toEqual({ result: '成功' });
    expect(generateContent).toHaveBeenCalledWith({
      model: GEMINI_FALLBACK_MODELS[0],
      contents: 'テスト',
      config: {},
    });
    expect(logger.info).toHaveBeenCalledWith(
      `モデル成功: ${GEMINI_FALLBACK_MODELS[0]}`,
      { method: 'test' },
    );
  });

  it('429の時、同一モデルを再試行せず次モデルへ進むこと', async () => {
    const generateContent = vi
      .fn()
      .mockRejectedValueOnce(
        new ApiError({ status: 429, message: 'クオータ超過' }),
      )
      .mockResolvedValueOnce({ text: '成功' });
    const sut = new GeminiClient('test-api-key', createLogger(), {
      api: createApi(generateContent),
    });

    const result = await sut.generate({
      prompt: 'テスト',
      method: 'test',
      config: {},
      parse: (text) => text,
    });

    expect(result).toBe('成功');
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(generateContent.mock.calls.map(([input]) => input.model)).toEqual([
      GEMINI_FALLBACK_MODELS[0],
      GEMINI_FALLBACK_MODELS[1],
    ]);
  });

  it('503の時、同一モデルを規定回数再試行してから次モデルへ進むこと', async () => {
    vi.useFakeTimers();
    const generateContent = vi
      .fn()
      .mockRejectedValueOnce(
        new ApiError({ status: 503, message: '一時利用不可' }),
      )
      .mockRejectedValueOnce(
        new ApiError({ status: 503, message: '一時利用不可' }),
      )
      .mockRejectedValueOnce(
        new ApiError({ status: 503, message: '一時利用不可' }),
      )
      .mockRejectedValueOnce(
        new ApiError({ status: 503, message: '一時利用不可' }),
      )
      .mockResolvedValueOnce({ text: 'フォールバック成功' });
    const sut = new GeminiClient('test-api-key', createLogger(), {
      api: createApi(generateContent),
    });

    const resultPromise = sut.generate({
      prompt: 'テスト',
      method: 'test',
      config: {},
      parse: (text) => text,
    });
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe('フォールバック成功');
    expect(generateContent.mock.calls.map(([input]) => input.model)).toEqual([
      GEMINI_FALLBACK_MODELS[0],
      GEMINI_FALLBACK_MODELS[0],
      GEMINI_FALLBACK_MODELS[0],
      GEMINI_FALLBACK_MODELS[0],
      GEMINI_FALLBACK_MODELS[1],
    ]);
  });

  it('空応答の時、失敗として次モデルへ進むこと', async () => {
    const generateContent = vi
      .fn()
      .mockResolvedValueOnce({ text: '' })
      .mockResolvedValueOnce({ text: '成功' });
    const sut = new GeminiClient('test-api-key', createLogger(), {
      api: createApi(generateContent),
    });

    const result = await sut.generate({
      prompt: 'テスト',
      method: 'test',
      config: {},
      parse: (text) => text,
    });

    expect(result).toBe('成功');
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('応答の検証に失敗した時、次モデルの応答を検証すること', async () => {
    const generateContent = vi
      .fn()
      .mockResolvedValueOnce({ text: '{"result":1}' })
      .mockResolvedValueOnce({ text: '{"result":"成功"}' });
    const sut = new GeminiClient('test-api-key', createLogger(), {
      api: createApi(generateContent),
    });

    const result = await sut.generate({
      prompt: 'テスト',
      method: 'test',
      config: {},
      parse: (text) => {
        const parsed = JSON.parse(text) as { result: unknown };
        if (typeof parsed.result !== 'string') {
          throw new Error('resultは文字列である必要があります');
        }
        return parsed.result;
      },
    });

    expect(result).toBe('成功');
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('連続呼び出しの時、モデル別の最小間隔を守ること', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T00:00:00Z'));
    const generateContent = vi.fn().mockResolvedValue({ text: '成功' });
    const sut = new GeminiClient('test-api-key', createLogger(), {
      api: createApi(generateContent),
    });
    const input = {
      prompt: 'テスト',
      method: 'test',
      config: {},
      parse: (text: string) => text,
    };
    await sut.generate(input);

    const resultPromise = sut.generate(input);
    await vi.advanceTimersByTimeAsync(14_999);
    expect(generateContent).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    const result = await resultPromise;

    expect(result).toBe('成功');
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('全モデルが失敗した時、最後の原因を含むエラーになること', async () => {
    const generateContent = vi.fn().mockRejectedValue(new Error('最後の失敗'));
    const sut = new GeminiClient('test-api-key', createLogger(), {
      api: createApi(generateContent),
    });

    const result = sut.generate({
      prompt: 'テスト',
      method: 'test',
      config: {},
      parse: (text) => text,
    });

    await expect(result).rejects.toThrow('最後の失敗');
    expect(generateContent).toHaveBeenCalledTimes(
      GEMINI_FALLBACK_MODELS.length,
    );
  });
});
