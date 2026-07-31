import {
  ClaudeCodeVersionSchema,
  NotificationAnalysisSchema,
} from '@claude-code-changelog-viewer/types';
import { Hono } from 'hono';
import { z } from 'zod';

const RequestSchema = z.object({
  version: ClaudeCodeVersionSchema,
  analysis: NotificationAnalysisSchema,
});

async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const va = new Uint8Array(ha);
  const vb = new Uint8Array(hb);
  return va.length === vb.length && va.every((byte, i) => byte === vb[i]);
}

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
      return c.json({ error: '認証に失敗しました' }, 401);
    }

    // リクエストボディのバリデーション
    const parseResult = RequestSchema.safeParse(await c.req.json());
    if (!parseResult.success) {
      return c.json({ error: 'リクエストが不正です' }, 400);
    }
    const { version, analysis } = parseResult.data;

    await c.env.NOTIFICATION_QUEUE.send({ version, analysis });

    return c.json({ success: true, queued: version });
  },
);
