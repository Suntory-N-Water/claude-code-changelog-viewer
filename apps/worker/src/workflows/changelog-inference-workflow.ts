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
import type { ChangelogItemInference } from '../domain/changelog-inference/changelog-inference';
import {
  createChangelogItemInferenceAi,
  createChangelogSummaryAi,
} from '../infrastructure/ai/changelog-inference-ai';
import { createDeployHookBuildTrigger } from '../infrastructure/build/deploy-hook';
import { createChangelogDiffRepository } from '../infrastructure/drizzle/changelog-diff-repository';
import { createChangelogInferenceRepository } from '../infrastructure/drizzle/changelog-inference-repository';
import { createExistingChangelogReader } from '../infrastructure/drizzle/existing-changelog-reader';
import { createChangelogDocumentSearch } from '../infrastructure/docs-search';
import { createGitHubChangelogMarkdownSource } from '../infrastructure/github/changelog-source';
import { createChangelogWorkflowFailureReporter } from '../infrastructure/github/changelog-workflow-failure-reporter';
import { parseChangelogReleases } from '../infrastructure/github/changelog-markdown-parser';
import { createChangelogWorkflowNotifier } from '../infrastructure/notification/changelog-workflow-notifier';
import {
  buildChangelogInferenceInput,
  inferChangelogItemBatch,
} from '../usecases/changelog-inference';
import {
  fetchAndClassifyChangelog,
  notifyChangelogVersions,
  reportChangelogWorkflowFailure,
  saveChangelogDiffs,
  saveChangelogInference,
} from '../usecases/changelog-inference-workflow';

const WorkflowParamsSchema = z.object({
  detectedHash: z.string().length(64),
  detectedAt: z.string().min(1),
});

const STEP_RETRIES: WorkflowStepConfigWithStaticDelay = {
  retries: {
    limit: 3,
    delay: '10 seconds',
    backoff: 'exponential',
  },
};

// 1バッチの入力量が Workers AI のタイムアウトに届かない範囲に収める。
// 設定リファレンス生成の 30 より小さいのは、1項目に関連ドキュメントの snippets が付くため
const BATCH_SIZE = 10;

const logger = getLogger({
  name: 'workflows.changelog-inference',
  serviceName: 'changelog-viewer-worker',
  level: 'INFO',
  format: 'json',
});

export type ChangelogInferenceWorkflowParams = z.infer<
  typeof WorkflowParamsSchema
>;

export class ChangelogInferenceWorkflow extends WorkflowEntrypoint<
  CloudflareBindings,
  ChangelogInferenceWorkflowParams
