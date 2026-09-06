import { workerLogger } from '../logger';
import { toError } from '@claude-code-changelog-viewer/common';

type TurnstileVerifyResponse = {
  success: boolean;
  'error-codes': string[];
};

const logger = workerLogger('infrastructure.turnstile');

export async function verifyTurnstileToken(
  token: string,
  secretKey: string,
): Promise<boolean> {
  let response: Response;
  try {
    response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret: secretKey, response: token }),
      },
    );
  } catch (error) {
    logger.error('Turnstile 検証 API の呼び出しに失敗しました', {
      error: toError(error),
    });
    throw error;
  }
  if (!response.ok) {
    logger.warn('Turnstile 検証 API がエラーを返しました', {
      'http.response.status_code': response.status,
    });
    return false;
  }
  const data = await response.json<TurnstileVerifyResponse>();
  logger.info('Turnstile 検証が完了しました', {
    'http.response.status_code': response.status,
    'turnstile.success': data.success === true,
  });
  return data.success === true;
}
