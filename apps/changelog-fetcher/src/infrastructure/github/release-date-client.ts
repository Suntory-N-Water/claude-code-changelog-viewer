import type { ReleaseInfoPort } from '../../usecase/weekly-post-generation';

type GitHubRelease = {
  tag_name: string;
  published_at: string;
};

export class GitHubReleaseDateClient implements ReleaseInfoPort {
  async fetchReleaseDates(): Promise<Map<string, string>> {
    const releaseDates = new Map<string, string>();

    for (let page = 1; page <= 3; page += 1) {
      const response = await fetch(
        `https://api.github.com/repos/anthropics/claude-code/releases?per_page=100&page=${page}`,
        { headers: { 'User-Agent': 'claude-code-changelog-viewer' } },
      );
      if (!response.ok) {
        throw new Error(`GitHub API: ${response.status}`);
      }

      const releases = (await response.json()) as GitHubRelease[];
      if (releases.length === 0) {
        break;
      }

      for (const release of releases) {
        releaseDates.set(
          release.tag_name.replace(/^v/, ''),
          release.published_at,
        );
      }

      if (releases.length < 100) {
        break;
      }
    }

    return releaseDates;
  }
}