> {
  override async run(
    event: WorkflowEvent<ChangelogInferenceWorkflowParams>,
    step: WorkflowStep,
  ): Promise<{
    processedVersions: string[];
    notifiedVersions: string[];
  }> {
    return runWithLogContext(
      {
        trace_id: event.instanceId,
        'workflow.name': 'changelog-inference',
      },
      async () => this.runWorkflow(event, step),
    );
  }

  private async runWorkflow(
    event: WorkflowEvent<ChangelogInferenceWorkflowParams>,
    step: WorkflowStep,
  ): Promise<{
    processedVersions: string[];
    notifiedVersions: string[];
  }> {
    const paramsResult = WorkflowParamsSchema.safeParse(event.payload);
    const failureParams = paramsResult.success
      ? paramsResult.data
      : { detectedHash: '(不正な payload)', detectedAt: '(不正な payload)' };
    const failureReporter = createChangelogWorkflowFailureReporter(
      this.env.GITHUB_DISPATCH_TOKEN,
    );
    logger.info('Workflow を開始します', {
      'workflow.name': 'changelog-inference',
    });

    try {
      if (!paramsResult.success) {
        throw new Error(
          `Workflow パラメータが不正です: ${z.prettifyError(paramsResult.error)}`,
        );
      }
      const params = paramsResult.data;
      const db = drizzle(this.env.DB);
      const existingChangelogReader = createExistingChangelogReader(db);
      const diffRepository = createChangelogDiffRepository(db);
      const inferenceRepository = createChangelogInferenceRepository(db);
      const source = createGitHubChangelogMarkdownSource(
        this.env.GITHUB_DISPATCH_TOKEN,
      );
      const documentSearch = createChangelogDocumentSearch(
        drizzle(this.env.DOCS_DB),
      );
      const inference = createChangelogItemInferenceAi(
        this.env.AI,
        this.env.AI_GATEWAY_ID,
      );
      const summarizer = createChangelogSummaryAi(
        this.env.AI,
        this.env.AI_GATEWAY_ID,
      );
      const notifier = createChangelogWorkflowNotifier(
        db,
        this.env.NOTIFICATION_QUEUE,
      );
      const buildTrigger = createDeployHookBuildTrigger(
        this.env.DEPLOY_HOOK_URL,
      );
      const classification = await step.do(
        'fetch-and-classify',
        STEP_RETRIES,
        async () =>
          fetchAndClassifyChangelog({
            source,
            parser: { parse: parseChangelogReleases },
            existingChangelogReader,
            params,
          }),
      );
      logger.info('Workflow step が完了しました', {
        'workflow.step': 'fetch-and-classify',
      });

      await step.do('save-diff', STEP_RETRIES, async () =>
        saveChangelogDiffs(diffRepository, classification.diffEvents),
      );
      logger.info('Workflow step が完了しました', {
        'workflow.step': 'save-diff',
      });

      for (const release of classification.versions) {
        const inferenceInput = await step.do(
          `build-inference-input-${release.version}`,
          STEP_RETRIES,
          async () => buildChangelogInferenceInput(documentSearch, release),
        );
        logger.info('Workflow step が完了しました', {
          'workflow.step': `build-inference-input-${release.version}`,
        });
        const itemInferences: ChangelogItemInference[] = [];
        for (
          let batchStart = 0, batchIndex = 0;
          batchStart < inferenceInput.items.length;
          batchStart += BATCH_SIZE, batchIndex += 1
        ) {
          const batch = {
            version: inferenceInput.version,
            items: inferenceInput.items.slice(
              batchStart,
              batchStart + BATCH_SIZE,
            ),
          };
          itemInferences.push(
            ...(await step.do(
              `infer-${release.version}-${batchIndex}`,
              STEP_RETRIES,
              async () =>
                runWithLogContext({ 'ai.batch_index': batchIndex }, () =>
                  inferChangelogItemBatch(inference, batch),
                ),
            )),
          );
          logger.info('Workflow step が完了しました', {
            'workflow.step': `infer-${release.version}-${batchIndex}`,
            'ai.batch_index': batchIndex,
          });
        }

        // サマリーは全項目を見る必要があるため、バッチ分割せず原文だけを渡して1回で作る
        const { summary } = await step.do(
          `summarize-${release.version}`,
          STEP_RETRIES,
          async () => ({ summary: await summarizer.summarize(release) }),
        );
        logger.info('Workflow step が完了しました', {
          'workflow.step': `summarize-${release.version}`,
        });

        await step.do(`store-${release.version}`, STEP_RETRIES, async () =>
          saveChangelogInference(inferenceRepository, {
            input: inferenceInput,
            itemInferences,
            summary,
          }),
        );
        logger.info('Workflow step が完了しました', {
          'workflow.step': `store-${release.version}`,
        });
      }

      if (classification.notifiableVersions.length > 0) {
        await step.do('notify', STEP_RETRIES, async () => {
          await notifyChangelogVersions(
            notifier,
            classification.notifiableVersions,
          );
          return { versions: classification.notifiableVersions };
        });
        logger.info('Workflow step が完了しました', {
          'workflow.step': 'notify',
          'notification.version_count':
            classification.notifiableVersions.length,
        });
      }

      if (
        classification.versions.length > 0 ||
        classification.diffEvents.length > 0
      ) {
        await step.do('trigger-build', STEP_RETRIES, async () =>
          buildTrigger.trigger(),
        );
        logger.info('Workflow step が完了しました', {
          'workflow.step': 'trigger-build',
        });
      }

      logger.info('Workflow が完了しました', {
        'workflow.name': 'changelog-inference',
        'workflow.version_count': classification.versions.length,
      });
      return {
        processedVersions: [...classification.versions].map(
          (release) => release.version,
        ),
        notifiedVersions: [...classification.notifiableVersions],
      };
    } catch (error) {
      logger.error('Workflow に失敗しました', {
        'workflow.name': 'changelog-inference',
        error: toError(error),
      });
      await step.do('create-failure-issue', STEP_RETRIES, async () =>
        reportChangelogWorkflowFailure(failureReporter, {
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
