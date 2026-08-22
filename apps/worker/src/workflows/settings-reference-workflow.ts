import { drizzle } from 'drizzle-orm/d1';
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
    const paramsResult = WorkflowParamsSchema.safeParse(event.payload ?? {});
    const failureParams: SettingsReferenceWorkflowParams = paramsResult.success
      ? paramsResult.data
      : {};
    const failureReporter = createSettingsReferenceFailureReporter(
      this.env.GITHUB_DISPATCH_TOKEN,
    );

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
        const translations = await step.do(
          `infer-${batchIndex}`,
          STEP_RETRIES,
          async () => inference.infer(input),
        );
        await step.do(`store-${batchIndex}`, STEP_RETRIES, async () =>
          saveSettingsReferences(repository, {
            input,
            translations,
            fetchedAt,
          }),
        );
      }

      if (entries.length > 0) {
        await step.do('trigger-build', STEP_RETRIES, async () =>
          buildTrigger.trigger(),
        );
      }

      return { processedKeys: [...entries].map((entry) => entry.key) };
    } catch (error) {
      await step.do('create-failure-issue', STEP_RETRIES, async () =>
        failureReporter.report({
          params: failureParams,
          instanceId: event.instanceId,
          error,
        }),
      );
      throw error;
    }
  }
}
