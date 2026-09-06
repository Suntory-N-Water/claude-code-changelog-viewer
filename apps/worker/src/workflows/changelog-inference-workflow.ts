import { workerLogger } from '../logger';
import { drizzle } from 'drizzle-orm/d1';
import {
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
  isUnusableAiResponseError,
} from '../infrastructure/ai/changelog-inference-ai';
import { createChangelogInferenceSkipReporter } from '../infrastructure/github/changelog-inference-skip-reporter';
import { createDeployHookBuildTrigger } from '../infrastructure/build/deploy-hook';
import { createChangelogDiffRepository } from '../infrastructure/drizzle/changelog-diff-repository';
import { createChangelogInferenceRepository } from '../infrastructure/drizzle/changelog-inference-repository';
import { createExistingChangelogReader } from '../infrastructure/drizzle/existing-changelog-reader';
import { searchDocsForChangelogEntry } from '../infrastructure/docs-search';
import { createGitHubChangelogMarkdownSource } from '../infrastructure/github/changelog-source';
import { createWorkflowFailureReporter } from '../infrastructure/github/workflow-failure-issue';
import { parseChangelogReleases } from '../infrastructure/github/changelog-markdown-parser';
import { createChangelogWorkflowNotifier } from '../infrastructure/notification/changelog-workflow-notifier';
import {
  buildChangelogInferenceInput,
  inferChangelogItemBatch,
} from '../usecases/changelog-inference';
import type { ChangelogFailureReporterPort } from '../usecases/changelog-inference-workflow';
import {
  fetchAndClassifyChangelog,
  notifyChangelogVersions,
  saveChangelogInference,
} from '../usecases/changelog-inference-workflow';
import { createStepRunner } from './run-step';

const WorkflowParamsSchema = z.object({
  detectedHash: z.string().length(64),
  detectedAt: z.string().min(1),
});

// AI 出力が空白ループに落ちる頻度が実測で約3割あり、3 回では 6 バッチ中どれかが落ち切る確率が
// 15% 残る。5 回まで許すと 1.5% まで下がる
const STEP_RETRIES: WorkflowStepConfigWithStaticDelay = {
  retries: {
    limit: 5,
    delay: '10 seconds',
    backoff: 'exponential',
  },
};

// 制約付きデコードの空白ループは 1 回のリクエストで生成させる配列要素が増えるほど起きやすい。
// 実測では同じ 5 項目が毎回失敗し、1 項目ずつなら 5 項目中 4 項目が 10 秒前後で成功した。
// 残る 1 項目は単独でも失敗するため、失敗を 1 項目に切り離す目的も兼ねて 1 にする
const BATCH_SIZE = 1;

const logger = workerLogger('workflows.changelog-inference');

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
    const runStep = createStepRunner(step);
    const failureReporter: ChangelogFailureReporterPort =
      createWorkflowFailureReporter(this.env.GITHUB_DISPATCH_TOKEN, {
        name: 'CHANGELOG 推論 Workflow',
        workflowLabel: 'workflow:changelog-auto-inference',
        summary: 'CHANGELOG 推論 Workflow が失敗しました。',
        extraFields: ({ params }) => [
          `**検出時刻**: ${params.detectedAt}`,
          `**検出ハッシュ**: ${params.detectedHash}`,
        ],
      });
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
      const documentSearch = searchDocsForChangelogEntry.bind(
        null,
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
      const skipReporter = createChangelogInferenceSkipReporter(
        this.env.GITHUB_DISPATCH_TOKEN,
      );
      const classification = await runStep(
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

      await runStep('save-diff', STEP_RETRIES, async () =>
        diffRepository.saveAll(classification.diffEvents),
      );

      for (const release of classification.versions) {
        const inferenceInput = await runStep(
          `build-inference-input-${release.version}`,
          STEP_RETRIES,
          async () => buildChangelogInferenceInput(documentSearch, release),
        );
        const itemInferences: ChangelogItemInference[] = [];
        const skippedItems: { id: string; content: string; reason: string }[] =
          [];
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
          try {
            itemInferences.push(
              ...(await runStep(
                `infer-${release.version}-${batchIndex}`,
                STEP_RETRIES,
                async () =>
                  runWithLogContext({ 'ai.batch_index': batchIndex }, () =>
                    inferChangelogItemBatch(inference, batch),
                  ),
              )),
            );
          } catch (error) {
            // 空白ループによる打ち切りは再試行を使い切っても回復しないことがある。
            // ここで諦めないとリリース全体が保存されないため、この項目だけ英語原文で残す
            if (!isUnusableAiResponseError(error)) {
              throw error;
            }
            const reason = toError(error).message;
            logger.warn('推論を諦めて原文のまま保存します', {
              'workflow.step': `infer-${release.version}-${batchIndex}`,
              'changelog.version': release.version,
              'changelog.item_ids': batch.items.map((item) => item.id),
              error: toError(error),
            });
            skippedItems.push(
              ...batch.items.map((item) => ({
                id: item.id,
                content: item.content,
                reason,
              })),
            );
            itemInferences.push(
              ...batch.items.map((item) => ({
                id: item.id,
                contentJa: '',
                featureAreas: [],
              })),
            );
          }
        }

        // サマリーは全項目を見る必要があるため、バッチ分割せず原文だけを渡して1回で作る
        const { summary } = await runStep(
          `summarize-${release.version}`,
          STEP_RETRIES,
          async () => ({ summary: await summarizer.summarize(release) }),
        );

        await runStep(`store-${release.version}`, STEP_RETRIES, async () =>
          saveChangelogInference(inferenceRepository, {
            input: inferenceInput,
            itemInferences,
            summary,
          }),
        );

        if (skippedItems.length > 0) {
          await runStep(
            `report-skipped-${release.version}`,
            {
              ...STEP_RETRIES,
              attrs: { 'changelog.skipped_item_count': skippedItems.length },
            },
            async () =>
              skipReporter.report({
                version: release.version,
                items: skippedItems,
              }),
          );
        }
      }

      if (classification.notifiableVersions.length > 0) {
        await runStep(
          'notify',
          {
            ...STEP_RETRIES,
            attrs: {
              'notification.version_count':
                classification.notifiableVersions.length,
            },
          },
          async () => {
            await notifyChangelogVersions(
              notifier,
              classification.notifiableVersions,
            );
            return { versions: classification.notifiableVersions };
          },
        );
      }

      if (
        classification.versions.length > 0 ||
        classification.diffEvents.length > 0
      ) {
        await runStep('trigger-build', STEP_RETRIES, async () =>
          buildTrigger.trigger(),
        );
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
      await runStep('create-failure-issue', STEP_RETRIES, async () =>
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
