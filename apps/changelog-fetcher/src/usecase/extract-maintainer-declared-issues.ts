import type { AppLogger } from '@claude-code-changelog-viewer/common';
import type { AnthropicIssuesClient } from '../infrastructure/github/anthropic-issues-client';
import { extractDeclarationFromComment } from '../domain/tie-issue/maintainer-declaration';

export type MaintainerCandidate = {
  number: number;
  title: string;
  url: string;
  state: 'open' | 'closed';
  reactionsTotal: number;
  commentsCount: number;
  isMaintainerInvolved: boolean;
  maintainerDeclaration: {
    user: string;
    publishedAt: string;
    body: string;
    url: string;
  };
};

// version は "v2.1.98" のようなプレフィクス付き、または "2.1.98" のような数値のみ
function stripVersionPrefix(version: string): string {
  return version.replace(/^v/, '');
}

export async function extractMaintainerDeclaredIssues(input: {
  version: string;
  client: AnthropicIssuesClient;
  logger: AppLogger;
}): Promise<MaintainerCandidate[]> {
  const { version, client, logger } = input;
  const bare = stripVersionPrefix(version);
  const repo = client.repoQualifier;

  // "fixed in vX.X.X" と "fixed in X.X.X" の両方で検索し union
  const queries = [
    `"fixed in v${bare}" in:comments ${repo}`,
    `"fixed in ${bare}" in:comments ${repo}`,
  ];

  const seenNumbers = new Set<number>();
  const candidates: MaintainerCandidate[] = [];

  for (const q of queries) {
    logger.info(`GitHub Search: ${q}`);
    for await (const item of client.searchIssues(q)) {
      if (seenNumbers.has(item.number)) {
        continue;
      }
      seenNumbers.add(item.number);

      const comments = await client.listIssueComments(item.number);
      let declaration: MaintainerCandidate['maintainerDeclaration'] | null =
        null;
      for (const comment of comments) {
        const result = extractDeclarationFromComment(comment, bare);
        if (result) {
          declaration = result;
          break;
        }
      }

      if (!declaration) {
        continue;
      }

      candidates.push({
        number: item.number,
        title: item.title,
        url: item.html_url,
        state: item.state as 'open' | 'closed',
        reactionsTotal:
          (item.reactions as { total_count?: number } | undefined)
            ?.total_count ?? 0,
        commentsCount: item.comments ?? 0,
        isMaintainerInvolved: true,
        maintainerDeclaration: declaration,
      });
    }
  }

  logger.info(
    `maintainer 宣言候補: ${candidates.length}件 (version=${version})`,
  );
  return candidates;
}
