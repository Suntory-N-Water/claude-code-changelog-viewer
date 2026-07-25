import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { detectChangelogUpdate } from '../cron/changelog-detection';

const CONTENT_HASH =
  'f7fbc09e193ed3fd94b8de6d283a159323fbabd7b5dc3f5875a5a232e4d65f4f';
const NOW = new Date('2026-07-25T09:00:00.000Z');
const PREVIOUS_DISPATCH_AT = '2026-07-25T08:55:00.000Z';

function createBindings(state: unknown = null) {
  return {
    CHANGELOG_DETECTION_KV: {
      get: vi.fn(async () => (state === null ? null : JSON.stringify(state))),
      put: vi.fn(async () => undefined),
    },
    GITHUB_DISPATCH_TOKEN: 'test-token',
  } as unknown as CloudflareBindings;
}

function previousState(overrides: Record<string, unknown> = {}) {
  return {
    contentHash: CONTENT_HASH,
    lastCheckedAt: PREVIOUS_DISPATCH_AT,
    lastDispatchedAt: PREVIOUS_DISPATCH_AT,
    lastDispatchedHash: CONTENT_HASH,
    attempts: 1,
    confirmed: false,
    ...overrides,
  };
}

describe('CHANGELOG 更新検知', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('新しい内容を検知した時、workflow を起動して未確定状態を保存すること', async () => {
    const bindings = createBindings();
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(new Response('CHANGELOG content'))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await detectChangelogUpdate(bindings, NOW);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'https://api.github.com/repos/anthropics/claude-code/contents/CHANGELOG.md?ref=main',
      {
        headers: {
          Accept: 'application/vnd.github.raw',
          Authorization: 'Bearer test-token',
          'User-Agent': 'notification-worker-changelog-detection',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    );
    expect(bindings.CHANGELOG_DETECTION_KV.put).toHaveBeenCalledWith(
      'changelog-detection-state',
      JSON.stringify({
        contentHash: CONTENT_HASH,
        lastCheckedAt: NOW.toISOString(),
        lastDispatchedAt: NOW.toISOString(),
        lastDispatchedHash: CONTENT_HASH,
        attempts: 1,
        confirmed: false,
      }),
    );
  });

  it('前回の run が未完了の時、再起動しないこと', async () => {
    const bindings = createBindings(previousState());
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(new Response('CHANGELOG content'))
      .mockResolvedValueOnce(
        Response.json({
          workflow_runs: [
            {
              name: `Fetch and Analyze CHANGELOG (${CONTENT_HASH})`,
              status: 'in_progress',
              conclusion: null,
            },
          ],
        }),
      );

    await detectChangelogUpdate(bindings, NOW);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(bindings.CHANGELOG_DETECTION_KV.put).toHaveBeenCalledWith(
      'changelog-detection-state',
      JSON.stringify({
        ...previousState(),
        lastCheckedAt: NOW.toISOString(),
      }),
    );
  });

  it('前回の run が成功した時、検知ハッシュを確定すること', async () => {
    const bindings = createBindings(previousState());
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(new Response('CHANGELOG content'))
      .mockResolvedValueOnce(
        Response.json({
          workflow_runs: [
            {
              name: `Fetch and Analyze CHANGELOG (${CONTENT_HASH})`,
              status: 'completed',
              conclusion: 'success',
            },
          ],
        }),
      );

    await detectChangelogUpdate(bindings, NOW);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(bindings.CHANGELOG_DETECTION_KV.put).toHaveBeenCalledWith(
      'changelog-detection-state',
      JSON.stringify({
        ...previousState(),
        lastCheckedAt: NOW.toISOString(),
        confirmed: true,
      }),
    );
  });

  it('前回の run が失敗した時、上限未満なら再起動すること', async () => {
    const bindings = createBindings(previousState());
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(new Response('CHANGELOG content'))
      .mockResolvedValueOnce(
        Response.json({
          workflow_runs: [
            {
              name: `Fetch and Analyze CHANGELOG (${CONTENT_HASH})`,
              status: 'completed',
              conclusion: 'failure',
            },
          ],
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await detectChangelogUpdate(bindings, NOW);

    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(bindings.CHANGELOG_DETECTION_KV.put).toHaveBeenCalledWith(
      'changelog-detection-state',
      JSON.stringify({
        ...previousState(),
        lastCheckedAt: NOW.toISOString(),
        lastDispatchedAt: NOW.toISOString(),
        attempts: 2,
      }),
    );
  });

  it('再起動回数が上限に達した時、再起動しないこと', async () => {
    const bindings = createBindings(previousState({ attempts: 3 }));
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response('CHANGELOG content'),
    );

    await detectChangelogUpdate(bindings, NOW);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(bindings.CHANGELOG_DETECTION_KV.put).toHaveBeenCalledWith(
      'changelog-detection-state',
      JSON.stringify({
        ...previousState({ attempts: 3 }),
        lastCheckedAt: NOW.toISOString(),
      }),
    );
  });

  it('旧形式の状態を読み込んだ時、新規検知として扱うこと', async () => {
    const bindings = createBindings({
      contentHash: CONTENT_HASH,
      lastCheckedAt: PREVIOUS_DISPATCH_AT,
      lastDispatchedAt: PREVIOUS_DISPATCH_AT,
      lastDispatchedHash: CONTENT_HASH,
    });
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(new Response('CHANGELOG content'))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await detectChangelogUpdate(bindings, NOW);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(bindings.CHANGELOG_DETECTION_KV.put).toHaveBeenCalledWith(
      'changelog-detection-state',
      JSON.stringify({
        contentHash: CONTENT_HASH,
        lastCheckedAt: NOW.toISOString(),
        lastDispatchedAt: NOW.toISOString(),
        lastDispatchedHash: CONTENT_HASH,
        attempts: 1,
        confirmed: false,
      }),
    );
  });
});
