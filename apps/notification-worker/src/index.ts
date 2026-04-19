import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { queueConsumer } from './queue/consumer';
import { dispatchRoute } from './routes/dispatch';
import { unsubscribeRoute } from './routes/unsubscribe';
import { webhooksRoute } from './routes/webhooks';

export const app = new Hono<{ Bindings: CloudflareBindings }>().basePath(
  '/api',
);

app.use('*', secureHeaders());
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

export default {
  fetch: app.fetch,
  queue: queueConsumer,
};
