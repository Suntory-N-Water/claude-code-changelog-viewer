// 3 レーンの生値をまとめて top 5 を選ぶスコア融合。
// plan.md「スコア融合: `has_nnn × 1000 + strong × 1.0 + cosine × 1.0`, top 5 出力」
// 統合カットオフ: `has_nnn === 0 && strong === 0 && cosine < 0.5` は除外
// tiebreak: `reactions_total desc → updated_at desc`

import type { IssueCorpusEntry } from '@claude-code-changelog-viewer/types';
import type {
  RelatedIssue,
  RelatedIssueMatchedReason,
} from '../analysis/related-issue';

export type ScoringLaneInput = {
  hasNnn: number;
  strongToken: number;
  cosine: number;
};

export type CandidateForFusion = {
  entry: IssueCorpusEntry;
  lanes: ScoringLaneInput;
};

const COSINE_CUTOFF = 0.5;
const TOP_K = 5;
const ISSUE_URL_PREFIX = 'https://github.com/anthropics/claude-code/issues/';

export function fuseAndPickTop(
  candidates: CandidateForFusion[],
): RelatedIssue[] {
  const survivors = candidates.filter((c) => {
    const { hasNnn, strongToken, cosine } = c.lanes;
    if (hasNnn === 0 && strongToken === 0 && cosine < COSINE_CUTOFF) {
      return false;
    }
    return true;
  });

  const scored = survivors.map((c) => {
    const { hasNnn, strongToken, cosine } = c.lanes;
    const total = hasNnn * 1000 + strongToken * 1.0 + cosine * 1.0;
    return { candidate: c, total };
  });

  scored.sort((a, b) => {
    if (b.total !== a.total) {
      return b.total - a.total;
    }
    const reactionsDiff =
      b.candidate.entry.reactions_total - a.candidate.entry.reactions_total;
    if (reactionsDiff !== 0) {
      return reactionsDiff;
    }
    // updated_at は ISO 8601 なので文字列比較で desc になる
    return b.candidate.entry.updated_at.localeCompare(
      a.candidate.entry.updated_at,
    );
  });

  return scored.slice(0, TOP_K).map(({ candidate, total }) => {
    const { entry, lanes } = candidate;
    return {
      number: entry.number,
      title: entry.title,
      url: `${ISSUE_URL_PREFIX}${entry.number}`,
      state: entry.state,
      reactionsTotal: entry.reactions_total,
      commentsCount: entry.comments_count,
      matchedReason: pickMatchedReason(lanes),
      isMaintainerInvolved: entry.is_maintainer_involved,
      ...(entry.duplicate_of !== undefined
        ? { duplicateOf: entry.duplicate_of }
        : {}),
      scores: {
        total,
        hasNnn: lanes.hasNnn,
        strongToken: lanes.strongToken,
        cosine: lanes.cosine,
      },
    };
  });
}

// マッチ理由は「そのレーンでスコアが立った」順に優先度を付ける
function pickMatchedReason(lanes: ScoringLaneInput): RelatedIssueMatchedReason {
  if (lanes.hasNnn > 0) {
    return 'direct_reference';
  }
  if (lanes.strongToken > 0) {
    return 'strong_token';
  }
  return 'cosine';
}
