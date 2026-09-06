import { workerLogger } from '../../logger';
import { toError } from '@claude-code-changelog-viewer/common';
import { z } from 'zod';
import type {
  ChangelogDetectionState,
  ChangelogDetectionStateRepository,
} from '../../domain/changelog-detection/changelog-detection';

const KV_KEY = 'changelog-detection-state';

const logger = workerLogger('infrastructure.kv.changelog-detection-state');

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
      let raw: string | null;
      try {
        raw = await kv.get(KV_KEY);
      } catch (error) {
        logger.error('CHANGELOG 検知状態の取得に失敗しました', {
          error: toError(error),
        });
        throw error;
      }
      if (!raw) {
        logger.info('CHANGELOG 検知状態が見つかりませんでした', {
          'resource.name': KV_KEY,
        });
        return null;
      }

      try {
        const result = ChangelogDetectionStateSchema.safeParse(JSON.parse(raw));
        logger.info('CHANGELOG 検知状態を取得しました', {
          'resource.name': KV_KEY,
          'state.valid': result.success,
        });
        return result.success ? result.data : null;
      } catch (error) {
        logger.warn('CHANGELOG 検知状態の解析に失敗しました', {
          'resource.name': KV_KEY,
          error: toError(error),
        });
        return null;
      }
    },

    async save(state): Promise<void> {
      try {
        await kv.put(KV_KEY, JSON.stringify(state));
      } catch (error) {
        logger.error('CHANGELOG 検知状態の保存に失敗しました', {
          'resource.name': KV_KEY,
          error: toError(error),
        });
        throw error;
      }
      logger.info('CHANGELOG 検知状態を保存しました', {
        'resource.name': KV_KEY,
      });
    },
  };
}
