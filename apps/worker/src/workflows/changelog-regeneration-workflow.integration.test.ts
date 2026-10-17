import { applyD1Migrations, introspectWorkflowInstance } from 'cloudflare:test';
import type { D1Migration } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { changelogItemRelatedDocs, changelogItems, changelogVersions } from '../db/schema';

declare global {
  namespace Cloudflare {
    interface Env {
      TEST_DOCS_SEARCH_MIGRATIONS: D1Migration[];
      TEST_NOTIFICATION_MIGRATIONS: D1Migration[];
    }
  }
}

const testEnv = env;

function chatCompletion(content: object) {
  return {
    id: 'test-completion',
    object: 'chat.completion',
    created: 0,
    model: '@cf/zai-org/glm-5.3-flash',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: JSON.stringify(content), refusal: null },
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

function mockAiRun({ translationUnusable = false } = {}) {
  return vi.spyOn(testEnv.AI, 'run').mockImplementation((async (
    _model: string,
    options: {
      messages: [{ content: string }];
      response_format: { json_schema: { name: string } };
    },
  ) => {
    const prompt = options.messages[0].content;
    const ids = [...prompt.matchAll(/^### 項目 id=(.+)$/gm)].map((match) => match[1] ?? '');
    switch (options.response_format.json_schema.name) {
      case 'changelog_translation':
        if (translationUnusable) {
          return truncatedCompletion();
        }
        return chatCompletion({
          // fixed-item は英語のまま返し、未翻訳の件数に表れることを確かめる
          translated_items: ids.map((id) => ({
            id,
            content_ja: id === 'fixed-item' ? 'Fixed a crash on startup' : `再生成した訳 ${id}`,
          })),
        });
      case 'changelog_items':
        return chatCompletion({
          inferred_items: ids.map((id) => ({ id, benefit: `再生成した変更後 ${id}` })),
        });
      default:
        return chatCompletion({ summary: '再生成したサマリー' });
    }
  }) as unknown as typeof testEnv.AI.run);
}

async function seedVersion(version: string) {
  const db = drizzle(testEnv.DB);
  await db.insert(changelogVersions).values({ version, summary: 'GLM 期のサマリー' });
  // item_id の辞書順と CHANGELOG 上の並び順をわざと逆にし、並び順が rowid で保たれるかを確かめる
  await db.insert(changelogItems).values([
    {
      version,
      itemId: 'z-added-item',
      content: '- Added workflow inference support',
      contentJa: 'Added workflow inference support',
      prefix: 'Added',
      inferenceBenefit: '生物フラグ付きリクエスト',
      searchText: 'added workflow inference support',
    },
    {
      version,
      itemId: 'fixed-item',
      content: '- Fixed a crash on startup',
      contentJa: '起動時のクラッシュを修正',
      prefix: 'Fixed',
      inferenceBenefit: null,
      searchText: 'fixed a crash on startup',
    },
  ]);
}

function mockGitHubIssueAndDeployHook() {
  const createdIssueTitles: string[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (url === 'https://deploy.example/hook') {
      return new Response(null, { status: 200 });
    }
    if (url.includes('/issues?') && init?.method === 'GET') {
      return new Response('[]', { status: 200 });
    }
    if (url.endsWith('/issues') && init?.method === 'POST') {
      createdIssueTitles.push((JSON.parse(String(init.body)) as { title: string }).title);
      return new Response(JSON.stringify({ number: 1 }), { status: 201 });
    }
    if (url.includes('/labels')) {
      return new Response('[]', { status: 200 });
    }
    throw new Error(`想定外の外部リクエスト: ${url}`);
  });
  return createdIssueTitles;
}

async function readStoredItems() {
  return drizzle(testEnv.DB)
    .select({
      version: changelogItems.version,
      itemId: changelogItems.itemId,
      contentJa: changelogItems.contentJa,
      inferenceBenefit: changelogItems.inferenceBenefit,
    })
    .from(changelogItems)
    .orderBy(changelogItems.version, sql`rowid`);
}

describe('CHANGELOG 再生成 Workflow', () => {
  beforeEach(async () => {
    await applyD1Migrations(testEnv.DB, testEnv.TEST_NOTIFICATION_MIGRATIONS);
    await applyD1Migrations(testEnv.DOCS_DB, testEnv.TEST_DOCS_SEARCH_MIGRATIONS);

    const db = drizzle(testEnv.DB);
    await db.delete(changelogItemRelatedDocs);
    await db.delete(changelogItems);
    await db.delete(changelogVersions);

    const docsDb = drizzle(testEnv.DOCS_DB);
    await docsDb.run(sql`DELETE FROM page_chunks_fts`);
    await docsDb.run(sql`
      INSERT INTO page_chunks_fts (content, path, heading, chunk_index)
      VALUES (
        'Workflow inference support. Configure workflow inference support.',
        'docs/en/features.md',
        'Features',
        0
      )
    `);
    // 1 件だけの索引では bm25() の IDF がほぼ 0 になり、関連ドキュメントが足切りで消えるため、
    // 検索語を含まないチャンクで埋めて IDF を上げる
    await docsDb.run(sql`
      INSERT INTO page_chunks_fts (content, path, heading, chunk_index)
      WITH RECURSIVE n(i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM n WHERE i < 1999)
      SELECT 'Unrelated reference text number ' || i || '.', 'background-' || (i % 50) || '.md', '', i / 50
      FROM n
    `);
  });

  it('範囲を指定して起動したとき、範囲内のバージョンだけを並び順を保って作り直し、通知せずにビルドを起動すること', async () => {
    for (const version of ['2.1.231', '2.1.232', '2.1.240', '2.1.241']) {
      await seedVersion(version);
    }
    mockAiRun();
    const queueSend = vi.spyOn(testEnv.NOTIFICATION_QUEUE, 'send');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === 'https://deploy.example/hook') {
        return new Response(null, { status: 200 });
      }
      throw new Error(`想定外の外部リクエスト: ${url}`);
    });

    const instanceId = `regenerate-${crypto.randomUUID()}`;
    const instance = await introspectWorkflowInstance(
      testEnv.CHANGELOG_REGENERATION_WORKFLOW,
      instanceId,
    );

    try {
      await instance.modify(async (modifier) => {
        await modifier.disableRetryDelays();
      });

      await testEnv.CHANGELOG_REGENERATION_WORKFLOW.create({
        id: instanceId,
        params: { fromVersion: 'v2.1.232', toVersion: '2.1.240' },
      });

      await expect(instance.waitForStatus('complete')).resolves.not.toThrow();
      // 各バージョン 2 項目のうち fixed-item の訳が英語のまま。変更後を求めるのは z-added-item だけ
      const gaps = {
        itemCount: 2,
        untranslatedItemCount: 1,
        missingBenefitItemCount: 0,
        untranslatedBenefitItemCount: 0,
      };
      await expect(instance.getOutput()).resolves.toEqual({
        regeneratedVersions: [
          { version: 'v2.1.232', ...gaps },
          { version: 'v2.1.240', ...gaps },
        ],
      });
      expect(queueSend).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith('https://deploy.example/hook', { method: 'POST' });

      const untouchedItems = (version: string) => [
        {
          version,
          itemId: 'z-added-item',
          contentJa: 'Added workflow inference support',
          inferenceBenefit: '生物フラグ付きリクエスト',
        },
        {
          version,
          itemId: 'fixed-item',
          contentJa: '起動時のクラッシュを修正',
          inferenceBenefit: null,
        },
      ];
      const regeneratedItems = (version: string) => [
        {
          version,
          itemId: 'z-added-item',
          contentJa: '再生成した訳 z-added-item',
          inferenceBenefit: '再生成した変更後 z-added-item',
        },
        {
          version,
          itemId: 'fixed-item',
          contentJa: 'Fixed a crash on startup',
          inferenceBenefit: null,
        },
      ];
      await expect(readStoredItems()).resolves.toEqual([
        ...untouchedItems('2.1.231'),
        ...regeneratedItems('2.1.232'),
        ...regeneratedItems('2.1.240'),
        ...untouchedItems('2.1.241'),
      ]);
      await expect(
        drizzle(testEnv.DB).select().from(changelogVersions).orderBy(changelogVersions.version),
      ).resolves.toEqual([
        { version: '2.1.231', summary: 'GLM 期のサマリー' },
        { version: '2.1.232', summary: '再生成したサマリー' },
        { version: '2.1.240', summary: '再生成したサマリー' },
        { version: '2.1.241', summary: 'GLM 期のサマリー' },
      ]);
    } finally {
      await instance.dispose();
    }
  });

  it('範囲に当てはまるバージョンがないとき、AI もビルドも呼ばずに空の結果で完了すること', async () => {
    await seedVersion('2.1.231');
    const aiRun = mockAiRun();
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    const instanceId = `regenerate-empty-${crypto.randomUUID()}`;
    const instance = await introspectWorkflowInstance(
      testEnv.CHANGELOG_REGENERATION_WORKFLOW,
      instanceId,
    );

    try {
      await instance.modify(async (modifier) => {
        await modifier.disableRetryDelays();
      });

      await testEnv.CHANGELOG_REGENERATION_WORKFLOW.create({
        id: instanceId,
        params: { fromVersion: '2.1.232' },
      });

      await expect(instance.waitForStatus('complete')).resolves.not.toThrow();
      await expect(instance.getOutput()).resolves.toEqual({ regeneratedVersions: [] });
      expect(aiRun).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      await instance.dispose();
    }
  });

  it('翻訳 AI が使えない応答を返し続けるとき、既存の日本語訳を残し、既存の訳がない項目は NULL で保存すること', async () => {
    const db = drizzle(testEnv.DB);
    await db.insert(changelogVersions).values({ version: '2.1.232', summary: 'GLM 期のサマリー' });
    await db.insert(changelogItems).values([
      {
        version: '2.1.232',
        itemId: 'kept-item',
        content: '- Fixed a crash on startup',
        contentJa: '起動時のクラッシュを修正',
        prefix: 'Fixed',
        inferenceBenefit: null,
        searchText: 'fixed a crash on startup',
      },
      {
        version: '2.1.232',
        itemId: 'missing-item',
        content: '- Fixed a hang on exit',
        contentJa: null,
        prefix: 'Fixed',
        inferenceBenefit: null,
        searchText: 'fixed a hang on exit',
      },
    ]);
    mockAiRun({ translationUnusable: true });
    const createdIssueTitles = mockGitHubIssueAndDeployHook();

    const instanceId = `regenerate-translation-skip-${crypto.randomUUID()}`;
    const instance = await introspectWorkflowInstance(
      testEnv.CHANGELOG_REGENERATION_WORKFLOW,
      instanceId,
    );

    try {
      await instance.modify(async (modifier) => {
        await modifier.disableRetryDelays();
      });

      await testEnv.CHANGELOG_REGENERATION_WORKFLOW.create({
        id: instanceId,
        params: { fromVersion: '2.1.232', toVersion: '2.1.232' },
      });

      await expect(instance.waitForStatus('complete')).resolves.not.toThrow();
      await expect(readStoredItems()).resolves.toEqual([
        {
          version: '2.1.232',
          itemId: 'kept-item',
          contentJa: '起動時のクラッシュを修正',
          inferenceBenefit: null,
        },
        { version: '2.1.232', itemId: 'missing-item', contentJa: null, inferenceBenefit: null },
      ]);
      expect(createdIssueTitles).toEqual(['v2.1.232 の 2 項目で推論を諦めました']);
    } finally {
      await instance.dispose();
    }
  });

  it('fromVersion が toVersion より新しいとき、失敗 Issue を作って Workflow を失敗させ、D1 を変更しないこと', async () => {
    await seedVersion('2.1.232');
    const aiRun = mockAiRun();
    const createdIssueTitles = mockGitHubIssueAndDeployHook();
    const before = await readStoredItems();

    const instanceId = `regenerate-reversed-${crypto.randomUUID()}`;
    const instance = await introspectWorkflowInstance(
      testEnv.CHANGELOG_REGENERATION_WORKFLOW,
      instanceId,
    );

    try {
      await instance.modify(async (modifier) => {
        await modifier.disableRetryDelays();
      });

      await testEnv.CHANGELOG_REGENERATION_WORKFLOW.create({
        id: instanceId,
        params: { fromVersion: '2.1.240', toVersion: '2.1.232' },
      });

      await expect(instance.waitForStatus('errored')).resolves.not.toThrow();
      expect(createdIssueTitles).toEqual(['CHANGELOG 再生成 Workflow に失敗']);
      expect(aiRun).not.toHaveBeenCalled();
      await expect(readStoredItems()).resolves.toEqual(before);
    } finally {
      await instance.dispose();
    }
  });
});
