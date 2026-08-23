import { describe, expect, it, vi } from 'vitest';
import { createChangelogWorkflowFailureReporter } from './changelog-workflow-failure-reporter';
import { createD1BackupFailureReporter } from './d1-backup-failure-reporter';
import { createSettingsReferenceFailureReporter } from './settings-reference-failure-reporter';

const changelogFailure = {
  params: {
    detectedHash: 'a'.repeat(64),
    detectedAt: '2026-08-20T20:35:06.978Z',
  },
  instanceId: 'changelog-inference-1',
  error: new Error('推論失敗'),
};

const reporterCases = [
  {
    name: 'CHANGELOG 推論 Workflow',
    workflowLabel: 'workflow:changelog-auto-inference',
    createReport: (githubToken: string) => async () =>
      createChangelogWorkflowFailureReporter(githubToken).report(
        changelogFailure,
      ),
  },
  {
    name: '設定リファレンス生成 Workflow',
    workflowLabel: 'workflow:generate-settings-reference',
    createReport: (githubToken: string) => async () =>
      createSettingsReferenceFailureReporter(githubToken).report({
        params: {},
        instanceId: 'settings-reference-1',
        error: new Error('推論失敗'),
      }),
  },
  {
    name: 'D1 バックアップ Workflow',
    workflowLabel: 'workflow:d1-backup',
    createReport: (githubToken: string) => async () =>
      createD1BackupFailureReporter(githubToken).report({
        instanceId: 'd1-backup-1',
        error: new Error('バックアップ失敗'),
      }),
  },
] as const;

type StoredIssue = {
  number: number;
  title: string;
  body: string | null;
  labels: string[];
};

function installGitHubIssueApi(
  initialIssues: StoredIssue[] = [],
  { rejectLabeling = false }: { rejectLabeling?: boolean } = {},
): StoredIssue[] {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';

    if (method === 'GET') {
      return Response.json(
        initialIssues.map(({ labels, ...issue }) => ({
          ...issue,
          labels: labels.map((name) => ({ name })),
        })),
      );
    }
    if (method === 'POST' && url.endsWith('/issues')) {
      const payload = JSON.parse(String(init?.body)) as {
        title?: unknown;
        body?: unknown;
        labels?: unknown;
      };
      const issue = {
        number: Math.max(960, ...initialIssues.map(({ number }) => number)) + 1,
        title: typeof payload.title === 'string' ? payload.title : '',
        body: typeof payload.body === 'string' ? payload.body : null,
        labels: Array.isArray(payload.labels)
          ? payload.labels.filter(
              (label): label is string => typeof label === 'string',
            )
          : [],
      };
      initialIssues.push(issue);
      return Response.json({ number: issue.number }, { status: 201 });
    }
    const labelRequest = /\/issues\/(\d+)\/labels$/.exec(url);
    if (method === 'POST' && labelRequest !== null) {
      if (rejectLabeling) {
        return new Response(null, { status: 403, statusText: 'Forbidden' });
      }
      const issue = initialIssues.find(
        ({ number }) => number === Number(labelRequest[1]),
      );
      if (issue === undefined) {
        throw new Error(`ラベル付与対象の Issue がありません: ${url}`);
      }
      const payload = JSON.parse(String(init?.body)) as { labels?: unknown };
      const labels = Array.isArray(payload.labels)
        ? payload.labels.filter(
            (label): label is string => typeof label === 'string',
          )
        : [];
      issue.labels = [...new Set([...issue.labels, ...labels])];
      return new Response(null, { status: 200 });
    }
    throw new Error(`想定外の GitHub API リクエスト: ${method} ${url}`);
  });
  return initialIssues;
}

describe('Workflow 失敗 Issue', () => {
  it.each(reporterCases)(
    '$name は同じ失敗が再通知されても、Issue を1件だけ作成して必要なラベルを付けること',
    async ({ workflowLabel, createReport }) => {
      const issues = installGitHubIssueApi();
      const report = createReport('github-token');

      await report();
      expect(issues).toHaveLength(1);
      const createdIssue = issues[0];
      if (createdIssue === undefined) {
        throw new Error('作成された Issue が保存されていません');
      }
      expect(createdIssue.labels).toEqual(
        expect.arrayContaining(['automated-failure', workflowLabel, 'bug']),
      );

      createdIssue.title = '人が変更したタイトル';
      createdIssue.body = '人が変更した本文';
      await report();

      expect(issues).toHaveLength(1);
    },
  );

  it('機械識別子だけがある open Issue は作成せず、不足ラベルを補うこと', async () => {
    const issues = installGitHubIssueApi([
      {
        number: 951,
        title: '任意のタイトル',
        body: '<!-- automated-failure:changelog-auto-inference -->',
        labels: [],
      },
    ]);
    const reporter = createChangelogWorkflowFailureReporter('github-token');

    await reporter.report(changelogFailure);

    expect(issues).toHaveLength(1);
    expect(issues[0]?.labels).toEqual(
      expect.arrayContaining([
        'automated-failure',
        'workflow:changelog-auto-inference',
        'bug',
      ]),
    );
  });

  it('ラベル付与が拒否されても、Issue 作成は成功として扱うこと', async () => {
    const issues = installGitHubIssueApi([], { rejectLabeling: true });
    const reporter = createChangelogWorkflowFailureReporter('github-token');

    await expect(reporter.report(changelogFailure)).resolves.toBeUndefined();
    expect(issues).toHaveLength(1);
  });

  it('別 Workflow の open Issue がある時、CHANGELOG 用 Issue は作成すること', async () => {
    const issues = installGitHubIssueApi([
      {
        number: 951,
        title: 'D1 バックアップ Workflow に失敗',
        body: null,
        labels: ['automated-failure', 'workflow:d1-backup', 'bug'],
      },
    ]);
    const reporter = createChangelogWorkflowFailureReporter('github-token');

    await reporter.report(changelogFailure);

    expect(issues).toHaveLength(2);
    expect(issues[1]?.labels).toEqual(
      expect.arrayContaining([
        'automated-failure',
        'workflow:changelog-auto-inference',
        'bug',
      ]),
    );
  });
});
