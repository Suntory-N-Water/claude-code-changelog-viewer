import {
  getLogContext,
  getLogger,
  toError,
} from '@claude-code-changelog-viewer/common';
import {
  ClaudeCodeVersionSchema,
  NotificationAnalysisSchema,
} from '@claude-code-changelog-viewer/types';
import { Hono } from 'hono';
import { z } from 'zod';
import { timingSafeEqual } from '../infrastructure/crypto/timing-safe-equal';
import { parseJsonBody } from './json-body';

const RequestSchema = z.object({
  version: ClaudeCodeVersionSchema,
  analysis: NotificationAnalysisSchema,
});

const logger = getLogger({
  name: 'routes.dispatch',
  serviceName: 'changelog-viewer-worker',
  level: 'INFO',
  format: 'json',
});

export const dispatchRoute = new Hono<{ Bindings: CloudflareBindings }>().post(
  '/',
  async (c) => {
    // Authorization検証(タイミング攻撃対策のため定数時間比較)
    const authHeader = c.req.header('Authorization');
    const isValid = await timingSafeEqual(
      authHeader ?? '',
      `Bearer ${c.env.DISPATCH_SECRET}`,
    );
    if (!isValid) {
      logger.warn('認証に失敗しました', { route: 'dispatch' });
      return c.json({ error: '認証に失敗しました' }, 401);
    }

    const jsonBody = await parseJsonBody(c.req);
    if (!jsonBody.ok) {
      logger.warn('リクエストの検証に失敗しました', {
        route: 'dispatch',
        reason: 'malformed_json',
      });
      return c.json({ error: 'リクエストが不正です' }, 400);
    }

    const parseResult = RequestSchema.safeParse(jsonBody.value);
    if (!parseResult.success) {
      logger.warn('リクエストの検証に失敗しました', {
        route: 'dispatch',
        error: parseResult.error,
      });
      return c.json({ error: 'リクエストが不正です' }, 400);
    }
    const { version, analysis } = parseResult.data;

    const traceId = getLogContext()['trace_id'];
    try {
      await c.env.NOTIFICATION_QUEUE.send({
        version,
        analysis,
        traceId: typeof traceId === 'string' ? traceId : crypto.randomUUID(),
      });
    } catch (error) {
      logger.error('通知のキュー投入に失敗しました', {
        route: 'dispatch',
        version,
        error: toError(error),
      });
      throw error;
    }

    logger.info('通知をキューに投入しました', {
      route: 'dispatch',
      version,
    });

    return c.json({ success: true, queued: version });
  },
);
