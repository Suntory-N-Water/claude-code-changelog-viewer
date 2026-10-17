import { applyD1Migrations, introspectWorkflowInstance } from 'cloudflare:test';
import type { D1Migration } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { changelogItems, settingsOfficialDocs, settingsReference } from '../db/schema';

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

type AiTask = 'settings_translation' | 'settings_use_case';

function aiTaskOf(inputs: unknown): AiTask {
  return (inputs as { response_format: { json_schema: { name: AiTask } } }).response_format
    .json_schema.name;
}

// 翻訳と用途で応答の形が違うため、response_format の名前で返す応答を分ける
function mockAi(responses: { [Task in AiTask]?: (inputs: unknown) => unknown }) {
  return vi.spyOn(testEnv.AI, 'run').mockImplementation((async (
    _model: string,
    inputs: unknown,
  ) => {
    const respond = responses[aiTaskOf(inputs)];
    if (respond === undefined) {
      throw new Error(`想定外の AI 呼び出し: ${aiTaskOf(inputs)}`);
    }
    return respond(inputs);
  }) as never);
}

function countCalls(aiRun: ReturnType<typeof mockAi>, task: AiTask): number {
  return aiRun.mock.calls.filter(([, inputs]) => aiTaskOf(inputs) === task).length;
}

function translationResponse(count: number) {
  return chatCompletion({
    results: Array.from({ length: count }, (_, id) => ({
      id,
      description_ja: `説明 ${id}です。`,
      enum_descriptions_ja: [],
      default_note_ja: '',
    })),
  });
}

