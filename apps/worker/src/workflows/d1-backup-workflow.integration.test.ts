import { introspectWorkflowInstance } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const testEnv = env;
const EXPORT_BOOKMARK = '00000085-0000024a-00004ffb-0000000000000000';
const SIGNED_URL = 'https://export.example/notification-db-dump.sql';
const DUMP =
  "CREATE TABLE channels (id TEXT);\nINSERT INTO channels VALUES ('1');\n";

function exportResponse(result: object) {
  return new Response(JSON.stringify({ result, success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isPolling(init: RequestInit | undefined) {
  return String(init?.body).includes('current_bookmark');
}

async function listBackupKeys() {
  const listed = await testEnv.D1_BACKUP_BUCKET.list({
    prefix: 'notification-db/',
  });
  return listed.objects.map((object) => object.key);
}

function failureIssueResponse(
  input: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1],
  onIssueCreated?: () => void,
): Response | undefined {
  const url = String(input);
  const method = init?.method ?? 'GET';
  if (url.includes('/issues?') && method === 'GET') {
    return Response.json([]);
  }
  if (url.endsWith('/issues') && method === 'POST') {
    onIssueCreated?.();
    return Response.json({ number: 961 }, { status: 201 });
  }
  if (/\/issues\/\d+\/labels$/.test(url) && method === 'POST') {
    return Response.json([]);
  }
  return;
}

describe('D1 バックアップ Workflow', () => {
  beforeEach(async () => {
    const keys = await listBackupKeys();
    if (keys.length > 0) {
      await testEnv.D1_BACKUP_BUCKET.delete(keys);
    }
  });

  describe('正常系', () => {
    it('export が完了したとき、SQL ダンプが R2 に保存されること', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const url = String(input);
        if (url.endsWith('/export')) {
          return exportResponse(
            isPolling(init)
              ? {
                  at_bookmark: EXPORT_BOOKMARK,
                  status: 'complete',
                  result: {
                    filename: 'notification-db-dump.sql',
                    signed_url: SIGNED_URL,
                  },
                }
              : { at_bookmark: EXPORT_BOOKMARK },
          );
        }
        if (url === SIGNED_URL) {
          return new Response(DUMP, { status: 200 });
        }
        throw new Error(`想定外の外部リクエスト: ${url}`);
      });

      const instanceId = `issue-900-${crypto.randomUUID()}`;
      const instance = await introspectWorkflowInstance(
        testEnv.D1_BACKUP_WORKFLOW,
        instanceId,
      );

      try {
        await instance.modify(async (modifier) => {
          await modifier.disableRetryDelays();
        });

        await testEnv.D1_BACKUP_WORKFLOW.create({ id: instanceId, params: {} });

        await expect(instance.waitForStatus('complete')).resolves.not.toThrow();

        const keys = await listBackupKeys();
        expect(keys).toHaveLength(1);
        expect(keys[0]).toMatch(
          /^notification-db\/\d{4}-\d{2}-\d{2}\/notification-db-dump\.sql$/,
        );

        const stored = await testEnv.D1_BACKUP_BUCKET.get(String(keys[0]));
        await expect(stored?.text()).resolves.toBe(DUMP);
        await expect(instance.getOutput()).resolves.toEqual({
          key: keys[0],
          size: DUMP.length,
        });
      } finally {
        await instance.dispose();
      }
    });

    it('1 回目の状態確認で署名付き URL が返らないとき、再試行して保存が完了すること', async () => {
      let pollCount = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const url = String(input);
        if (url.endsWith('/export')) {
          if (!isPolling(init)) {
            return exportResponse({ at_bookmark: EXPORT_BOOKMARK });
          }
          pollCount += 1;
          return exportResponse(
            pollCount === 1
              ? { at_bookmark: EXPORT_BOOKMARK, messages: ['エクスポート中'] }
              : {
                  at_bookmark: EXPORT_BOOKMARK,
                  status: 'complete',
                  result: {
                    filename: 'notification-db-dump.sql',
                    signed_url: SIGNED_URL,
                  },
                },
          );
        }
        if (url === SIGNED_URL) {
          return new Response(DUMP, { status: 200 });
        }
        throw new Error(`想定外の外部リクエスト: ${url}`);
      });

      const instanceId = `issue-900-polling-${crypto.randomUUID()}`;
      const instance = await introspectWorkflowInstance(
        testEnv.D1_BACKUP_WORKFLOW,
        instanceId,
      );

      try {
        await instance.modify(async (modifier) => {
          await modifier.disableRetryDelays();
        });

        await testEnv.D1_BACKUP_WORKFLOW.create({ id: instanceId, params: {} });

        await expect(instance.waitForStatus('complete')).resolves.not.toThrow();
        expect(pollCount).toBe(2);
        await expect(listBackupKeys()).resolves.toHaveLength(1);
      } finally {
        await instance.dispose();
      }
    });
  });

  describe('異常系', () => {
    it('export の開始要求が bookmark を返さないとき、Workflow が失敗すること', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const url = String(input);
        if (url.endsWith('/export')) {
          return exportResponse({ messages: [] });
        }
        const issueResponse = failureIssueResponse(input, init);
        if (issueResponse !== undefined) {
          return issueResponse;
        }
        throw new Error(`想定外の外部リクエスト: ${url}`);
      });

      const instanceId = `issue-900-no-bookmark-${crypto.randomUUID()}`;
      const instance = await introspectWorkflowInstance(
        testEnv.D1_BACKUP_WORKFLOW,
        instanceId,
      );

      try {
        await instance.modify(async (modifier) => {
          await modifier.disableRetryDelays();
        });

        await testEnv.D1_BACKUP_WORKFLOW.create({ id: instanceId, params: {} });

        await expect(instance.waitForStatus('errored')).resolves.not.toThrow();
        await expect(listBackupKeys()).resolves.toEqual([]);
      } finally {
        await instance.dispose();
      }
    });

    it('export API がエラーを返したとき、再試行せず Workflow が失敗すること', async () => {
      let exportCallCount = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const url = String(input);
        if (url.endsWith('/export')) {
          exportCallCount += 1;
          return exportResponse({
            status: 'error',
            error: 'Authentication error',
          });
        }
        const issueResponse = failureIssueResponse(input, init);
        if (issueResponse !== undefined) {
          return issueResponse;
        }
        throw new Error(`想定外の外部リクエスト: ${url}`);
      });

      const instanceId = `issue-900-api-error-${crypto.randomUUID()}`;
      const instance = await introspectWorkflowInstance(
        testEnv.D1_BACKUP_WORKFLOW,
        instanceId,
      );

      try {
        await instance.modify(async (modifier) => {
          await modifier.disableRetryDelays();
        });

        await testEnv.D1_BACKUP_WORKFLOW.create({ id: instanceId, params: {} });

        await expect(instance.waitForStatus('errored')).resolves.not.toThrow();
        // 未完了と区別され、再試行せずに失敗する
        expect(exportCallCount).toBe(1);
      } finally {
        await instance.dispose();
      }
    });

    it('ダンプの取得に失敗したとき、R2 にオブジェクトが作られないこと', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const url = String(input);
        if (url.endsWith('/export')) {
          return exportResponse(
            isPolling(init)
              ? {
                  at_bookmark: EXPORT_BOOKMARK,
                  status: 'complete',
                  result: {
                    filename: 'notification-db-dump.sql',
                    signed_url: SIGNED_URL,
                  },
                }
              : { at_bookmark: EXPORT_BOOKMARK },
          );
        }
        if (url === SIGNED_URL) {
          return new Response('Internal Server Error', { status: 500 });
        }
        const issueResponse = failureIssueResponse(input, init);
        if (issueResponse !== undefined) {
          return issueResponse;
        }
        throw new Error(`想定外の外部リクエスト: ${url}`);
      });

      const instanceId = `issue-900-download-error-${crypto.randomUUID()}`;
      const instance = await introspectWorkflowInstance(
        testEnv.D1_BACKUP_WORKFLOW,
        instanceId,
      );

      try {
        await instance.modify(async (modifier) => {
          await modifier.disableRetryDelays();
        });

        await testEnv.D1_BACKUP_WORKFLOW.create({ id: instanceId, params: {} });

        await expect(instance.waitForStatus('errored')).resolves.not.toThrow();
        await expect(listBackupKeys()).resolves.toEqual([]);
      } finally {
        await instance.dispose();
      }
    });

    it('Workflow が失敗したとき、失敗を知らせる issue が作成されること', async () => {
      let issueCreationCount = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const url = String(input);
        if (url.endsWith('/export')) {
          return exportResponse({ messages: [] });
        }
        const issueResponse = failureIssueResponse(input, init, () => {
          issueCreationCount += 1;
        });
        if (issueResponse !== undefined) {
          return issueResponse;
        }
        throw new Error(`想定外の外部リクエスト: ${url}`);
      });

      const instanceId = `issue-900-failure-issue-${crypto.randomUUID()}`;
      const instance = await introspectWorkflowInstance(
        testEnv.D1_BACKUP_WORKFLOW,
        instanceId,
      );

      try {
        await instance.modify(async (modifier) => {
          await modifier.disableRetryDelays();
        });

        await testEnv.D1_BACKUP_WORKFLOW.create({ id: instanceId, params: {} });

        await expect(instance.waitForStatus('errored')).resolves.not.toThrow();
        expect(issueCreationCount).toBe(1);
      } finally {
        await instance.dispose();
      }
    });
  });
});
