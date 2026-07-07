export type RelatedIssueMatchedReason =
  | 'direct_reference'
  | 'strong_token'
  | 'cosine';

export type RelatedIssueScores = {
  total: number;
  hasNnn: number;
  strongToken: number;
  cosine: number;
};

export type RelatedIssue = {
  number: number;
  title: string;
  url: string;
  state: 'open' | 'closed';
  reactionsTotal: number;
  commentsCount: number;
  matchedReason: RelatedIssueMatchedReason;
  isMaintainerInvolved: boolean;
  duplicateOf?: number;
  scores: RelatedIssueScores;
};
