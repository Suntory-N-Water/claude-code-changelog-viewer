import type { AppLogger } from '@claude-code-changelog-viewer/common';
import type { IssueCorpusEntry } from '@claude-code-changelog-viewer/types';
import type {
  AnthropicIssuesClient,
  IssueCommentItem,
  SearchIssueItem,
} from '../infrastructure/github/anthropic-issues-client';
import type {
  IssuesCorpusStore,
  IssuesFetchMetadata,
} from '../infrastructure/filesystem/issues-corpus-store';

const TOP_COMMENTS_LIMIT = 3;
const TOP_COMMENT_MAX_CHARS = 500;
const BODY_TRUNCATE_BYTES = 4 * 1024;
const DUPLICATE_PARENT_MIN_MENTIONS = 3;
const MAINTAINER_ASSOCIATIONS = new Set(['MEMBER', 'OWNER', 'COLLABORATOR']);
const DUPLICATE_BOT_LOGIN = 'github-actions[bot]';
const DUPLICATE_HEADER_PATTERN =
  /Found\s+\d+\s+possible\s+duplicate\s+issues?:/i;
const DUPLICATE_ISSUE_LINK_PATTERN = /#(\d{1,6})\b/g;

export type FetchIssueCorpusInput = {
  client: AnthropicIssuesClient;
  store: IssuesCorpusStore;
  maintainerHandles: string[];
  fullScan: boolean;
  enrichAuthorAssociation: boolean;
  // ISO 日付 (YYYY-MM-DD)。初回 seed で Search API の 1000 件制約を回避するため
  // 期間分割走行するときに指定する
  since?: string;
  until?: string;
  logger: AppLogger;
};

export type FetchIssueCorpusResult = {
  fetched: number;
  metadata: IssuesFetchMetadata;
};

export async function fetchIssueCorpus(
  input: FetchIssueCorpusInput,
): Promise<FetchIssueCorpusResult> {
  const runStartedAt = new Date().toISOString();
  const previousMetadata = await input.store.loadMetadata();
  const lastFetch = input.fullScan ? undefined : previousMetadata?.last_fetch;

  const filters: string[] = [];
  if (lastFetch) {
    filters.push(`updated:>=${lastFetch}`);
  }
  if (input.since) {
    filters.push(`created:>=${input.since}`);
  }
  if (input.until) {
    filters.push(`created:<=${input.until}`);
  }
  const timeFilter = filters.join(' ');

  const encountered = new Map<number, SearchIssueItem>();
  const maintainerHits = new Set<number>();
  const duplicateChildren: SearchIssueItem[] = [];

  const heatQueries = [
    joinQuery('is:issue reactions:>=10', timeFilter),
    joinQuery('is:issue comments:>=10', timeFilter),
  ];
  const maintainerQueries = input.maintainerHandles.map((handle) =>
    joinQuery(`is:issue commenter:${handle}`, timeFilter),
  );
  const duplicateBaseQuery = joinQuery(
    'is:issue is:closed reason:not-planned',
    timeFilter,
  );

  // 並列化すると GitHub Search API の secondary rate limit (abuse detection)
  // が発火して 403 になる。1000 件制約は since/until で time-slice する運用に任せ、
  // レーン間は逐次に叩く
  const collect = async (
    query: string,
    onItem?: (item: SearchIssueItem) => void,
  ): Promise<void> => {
    for await (const item of input.client.searchIssues(query)) {
      encountered.set(item.number, item);
      onItem?.(item);
    }
  };

  for (const q of heatQueries) {
    await collect(q);
  }
  for (const q of maintainerQueries) {
    await collect(q, (item) => maintainerHits.add(item.number));
  }
  await collect(duplicateBaseQuery, (item) => duplicateChildren.push(item));

  input.logger.info(
    `Search API 完了: encountered=${encountered.size} maintainerHits=${maintainerHits.size} duplicateChildren=${duplicateChildren.length}`,
  );

  const duplicateParentCounts = new Map<number, number>();
  for (const child of duplicateChildren) {
    const comments = await input.client.listIssueComments(child.number);
    for (const parent of extractDuplicateParents(comments)) {
      duplicateParentCounts.set(
        parent,
        (duplicateParentCounts.get(parent) ?? 0) + 1,
      );
    }
  }
  const forcedParents = [...duplicateParentCounts.entries()]
    .filter(([, count]) => count >= DUPLICATE_PARENT_MIN_MENTIONS)
    .map(([number]) => number);

  for (const parentNumber of forcedParents) {
    if (encountered.has(parentNumber)) {
      continue;
    }
    for await (const item of input.client.searchIssues(
      `${input.client.repoQualifier} is:issue in:title,body ${parentNumber}`,
    )) {
      if (item.number === parentNumber) {
        encountered.set(parentNumber, item);
        break;
      }
    }
  }

  for (const item of encountered.values()) {
    const isMaintainerHit = maintainerHits.has(item.number);
    let enrichedComments: IssueCommentItem[] | null = null;
    let maintainerViaComments = false;

    if (
      input.enrichAuthorAssociation &&
      !isMaintainerHit &&
      item.comments > 0
    ) {
      enrichedComments = await input.client.listIssueComments(item.number);
      maintainerViaComments = enrichedComments.some((c) =>
        MAINTAINER_ASSOCIATIONS.has(c.author_association),
      );
    }

    const entry = toCorpusEntry({
      item,
      isMaintainerInvolved: isMaintainerHit || maintainerViaComments,
      duplicateOf: duplicateParentCounts.has(item.number)
        ? undefined
        : firstDuplicateParent(item, enrichedComments),
      comments: enrichedComments,
    });
    await input.store.saveEntry(entry);
  }

  const newMetadata: IssuesFetchMetadata = { last_fetch: runStartedAt };
  await input.store.saveMetadata(newMetadata);

  return { fetched: encountered.size, metadata: newMetadata };
}

