import {
  decideChangelogDetection,
  type ChangelogDetectionStateRepository,
  type ChangelogWorkflowStatus,
} from '../domain/changelog-detection/changelog-detection';

/** CHANGELOG 本文の取得・ハッシュ化を抽象化する port。 */
export type ChangelogSource = {
  fetchContentHash(): Promise<string>;
};

/** GitHub workflow の起動と実行状態取得を抽象化する port。 */
export type ChangelogWorkflow = {
  dispatch(input: {
    readonly hash: string;
    readonly detectedAt: string;
  }): Promise<void>;
  findStatus(dispatchedHash: string): Promise<ChangelogWorkflowStatus>;
};

export type DetectChangelogUpdateDependencies = {
  readonly source: ChangelogSource;
  readonly workflow: ChangelogWorkflow;
  readonly stateRepository: ChangelogDetectionStateRepository;
};

export type DetectChangelogUpdateInput = {
  readonly now: Date;
};

export type DetectChangelogUpdateResult = {
  readonly action: 'dispatched' | 'waiting' | 'confirmed' | 'max_attempts';
  readonly contentHash: string;
  readonly previousHash: string | null;
};

/** CHANGELOG の変化を検知し、推論 workflow の起動状態を更新する。 */
export async function detectChangelogUpdate(
  dependencies: DetectChangelogUpdateDependencies,
  input: DetectChangelogUpdateInput,
): Promise<DetectChangelogUpdateResult> {
  const checkedAt = input.now.toISOString();
  const contentHash = await dependencies.source.fetchContentHash();
  const previous = await dependencies.stateRepository.load();

  let decision = decideChangelogDetection({
    previous,
    contentHash,
    checkedAt,
  });
  if (decision.action === 'check_workflow' && previous !== null) {
    const workflowStatus = await dependencies.workflow.findStatus(
      previous.lastDispatchedHash,
    );
    decision = decideChangelogDetection({
      previous,
      contentHash,
      checkedAt,
      workflowStatus,
    });
  }

  if (decision.action === 'dispatch') {
    await dependencies.workflow.dispatch({
      hash: decision.state.lastDispatchedHash,
      detectedAt: decision.state.lastDispatchedAt,
    });
  }

  await dependencies.stateRepository.save(decision.state);

  return {
    action:
      decision.action === 'dispatch'
        ? 'dispatched'
        : decision.action === 'wait'
          ? 'waiting'
          : decision.action === 'check_workflow'
            ? 'waiting'
            : decision.action,
    contentHash,
    previousHash: previous === null ? null : previous.contentHash,
  };
}
