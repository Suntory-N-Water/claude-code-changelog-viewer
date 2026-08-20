import { describe, expect, it } from 'vitest';
import type {
  ChangelogDetectionState,
  ChangelogWorkflowStatus,
} from '../domain/changelog-detection/changelog-detection';
import { detectChangelogUpdate } from './detect-changelog-update';

describe('CHANGELOG 更新検知ユースケース', () => {
  it('新しい内容を検知した時、workflow を起動して状態を保存する', async () => {
    const dispatched: Array<{
      hash: string;
      detectedAt: string;
      attempts: number;
    }> = [];
    let savedState: ChangelogDetectionState | null = null;
    const dependencies = {
      source: {
        fetchContentHash: async () => 'new-hash',
      },
      workflow: {
        dispatch: async (input: {
          hash: string;
          detectedAt: string;
          attempts: number;
        }) => {
          dispatched.push(input);
        },
        findStatus: async (): Promise<ChangelogWorkflowStatus> => 'pending',
      },
      stateRepository: {
        load: async () => null,
        save: async (state: ChangelogDetectionState) => {
          savedState = state;
        },
      },
    };

    const result = await detectChangelogUpdate(dependencies, {
      now: new Date('2026-08-16T00:00:00.000Z'),
    });

    expect(result).toEqual({
      action: 'dispatched',
      contentHash: 'new-hash',
      previousHash: null,
    });
    expect(dispatched).toEqual([
      {
        hash: 'new-hash',
        detectedAt: '2026-08-16T00:00:00.000Z',
        attempts: 1,
      },
    ]);
    expect(savedState).toEqual({
      contentHash: 'new-hash',
      lastCheckedAt: '2026-08-16T00:00:00.000Z',
      lastDispatchedAt: '2026-08-16T00:00:00.000Z',
      lastDispatchedHash: 'new-hash',
      attempts: 1,
      confirmed: false,
    });
  });

  it('前回の workflow が未完了の時、再起動せず確認時刻だけ更新する', async () => {
    const dispatched: Array<{
      hash: string;
      detectedAt: string;
      attempts: number;
    }> = [];
    const savedStates: ChangelogDetectionState[] = [];
    const dependencies = {
      source: {
        fetchContentHash: async () => 'same-hash',
      },
      workflow: {
        dispatch: async (input: {
          hash: string;
          detectedAt: string;
          attempts: number;
        }) => {
          dispatched.push(input);
        },
        findStatus: async (): Promise<ChangelogWorkflowStatus> => 'pending',
      },
      stateRepository: {
        load: async (): Promise<ChangelogDetectionState> => ({
          contentHash: 'same-hash',
          lastCheckedAt: '2026-08-16T00:00:00.000Z',
          lastDispatchedAt: '2026-08-15T23:55:00.000Z',
          lastDispatchedHash: 'same-hash',
          attempts: 1,
          confirmed: false,
        }),
        save: async (state: ChangelogDetectionState) => {
          savedStates.push(state);
        },
      },
    };

    const result = await detectChangelogUpdate(dependencies, {
      now: new Date('2026-08-16T00:05:00.000Z'),
    });

    expect(result).toEqual({
      action: 'waiting',
      contentHash: 'same-hash',
      previousHash: 'same-hash',
    });
    expect(dispatched).toEqual([]);
    expect(savedStates).toEqual([
      {
        contentHash: 'same-hash',
        lastCheckedAt: '2026-08-16T00:05:00.000Z',
        lastDispatchedAt: '2026-08-15T23:55:00.000Z',
        lastDispatchedHash: 'same-hash',
        attempts: 1,
        confirmed: false,
      },
    ]);
  });

  it('workflow 起動後の状態保存に失敗した時、同じ instance ID で次の tick に復帰する', async () => {
    const dispatched: Array<{
      hash: string;
      detectedAt: string;
      attempts: number;
    }> = [];
    let saveCount = 0;
    const dependencies = {
      source: {
        fetchContentHash: async () => 'new-hash',
      },
      workflow: {
        dispatch: async (input: {
          hash: string;
          detectedAt: string;
          attempts: number;
        }) => {
          dispatched.push(input);
        },
        findStatus: async (): Promise<ChangelogWorkflowStatus> => 'pending',
      },
      stateRepository: {
        load: async () => null,
        save: async () => {
          saveCount += 1;
          if (saveCount === 1) {
            throw new Error('状態保存の一時的な失敗');
          }
        },
      },
    };

    await expect(
      detectChangelogUpdate(dependencies, {
        now: new Date('2026-08-16T00:00:00.000Z'),
      }),
    ).rejects.toThrow('状態保存の一時的な失敗');

    const result = await detectChangelogUpdate(dependencies, {
      now: new Date('2026-08-16T00:05:00.000Z'),
    });

    expect(result.action).toBe('dispatched');
    expect(dispatched).toEqual([
      {
        hash: 'new-hash',
        detectedAt: '2026-08-16T00:00:00.000Z',
        attempts: 1,
      },
      {
        hash: 'new-hash',
        detectedAt: '2026-08-16T00:05:00.000Z',
        attempts: 1,
      },
    ]);
  });
});
