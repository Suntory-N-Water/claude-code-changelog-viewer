/** CHANGELOG 検知における workflow 起動の最大試行回数。 */
export const CHANGELOG_DETECTION_MAX_ATTEMPTS = 3;

/** CHANGELOG 検知の永続化状態。 */
export type ChangelogDetectionState = {
  readonly contentHash: string;
  readonly lastCheckedAt: string;
  readonly lastDispatchedAt: string;
  readonly lastDispatchedHash: string;
  readonly attempts: number;
  readonly confirmed: boolean;
};

/** workflow の実行状態を provider 非依存の表現へ変換した値。 */
export type ChangelogWorkflowStatus = 'pending' | 'succeeded' | 'failed';

/** CHANGELOG 検知状態を永続化する port。実装は infrastructure 層に置く。 */
export type ChangelogDetectionStateRepository = {
  load(): Promise<ChangelogDetectionState | null>;
  save(state: ChangelogDetectionState): Promise<void>;
};

export type ChangelogDetectionDecision =
  | {
      readonly action: 'dispatch';
      readonly state: ChangelogDetectionState;
    }
  | {
      readonly action: 'check_workflow';
      readonly state: ChangelogDetectionState;
    }
  | {
      readonly action: 'wait';
      readonly state: ChangelogDetectionState;
    }
  | {
      readonly action: 'confirmed';
      readonly state: ChangelogDetectionState;
    }
  | {
      readonly action: 'max_attempts';
      readonly state: ChangelogDetectionState;
    };

export type ChangelogDetectionDecisionInput = {
  readonly previous: ChangelogDetectionState | null;
  readonly contentHash: string;
  readonly checkedAt: string;
  readonly workflowStatus?: ChangelogWorkflowStatus;
};

/** 現在のハッシュと workflow 状態から、次の検知状態を決める。 */
export function decideChangelogDetection({
  previous,
  contentHash,
  checkedAt,
  workflowStatus,
}: ChangelogDetectionDecisionInput): ChangelogDetectionDecision {
  if (previous === null || previous.contentHash !== contentHash) {
    return {
      action: 'dispatch',
      state: {
        contentHash,
        lastCheckedAt: checkedAt,
        lastDispatchedAt: checkedAt,
        lastDispatchedHash: contentHash,
        attempts: 1,
        confirmed: false,
      },
    };
  }

  const checkedState = {
    ...previous,
    lastCheckedAt: checkedAt,
  };

  if (
    previous.confirmed ||
    previous.attempts >= CHANGELOG_DETECTION_MAX_ATTEMPTS
  ) {
    return { action: 'max_attempts', state: checkedState };
  }

  if (workflowStatus === undefined) {
    return { action: 'check_workflow', state: checkedState };
  }

  if (workflowStatus === 'succeeded') {
    return {
      action: 'confirmed',
      state: { ...checkedState, confirmed: true },
    };
  }

  if (workflowStatus === 'failed') {
    return {
      action: 'dispatch',
      state: {
        ...checkedState,
        lastDispatchedAt: checkedAt,
        attempts: previous.attempts + 1,
      },
    };
  }

  return { action: 'wait', state: checkedState };
}
