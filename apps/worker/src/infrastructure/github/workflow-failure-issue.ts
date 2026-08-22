import { createGitHubHeaders } from './github-headers';

const FAILURE_ISSUE_URL =
  'https://api.github.com/repos/Suntory-N-Water/claude-code-changelog-viewer/issues';

type GitHubIssueListItem = {
  readonly number: number;
  readonly body: string | null;
  readonly labels: ReadonlyArray<{ readonly name: string }>;
};

type WorkflowFailureIssue = {
  readonly title: string;
  readonly description: string;
  readonly workflowLabel: `workflow:${string}`;
};

function hasAllLabels(
  issue: GitHubIssueListItem,
  labels: readonly string[],
): boolean {
  return labels.every((label) =>
    issue.labels.some((issueLabel) => issueLabel.name === label),
  );
}

async function addFailureIssueLabels(
  githubToken: string,
  issueNumber: number,
  labels: readonly string[],
): Promise<void> {
  const response = await fetch(`${FAILURE_ISSUE_URL}/${issueNumber}/labels`, {
    method: 'POST',
    headers: {
      ...createGitHubHeaders(githubToken, 'application/vnd.github+json'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ labels }),
  });
  if (!response.ok) {
    throw new Error(
      `失敗通知 Issue のラベル付与に失敗しました: ${response.status} ${response.statusText}`,
    );
  }
}

export async function reportWorkflowFailureIssue(
  githubToken: string,
  { title, description, workflowLabel }: WorkflowFailureIssue,
): Promise<void> {
  const duplicateLabels = ['automated-failure', workflowLabel] as const;
  const issueLabels = [...duplicateLabels, 'bug'] as const;
  const issueMarker = `<!-- automated-failure:${workflowLabel.slice('workflow:'.length)} -->`;
  let page = 1;
  let existingIssue: GitHubIssueListItem | undefined;

  while (existingIssue === undefined) {
    const existingIssuesUrl = new URL(FAILURE_ISSUE_URL);
    existingIssuesUrl.searchParams.set('state', 'open');
    existingIssuesUrl.searchParams.set('per_page', '100');
    existingIssuesUrl.searchParams.set('page', String(page));
    const response = await fetch(existingIssuesUrl, {
      method: 'GET',
      headers: createGitHubHeaders(githubToken, 'application/vnd.github+json'),
    });
    if (!response.ok) {
      throw new Error(
        `既存の失敗通知 Issue の取得に失敗しました: ${response.status} ${response.statusText}`,
      );
    }
    const issues = await response.json<GitHubIssueListItem[]>();
    existingIssue = issues.find(
      (issue) =>
        issue.body?.includes(issueMarker) === true ||
        hasAllLabels(issue, duplicateLabels),
    );
    if (existingIssue !== undefined || issues.length < 100) {
      break;
    }
    page += 1;
  }

  if (existingIssue !== undefined) {
    if (!hasAllLabels(existingIssue, issueLabels)) {
      await addFailureIssueLabels(
        githubToken,
        existingIssue.number,
        issueLabels,
      );
    }
    return;
  }

  const response = await fetch(FAILURE_ISSUE_URL, {
    method: 'POST',
    headers: {
      ...createGitHubHeaders(githubToken, 'application/vnd.github+json'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title,
      body: [issueMarker, '', description].join('\n'),
      labels: issueLabels,
    }),
  });
  if (!response.ok) {
    throw new Error(
      `失敗通知 Issue の作成に失敗しました: ${response.status} ${response.statusText}`,
    );
  }
  const createdIssue = await response.json<{ number: unknown }>();
  if (typeof createdIssue.number !== 'number') {
    throw new Error('失敗通知 Issue の作成結果に Issue 番号がありません');
  }
  await addFailureIssueLabels(githubToken, createdIssue.number, issueLabels);
}
