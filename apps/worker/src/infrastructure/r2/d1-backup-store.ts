import type { BackupStorePort } from '../../usecases/d1-backup-workflow';

export function createD1BackupStore(bucket: R2Bucket): BackupStorePort {
  return {
    async save(key, body) {
      const stored = await bucket.put(key, body);
      if (stored === null) {
        throw new Error(`D1 バックアップの保存に失敗しました: ${key}`);
      }
      return { size: stored.size };
    },
  };
}
