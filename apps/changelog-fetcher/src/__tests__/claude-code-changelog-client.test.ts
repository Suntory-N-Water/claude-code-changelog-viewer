import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ClaudeCodeChangelogClient } from '../infrastructure/github/claude-code-changelog-client';

const SAMPLE_MARKDOWN = '## 2.1.0\n\n- Item A\n- Item B\n';
const ALT_MARKDOWN = '## 2.0.0\n\n- Old item\n';

function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf-8').digest('hex');
}

function mockOkResponse(body: string): Response {
  return new Response(body, { status: 200, statusText: 'OK' });
}

function mockErrorResponse(status: number, statusText: string): Response {
  return new Response('', { status, statusText });
}

describe('ClaudeCodeChangelogClient', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('expectedHash 未指定なら 1 回 fetch で正常 return する', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockOkResponse(SAMPLE_MARKDOWN),
    );

    const client = new ClaudeCodeChangelogClient({
      retryOptions: { delayMs: 0, retries: 2 },
    });
    const releases = await client.fetchReleases();

    expect(releases).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('ハッシュ不一致なら再 fetch し一致したら return する', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(mockOkResponse(ALT_MARKDOWN))
      .mockResolvedValueOnce(mockOkResponse(SAMPLE_MARKDOWN));

    const client = new ClaudeCodeChangelogClient({
      expectedHash: sha256(SAMPLE_MARKDOWN),
      retryOptions: { delayMs: 0, retries: 2 },
    });
    const releases = await client.fetchReleases();

    expect(releases).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('全試行で不一致なら throw する', async () => {
    vi.mocked(global.fetch).mockImplementation(async () =>
      mockOkResponse(ALT_MARKDOWN),
    );

    const client = new ClaudeCodeChangelogClient({
      expectedHash: sha256(SAMPLE_MARKDOWN),
      retryOptions: { delayMs: 0, retries: 2 },
    });

    await expect(client.fetchReleases()).rejects.toThrow(/ハッシュ不一致/);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  test('HTTP 404 は AbortError で即中断しリトライしない', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockErrorResponse(404, 'Not Found'),
    );

    const client = new ClaudeCodeChangelogClient({
      expectedHash: sha256(SAMPLE_MARKDOWN),
      retryOptions: { delayMs: 0, retries: 2 },
    });

    await expect(client.fetchReleases()).rejects.toThrow(/404/);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
