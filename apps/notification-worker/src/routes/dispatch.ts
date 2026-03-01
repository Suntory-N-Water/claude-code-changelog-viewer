import { Hono } from 'hono';
import { z } from 'zod';

const RequestSchema = z.object({
  versions: z.array(z.string().startsWith('v')).min(1),
});

export const dispatchRoute = new Hono<{ Bindings: CloudflareBindings }>().post(
  '/',
  async (c) => {
    // Authorization検証
    const authHeader = c.req.header('Authorization');
    if (authHeader !== `Bearer ${c.env.DISPATCH_SECRET}`) {
      return c.json({ error: '認証に失敗しました' }, 401);
    }

    // リクエストボディのバリデーション
    const parseResult = RequestSchema.safeParse(await c.req.json());
    if (!parseResult.success) {
      return c.json({ error: 'リクエストが不正です' }, 400);
    }
    const { versions } = parseResult.data;

    // 各バージョンを一括で Queue に投入
    await c.env.NOTIFICATION_QUEUE.sendBatch(
      versions.map((version) => ({ body: { version } })),
    );

    return c.json({ success: true, queued: versions });
  },
);
