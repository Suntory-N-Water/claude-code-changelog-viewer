import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ClaudeCodeChangelogClient } from '../infrastructure/github/claude-code-changelog-client';

const SAMPLE_MARKDOWN = '## 2.1.0\n\n- Item A\n- Item B\n';
const ALT_MARKDOWN = '## 2.0.0\n\n- Old item\n';
const GITHUB_TOKEN = 'test-token';

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

  test('検知ハッシュが未指定の時、認証付き Contents API から取得できること', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockOkResponse(SAMPLE_MARKDOWN),
    );

    const sut = new ClaudeCodeChangelogClient({ githubToken: GITHUB_TOKEN });

    const result = await sut.fetchReleases();

    expect(result).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/anthropics/claude-code/contents/CHANGELOG.md?ref=main',
      {
        headers: {
          Accept: 'application/vnd.github.raw',
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          'User-Agent': 'claude-code-changelog-viewer',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    );
  });

  test('取得内容が検知ハッシュと一致する時、リリースを返すこと', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockOkResponse(SAMPLE_MARKDOWN),
    );

    const sut = new ClaudeCodeChangelogClient({
      githubToken: GITHUB_TOKEN,
      expectedHash: sha256(SAMPLE_MARKDOWN),
    });

    const result = await sut.fetchReleases();

    expect(result).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('取得内容が検知ハッシュと異なる時、再取得せず失敗すること', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(mockOkResponse(ALT_MARKDOWN));

    const sut = new ClaudeCodeChangelogClient({
      githubToken: GITHUB_TOKEN,
      expectedHash: sha256(SAMPLE_MARKDOWN),
    });

    await expect(sut.fetchReleases()).rejects.toThrow(/ハッシュ不一致/);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('GitHub API が失敗した時、再取得せず失敗すること', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockErrorResponse(404, 'Not Found'),
    );

    const sut = new ClaudeCodeChangelogClient({
      githubToken: GITHUB_TOKEN,
      expectedHash: sha256(SAMPLE_MARKDOWN),
    });

    await expect(sut.fetchReleases()).rejects.toThrow(/404/);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
