import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createChangelogInferenceSkipReporter } from './changelog-inference-skip-reporter';

const skippedItems = [
  {
    version: 'v2.1.257',
    id: 'a1b2c3d4e5f6',
    content:
      '- Fixed worktree-isolated sessions refusing Bash loops and heredocs',
    reason: 'AI 応答の JSON 解析に失敗しました',
  },
];

describe('推論を諦めた項目の Issue 報告', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('同じバージョンの Issue がまだない時、項目を並べた Issue を作成すること', async () => {
    let createdBody = '';
    let createdTitle = '';
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input, init) => {
        const url = String(input);
        if (url.includes('/issues?') && init?.method === 'GET') {
          return new Response('[]', { status: 200 });
        }
        if (url.endsWith('/issues') && init?.method === 'POST') {
          const payload = JSON.parse(String(init.body)) as {
            title: string;
            body: string;
          };
          createdTitle = payload.title;
          createdBody = payload.body;
          return new Response(JSON.stringify({ number: 42 }), { status: 201 });
        }
        if (url.includes('/labels')) {
          return new Response('[]', { status: 200 });
        }
        throw new Error(`想定外のリクエスト: ${url}`);
      });

    const sut = createChangelogInferenceSkipReporter('test-token');
    await sut.report({ version: 'v2.1.257', items: skippedItems });

    expect(createdTitle).toContain('v2.1.257');
    expect(createdBody).toContain('a1b2c3d4e5f6');
    expect(createdBody).toContain('worktree-isolated sessions');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('同じバージョンの Issue が既にある時、重ねて作成しないこと', async () => {
    let creationCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/issues?') && init?.method === 'GET') {
        return new Response(
          JSON.stringify([
            {
              number: 7,
              body: '<!-- inference-skipped:v2.1.257 -->',
              labels: [{ name: 'inference-skipped' }],
            },
          ]),
          { status: 200 },
        );
      }
      if (url.endsWith('/issues') && init?.method === 'POST') {
        creationCount += 1;
        return new Response(JSON.stringify({ number: 43 }), { status: 201 });
      }
      throw new Error(`想定外のリクエスト: ${url}`);
    });

    const sut = createChangelogInferenceSkipReporter('test-token');
    await sut.report({ version: 'v2.1.257', items: skippedItems });

    expect(creationCount).toBe(0);
  });

  it('別のバージョンの Issue しかない時、そのバージョンの Issue を作成すること', async () => {
    let creationCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/issues?') && init?.method === 'GET') {
        return new Response(
          JSON.stringify([
            {
              number: 7,
              body: '<!-- inference-skipped:v2.1.250 -->',
              labels: [{ name: 'inference-skipped' }],
            },
          ]),
          { status: 200 },
        );
      }
      if (url.endsWith('/issues') && init?.method === 'POST') {
        creationCount += 1;
        return new Response(JSON.stringify({ number: 44 }), { status: 201 });
      }
      if (url.includes('/labels')) {
        return new Response('[]', { status: 200 });
      }
      throw new Error(`想定外のリクエスト: ${url}`);
    });

    const sut = createChangelogInferenceSkipReporter('test-token');
    await sut.report({ version: 'v2.1.257', items: skippedItems });

    expect(creationCount).toBe(1);
  });
});
