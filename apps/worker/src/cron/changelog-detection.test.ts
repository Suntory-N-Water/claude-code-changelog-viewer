import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { detectChangelogUpdate } from './changelog-detection';

const CONTENT_HASH =
  'f7fbc09e193ed3fd94b8de6d283a159323fbabd7b5dc3f5875a5a232e4d65f4f';
const NOW = new Date('2026-07-25T09:00:00.000Z');
const PREVIOUS_DISPATCH_AT = '2026-07-25T08:55:00.000Z';
const CHANGELOG_URL =
  'https://api.github.com/repos/anthropics/claude-code/contents/CHANGELOG.md?ref=main';
const DISPATCH_URL =
  'https://api.github.com/repos/Suntory-N-Water/claude-code-changelog-viewer/actions/workflows/changelog-auto-inference.yml/dispatches';
const RUNS_URL =
  'https://api.github.com/repos/Suntory-N-Water/claude-code-changelog-viewer/actions/workflows/changelog-auto-inference.yml/runs?event=workflow_dispatch&per_page=100';

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

function mockGitHub(run?: { status: string; conclusion: string | null }) {
  vi.mocked(global.fetch).mockImplementation(async (input, init) => {
    if (input === CHANGELOG_URL) {
      return new Response('CHANGELOG content');
    }
    if (input === RUNS_URL) {
      return Response.json({
        workflow_runs: run
          ? [
              {
                name: `Fetch and Analyze CHANGELOG (${CONTENT_HASH})`,
                ...run,
              },
            ]
          : [],
      });
    }
    if (input === DISPATCH_URL && init?.method === 'POST') {
      return new Response(null, { status: 204 });
    }
    throw new Error(`想定外のリクエスト: ${String(input)}`);
  });
}

function dispatchRequests() {
  return vi
    .mocked(global.fetch)
    .mock.calls.filter(
      ([input, init]) => input === DISPATCH_URL && init?.method === 'POST',
    );
}

function storedState(bindings: CloudflareBindings) {
  const raw = vi.mocked(bindings.CHANGELOG_DETECTION_KV.put).mock.lastCall?.[1];
  if (typeof raw !== 'string') {
    throw new Error('保存された検知状態がありません');
  }
  return JSON.parse(raw) as Record<string, unknown>;
}

describe('CHANGELOG 更新検知', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('新しい内容を検知した時、workflow を起動すること', async () => {
    const bindings = createBindings();
    mockGitHub();

    await detectChangelogUpdate(bindings, NOW);

    expect(dispatchRequests()).toHaveLength(1);
  });

  it('前回の run が未完了の時、再起動しないこと', async () => {
    const bindings = createBindings(previousState());
    mockGitHub({ status: 'in_progress', conclusion: null });

    await detectChangelogUpdate(bindings, NOW);

    expect(dispatchRequests()).toHaveLength(0);
  });

  it('前回の run が成功した時、検知ハッシュを確定すること', async () => {
    const bindings = createBindings(previousState());
    mockGitHub({ status: 'completed', conclusion: 'success' });

    await detectChangelogUpdate(bindings, NOW);

    expect(storedState(bindings)).toMatchObject({ confirmed: true });
  });

  it('前回の run が失敗した時、上限未満なら再起動すること', async () => {
    const bindings = createBindings(previousState());
    mockGitHub({ status: 'completed', conclusion: 'failure' });

    await detectChangelogUpdate(bindings, NOW);

    expect(dispatchRequests()).toHaveLength(1);
    expect(storedState(bindings)).toMatchObject({ attempts: 2 });
  });

  it('再起動回数が上限に達した時、再起動しないこと', async () => {
    const bindings = createBindings(previousState({ attempts: 3 }));
    mockGitHub();

    await detectChangelogUpdate(bindings, NOW);

    expect(dispatchRequests()).toHaveLength(0);
  });

  it('旧形式の状態を読み込んだ時、新規検知として扱うこと', async () => {
    const bindings = createBindings({
      contentHash: CONTENT_HASH,
      lastCheckedAt: PREVIOUS_DISPATCH_AT,
      lastDispatchedAt: PREVIOUS_DISPATCH_AT,
      lastDispatchedHash: CONTENT_HASH,
    });
    mockGitHub();

    await detectChangelogUpdate(bindings, NOW);

    expect(dispatchRequests()).toHaveLength(1);
  });
});
