import { workerLogger } from '../logger';
import { cloudflareAccess } from '@hono/cloudflare-access';
import { toError } from '@claude-code-changelog-viewer/common';
import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import { z } from 'zod';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const accessMiddlewareByConfig = new Map<string, MiddlewareHandler>();
const UploadSchema = z.object({
  file: z.file().max(MAX_IMAGE_SIZE, '画像は5MB以下にしてください'),
  week: z.string().min(1, '必須フィールドが不足しています'),
  itemId: z.string().min(1, '必須フィールドが不足しています'),
});
const imageTypes = [
  {
    extension: 'png',
    contentType: 'image/png',
    signatures: [
      {
        offset: 0,
        bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      },
    ],
  },
  {
    extension: 'jpg',
    contentType: 'image/jpeg',
    signatures: [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
  },
  {
    extension: 'webp',
    contentType: 'image/webp',
    signatures: [
      { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
      { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] },
    ],
  },
] as const;

const logger = workerLogger('routes.uploads');

export const uploadsRoute = new Hono<{
  Bindings: CloudflareBindings;
}>();

uploadsRoute.use('*', async (c, next) => {
  const teamDomain: string = c.env.CF_ACCESS_TEAM_DOMAIN;
  if (!teamDomain) {
    return next();
  }

  const teamName = teamDomain
    .replace(/^https?:\/\//, '')
    .replace(/\.cloudflareaccess\.com\/?$/, '');
  const accessAud: string = c.env.CF_ACCESS_AUD;
  const config = `${teamName}:${accessAud}`;
  const cachedMiddleware = accessMiddlewareByConfig.get(config);
  if (cachedMiddleware) {
    return cachedMiddleware(c, next);
  }
  const middleware = cloudflareAccess(teamName, accessAud);
  accessMiddlewareByConfig.set(config, middleware);
  return middleware(c, next);
});

uploadsRoute.post(
  '/',
  sValidator('form', UploadSchema, (result, c) => {
    if (result.success) {
      return;
    }
    logger.warn('アップロードリクエストの検証に失敗しました', {
      route: 'uploads',
      error: result.error,
    });
    return c.json(
      { error: result.error[0]?.message ?? 'リクエストが不正です' },
      400,
    );
  }),
  async (c) => {
    const { file, week, itemId } = c.req.valid('form');
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const imageType = imageTypes.find(({ signatures }) =>
      signatures.every(({ offset, bytes: signature }) =>
        signature.every((byte, index) => bytes[offset + index] === byte),
      ),
    );
    if (!imageType) {
      logger.warn('画像形式の検証に失敗しました', {
        route: 'uploads',
        week,
        item_id: itemId,
      });
      return c.json({ error: 'PNG・JPEG・WebPのみアップロードできます' }, 400);
    }

    const timestamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
    const key = `weekly/${week}/${itemId}-${timestamp.slice(0, 8)}-${timestamp.slice(8)}.${imageType.extension}`;
    try {
      await c.env.WEEKLY_ASSETS.put(key, buffer, {
        httpMetadata: { contentType: imageType.contentType },
      });
    } catch (error) {
      logger.error('画像の保存に失敗しました', {
        route: 'uploads',
        key,
        error: toError(error),
      });
      return c.json({ error: '画像の保存に失敗しました' }, 500);
    }

    logger.info('画像を保存しました', {
      route: 'uploads',
      key,
      content_type: imageType.contentType,
    });

    return c.json({ url: `https://assets.claude-code-log.com/${key}` });
  },
);
