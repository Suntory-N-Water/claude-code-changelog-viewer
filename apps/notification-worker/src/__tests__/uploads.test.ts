import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { uploadsRoute } from '../routes/uploads';

const sut = new Hono<{ Bindings: CloudflareBindings }>()
  .basePath('/api')
  .route('/uploads', uploadsRoute);

const imageCases = [
  {
    label: 'PNG',
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    extension: 'png',
    contentType: 'image/png',
  },
  {
    label: 'JPEG',
    bytes: [0xff, 0xd8, 0xff],
    extension: 'jpg',
    contentType: 'image/jpeg',
  },
  {
    label: 'WebP',
    bytes: [
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ],
    extension: 'webp',
    contentType: 'image/webp',
  },
] as const;

function createEnv(overrides: Record<string, unknown> = {}) {
  return {
    CF_ACCESS_TEAM_DOMAIN: '',
    CF_ACCESS_AUD: '',
    WEEKLY_ASSETS: { put: vi.fn().mockResolvedValue(undefined) },
    ...overrides,
  } as unknown as CloudflareBindings;
}

function createUploadRequest(
  bytes: ArrayLike<number>,
  fields: { week?: string; itemId?: string } = {
    week: '2026-w28',
    itemId: 'ea64434ed3ad',
  },
) {
  const body = new FormData();
  body.append('file', new File([new Uint8Array(bytes)], 'image.bin'));
  if (fields.week !== undefined) {
    body.append('week', fields.week);
  }
  if (fields.itemId !== undefined) {
    body.append('itemId', fields.itemId);
  }
  return { method: 'POST', body };
}

describe('POST /api/uploads', () => {
  describe('画像を保存する時', () => {
    it.each(imageCases)(
      '$label の実バイトを送ると判定済みの形式で R2 に保存されること',
      async ({ bytes, extension, contentType }) => {
        // Arrange(準備)
        const put = vi.fn().mockResolvedValue(undefined);
        const env = createEnv({
          WEEKLY_ASSETS: { put } as unknown as R2Bucket,
        });

        // Act(実行)
        const response = await sut.request(
          '/api/uploads',
          createUploadRequest([...bytes]),
          env,
        );

        // Assert(確認)
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
          url: expect.stringMatching(
            new RegExp(
              `^https://assets\\.claude-code-log\\.com/weekly/2026-w28/ea64434ed3ad-\\d{8}-\\d{6}\\.${extension}$`,
            ),
          ),
        });
        expect(put).toHaveBeenCalledWith(
          expect.stringMatching(
            new RegExp(
              `^weekly/2026-w28/ea64434ed3ad-\\d{8}-\\d{6}\\.${extension}$`,
            ),
          ),
          expect.any(ArrayBuffer),
          { httpMetadata: { contentType } },
        );
      },
    );

    it('R2 への保存に失敗した時、500を返すこと', async () => {
      // Arrange(準備)
      const env = createEnv({
        WEEKLY_ASSETS: {
          put: vi.fn().mockRejectedValue(new Error('R2 error')),
        } as unknown as R2Bucket,
      });

      // Act(実行)
      const response = await sut.request(
        '/api/uploads',
        createUploadRequest([...imageCases[0].bytes]),
        env,
      );

      // Assert(確認)
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        error: '画像の保存に失敗しました',
      });
    });
  });

  describe('入力が不正な時', () => {
    it.each([
      ['week', { itemId: 'ea64434ed3ad' }],
      ['itemId', { week: '2026-w28' }],
    ])('%s が無いと400を返すこと', async (_label, fields) => {
      // Arrange(準備)
      const env = createEnv();

      // Act(実行)
      const response = await sut.request(
        '/api/uploads',
        createUploadRequest([...imageCases[0].bytes], fields),
        env,
      );

      // Assert(確認)
      expect(response.status).toBe(400);
    });

    it('file が無いと400を返すこと', async () => {
      // Arrange(準備)
      const body = new FormData();
      body.append('week', '2026-w28');
      body.append('itemId', 'ea64434ed3ad');

      // Act(実行)
      const response = await sut.request(
        '/api/uploads',
        { method: 'POST', body },
        createEnv(),
      );

      // Assert(確認)
      expect(response.status).toBe(400);
    });

    it('画像が5MBを超えると400を返し、R2へ保存しないこと', async () => {
      // Arrange(準備)
      const put = vi.fn();
      const bytes = new Uint8Array(5 * 1024 * 1024 + 1);
      bytes.set(imageCases[0].bytes);
      const env = createEnv({
        WEEKLY_ASSETS: { put } as unknown as R2Bucket,
      });

      // Act(実行)
      const response = await sut.request(
        '/api/uploads',
        createUploadRequest(bytes),
        env,
      );

      // Assert(確認)
      expect(response.status).toBe(400);
      expect(put).not.toHaveBeenCalled();
    });

    it.each([
      ['GIF', [0x47, 0x49, 0x46, 0x38]],
      ['SVG', [...new TextEncoder().encode('<svg></svg>')]],
      ['HTML', [...new TextEncoder().encode('<html></html>')]],
      ['WAV', [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]],
      ['AVI', [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20]],
      ['空ファイル', []],
    ])(
      'Content-Type が image/png でも実バイトが %s なら400を返すこと',
      async (_label, bytes) => {
        // Arrange(準備)
        const body = new FormData();
        body.append(
          'file',
          new File([new Uint8Array(bytes)], 'fake.png', { type: 'image/png' }),
        );
        body.append('week', '2026-w28');
        body.append('itemId', 'ea64434ed3ad');

        // Act(実行)
        const response = await sut.request(
          '/api/uploads',
          { method: 'POST', body },
          createEnv(),
        );

        // Assert(確認)
        expect(response.status).toBe(400);
      },
    );
  });

  describe('Access 認証を行う時', () => {
    it('team domain が空文字なら認証なしでアップロードできること', async () => {
      // Arrange(準備)
      const env = createEnv({ CF_ACCESS_TEAM_DOMAIN: '' });

      // Act(実行)
      const response = await sut.request(
        '/api/uploads',
        createUploadRequest([...imageCases[0].bytes]),
        env,
      );

      // Assert(確認)
      expect(response.status).toBe(200);
    });

    it('team domain が設定済みで JWT が無いと401を返すこと', async () => {
      // Arrange(準備)
      const env = createEnv({
        CF_ACCESS_TEAM_DOMAIN: 'example.cloudflareaccess.com',
        CF_ACCESS_AUD: 'test-aud',
      });

      // Act(実行)
      const response = await sut.request(
        '/api/uploads',
        createUploadRequest([...imageCases[0].bytes]),
        env,
      );

      // Assert(確認)
      expect(response.status).toBe(401);
    });
  });
});
