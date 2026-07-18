/**
 * @typedef {import("../types/actions.ts").ActionOptions} ActionOptions
 */

/**
 * 自動実行ワークフローの失敗時にIssueを作成する
 * 同じラベルのIssueが既に開いている場合は作成しない
 *
 * @param {ActionOptions} options
 */
module.exports = async function createAutomatedFailureIssue({
  github,
  context,
  core,
}) {
  try {
    const title = process.env.ISSUE_TITLE;
    const summary = process.env.ISSUE_SUMMARY;
    const labels = process.env.ISSUE_LABELS
      ? process.env.ISSUE_LABELS.split(',')
          .map((label) => label.trim())
          .filter(Boolean)
      : [];

    if (!title) {
      core.setFailed('ISSUE_TITLE 環境変数が必要です');
      return;
    }

    if (!summary) {
      core.setFailed('ISSUE_SUMMARY 環境変数が必要です');
      return;
    }

    if (labels.length === 0) {
      core.setFailed('ISSUE_LABELS 環境変数が必要です');
      return;
    }

    const workflowLabels = labels.filter((label) =>
      label.startsWith('workflow:'),
    );

    if (!labels.includes('automated-failure')) {
      core.setFailed('ISSUE_LABELS には automated-failure ラベルが必要です');
      return;
    }

    if (workflowLabels.length !== 1) {
      core.setFailed('ISSUE_LABELS には workflow:* ラベルが1つ必要です');
      return;
    }

    const duplicateLabels = ['automated-failure', workflowLabels[0]];

    const runUrl = [
      context.serverUrl,
      context.repo.owner,
      context.repo.repo,
      'actions/runs',
      context.runId,
    ].join('/');
    const failedJobsLines = (() => {
      const raw = process.env.FAILED_JOBS;
      if (!raw) {
        return [];
      }
      const lines = raw
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      if (lines.length === 0) {
        return [];
      }
      return ['', '**ジョブ結果**:', ...lines.map((line) => `- ${line}`)];
    })();
    const body = [
      '## エラー詳細',
      '',
      summary,
      '',
      `**ワークフロー**: ${context.workflow}`,
      `**実行ログ**: ${runUrl}`,
      `**実行時刻**: ${new Date().toISOString()}`,
      ...failedJobsLines,
      '',
      '詳細はワークフローログを確認してください。',
    ].join('\n');

    const existingIssues = await github.rest.issues.listForRepo({
      owner: context.repo.owner,
      repo: context.repo.repo,
      state: 'open',
      labels: duplicateLabels.join(','),
    });

    if (existingIssues.data.length > 0) {
      core.info('同じ失敗Issueが既に開いているため作成をスキップしました');
      return;
    }

    await github.rest.issues.create({
      owner: context.repo.owner,
      repo: context.repo.repo,
      title,
      body,
      labels,
    });
    core.info('Issueを作成しました');
  } catch (error) {
    core.setFailed(`Issue作成に失敗しました: ${error.message}`);
  }
};
