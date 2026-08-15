import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyTurnstileToken } from './turnstile';

describe('Turnstile 検証', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('検証 API が成功を返す時、検証済みになること', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, 'error-codes': [] }), {
        status: 200,
      }),
    );

    const result = await verifyTurnstileToken('token', 'secret');

    expect(result).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expect.objectContaining({
        method: 'POST',
        body: new URLSearchParams({ secret: 'secret', response: 'token' }),
      }),
    );
  });

  it('検証 API が失敗を返す時、検証済みにならないこと', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: false, 'error-codes': [] }), {
        status: 200,
      }),
    );

    const result = await verifyTurnstileToken('token', 'secret');

    expect(result).toBe(false);
  });

  it('検証 API が HTTP エラーの時、検証済みにならないこと', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', { status: 503 }),
    );

    const result = await verifyTurnstileToken('token', 'secret');

    expect(result).toBe(false);
  });
});
