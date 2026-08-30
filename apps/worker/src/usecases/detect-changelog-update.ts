import {
  decideChangelogDetection,
  type ChangelogDetectionStateRepository,
  type ChangelogWorkflowStatus,
} from '../domain/changelog-detection/changelog-detection';

/** CHANGELOG 本文の取得・ハッシュ化を抽象化する port。 */
export type ChangelogSource = {
  fetchContentHash(): Promise<string>;
};

/** 推論 workflow の起動と実行状態取得を抽象化する port。 */
export type ChangelogWorkflow = {
  dispatch(input: {
    hash: string;
    detectedAt: string;
    attempts: number;
  }): Promise<void>;
  findStatus(input: {
    hash: string;
    attempts: number;
  }): Promise<ChangelogWorkflowStatus>;
};

export type DetectChangelogUpdateDependencies = {
  source: ChangelogSource;
  workflow: ChangelogWorkflow;
  stateRepository: ChangelogDetectionStateRepository;
};

export type DetectChangelogUpdateInput = {
  now: Date;
};

export type DetectChangelogUpdateResult = {
  action: 'dispatched' | 'waiting' | 'confirmed' | 'max_attempts';
  contentHash: string;
  previousHash: string | null;
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
    const workflowStatus = await dependencies.workflow.findStatus({
      hash: previous.lastDispatchedHash,
      attempts: previous.attempts,
    });
    decision = decideChangelogDetection({
      previous,
      contentHash,
      checkedAt,
      workflowStatus,
    });
  }

  // Workflow 起動後に状態保存だけ失敗すると、次回も同じ一意 ID で起動して
  // 永続的に失敗する。先に再開地点を保存し、起動失敗は次の tick で回復する。
  await dependencies.stateRepository.save(decision.state);

  if (decision.action === 'dispatch') {
    await dependencies.workflow.dispatch({
      hash: decision.state.lastDispatchedHash,
      detectedAt: decision.state.lastDispatchedAt,
      attempts: decision.state.attempts,
    });
  }

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
