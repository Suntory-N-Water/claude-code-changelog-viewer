import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('node:child_process', () => ({ spawn: vi.fn() }));

import { spawn } from 'node:child_process';
import {
  DOCS_SEARCH_TIMEOUT_MS,
  runDocsSearchEngine,
} from '../infrastructure/docs/docs-search-engine-client';

function createChildProcess() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    stdin: { end: ReturnType<typeof vi.fn> };
    kill: ReturnType<typeof vi.fn>;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = { end: vi.fn() };
  child.kill = vi.fn(() => true);
  vi.mocked(spawn).mockReturnValue(child as never);
  return child;
}

describe('Docs 検索エンジンの実行', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test('子プロセスが正常終了した時、検索結果を返すこと', async () => {
    const child = createChildProcess();
    const sut = runDocsSearchEngine({
      docsDir: '/docs',
      entries: ['setting'],
    });
    child.stdout.emit('data', Buffer.from('{"results":[[]]}'));

    child.emit('close', 0);

    await expect(sut).resolves.toEqual({ results: [[]] });
    expect(child.kill).not.toHaveBeenCalled();
  });

  test('子プロセスが制限時間を超えた時、終了して失敗すること', async () => {
    vi.useFakeTimers();
    const child = createChildProcess();
    const sut = runDocsSearchEngine({
      docsDir: '/docs',
      entries: ['setting'],
    });
    const result = expect(sut).rejects.toThrow(
      `${DOCS_SEARCH_TIMEOUT_MS}ms 以内に完了しなかったため終了しました`,
    );

    await vi.advanceTimersByTimeAsync(DOCS_SEARCH_TIMEOUT_MS);

    await result;
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
  });
});