describe('設定リファレンス生成 Workflow', () => {
  beforeEach(async () => {
    await applyD1Migrations(testEnv.DB, testEnv.TEST_NOTIFICATION_MIGRATIONS);
    await applyD1Migrations(testEnv.DOCS_DB, testEnv.TEST_DOCS_SEARCH_MIGRATIONS);

    const db = drizzle(testEnv.DB);
    await db.delete(settingsOfficialDocs);
    await db.delete(settingsReference);
    await db.delete(changelogItems);

    await testEnv.DOCS_DB.prepare('DELETE FROM page_chunks_fts').run();
    await testEnv.DOCS_DB.prepare('DELETE FROM setting_schema_entries').run();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('関連ドキュメントがある設定のとき、翻訳と用途を 1 回ずつ生成して保存し、保存の再試行で AI を呼び直さないこと', async () => {
    await seedSettingSchema();
    await seedDocument();
    const db = drizzle(testEnv.DB);
    await db.insert(changelogItems).values({
      version: '2.1.234',
      itemId: 'setting-item',
      content: '- Added permissions.additionalDirectories support',
      contentJa: 'permissions.additionalDirectories のサポートを追加しました。',
      prefix: 'Added',
      inferenceBenefit: '必要な作業領域へアクセスできます。',
      searchText: 'permissions.additionaldirectories',
    });

    const aiRun = mockAi({
      settings_translation: () =>
        chatCompletion({
          results: [
            {
              id: 0,
              description_ja: 'アクセスを許可する追加ディレクトリです。',
              enum_descriptions_ja: [],
              default_note_ja: '',
            },
          ],
        }),
      settings_use_case: () =>
        chatCompletion({
          use_cases_ja: ['プロジェクト外のディレクトリを参照する場合に使います。'],
        }),
    });
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input) === 'https://deploy.example/hook') {
        return new Response(null, { status: 200 });
      }
      throw new Error(`想定外の外部リクエスト: ${String(input)}`);
    });
    const instanceId = `issue-902-store-retry-${crypto.randomUUID()}`;
    const instance = await introspectWorkflowInstance(
      testEnv.SETTINGS_REFERENCE_WORKFLOW,
      instanceId,
    );

    try {
      await instance.modify(async (modifier) => {
        await modifier.disableRetryDelays();
        await modifier.mockStepError({ name: 'store-0' }, new Error('保存の一時的な失敗'), 1);
      });

      await testEnv.SETTINGS_REFERENCE_WORKFLOW.create({
        id: instanceId,
        params: {},
      });

      await expect(instance.waitForStatus('complete')).resolves.not.toThrow();
      await expect(instance.getOutput()).resolves.toEqual({
        processedKeys: ['permissions.additionalDirectories'],
      });
      expect(countCalls(aiRun, 'settings_translation')).toBe(1);
      expect(countCalls(aiRun, 'settings_use_case')).toBe(1);

      await expect(
        db
          .select({
            key: settingsReference.key,
            descriptionJa: settingsReference.descriptionJa,
            useCaseJa: settingsReference.useCaseJa,
          })
          .from(settingsReference),
      ).resolves.toEqual([
        {
          key: 'permissions.additionalDirectories',
          descriptionJa: 'アクセスを許可する追加ディレクトリです。',
          useCaseJa: '- プロジェクト外のディレクトリを参照する場合に使います。',
        },
      ]);
      await expect(
        db
          .select({
            settingKey: settingsOfficialDocs.settingKey,
            docPath: settingsOfficialDocs.docPath,
          })
          .from(settingsOfficialDocs),
      ).resolves.toEqual([
        {
          settingKey: 'permissions.additionalDirectories',
          docPath: 'permissions.md',
        },
      ]);
    } finally {
      await instance.dispose();
    }
  });

  it('生成済みの項目がない時は AI を呼ばず、targetKeys 指定時は再生成する', async () => {
    await seedSettingSchema();
    const db = drizzle(testEnv.DB);
    await db.insert(settingsReference).values({
      key: 'permissions.additionalDirectories',
      leafName: 'additionalDirectories',
      slug: 'permissions-additional-directories',
      source: 'settings',
      descriptionEn: 'Old description',
      descriptionJa: '古い説明です。',
      useCaseJa: null,
      fetchedAt: '2026-08-16',
    });

    const aiRun = mockAi({ settings_translation: () => translationResponse(1) });
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input) === 'https://deploy.example/hook') {
        return new Response(null, { status: 200 });
      }
      throw new Error(`想定外の外部リクエスト: ${String(input)}`);
    });

    const skippedId = `issue-902-skip-${crypto.randomUUID()}`;
    const skipped = await introspectWorkflowInstance(
      testEnv.SETTINGS_REFERENCE_WORKFLOW,
      skippedId,
    );
    try {
      await skipped.modify(async (modifier) => {
        await modifier.disableRetryDelays();
      });
      await testEnv.SETTINGS_REFERENCE_WORKFLOW.create({
        id: skippedId,
        params: {},
      });
      await expect(skipped.waitForStatus('complete')).resolves.not.toThrow();
      expect(aiRun).not.toHaveBeenCalled();
    } finally {
      await skipped.dispose();
    }

    const targetId = `issue-902-target-${crypto.randomUUID()}`;
    const target = await introspectWorkflowInstance(testEnv.SETTINGS_REFERENCE_WORKFLOW, targetId);
    try {
      await target.modify(async (modifier) => {
        await modifier.disableRetryDelays();
      });
      await testEnv.SETTINGS_REFERENCE_WORKFLOW.create({
        id: targetId,
        params: { targetKeys: ['permissions.additionalDirectories'] },
      });
      await expect(target.waitForStatus('complete')).resolves.not.toThrow();
      expect(aiRun).toHaveBeenCalledTimes(1);
    } finally {
      await target.dispose();
    }
  });

  it('targetKeys で選んだキーだけ、選択肢の説明と既定値の補足を日本語で保存する', async () => {
    await testEnv.DOCS_DB.prepare(
      `INSERT INTO setting_schema_entries
       (key, source, description, parent_descriptions, value_type, default_value, enum_values, enum_descriptions, default_note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        'autoUpdatesChannel',
        'settings',
        'Choose which release channel auto-updates follow.',
        '[]',
        'string',
        null,
        '["latest","stable"]',
        '{"latest":"updates follow the most recent release","stable":"updates follow a week-old version"}',
        'unset, so Claude Code follows `"latest"`',
      )
      .run();
    await testEnv.DOCS_DB.prepare(
      `INSERT INTO setting_schema_entries
       (key, source, description, parent_descriptions, value_type, default_value, enum_values)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind('model', 'settings', 'Model for the session.', '[]', 'string', null, null)
      .run();

    const db = drizzle(testEnv.DB);
    await db.insert(settingsReference).values([
      {
        key: 'autoUpdatesChannel',
        leafName: 'autoUpdatesChannel',
        slug: 'auto-updates-channel',
        source: 'settings',
        descriptionEn: 'Choose which release channel auto-updates follow.',
        descriptionJa: '自動更新が追いかけるリリース系統を選ぶ。',
        useCaseJa: null,
        fetchedAt: '2026-08-16',
      },
      {
        key: 'model',
        leafName: 'model',
        slug: 'model',
        source: 'settings',
        descriptionEn: 'Model for the session.',
        descriptionJa: 'セッションで使うモデルを指定する。',
        useCaseJa: null,
        fetchedAt: '2026-08-16',
      },
    ]);

    mockAi({
      settings_translation: () =>
        chatCompletion({
          results: [
            {
              id: 0,
              description_ja: '自動更新が追いかけるリリース系統を選ぶ。',
              enum_descriptions_ja: [
                { value: 'latest', description_ja: '最新のリリースを追いかける' },
                {
                  value: 'stable',
                  description_ja: 'おおむね1週間前のリリースを追いかける',
                },
                { value: 'nightly', description_ja: '毎晩のビルドを追いかける' },
              ],
              default_note_ja: '未設定のときは `"latest"` を追いかける',
            },
          ],
        }),
    });
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input) === 'https://deploy.example/hook') {
        return new Response(null, { status: 200 });
      }
      throw new Error(`想定外の外部リクエスト: ${String(input)}`);
    });

    const instanceId = `issue-991-target-${crypto.randomUUID()}`;
    const instance = await introspectWorkflowInstance(
      testEnv.SETTINGS_REFERENCE_WORKFLOW,
      instanceId,
    );
    try {
      await instance.modify(async (modifier) => {
        await modifier.disableRetryDelays();
      });
      await testEnv.SETTINGS_REFERENCE_WORKFLOW.create({
        id: instanceId,
        params: { targetKeys: ['autoUpdatesChannel'] },
      });
      await expect(instance.waitForStatus('complete')).resolves.not.toThrow();

      const rows = await db.select().from(settingsReference).orderBy(settingsReference.key);

      expect(rows).toMatchObject([
        {
          key: 'autoUpdatesChannel',
          enumDescriptionsJa:
            '{"latest":"最新のリリースを追いかける","stable":"おおむね1週間前のリリースを追いかける"}',
          defaultNoteJa: '未設定のときは `"latest"` を追いかける',
        },
        {
          key: 'model',
          descriptionJa: 'セッションで使うモデルを指定する。',
          enumDescriptionsJa: null,
          defaultNoteJa: null,
        },
      ]);
    } finally {
      await instance.dispose();
    }
  });

  it('関連情報のない 31 件のとき、翻訳を 30 件と 1 件に分けて呼び、用途を作らずに保存すること', async () => {
    await seedSettingSchema(31);
    const translationBatchSizes: number[] = [];
    const aiRun = mockAi({
      settings_translation: (inputs) => {
        // バッチの件数はプロンプトに並んだ項目の数で数える
        const prompt = (inputs as { messages: [{ content: string }] }).messages[0].content;
        const count = prompt.match(/### 項目 id=/g)?.length ?? 0;
        translationBatchSizes.push(count);
        return translationResponse(count);
      },
    });
    mockDeployHook();
    const instanceId = `issue-902-batch-${crypto.randomUUID()}`;
    const instance = await introspectWorkflowInstance(
      testEnv.SETTINGS_REFERENCE_WORKFLOW,
      instanceId,
    );

    try {
      await instance.modify(async (modifier) => {
        await modifier.disableRetryDelays();
      });
      await testEnv.SETTINGS_REFERENCE_WORKFLOW.create({
        id: instanceId,
        params: {},
      });
      await expect(instance.waitForStatus('complete')).resolves.not.toThrow();
      expect(translationBatchSizes).toEqual([30, 1]);
      expect(countCalls(aiRun, 'settings_use_case')).toBe(0);
      const rows = await drizzle(testEnv.DB)
        .select({ useCaseJa: settingsReference.useCaseJa })
        .from(settingsReference);
      expect(rows).toHaveLength(31);
      expect(rows.every((row) => row.useCaseJa === null)).toBe(true);
    } finally {
      await instance.dispose();
    }
  });

  it('翻訳が使えない応答を返し続けたとき、そのバッチを保存せずに Workflow を完了し、失敗 Issue もビルドも起こさないこと', async () => {
    await seedSettingSchema();
    mockAi({
      settings_translation: () => chatCompletion({ results: [{ id: 'invalid' }] }),
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      throw new Error(`想定外の外部リクエスト: ${String(input)}`);
    });
    const instanceId = `issue-1040-translation-giveup-${crypto.randomUUID()}`;
    const instance = await introspectWorkflowInstance(
      testEnv.SETTINGS_REFERENCE_WORKFLOW,
      instanceId,
    );

    try {
      await instance.modify(async (modifier) => {
        await modifier.disableRetryDelays();
      });
      await testEnv.SETTINGS_REFERENCE_WORKFLOW.create({
        id: instanceId,
        params: {},
      });
      await expect(instance.waitForStatus('complete')).resolves.not.toThrow();
      await expect(instance.getOutput()).resolves.toEqual({ processedKeys: [] });
      await expect(drizzle(testEnv.DB).select().from(settingsReference)).resolves.toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      await instance.dispose();
    }
  });

  it('用途だけが使えない応答を返し続けたとき、説明を保存し、用途を NULL にすること', async () => {
    await seedSettingSchema();
    await seedDocument();
    mockAi({
      settings_translation: () => translationResponse(1),
      settings_use_case: () => chatCompletion({ use_cases_ja: 1 }),
    });
    mockDeployHook();
    const instanceId = `issue-1040-use-case-giveup-${crypto.randomUUID()}`;
    const instance = await introspectWorkflowInstance(
      testEnv.SETTINGS_REFERENCE_WORKFLOW,
      instanceId,
    );

    try {
      await instance.modify(async (modifier) => {
        await modifier.disableRetryDelays();
      });
      await testEnv.SETTINGS_REFERENCE_WORKFLOW.create({
        id: instanceId,
        params: {},
      });
      await expect(instance.waitForStatus('complete')).resolves.not.toThrow();
      await expect(
        drizzle(testEnv.DB)
          .select({
            key: settingsReference.key,
            descriptionJa: settingsReference.descriptionJa,
            useCaseJa: settingsReference.useCaseJa,
          })
          .from(settingsReference),
      ).resolves.toEqual([
        {
          key: 'permissions.additionalDirectories',
          descriptionJa: '説明 0です。',
          useCaseJa: null,
        },
      ]);
    } finally {
      await instance.dispose();
    }
  });

  it('AI の呼び出し自体が失敗し続けたとき、失敗 Issue を作成して Workflow を失敗させること', async () => {
    await seedSettingSchema();
    const aiRun = vi.spyOn(testEnv.AI, 'run').mockRejectedValue(new Error('network error'));
    let issueCreationCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/issues?') && init?.method === 'GET') {
        return Response.json([]);
      }
      if (url.endsWith('/issues') && init?.method === 'POST') {
        issueCreationCount += 1;
        return Response.json({ number: 961 }, { status: 201 });
      }
      if (url.endsWith('/issues/961/labels') && init?.method === 'POST') {
        return Response.json([]);
      }
      throw new Error(`想定外の外部リクエスト: ${url}`);
    });
    const instanceId = `issue-902-failure-${crypto.randomUUID()}`;
    const instance = await introspectWorkflowInstance(
      testEnv.SETTINGS_REFERENCE_WORKFLOW,
      instanceId,
    );

    try {
      await instance.modify(async (modifier) => {
        await modifier.disableRetryDelays();
      });
      await testEnv.SETTINGS_REFERENCE_WORKFLOW.create({
        id: instanceId,
        params: {},
      });
      await expect(instance.waitForStatus('errored')).resolves.not.toThrow();
      // 初回と再試行 3 回
      expect(aiRun).toHaveBeenCalledTimes(4);
      expect(issueCreationCount).toBe(1);
    } finally {
      await instance.dispose();
    }
  });
});

function mockDeployHook() {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    if (String(input) === 'https://deploy.example/hook') {
      return new Response(null, { status: 200 });
    }
    throw new Error(`想定外の外部リクエスト: ${String(input)}`);
  });
}

async function seedSettingSchema(count = 1): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    const key = index === 0 ? 'permissions.additionalDirectories' : `permissions.setting${index}`;
    await testEnv.DOCS_DB.prepare(
      `INSERT INTO setting_schema_entries
       (key, source, description, parent_descriptions, value_type, default_value, enum_values)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        key,
        'settings',
        'Additional directories allowed for access.',
        JSON.stringify(['Permission settings']),
        index === 0 ? 'array' : 'string',
        index === 0 ? '[]' : null,
        null,
      )
      .run();
  }
}

async function seedDocument(): Promise<void> {
  await testEnv.DOCS_DB.prepare(
    `INSERT INTO page_chunks_fts (content, path, heading, chunk_index)
       VALUES (?, ?, ?, ?)`,
  )
    .bind(
      'Set `additionalDirectories` to grant access to extra directories.',
      'permissions.md',
      'Permissions',
      0,
    )
    .run();
}
