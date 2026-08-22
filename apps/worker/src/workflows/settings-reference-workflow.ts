import { drizzle } from 'drizzle-orm/d1';
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
import { z } from 'zod';
import { createSettingsReferenceAi } from '../infrastructure/ai/settings-reference-ai';
import { createDeployHookBuildTrigger } from '../infrastructure/build/deploy-hook';
import { createSettingsReferenceRepository } from '../infrastructure/drizzle/settings-reference-repository';
import { createSettingsEntrySource } from '../infrastructure/drizzle/settings-entry-source';
import { createSettingsReferenceFailureReporter } from '../infrastructure/github/settings-reference-failure-reporter';
import { createSettingsDocumentSearch } from '../infrastructure/docs-search';
import {
  buildSettingsReferenceInput,
  loadSettingsReferenceEntries,
  saveSettingsReferences,
} from '../usecases/settings-reference';

const WorkflowParamsSchema = z.object({
  targetKeys: z.array(z.string().min(1)).optional(),
});

// CHANGELOG 推論と同じく AI 出力が空白ループに落ちて上限で打ち切られることがあるため、
// 再試行の回数に余裕を持たせる
const STEP_RETRIES: WorkflowStepConfigWithStaticDelay = {
  retries: {
    limit: 5,
    delay: '10 seconds',
    backoff: 'exponential',
  },
};

const BATCH_SIZE = 30;

const logger = getLogger({
  name: 'workflows.settings-reference',
  serviceName: 'changelog-viewer-worker',
  level: 'INFO',
  format: 'json',
});

export type SettingsReferenceWorkflowParams = z.infer<
  typeof WorkflowParamsSchema
>;

export class SettingsReferenceWorkflow extends WorkflowEntrypoint<
  CloudflareBindings,
  SettingsReferenceWorkflowParams
> {
  override async run(
    event: WorkflowEvent<SettingsReferenceWorkflowParams>,
    step: WorkflowStep,
  ): Promise<{ processedKeys: string[] }> {
    return runWithLogContext(
      {
        trace_id: event.instanceId,
        'workflow.name': 'settings-reference',
      },
      async () => this.runWorkflow(event, step),
    );
  }

  private async runWorkflow(
    event: WorkflowEvent<SettingsReferenceWorkflowParams>,
    step: WorkflowStep,
  ): Promise<{ processedKeys: string[] }> {
    const paramsResult = WorkflowParamsSchema.safeParse(event.payload ?? {});
    const failureParams: SettingsReferenceWorkflowParams = paramsResult.success
      ? paramsResult.data
      : {};
    const failureReporter = createSettingsReferenceFailureReporter(
      this.env.GITHUB_DISPATCH_TOKEN,
    );
    logger.info('Workflow を開始します', {
      'workflow.name': 'settings-reference',
    });

    try {
      if (!paramsResult.success) {
        throw new Error(
          `Workflow パラメータが不正です: ${z.prettifyError(paramsResult.error)}`,
        );
      }
      const params = paramsResult.data;
      const db = drizzle(this.env.DB);
      const docsDb = drizzle(this.env.DOCS_DB);
      const entrySource = createSettingsEntrySource(db, this.env.DOCS_DB);
      const documentSearch = createSettingsDocumentSearch(docsDb);
      const inference = createSettingsReferenceAi(
        this.env.AI,
        this.env.AI_GATEWAY_ID,
      );
      const repository = createSettingsReferenceRepository(db);
      const buildTrigger = createDeployHookBuildTrigger(
        this.env.DEPLOY_HOOK_URL,
      );
      // replay で日付が変わらないよう、実行時刻ではなく起動時刻を使う。
      const fetchedAt = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Tokyo',
      }).format(event.timestamp);

      const entries = await step.do('load-entries', STEP_RETRIES, async () =>
        loadSettingsReferenceEntries(entrySource, params),
      );
      logger.info('Workflow step が完了しました', {
        'workflow.step': 'load-entries',
        'settings.entry_count': entries.length,
      });

      for (
        let batchStart = 0, batchIndex = 0;
        batchStart < entries.length;
        batchStart += BATCH_SIZE, batchIndex += 1
      ) {
        const batchEntries = entries.slice(batchStart, batchStart + BATCH_SIZE);
        const input = await step.do(
          `build-input-${batchIndex}`,
          STEP_RETRIES,
          async () =>
            buildSettingsReferenceInput(
              documentSearch,
              entrySource,
              batchEntries,
            ),
        );
        logger.info('Workflow step が完了しました', {
          'workflow.step': `build-input-${batchIndex}`,
          'ai.batch_index': batchIndex,
        });
        const translations = await step.do(
          `infer-${batchIndex}`,
          STEP_RETRIES,
          async () =>
            runWithLogContext({ 'ai.batch_index': batchIndex }, () =>
              inference.infer(input),
            ),
        );
        logger.info('Workflow step が完了しました', {
          'workflow.step': `infer-${batchIndex}`,
          'ai.batch_index': batchIndex,
        });
        await step.do(`store-${batchIndex}`, STEP_RETRIES, async () =>
          saveSettingsReferences(repository, {
            input,
            translations,
            fetchedAt,
          }),
        );
        logger.info('Workflow step が完了しました', {
          'workflow.step': `store-${batchIndex}`,
          'ai.batch_index': batchIndex,
        });
      }

      if (entries.length > 0) {
        await step.do('trigger-build', STEP_RETRIES, async () =>
          buildTrigger.trigger(),
        );
        logger.info('Workflow step が完了しました', {
          'workflow.step': 'trigger-build',
        });
      }

      logger.info('Workflow が完了しました', {
        'workflow.name': 'settings-reference',
        'settings.entry_count': entries.length,
      });
      return { processedKeys: [...entries].map((entry) => entry.key) };
    } catch (error) {
      logger.error('Workflow に失敗しました', {
        'workflow.name': 'settings-reference',
        error: toError(error),
      });
      await step.do('create-failure-issue', STEP_RETRIES, async () =>
        failureReporter.report({
          params: failureParams,
          instanceId: event.instanceId,
          error,
        }),
      );
      logger.info('Workflow step が完了しました', {
        'workflow.step': 'create-failure-issue',
      });
      throw error;
    }
  }
}
