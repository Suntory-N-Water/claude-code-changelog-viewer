import { describe, expect, it } from 'vitest';
import { decideChangelogDetection } from './changelog-detection';

describe('CHANGELOG 検知状態', () => {
  it('初回または新しい内容を検知した時、workflow 起動待ちの状態を作る', () => {
    expect(
      decideChangelogDetection({
        previous: null,
        contentHash: 'new-hash',
        checkedAt: '2026-08-16T00:00:00.000Z',
      }),
    ).toEqual({
      action: 'dispatch',
      state: {
        contentHash: 'new-hash',
        lastCheckedAt: '2026-08-16T00:00:00.000Z',
        lastDispatchedAt: '2026-08-16T00:00:00.000Z',
        lastDispatchedHash: 'new-hash',
        attempts: 1,
        confirmed: false,
      },
    });
  });

  it('起動した workflow が成功した時、検知を確定する', () => {
    expect(
      decideChangelogDetection({
        previous: {
          contentHash: 'same-hash',
          lastCheckedAt: '2026-08-16T00:00:00.000Z',
          lastDispatchedAt: '2026-08-15T23:55:00.000Z',
          lastDispatchedHash: 'same-hash',
          attempts: 1,
          confirmed: false,
        },
        contentHash: 'same-hash',
        checkedAt: '2026-08-16T00:05:00.000Z',
        workflowStatus: 'succeeded',
      }),
    ).toEqual({
      action: 'confirmed',
      state: {
        contentHash: 'same-hash',
        lastCheckedAt: '2026-08-16T00:05:00.000Z',
        lastDispatchedAt: '2026-08-15T23:55:00.000Z',
        lastDispatchedHash: 'same-hash',
        attempts: 1,
        confirmed: true,
      },
    });
  });

  it('起動した workflow が失敗した時、検知時刻を保ったまま試行回数を増やして再起動する', () => {
    expect(
      decideChangelogDetection({
        previous: {
          contentHash: 'same-hash',
          lastCheckedAt: '2026-08-16T00:00:00.000Z',
          lastDispatchedAt: '2026-08-15T23:55:00.000Z',
          lastDispatchedHash: 'same-hash',
          attempts: 1,
          confirmed: false,
        },
        contentHash: 'same-hash',
        checkedAt: '2026-08-16T00:05:00.000Z',
        workflowStatus: 'failed',
      }),
    ).toEqual({
      action: 'dispatch',
      state: {
        contentHash: 'same-hash',
        lastCheckedAt: '2026-08-16T00:05:00.000Z',
        lastDispatchedAt: '2026-08-15T23:55:00.000Z',
        lastDispatchedHash: 'same-hash',
        attempts: 2,
        confirmed: false,
      },
    });
  });
});
