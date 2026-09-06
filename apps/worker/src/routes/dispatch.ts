import { getLogContext, toError } from '@claude-code-changelog-viewer/common';
import {
  ClaudeCodeVersionSchema,
  NotificationAnalysisSchema,
} from '@claude-code-changelog-viewer/types';
import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';
import { bearerAuth } from 'hono/bearer-auth';
import { z } from 'zod';
import { workerLogger } from '../logger';

const RequestSchema = z.object({
  version: ClaudeCodeVersionSchema,
  analysis: NotificationAnalysisSchema,
});

const logger = workerLogger('routes.dispatch');

export const dispatchRoute = new Hono<{ Bindings: CloudflareBindings }>().post(
  '/',
  // token 指定の bearerAuth は内部で定数時間比較を行う。env は起動時に決まらないため毎回組み立てる
  (c, next) =>
    bearerAuth<{ Bindings: CloudflareBindings }>({
      token: c.env.DISPATCH_SECRET,
    })(c, next),
  sValidator('json', RequestSchema, (result, c) => {
    if (!result.success) {
      logger.warn('リクエストの検証に失敗しました', {
        route: 'dispatch',
        error: result.error,
      });
      return c.json({ error: 'リクエストが不正です' }, 400);
    }
    return;
  }),
  async (c) => {
    const { version, analysis } = c.req.valid('json');

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
