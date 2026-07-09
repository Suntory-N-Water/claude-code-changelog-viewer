import type { IssueCommentItem } from '../../infrastructure/github/anthropic-issues-client';

export const MAINTAINER_ASSOCIATIONS = new Set([
  'MEMBER',
  'OWNER',
  'COLLABORATOR',
]);

export type MaintainerDeclaration = {
  user: string;
  publishedAt: string;
  body: string;
  url: string;
};

export function buildDeclarationRegex(version: string): RegExp {
  const escaped = version.replace(/\./g, '\\.');
  return new RegExp(`fixed\\s+in\\s+\\*?\\*?v?${escaped}\\*?\\*?(?!\\d)`, 'i');
}

export function extractDeclarationFromComment(
  comment: IssueCommentItem,
  version: string,
): MaintainerDeclaration | null {
  if (
    !comment.author_association ||
    !MAINTAINER_ASSOCIATIONS.has(comment.author_association)
  ) {
    return null;
  }

  const regex = buildDeclarationRegex(version);
  if (!comment.body || !regex.test(comment.body)) {
    return null;
  }

  return {
    user: comment.user?.login ?? 'unknown',
    publishedAt: comment.created_at,
    body: comment.body,
    url: comment.html_url,
  };
}
