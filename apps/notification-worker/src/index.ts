import { getLogger, toError } from '@claude-code-changelog-viewer/common';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { detectChangelogUpdate } from './cron/changelog-detection';
import { cleanupInactiveChannels } from './cron/cleanup';
import { queueConsumer } from './queue/consumer';
import { dispatchRoute } from './routes/dispatch';
import { unsubscribeRoute } from './routes/unsubscribe';
import { webhooksRoute } from './routes/webhooks';

const logger = getLogger({
  name: 'notification-worker',
  level: 'INFO',
  format: 'json',
});

export const app = new Hono<{ Bindings: CloudflareBindings }>().basePath(
  '/api',
);

app.use('*', secureHeaders());
app.use('*', async (c, next) => {
  const start = Date.now();
  logger.msg('APLG0030', {
    attrs: { method: c.req.method, path: c.req.path },
  });
  await next();
  logger.msg('APLG0031', {
    attrs: {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      elapsedMs: Date.now() - start,
    },
  });
});
app.use(
  '/webhooks',
  cors({
    origin: ['https://claude-code-log.com', 'http://localhost:4321'],
    allowHeaders: ['Content-Type'],
  }),
);

app.get('/health', (c) => c.text('ok'));

app.route('/webhooks', webhooksRoute);
app.route('/dispatch', dispatchRoute);
app.route('/unsubscribe', unsubscribeRoute);

async function runCron(name: string, task: Promise<void>): Promise<void> {
  logger.msg('APLG0001', { params: [name] });
  try {
    await task;
    logger.msg('APLG0002', { params: [name] });
  } catch (error) {
    logger.error(`${name} が失敗`, toError(error));
  }
}

export default {
  fetch: app.fetch,
  queue: queueConsumer,
  async scheduled(
    event: ScheduledEvent,
    env: CloudflareBindings,
    ctx: ExecutionContext,
  ) {
    switch (event.cron) {
      case '0 15 * * *':
        ctx.waitUntil(
          runCron(
            '非アクティブチャンネル cleanup cron',
            cleanupInactiveChannels(env),
          ),
        );
        break;
      case '*/5 * * * *':
        ctx.waitUntil(
          runCron('CHANGELOG 検知 cron', detectChangelogUpdate(env)),
        );
        break;
      default:
        logger.warn('未対応の cron トリガー', { cron: event.cron });
    }
  },
};
