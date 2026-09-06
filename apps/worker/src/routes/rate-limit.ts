import type { MiddlewareHandler } from 'hono';
import { workerLogger } from '../logger';

const logger = workerLogger('routes.rate-limit');

// prefix は Cloudflare 側に残るカウンタのキーになるため、既存の値から変えない
export function rateLimit(
  pick: (env: CloudflareBindings) => RateLimit,
  prefix: string,
  message: string,
): MiddlewareHandler<{ Bindings: CloudflareBindings }> {
  return async (c, next) => {
    const clientKey = c.req.header('CF-Connecting-IP') ?? 'unknown-client';
    const { success } = await pick(c.env).limit({
      key: `${prefix}:${clientKey}`,
    });
    if (success) {
      return next();
    }
    c.header('Retry-After', '60');
    logger.warn('レート制限を超過しました', {
      route: prefix,
      'client.address': clientKey,
    });
    return c.json({ error: message }, 429);
  };
}
