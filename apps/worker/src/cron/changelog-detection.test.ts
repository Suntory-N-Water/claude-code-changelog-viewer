import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { detectChangelogUpdate } from './changelog-detection';

const CONTENT_HASH =
  'f7fbc09e193ed3fd94b8de6d283a159323fbabd7b5dc3f5875a5a232e4d65f4f';
const NOW = new Date('2026-07-25T09:00:00.000Z');
const PREVIOUS_DISPATCH_AT = '2026-07-25T08:55:00.000Z';
const CHANGELOG_URL =
  'https://api.github.com/repos/anthropics/claude-code/contents/CHANGELOG.md?ref=main';

function createBindings(
  state: unknown = null,
  workflowStatus: string = 'running',
) {
  const workflow = {
    createBatch: vi.fn(async () => []),
    get: vi.fn(async () => ({
      status: vi.fn(async () => ({ status: workflowStatus })),
    })),
  };
  return {
    CHANGELOG_DETECTION_KV: {
      get: vi.fn(async () => (state === null ? null : JSON.stringify(state))),
      put: vi.fn(async () => undefined),
    },
    GITHUB_DISPATCH_TOKEN: 'test-token',
    CHANGELOG_INFERENCE_WORKFLOW: workflow,
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

function mockGitHub() {
  vi.mocked(global.fetch).mockImplementation(async (input) => {
    if (input === CHANGELOG_URL) {
      return new Response('CHANGELOG content');
    }
    throw new Error(`想定外のリクエスト: ${String(input)}`);
  });
}

function dispatchRequests(bindings: CloudflareBindings) {
  return vi.mocked(bindings.CHANGELOG_INFERENCE_WORKFLOW.createBatch).mock
    .calls;
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

    expect(dispatchRequests(bindings)).toHaveLength(1);
  });

  it('前回の run が未完了の時、再起動しないこと', async () => {
    const bindings = createBindings(previousState());
    mockGitHub();

    await detectChangelogUpdate(bindings, NOW);

    expect(dispatchRequests(bindings)).toHaveLength(0);
  });

  it('前回の run が成功した時、検知ハッシュを確定すること', async () => {
    const bindings = createBindings(previousState(), 'complete');
    mockGitHub();

    await detectChangelogUpdate(bindings, NOW);

    expect(storedState(bindings)).toMatchObject({ confirmed: true });
  });

  it('前回の run が失敗した時、上限未満なら再起動すること', async () => {
    const bindings = createBindings(previousState(), 'errored');
    mockGitHub();

    await detectChangelogUpdate(bindings, NOW);

    expect(dispatchRequests(bindings)).toHaveLength(1);
    expect(storedState(bindings)).toMatchObject({ attempts: 2 });
  });

  it('再起動回数が上限に達した時、再起動しないこと', async () => {
    const bindings = createBindings(previousState({ attempts: 3 }));
    mockGitHub();

    await detectChangelogUpdate(bindings, NOW);

    expect(dispatchRequests(bindings)).toHaveLength(0);
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

    expect(dispatchRequests(bindings)).toHaveLength(1);
  });
});
