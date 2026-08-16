// biome-ignore lint/correctness/noUnresolvedImports: Cloudflare Workers テストランタイム組み込みモジュール
import { applyD1Migrations } from 'cloudflare:test';
// biome-ignore lint/correctness/noUnresolvedImports: Cloudflare Workers テストランタイム組み込みモジュール
import { introspectWorkflowInstance } from 'cloudflare:test';
// biome-ignore lint/correctness/noUnresolvedImports: Cloudflare Workers テストランタイム組み込みモジュール
import type { D1Migration } from 'cloudflare:test';
// biome-ignore lint/correctness/noUnresolvedImports: Cloudflare Workers ランタイム組み込みモジュール
import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  changelogDiffEventItems,
  changelogDiffEvents,
  changelogItemFeatureAreas,
  changelogItemRelatedDocs,
  changelogItems,
  changelogVersions,
} from '../db/schema';
import { sha256Hex } from '../infrastructure/crypto/sha256-hex';
import { parseChangelogReleases } from '../infrastructure/github/changelog-markdown-parser';

type TestBindings = Cloudflare.Env & {
  TEST_DOCS_SEARCH_MIGRATIONS: D1Migration[];
  TEST_NOTIFICATION_MIGRATIONS: D1Migration[];
};

const testEnv = env as TestBindings;
const changelog = `# Changelog\n\n## 2.1.234\n\n- Added workflow inference support\n`;

