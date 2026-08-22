import { applyD1Migrations, introspectWorkflowInstance } from 'cloudflare:test';
import type { D1Migration } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  changelogItems,
  settingsOfficialDocs,
  settingsReference,
} from '../db/schema';

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
    model: '@cf/zai-org/glm-4.7-flash',
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

describe('設定リファレンス生成 Workflow', () => {
  beforeEach(async () => {
    await applyD1Migrations(testEnv.DB, testEnv.TEST_NOTIFICATION_MIGRATIONS);
    await applyD1Migrations(
      testEnv.DOCS_DB,
      testEnv.TEST_DOCS_SEARCH_MIGRATIONS,
    );

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

  it('AI 出力と D1 格納を分け、保存再試行で AI を再実行しない', async () => {
    await seedSettingSchema();
    await seedDocument();
    const db = drizzle(testEnv.DB);
    await db.insert(changelogItems).values({
      version: '2.1.234',
      itemId: 'setting-item',
      content: '- Added permissions.additionalDirectories support',
      contentJa: 'permissions.additionalDirectories のサポートを追加しました。',
      prefix: 'Added',
      inferenceBefore: '追加ディレクトリを指定できませんでした。',
      inferenceAfter: '追加ディレクトリを指定できるようになりました。',
      inferenceBenefit: '必要な作業領域へアクセスできます。',
      searchText: 'permissions.additionaldirectories',
    });

    const aiRun = vi.spyOn(testEnv.AI, 'run').mockResolvedValue(
      chatCompletion({
        results: [
          {
            id: 0,
            description_ja: 'アクセスを許可する追加ディレクトリです。',
            use_case_ja:
              '- プロジェクト外のディレクトリを参照する場合に使います。',
          },
        ],
      }),
    );
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
        await modifier.mockStepError(
          { name: 'store-0' },
          new Error('保存の一時的な失敗'),
          1,
        );
      });

      await testEnv.SETTINGS_REFERENCE_WORKFLOW.create({
        id: instanceId,
        params: {},
      });

      await expect(instance.waitForStatus('complete')).resolves.not.toThrow();
      await expect(instance.getOutput()).resolves.toEqual({
        processedKeys: ['permissions.additionalDirectories'],
      });
      expect(aiRun).toHaveBeenCalledTimes(1);

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

    const aiRun = vi.spyOn(testEnv.AI, 'run').mockResolvedValue(
      chatCompletion({
        results: [
          {
            id: 0,
            description_ja: '再生成した説明です。',
            use_case_ja: '',
          },
        ],
      }),
    );
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
    const target = await introspectWorkflowInstance(
      testEnv.SETTINGS_REFERENCE_WORKFLOW,
      targetId,
    );
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

  it('31件の設定項目を30件ずつの AI バッチに分ける', async () => {
    await seedSettingSchema(31);
    let callCount = 0;
    const aiRun = vi.spyOn(testEnv.AI, 'run').mockImplementation(async () => {
      const count = callCount === 0 ? 30 : 1;
      callCount += 1;
      return chatCompletion({
        results: Array.from({ length: count }, (_, id) => ({
          id,
          description_ja: `説明 ${id}です。`,
          use_case_ja: '',
        })),
      });
    });
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input) === 'https://deploy.example/hook') {
        return new Response(null, { status: 200 });
      }
      throw new Error(`想定外の外部リクエスト: ${String(input)}`);
    });
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
      expect(aiRun).toHaveBeenCalledTimes(2);
    } finally {
      await instance.dispose();
    }
  });

  it('AI 応答が不正な時、失敗 Issue を作成して Workflow を失敗させる', async () => {
    await seedSettingSchema();
    const aiRun = vi
      .spyOn(testEnv.AI, 'run')
      .mockResolvedValue(chatCompletion({ results: [{ id: 'invalid' }] }));
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
      expect(aiRun).toHaveBeenCalledTimes(6);
      expect(issueCreationCount).toBe(1);
    } finally {
      await instance.dispose();
    }
  });
});

async function seedSettingSchema(count = 1): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    const key =
      index === 0
        ? 'permissions.additionalDirectories'
        : `permissions.setting${index}`;
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
