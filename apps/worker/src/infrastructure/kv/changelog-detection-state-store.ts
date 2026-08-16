import { z } from 'zod';
import type {
  ChangelogDetectionState,
  ChangelogDetectionStateRepository,
} from '../../domain/changelog-detection/changelog-detection';

const KV_KEY = 'changelog-detection-state';

const ChangelogDetectionStateSchema = z.object({
  contentHash: z.string(),
  lastCheckedAt: z.string(),
  lastDispatchedAt: z.string(),
  lastDispatchedHash: z.string(),
  attempts: z.number(),
  confirmed: z.boolean(),
});

/** KV に保存された CHANGELOG 検知状態を domain state へ変換する adapter。 */
export function createChangelogDetectionStateRepository(
  kv: KVNamespace,
): ChangelogDetectionStateRepository {
  return {
    async load(): Promise<ChangelogDetectionState | null> {
      const raw = await kv.get(KV_KEY);
      if (!raw) {
        return null;
      }

      try {
        const result = ChangelogDetectionStateSchema.safeParse(JSON.parse(raw));
        return result.success ? result.data : null;
      } catch {
        return null;
      }
    },

    async save(state): Promise<void> {
      await kv.put(KV_KEY, JSON.stringify(state));
    },
  };
}
