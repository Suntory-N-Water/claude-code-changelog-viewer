const USER_AGENT = 'changelog-viewer-worker-changelog-detection';

/** GitHub API 呼び出しに共通するヘッダーを組み立てる。 */
export function createGitHubHeaders(token: string, accept: string) {
  return {
    Accept: accept,
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': USER_AGENT,
  };
}
