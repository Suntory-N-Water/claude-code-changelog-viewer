import { applyD1Migrations } from 'cloudflare:test';
import { introspectWorkflowInstance } from 'cloudflare:test';
import type { D1Migration } from 'cloudflare:test';
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

declare global {
  namespace Cloudflare {
    interface Env {
      TEST_DOCS_SEARCH_MIGRATIONS: D1Migration[];
      TEST_NOTIFICATION_MIGRATIONS: D1Migration[];
    }
  }
}

const testEnv = env;
const changelog = `# Changelog\n\n## 2.1.234\n\n- Added workflow inference support\n`;
// 翻訳が 30 件と 1 件に割れる最小の件数
const LARGE_RELEASE_ITEM_COUNT = 31;
const largeChangelog = [
  '# Changelog',
  '',
  '## 2.1.238',
  '',
  ...Array.from(
    { length: LARGE_RELEASE_ITEM_COUNT },
    (_, index) => `- Added workflow inference support for case ${index}`,
  ),
  '',
].join('\n');

function chatCompletion(content: object) {
  return {
    id: 'test-completion',
    object: 'chat.completion',
    created: 0,
    model: '@cf/zai-org/glm-5.3-flash',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: JSON.stringify(content),
          refusal: null,
        },
        finish_reason: 'stop',
        logprobs: null,
      },
    ],
  };
}

function truncatedCompletion() {
  return {
    id: 'test-completion',
    object: 'chat.completion',
    created: 0,
    model: '@cf/zai-org/glm-5.3-flash',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: '{"translated_items":[{"id":"x","content_ja":"途中',
          refusal: null,
        },
        finish_reason: 'length',
        logprobs: null,
      },
    ],
  };
}

function singleItemCompletion(kind: string, id: string) {
  if (kind === 'changelog_translation') {
    return chatCompletion({
      translated_items: [{ id, content_ja: 'Workflow 推論のサポートを追加しました。' }],
    });
  }
  if (kind === 'changelog_items') {
    return chatCompletion({
      inferred_items: [
        {
          id,
          benefit: 'CHANGELOG の更新を自動で推論して保存できます。',
        },
      ],
      feature_area_corrections: [],
    });
  }
  return chatCompletion({ summary: 'Workflow 推論のサポートを追加しました。' });
}

type AiRequest = {
  kind: string;
  prompt: string;
  ids: string[];
};

