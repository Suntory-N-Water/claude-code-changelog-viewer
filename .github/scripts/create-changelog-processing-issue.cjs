/**
 * @typedef {import("../types/actions").ActionOptions} ActionOptions
 */

/**
 * CHANGELOGの処理エラー時にIssueを作成する
 * 重複チェックを行い、同じJob名のIssueが既に存在する場合は作成しない
 *
 * @param {ActionOptions} options
 */
module.exports = async ({ github, context, core }) => {
  try {
    const jobName = process.env.JOB_NAME;
    const versions = process.env.NEW_VERSIONS || '';

    if (!jobName) {
      core.setFailed('JOB_NAME environment variable is required');
      return;
    }

    const title = `Changelog processing failed - ${jobName}`;
    const body = `## エラー詳細

**Job名**: ${jobName}
**対象バージョン**: ${versions}
**Workflow run**: ${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}
**実行時刻**: ${new Date().toISOString()}

詳細はワークフローログを確認してください。`;

    // 重複チェック
    const existingIssues = await github.rest.issues.listForRepo({
      owner: context.repo.owner,
      repo: context.repo.repo,
      state: 'open',
      labels: 'bug,automated,changelog-processing',
    });

    const duplicate = existingIssues.data.find(
      (issue) =>
        issue.title.includes('Changelog processing failed') &&
        issue.title.includes(jobName),
    );

    if (!duplicate) {
      await github.rest.issues.create({
        owner: context.repo.owner,
        repo: context.repo.repo,
        title: title,
        body: body,
        labels: ['bug', 'automated', 'changelog-processing'],
      });
      core.info('✓ Issue created');
    } else {
      core.info('ℹ️ Duplicate issue already exists');
    }
  } catch (error) {
    core.setFailed(`Failed to create issue: ${error.message}`);
  }
};