describe('CHANGELOG 推論 Workflow', () => {
  beforeEach(async () => {
    await applyD1Migrations(testEnv.DB, testEnv.TEST_NOTIFICATION_MIGRATIONS);
    await applyD1Migrations(
      testEnv.DOCS_DB,
      testEnv.TEST_DOCS_SEARCH_MIGRATIONS,
    );

    const notificationDb = drizzle(testEnv.DB);
    await notificationDb.delete(changelogDiffEventItems);
    await notificationDb.delete(changelogDiffEvents);
    await notificationDb.delete(changelogItemRelatedDocs);
    await notificationDb.delete(changelogItemFeatureAreas);
    await notificationDb.delete(changelogItems);
    await notificationDb.delete(changelogVersions);

    const docsDb = drizzle(testEnv.DOCS_DB);
    await docsDb.run(sql`DELETE FROM page_chunks_fts`);
    await docsDb.run(sql`
      INSERT INTO page_chunks_fts (content, path, heading, chunk_index)
      VALUES (
        'Workflow inference support is documented here.',
        'docs/en/features.md',
        'Features',
        0
      )
    `);
  });

  it('検出から D1 保存・通知・ビルド起動まで完了し、保存再試行で AI を再実行しないこと', async () => {
    const release = (await parseChangelogReleases(changelog))[0];
    if (release === undefined) {
      throw new Error('テスト用 CHANGELOG のリリースがありません');
    }

    const item = release.items[0];
    if (item === undefined) {
      throw new Error('テスト用 CHANGELOG の項目がありません');
    }

    const aiRun = vi.spyOn(testEnv.AI, 'run').mockResolvedValue({
      response: JSON.stringify({
        inferred_items: [
          {
            id: item.id,
            content_ja: 'Workflow 推論のサポートを追加しました。',
            before: 'Workflow 推論のサポートがありませんでした。',
            after: 'Workflow 推論のサポートが追加されました。',
            benefit: 'CHANGELOG の更新を自動で推論して保存できます。',
          },
        ],
        translated_items: [],
        feature_area_corrections: [
          { id: item.id, feature_areas: ['Workflow'] },
        ],
        summary: 'Workflow 推論のサポートを追加しました。',
      }),
    });
    const queueSend = vi
      .spyOn(testEnv.NOTIFICATION_QUEUE, 'send')
      .mockResolvedValue({
        metadata: { metrics: { backlogCount: 0, backlogBytes: 0 } },
      });
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('/contents/CHANGELOG.md')) {
          return new Response(changelog, { status: 200 });
        }
        if (url === 'https://deploy.example/hook') {
          return new Response(null, { status: 200 });
        }
        throw new Error(`想定外の外部リクエスト: ${url}`);
      });

    const instanceId = `issue-901-${crypto.randomUUID()}`;
    const instance = await introspectWorkflowInstance(
      testEnv.CHANGELOG_INFERENCE_WORKFLOW,
      instanceId,
    );

    try {
      await instance.modify(async (modifier) => {
        await modifier.disableRetryDelays();
        await modifier.mockStepError(
          { name: `store-${release.version}` },
          new Error('保存の一時的な失敗'),
          1,
        );
      });

      await testEnv.CHANGELOG_INFERENCE_WORKFLOW.create({
        id: instanceId,
        params: {
          detectedHash: await sha256Hex(changelog),
          detectedAt: '2026-08-16T00:00:00.000Z',
        },
      });

      await expect(instance.waitForStatus('complete')).resolves.not.toThrow();
      await expect(instance.getOutput()).resolves.toEqual({
        processedVersions: ['v2.1.234'],
        notifiedVersions: ['v2.1.234'],
      });

      expect(aiRun).toHaveBeenCalledTimes(1);
      expect(queueSend).toHaveBeenCalledWith(
        expect.objectContaining({ version: 'v2.1.234' }),
      );
      expect(fetchMock).toHaveBeenCalledWith('https://deploy.example/hook', {
        method: 'POST',
      });

      const db = drizzle(testEnv.DB);
      const stored = await db
        .select({
          version: changelogVersions.version,
          summary: changelogVersions.summary,
          contentJa: changelogItems.contentJa,
          inferenceBefore: changelogItems.inferenceBefore,
          inferenceAfter: changelogItems.inferenceAfter,
          inferenceBenefit: changelogItems.inferenceBenefit,
        })
        .from(changelogVersions)
        .innerJoin(
          changelogItems,
          eq(changelogItems.version, changelogVersions.version),
        )
        .where(eq(changelogVersions.version, '2.1.234'));
      expect(stored).toEqual([
        {
          version: '2.1.234',
          summary: 'Workflow 推論のサポートを追加しました。',
          contentJa: 'Workflow 推論のサポートを追加しました。',
          inferenceBefore: 'Workflow 推論のサポートがありませんでした。',
          inferenceAfter: 'Workflow 推論のサポートが追加されました。',
          inferenceBenefit: 'CHANGELOG の更新を自動で推論して保存できます。',
        },
      ]);
    } finally {
      await instance.dispose();
    }
  });

  it('CHANGELOG のハッシュが一致しない時、失敗 Issue を作成して Workflow を失敗させること', async () => {
    const issueBodies: string[] = [];
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input, init) => {
        const url = String(input);
        if (url.includes('/contents/CHANGELOG.md')) {
          return new Response(changelog, { status: 200 });
        }
        if (url.endsWith('/issues') && init?.method === 'POST') {
          issueBodies.push(String(init.body));
          return new Response('{}', { status: 201 });
        }
        throw new Error(`想定外の外部リクエスト: ${url}`);
      });
    const instanceId = `issue-901-failure-${crypto.randomUUID()}`;
    const instance = await introspectWorkflowInstance(
      testEnv.CHANGELOG_INFERENCE_WORKFLOW,
      instanceId,
    );

    try {
      await instance.modify(async (modifier) => {
        await modifier.disableRetryDelays();
      });

      await testEnv.CHANGELOG_INFERENCE_WORKFLOW.create({
        id: instanceId,
        params: {
          detectedHash: '0'.repeat(64),
          detectedAt: '2026-08-16T00:00:00.000Z',
        },
      });

      await expect(instance.waitForStatus('errored')).resolves.not.toThrow();
      expect(issueBodies).toHaveLength(1);
      expect(issueBodies[0]).toContain('CHANGELOG ハッシュ不一致');
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/issues'),
        expect.objectContaining({ method: 'POST' }),
      );
    } finally {
      await instance.dispose();
    }
  });
});
