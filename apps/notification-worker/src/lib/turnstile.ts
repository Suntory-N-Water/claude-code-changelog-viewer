type TurnstileVerifyResponse = {
  success: boolean;
  'error-codes': string[];
};

export async function verifyTurnstileToken(
  token: string,
  secretKey: string,
): Promise<boolean> {
  const response = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: secretKey, response: token }),
    },
  );
  const data = await response.json<TurnstileVerifyResponse>();
  return data.success;
}
