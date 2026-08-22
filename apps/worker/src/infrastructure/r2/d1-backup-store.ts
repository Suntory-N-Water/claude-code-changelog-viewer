import { getLogger, toError } from '@claude-code-changelog-viewer/common';
import type { BackupStorePort } from '../../usecases/d1-backup-workflow';

const logger = getLogger({
  name: 'infrastructure.r2.d1-backup-store',
  serviceName: 'changelog-viewer-worker',
  level: 'INFO',
  format: 'json',
});

export function createD1BackupStore(bucket: R2Bucket): BackupStorePort {
  return {
    async save(key, body) {
      let stored: R2Object | null;
      try {
        stored = await bucket.put(key, body);
      } catch (error) {
        logger.error('D1 バックアップの保存に失敗しました', {
          key,
          error: toError(error),
        });
        throw error;
      }
      if (stored === null) {
        logger.error('D1 バックアップの保存に失敗しました', { key });
        throw new Error(`D1 バックアップの保存に失敗しました: ${key}`);
      }
      logger.info('D1 バックアップを保存しました', {
        key,
        size: stored.size,
      });
      return { size: stored.size };
    },
  };
}
