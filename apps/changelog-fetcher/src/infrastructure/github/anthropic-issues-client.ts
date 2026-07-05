import {
  type AppLogger,
  getLogger,
} from '@claude-code-changelog-viewer/common';
import { retry } from '@octokit/plugin-retry';
import { throttling } from '@octokit/plugin-throttling';
import { Octokit } from '@octokit/rest';

const IssuesOctokit = Octokit.plugin(retry, throttling);
type OctokitInstance = InstanceType<typeof IssuesOctokit>;

export type SearchIssueItem = Awaited<
  ReturnType<OctokitInstance['rest']['search']['issuesAndPullRequests']>
>['data']['items'][number];

export type IssueCommentItem = Awaited<
  ReturnType<OctokitInstance['rest']['issues']['listComments']>
>['data'][number];

const REPO_OWNER = 'anthropics';
const REPO_NAME = 'claude-code';
const MAX_RETRY_COUNT = 3;

type ClientOptions = {
  token: string;
  logger?: AppLogger;
};

export class AnthropicIssuesClient {
  private readonly octokit: InstanceType<typeof IssuesOctokit>;
  private readonly log: AppLogger;

  constructor(options: ClientOptions) {
    if (!options.token) {
      throw new Error('GITHUB_TOKEN environment variable is required');
    }
    this.log = options.logger ?? getLogger({ name: 'anthropic-issues-client' });

    const log = this.log;
    this.octokit = new IssuesOctokit({
      auth: options.token,
      throttle: {
        // biome-ignore lint/complexity/useMaxParams: octokit throttling plugin API signature
        onRateLimit: (retryAfter, requestOptions, _octokit, retryCount) => {
          log.warn(
            `rate limit: retryAfter=${retryAfter}s method=${requestOptions.method} url=${requestOptions.url} attempt=${retryCount + 1}`,
          );
          return retryCount < MAX_RETRY_COUNT;
        },
        // biome-ignore lint/complexity/useMaxParams: octokit throttling plugin API signature
        onSecondaryRateLimit: (
          retryAfter,
          requestOptions,
          _octokit,
          retryCount,
        ) => {
          log.warn(
            `secondary rate limit: retryAfter=${retryAfter}s method=${requestOptions.method} url=${requestOptions.url} attempt=${retryCount + 1}`,
          );
          return retryCount < MAX_RETRY_COUNT;
        },
      },
    });
  }

  // GitHub Search API の Issues endpoint。q は "repo:..." 修飾子を含む完全なクエリ。
  // page 単位でストリーミングし、pagination は octokit.paginate.iterator に委譲。
  async *searchIssues(q: string): AsyncGenerator<SearchIssueItem> {
    const iterator = this.octokit.paginate.iterator(
      this.octokit.rest.search.issuesAndPullRequests,
      { q, per_page: 100, advanced_search: 'true' },
    );
    for await (const page of iterator) {
      for (const item of page.data) {
        // Search API の items[] は PR も含み得るので、pull_request がある要素は捨てる。
        if (!('pull_request' in item) || item.pull_request === undefined) {
          yield item;
        }
      }
    }
  }

  async listIssueComments(issueNumber: number): Promise<IssueCommentItem[]> {
    return await this.octokit.paginate(this.octokit.rest.issues.listComments, {
      owner: REPO_OWNER,
      repo: REPO_NAME,
      issue_number: issueNumber,
      per_page: 100,
    });
  }

  get repoQualifier(): string {
    return `repo:${REPO_OWNER}/${REPO_NAME}`;
  }
}