// 応答の種類はスキーマ名で決まるため、テストごとに種類別の応答だけを差し替えられるようにする
function mockAiRun(respond: (request: AiRequest) => object) {
  return vi.spyOn(testEnv.AI, 'run').mockImplementation((async (
    _model: string,
    options: {
      messages: [{ content: string }];
      response_format: { json_schema: { name: string } };
    },
  ) => {
    const prompt = options.messages[0].content;
    return respond({
      kind: options.response_format.json_schema.name,
      prompt,
      ids: [...prompt.matchAll(/^### 項目 id=(.+)$/gm)].map((match) => match[1] ?? ''),
    });
  }) as unknown as typeof testEnv.AI.run);
}

describe('CHANGELOG 推論 Workflow', () => {
  beforeEach(async () => {
    await applyD1Migrations(testEnv.DB, testEnv.TEST_NOTIFICATION_MIGRATIONS);
    await applyD1Migrations(testEnv.DOCS_DB, testEnv.TEST_DOCS_SEARCH_MIGRATIONS);

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

  it('CHANGELOG を検出して D1 保存・通知・ビルド起動まで行う時、保存再試行で AI を再実行しないこと', async () => {
    const release = (await parseChangelogReleases(changelog))[0];
    if (release === undefined) {
      throw new Error('テスト用 CHANGELOG のリリースがありません');
    }

    const item = release.items[0];
    if (item === undefined) {
      throw new Error('テスト用 CHANGELOG の項目がありません');
    }

    const aiRun = mockAiRun(({ kind }) => singleItemCompletion(kind, item.id));
    const queueSend = vi.spyOn(testEnv.NOTIFICATION_QUEUE, 'send').mockResolvedValue({
      metadata: { metrics: { backlogCount: 0, backlogBytes: 0 } },
    });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
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

      // 翻訳・項目推論・サマリー生成で 1 回ずつ呼ばれる
      expect(aiRun).toHaveBeenCalledTimes(3);
      expect(queueSend).toHaveBeenCalledWith({
        version: 'v2.1.234',
        analysis: {
          version: 'v2.1.234',
          summary: 'Workflow 推論のサポートを追加しました。',
          items: [
            {
              content: '- Added workflow inference support',
              content_ja: 'Workflow 推論のサポートを追加しました。',
              prefix: 'Added',
            },
          ],
        },
      });
      expect(fetchMock).toHaveBeenCalledWith('https://deploy.example/hook', {
        method: 'POST',
      });

      const db = drizzle(testEnv.DB);
      const stored = await db
        .select({
          version: changelogVersions.version,
          summary: changelogVersions.summary,
          contentJa: changelogItems.contentJa,
          inferenceBenefit: changelogItems.inferenceBenefit,
        })
        .from(changelogVersions)
        .innerJoin(changelogItems, eq(changelogItems.version, changelogVersions.version))
        .where(eq(changelogVersions.version, '2.1.234'));
      expect(stored).toEqual([
        {
          version: '2.1.234',
          summary: 'Workflow 推論のサポートを追加しました。',
          contentJa: 'Workflow 推論のサポートを追加しました。',
          inferenceBenefit: 'CHANGELOG の更新を自動で推論して保存できます。',
        },
      ]);
    } finally {
      await instance.dispose();
    }
  });

  it('CHANGELOG のハッシュが一致しない時、失敗 Issue を作成して Workflow を失敗させること', async () => {
    let issueCreationCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/contents/CHANGELOG.md')) {
        return new Response(changelog, { status: 200 });
      }
      if (url.includes('/issues?') && init?.method === 'GET') {
        return new Response('[]', { status: 200 });
      }
      if (url.endsWith('/issues') && init?.method === 'POST') {
        issueCreationCount += 1;
        return new Response('{"number":961}', { status: 201 });
      }
      if (url.endsWith('/issues/961/labels') && init?.method === 'POST') {
        return new Response('[]', { status: 200 });
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
      expect(issueCreationCount).toBe(1);
    } finally {
      await instance.dispose();
    }
  });

  it('既存バージョンの項目が変わった時、差分イベントを D1 に保存して通知しないこと', async () => {
    const db = drizzle(testEnv.DB);
    await db.insert(changelogVersions).values({
      version: '2.1.234',
      summary: '古い要約',
    });
    await db.insert(changelogItems).values({
      version: '2.1.234',
      itemId: 'old-item',
      content: '- Old workflow behavior',
      contentJa: null,
      prefix: 'Changed',
      inferenceBenefit: null,
      searchText: 'old workflow behavior',
    });
    const [release] = await parseChangelogReleases(changelog);
    const item = release?.items[0];
    if (item === undefined) {
      throw new Error('テスト用 CHANGELOG の項目がありません');
    }

    const aiRun = mockAiRun(({ kind }) => singleItemCompletion(kind, item.id));
    const queueSend = vi.spyOn(testEnv.NOTIFICATION_QUEUE, 'send').mockResolvedValue({
      metadata: { metrics: { backlogCount: 0, backlogBytes: 0 } },
    });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/contents/CHANGELOG.md')) {
        return new Response(changelog, { status: 200 });
      }
      if (url === 'https://deploy.example/hook') {
        return new Response(null, { status: 200 });
      }
      throw new Error(`想定外の外部リクエスト: ${url}`);
    });
    const instanceId = `issue-901-diff-${crypto.randomUUID()}`;
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
          detectedHash: await sha256Hex(changelog),
          detectedAt: '2026-08-16T00:00:00.000Z',
        },
      });

      await expect(instance.waitForStatus('complete')).resolves.not.toThrow();
      await expect(instance.getOutput()).resolves.toEqual({
        processedVersions: ['v2.1.234'],
        notifiedVersions: [],
      });
      // 翻訳・項目推論・サマリー生成で 1 回ずつ呼ばれる
      expect(aiRun).toHaveBeenCalledTimes(3);
      expect(queueSend).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledWith('https://deploy.example/hook', {
        method: 'POST',
      });

      await expect(
        db
          .select({
            version: changelogDiffEvents.version,
            type: changelogDiffEvents.type,
          })
          .from(changelogDiffEvents),
      ).resolves.toEqual([{ version: 'v2.1.234', type: 'items_changed' }]);
      await expect(
        db
          .select({
            version: changelogDiffEventItems.version,
            direction: changelogDiffEventItems.direction,
            content: changelogDiffEventItems.content,
          })
          .from(changelogDiffEventItems)
          .orderBy(sql.raw('changelog_diff_event_items.rowid')),
      ).resolves.toEqual([
        {
          version: 'v2.1.234',
          direction: 'added',
          content: '- Added workflow inference support',
        },
        {
          version: 'v2.1.234',
          direction: 'removed',
          content: '- Old workflow behavior',
        },
      ]);
    } finally {
      await instance.dispose();
    }
  });

  it('ある推論バッチが打ち切られ続けるとき、そのバッチの項目は日本語訳だけを保存して Issue を作ること', async () => {
    // 推論は 1 件ずつなので、失敗した 6 件目以外の推論は残る
    const sixItemChangelog = [
      '# Changelog',
      '',
      '## 2.1.240',
      '',
      ...Array.from(
        { length: 5 },
        (_, index) => `- Added workflow inference support for the healthy case ${index}`,
      ),
      '- Added workflow inference support for the doomed case',
      '',
    ].join('\n');
    const release = (await parseChangelogReleases(sixItemChangelog))[0];
    if (release === undefined) {
      throw new Error('テスト用 CHANGELOG のリリースがありません');
    }
    const healthyItem = release.items[0];
    const doomedItem = release.items[5];
    if (healthyItem === undefined || doomedItem === undefined) {
      throw new Error('テスト用 CHANGELOG の項目が足りません');
    }

    mockAiRun(({ kind, ids }) => {
      if (kind === 'changelog_summary') {
        return chatCompletion({ summary: '6 件の変更を追加しました。' });
      }
      if (kind === 'changelog_translation') {
        return chatCompletion({
          translated_items: ids.map((id) => ({ id, content_ja: `項目 ${id} を追加した。` })),
        });
      }
      if (ids.includes(doomedItem.id)) {
        return truncatedCompletion();
      }
      return chatCompletion({
        inferred_items: ids.map((id) => ({
          id,
          benefit: '追加された機能をそのまま利用できます。',
        })),
        feature_area_corrections: [],
      });
    });
    vi.spyOn(testEnv.NOTIFICATION_QUEUE, 'send').mockResolvedValue({
      metadata: { metrics: { backlogCount: 0, backlogBytes: 0 } },
    });

    const skipIssueBodies: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/contents/CHANGELOG.md')) {
        return new Response(sixItemChangelog, { status: 200 });
      }
      if (url === 'https://deploy.example/hook') {
        return new Response(null, { status: 200 });
      }
      if (url.includes('/issues?') && init?.method === 'GET') {
        return new Response('[]', { status: 200 });
      }
      if (url.endsWith('/issues') && init?.method === 'POST') {
        const payload = JSON.parse(String(init.body)) as { body: string };
        skipIssueBodies.push(payload.body);
        return new Response(JSON.stringify({ number: 1 }), { status: 201 });
      }
      if (url.includes('/labels')) {
        return new Response('[]', { status: 200 });
      }
      throw new Error(`想定外の外部リクエスト: ${url}`);
    });

    const instanceId = `skip-${crypto.randomUUID()}`;
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
          detectedHash: await sha256Hex(sixItemChangelog),
          detectedAt: '2026-09-02T00:00:00.000Z',
        },
      });

      await expect(instance.waitForStatus('complete')).resolves.not.toThrow();

      const db = drizzle(testEnv.DB);
      const stored = await db
        .select({
          itemId: changelogItems.itemId,
          content: changelogItems.content,
          contentJa: changelogItems.contentJa,
          inferenceBenefit: changelogItems.inferenceBenefit,
        })
        .from(changelogItems)
        .where(eq(changelogItems.version, '2.1.240'));

      expect(stored).toEqual(
        expect.arrayContaining([
          {
            itemId: healthyItem.id,
            content: '- Added workflow inference support for the healthy case 0',
            contentJa: `項目 ${healthyItem.id} を追加した。`,
            inferenceBenefit: '追加された機能をそのまま利用できます。',
          },
          {
            itemId: doomedItem.id,
            content: '- Added workflow inference support for the doomed case',
            contentJa: `項目 ${doomedItem.id} を追加した。`,
            inferenceBenefit: null,
          },
        ]),
      );
      expect(skipIssueBodies).toHaveLength(1);
      expect(skipIssueBodies[0]).toContain(doomedItem.id);
      expect(skipIssueBodies[0]).not.toContain(healthyItem.id);
    } finally {
      await instance.dispose();
    }
  });

  it('1バージョンの項目数が多いとき、翻訳は 30 件ずつ・推論は 1 件ずつに分けて全項目の日本語訳を保存すること', async () => {
    const release = (await parseChangelogReleases(largeChangelog))[0];
    if (release === undefined) {
      throw new Error('テスト用 CHANGELOG のリリースがありません');
    }

    const translatedIdBatches: string[][] = [];
    const inferredIdBatches: string[][] = [];
    let summaryCount = 0;
    mockAiRun(({ kind, ids }) => {
      if (kind === 'changelog_summary') {
        summaryCount += 1;
        return chatCompletion({ summary: '多数の変更を追加しました。' });
      }
      if (kind === 'changelog_translation') {
        translatedIdBatches.push(ids);
        return chatCompletion({
          translated_items: ids.map((id) => ({ id, content_ja: `項目 ${id} を追加した。` })),
        });
      }
      inferredIdBatches.push(ids);
      return chatCompletion({
        inferred_items: ids.map((id) => ({
          id,
          benefit: '追加された機能をそのまま利用できます。',
        })),
        feature_area_corrections: [],
      });
    });
    vi.spyOn(testEnv.NOTIFICATION_QUEUE, 'send').mockResolvedValue({
      metadata: { metrics: { backlogCount: 0, backlogBytes: 0 } },
    });
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/contents/CHANGELOG.md')) {
        return new Response(largeChangelog, { status: 200 });
      }
      if (url === 'https://deploy.example/hook') {
        return new Response(null, { status: 200 });
      }
      throw new Error(`想定外の外部リクエスト: ${url}`);
    });

    const instanceId = `issue-955-batch-${crypto.randomUUID()}`;
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
          detectedHash: await sha256Hex(largeChangelog),
          detectedAt: '2026-08-21T00:00:00.000Z',
        },
      });

      await expect(instance.waitForStatus('complete')).resolves.not.toThrow();

      const itemIds = release.items.map((item) => item.id);
      // 31 項目 = 翻訳 30 + 1、推論 1 × 31
      expect(translatedIdBatches.map((batch) => batch.length)).toEqual([30, 1]);
      expect(translatedIdBatches.flat()).toEqual(itemIds);
      expect(inferredIdBatches.map((batch) => batch.length)).toEqual(
        Array.from({ length: LARGE_RELEASE_ITEM_COUNT }, () => 1),
      );
      expect(inferredIdBatches.flat()).toEqual(itemIds);
      expect(summaryCount).toBe(1);

      const db = drizzle(testEnv.DB);
      const stored = await db
        .select({ itemId: changelogItems.itemId, contentJa: changelogItems.contentJa })
        .from(changelogItems)
        .where(eq(changelogItems.version, '2.1.238'));
      expect(stored).toEqual(
        expect.arrayContaining(
          itemIds.map((id) => ({ itemId: id, contentJa: `項目 ${id} を追加した。` })),
        ),
      );
      expect(stored).toHaveLength(LARGE_RELEASE_ITEM_COUNT);
    } finally {
      await instance.dispose();
    }
  });

  it('翻訳が使えない応答を返し続けるとき、そのバッチを原文のまま保存し、推論は保存して Issue を作ること', async () => {
    const [release] = await parseChangelogReleases(changelog);
    const item = release?.items[0];
    if (item === undefined) {
      throw new Error('テスト用 CHANGELOG の項目がありません');
    }

    mockAiRun(({ kind }) =>
      kind === 'changelog_translation'
        ? truncatedCompletion()
        : singleItemCompletion(kind, item.id),
    );
    vi.spyOn(testEnv.NOTIFICATION_QUEUE, 'send').mockResolvedValue({
      metadata: { metrics: { backlogCount: 0, backlogBytes: 0 } },
    });
    const skipIssueBodies: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/contents/CHANGELOG.md')) {
        return new Response(changelog, { status: 200 });
      }
      if (url === 'https://deploy.example/hook') {
        return new Response(null, { status: 200 });
      }
      if (url.includes('/issues?') && init?.method === 'GET') {
        return new Response('[]', { status: 200 });
      }
      if (url.endsWith('/issues') && init?.method === 'POST') {
        const payload = JSON.parse(String(init.body)) as { body: string };
        skipIssueBodies.push(payload.body);
        return new Response(JSON.stringify({ number: 1 }), { status: 201 });
      }
      if (url.includes('/labels')) {
        return new Response('[]', { status: 200 });
      }
      throw new Error(`想定外の外部リクエスト: ${url}`);
    });

    const instanceId = `translation-skip-${crypto.randomUUID()}`;
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
          detectedHash: await sha256Hex(changelog),
          detectedAt: '2026-10-17T00:00:00.000Z',
        },
      });

      await expect(instance.waitForStatus('complete')).resolves.not.toThrow();

      const db = drizzle(testEnv.DB);
      await expect(
        db
          .select({
            contentJa: changelogItems.contentJa,
            inferenceBenefit: changelogItems.inferenceBenefit,
          })
          .from(changelogItems)
          .where(eq(changelogItems.version, '2.1.234')),
      ).resolves.toEqual([
        { contentJa: null, inferenceBenefit: 'CHANGELOG の更新を自動で推論して保存できます。' },
      ]);
      expect(skipIssueBodies).toHaveLength(1);
      expect(skipIssueBodies[0]).toContain(item.id);
      expect(skipIssueBodies[0]).toContain('translate-v2.1.234-0');
    } finally {
      await instance.dispose();
    }
  });
});
