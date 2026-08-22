import { getLogger } from '@claude-code-changelog-viewer/common';
import {
  parseEnvVarsMd,
  parsePublicEnvEntriesFromDocs,
} from '../infrastructure/docs-sync/content';
import { createDocsSearchStore } from '../infrastructure/docs-sync/docs-search-store';
import { createOfficialDocsSource } from '../infrastructure/docs-sync/official-docs-source';
import { syncDocs as syncDocsUsecase } from '../usecases/sync-docs';

const logger = getLogger({
  name: 'cron.docs-sync',
  serviceName: 'changelog-viewer-worker',
  level: 'INFO',
  format: 'json',
});

/** ScheduledEvent と Cloudflare binding をドキュメント同期 usecase へ接続する entry point。 */
export async function syncDocs(
  bindings: CloudflareBindings,
  now = new Date(),
): Promise<void> {
  const result = await syncDocsUsecase(
    {
      source: createOfficialDocsSource(),
      store: createDocsSearchStore(bindings.DOCS_DB),
      contentParser: { parseEnvVarsMd, parsePublicEnvEntriesFromDocs },
    },
    { now },
  );

  if (result.documentCount === 0) {
    logger.warn('ドキュメント一覧が空のため、D1 の変更をスキップしました', {
      'job.name': 'ドキュメント検索用 D1 同期 cron',
    });
    return;
  }

  logger.info('ドキュメント同期が完了しました', {
    'job.name': 'ドキュメント検索用 D1 同期 cron',
    'fetch.successful_count': result.successfulCount,
    'fetch.failed_count': result.failedCount,
    'write.changed_count': result.changedCount,
    'write.skipped_count': result.skippedCount,
    'delete.count': result.deletedCount,
    'delete.skipped_by_safety_guard': result.skippedBySafetyGuard,
    'schema.updated': result.schemaUpdated,
  });
}
