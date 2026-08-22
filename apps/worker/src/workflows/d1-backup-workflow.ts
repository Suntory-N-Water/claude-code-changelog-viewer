import {
  getLogger,
  runWithLogContext,
  toError,
} from '@claude-code-changelog-viewer/common';
import { WorkflowEntrypoint } from 'cloudflare:workers';
import type {
  WorkflowEvent,
  WorkflowStep,
  WorkflowStepConfigWithStaticDelay,
} from 'cloudflare:workers';
import { createD1ExportClient } from '../infrastructure/d1/d1-export-client';
import { createD1BackupFailureReporter } from '../infrastructure/github/d1-backup-failure-reporter';
import { createD1BackupStore } from '../infrastructure/r2/d1-backup-store';
import { storeD1Backup } from '../usecases/d1-backup-workflow';

const logger = getLogger({
  name: 'workflows.d1-backup',
  serviceName: 'changelog-viewer-worker',
  level: 'INFO',
  format: 'json',
});

const START_EXPORT_RETRIES: WorkflowStepConfigWithStaticDelay = {
  retries: {
    limit: 3,
    delay: '10 seconds',
    backoff: 'exponential',
  },
};

// この step の throw は失敗ではなく export の未完了を意味するため、
// 待ち時間を伸ばさず 10 秒間隔で最大 300 秒ポーリングする。
const STORE_BACKUP_RETRIES: WorkflowStepConfigWithStaticDelay = {
  retries: {
    limit: 30,
    delay: '10 seconds',
    backoff: 'constant',
  },
};

export type D1BackupWorkflowParams = Record<string, never>;

export class D1BackupWorkflow extends WorkflowEntrypoint<
  CloudflareBindings,
  D1BackupWorkflowParams
> {
  override async run(
    event: WorkflowEvent<D1BackupWorkflowParams>,
    step: WorkflowStep,
  ): Promise<{ key: string; size: number }> {
    return runWithLogContext(
      {
        trace_id: event.instanceId,
        'workflow.name': 'd1-backup',
      },
      async () => {
        const failureReporter = createD1BackupFailureReporter(
          this.env.GITHUB_DISPATCH_TOKEN,
        );
        logger.info('Workflow を開始します', {
          'workflow.name': 'd1-backup',
        });

        try {
          const d1Export = createD1ExportClient({
            accountId: this.env.CLOUDFLARE_ACCOUNT_ID,
            databaseId: this.env.BACKUP_DATABASE_ID,
            apiToken: this.env.D1_REST_API_TOKEN,
          });
          const store = createD1BackupStore(this.env.D1_BACKUP_BUCKET);

          const bookmark = await step.do(
            'start-export',
            START_EXPORT_RETRIES,
            async () => d1Export.start(),
          );
          logger.info('Workflow step が完了しました', {
            'workflow.step': 'start-export',
          });
          const stored = await step.do(
            'store-backup',
            STORE_BACKUP_RETRIES,
            async () =>
              storeD1Backup(d1Export, store, {
                bookmark,
                // 再試行で保存先キーが変わらないよう、実行時刻ではなく起動時刻を使う。
                exportedAt: event.timestamp.toISOString(),
              }),
          );
          logger.info('Workflow step が完了しました', {
            'workflow.step': 'store-backup',
          });

          logger.msg('APLG0021', {
            attrs: {
              'resource.name': '正データ用 D1 のバックアップ',
              key: stored.key,
              size: stored.size,
            },
          });
          logger.info('Workflow が完了しました', {
            'workflow.name': 'd1-backup',
          });
          return stored;
        } catch (error) {
          logger.error('Workflow に失敗しました', {
            'workflow.name': 'd1-backup',
            error: toError(error),
          });
          await step.do(
            'create-failure-issue',
            START_EXPORT_RETRIES,
            async () =>
              failureReporter.report({ instanceId: event.instanceId, error }),
          );
          logger.info('Workflow step が完了しました', {
            'workflow.step': 'create-failure-issue',
          });
          throw error;
        }
      },
    );
  }
}
