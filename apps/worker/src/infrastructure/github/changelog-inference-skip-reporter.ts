import { getLogger } from '@claude-code-changelog-viewer/common';
import { createGitHubHeaders } from './github-headers';
import type { ChangelogInferenceSkipReporterPort } from '../../usecases/changelog-inference-workflow';

const ISSUE_URL =
  'https://api.github.com/repos/Suntory-N-Water/claude-code-changelog-viewer/issues';

const logger = getLogger({
  name: 'infrastructure.github.changelog-inference-skip-reporter',
  serviceName: 'changelog-viewer-worker',
  level: 'INFO',
  format: 'json',
});

type GitHubIssueListItem = {
  readonly number: number;
  readonly body: string | null;
};

export function createChangelogInferenceSkipReporter(
  githubToken: string,
): ChangelogInferenceSkipReporterPort {
  return {
    async report({ version, items }) {
      // バージョンごとに 1 本にする。ラベルだけで重複を判定すると、別バージョンの
      // 未解決 Issue が open な間ずっと新しい取りこぼしが記録されなくなる
      const marker = `<!-- inference-skipped:${version} -->`;
      if (await findOpenIssue(githubToken, marker)) {
        logger.info('推論を諦めた項目の Issue は作成済みです', {
          'changelog.version': version,
        });
        return;
      }

      const body = [
        marker,
        '',
        `## 推論を諦めた項目`,
        '',
        `バージョン ${version} の ${items.length} 項目で、AI 応答が出力上限で打ち切られ続けたため、`,
        '推論と翻訳を行わずに英語原文のまま保存しました。',
        '',
        ...items.flatMap((item) => [
          `### \`${item.id}\``,
          '',
          '```text',
          item.content,
          '```',
          '',
          `最後のエラー: ${item.reason}`,
          '',
        ]),
        '再処理の方法を決めるまで、この Issue を open のままにしてください。',
      ].join('\n');

      const response = await fetch(ISSUE_URL, {
        method: 'POST',
        headers: {
          ...createGitHubHeaders(githubToken, 'application/vnd.github+json'),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: `${version} の ${items.length} 項目で推論を諦めました`,
          body,
          labels: ['inference-skipped', 'workflow:changelog-auto-inference'],
        }),
      });
      if (!response.ok) {
        throw new Error(
          `推論を諦めた項目の Issue 作成に失敗しました: ${response.status} ${response.statusText}`,
        );
      }
      logger.info('推論を諦めた項目の Issue を作成しました', {
        'changelog.version': version,
        'changelog.skipped_item_count': items.length,
      });
    },
  };
}

async function findOpenIssue(
  githubToken: string,
  marker: string,
): Promise<boolean> {
  for (let page = 1; ; page += 1) {
    const url = new URL(ISSUE_URL);
    url.searchParams.set('state', 'open');
    url.searchParams.set('per_page', '100');
    url.searchParams.set('page', String(page));
    const response = await fetch(url, {
      method: 'GET',
      headers: createGitHubHeaders(githubToken, 'application/vnd.github+json'),
    });
    if (!response.ok) {
      throw new Error(
        `既存 Issue の取得に失敗しました: ${response.status} ${response.statusText}`,
      );
    }
    const issues = await response.json<GitHubIssueListItem[]>();
    if (issues.some((issue) => issue.body?.includes(marker) === true)) {
      return true;
    }
    if (issues.length < 100) {
      return false;
    }
  }
}