function joinQuery(base: string, timeFilter: string): string {
  return timeFilter ? `${base} ${timeFilter}` : base;
}

function extractDuplicateParents(comments: IssueCommentItem[]): number[] {
  const parents: number[] = [];
  for (const comment of comments) {
    if (comment.user?.login !== DUPLICATE_BOT_LOGIN) {
      continue;
    }
    const body = comment.body ?? '';
    if (!DUPLICATE_HEADER_PATTERN.test(body)) {
      continue;
    }
    for (const match of body.matchAll(DUPLICATE_ISSUE_LINK_PATTERN)) {
      const n = Number.parseInt(match[1] ?? '', 10);
      if (Number.isInteger(n) && n > 0) {
        parents.push(n);
      }
    }
  }
  return parents;
}

function firstDuplicateParent(
  item: SearchIssueItem,
  comments: IssueCommentItem[] | null,
): number | undefined {
  if (item.state_reason !== 'duplicate' || !comments) {
    return;
  }
  const parents = extractDuplicateParents(comments);
  return parents[0];
}

function toCorpusEntry(input: {
  item: SearchIssueItem;
  isMaintainerInvolved: boolean;
  duplicateOf: number | undefined;
  comments: IssueCommentItem[] | null;
}): IssueCorpusEntry {
  const { item } = input;
  return {
    number: item.number,
    title: item.title,
    body: truncateBytes(item.body ?? '', BODY_TRUNCATE_BYTES),
    labels: item.labels.map((l) =>
      typeof l === 'string' ? l : (l.name ?? ''),
    ),
    state: item.state === 'closed' ? 'closed' : 'open',
    state_reason: item.state_reason ?? null,
    created_at: item.created_at,
    updated_at: item.updated_at,
    closed_at: item.closed_at ?? null,
    reactions_total: item.reactions?.total_count ?? 0,
    comments_count: item.comments,
    author: item.user?.login ?? '',
    is_maintainer_involved: input.isMaintainerInvolved,
    ...(input.duplicateOf !== undefined
      ? { duplicate_of: input.duplicateOf }
      : {}),
    top_comments: pickTopComments(input.comments ?? []),
  };
}

function pickTopComments(
  comments: IssueCommentItem[],
): IssueCorpusEntry['top_comments'] {
  const maintainer = comments.filter((c) =>
    MAINTAINER_ASSOCIATIONS.has(c.author_association),
  );
  const others = comments.filter(
    (c) => !MAINTAINER_ASSOCIATIONS.has(c.author_association),
  );
  return [...maintainer, ...others].slice(0, TOP_COMMENTS_LIMIT).map((c) => ({
    author: c.user?.login ?? '',
    author_association: c.author_association,
    body: (c.body ?? '').slice(0, TOP_COMMENT_MAX_CHARS),
    created_at: c.created_at,
  }));
}

function truncateBytes(text: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  if (bytes.length <= maxBytes) {
    return text;
  }
  const decoder = new TextDecoder('utf-8', { fatal: false });
  return decoder.decode(bytes.slice(0, maxBytes)).replace(/�+$/g, '');
}
