export type MaintainerDeclaration = {
  user: string;
  publishedAt: string;
  body: string;
  url: string;
};

export type RelatedIssue = {
  number: number;
  title: string;
  url: string;
  state: 'open' | 'closed';
  reactionsTotal: number;
  commentsCount: number;
  isMaintainerInvolved: boolean;
  maintainerDeclaration: MaintainerDeclaration;
};
