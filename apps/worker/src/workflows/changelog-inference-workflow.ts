import { workerLogger } from '../logger';
import { drizzle } from 'drizzle-orm/d1';
import { runWithLogContext, toError } from '@claude-code-changelog-viewer/common';
import { WorkflowEntrypoint } from 'cloudflare:workers';
import type {
  WorkflowEvent,
  WorkflowStep,
  WorkflowStepConfigWithStaticDelay,
} from 'cloudflare:workers';
import { z } from 'zod';
import type {
  ChangelogAiTranslationItem,
  ChangelogInferenceInput,
  ChangelogItem,
  ChangelogItemInference,
} from '../domain/changelog-inference/changelog-inference';
import {
  createChangelogItemInferenceAi,
  createChangelogSummaryAi,
  createChangelogTranslationAi,
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
  translateChangelogItemBatch,
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

const STEP_RETRIES: WorkflowStepConfigWithStaticDelay = {
  retries: {
    limit: 3,
    delay: '10 seconds',
    backoff: 'exponential',
  },
};

// 翻訳だけのプロンプトなら 89 項目を 1 回で処理しても全件成功した (2026-10-14 計測)。
// 1 回の失敗で巻き添えになる項目を抑えるため 30 件で区切る
const TRANSLATION_BATCH_SIZE = 30;

// 推論は関連ドキュメント付きの入れ子の JSON を返させるため、翻訳と違って空白ループが残りうる。
// 1 件の失敗で同じバッチの推論がまとめて失われないよう、1 項目ずつ切り離す
const INFERENCE_BATCH_SIZE = 1;

// 1 項目の snippets は最大 8000 字で、約 180 項目のリリースを 1 step にまとめると
// step の戻り値の上限 1MiB を超えうる。20 項目なら最大でも約 160KB に収まる
const SEARCH_CHUNK_SIZE = 20;

const logger = workerLogger('workflows.changelog-inference');

export type ChangelogInferenceWorkflowParams = z.infer<typeof WorkflowParamsSchema>;

type SkippedItem = { id: string; content: string; reason: string };

function reportSkippedBatch(
  stepName: string,
  batch: { version: string; items: ChangelogItem[] },
  error: unknown,
): SkippedItem[] {
  const { version, items } = batch;
  logger.warn('AI 処理を諦めて原文のまま保存します', {
    'workflow.step': stepName,
    'changelog.version': version,
    'changelog.item_ids': items.map((item) => item.id),
    error: toError(error),
  });
  const reason = `${stepName}: ${toError(error).message}`;
  return items.map((item) => ({ id: item.id, content: item.content, reason }));
}

// 翻訳を諦めた項目も推論の対象に残るため、推論も諦めると同じ項目が 2 回届く。
// Issue の件数と項目の一覧が水増しされないよう、項目ごとに 1 件へまとめて理由を並べる
function addSkippedItems(skippedItems: Map<string, SkippedItem>, items: SkippedItem[]): void {
  for (const item of items) {
    const existing = skippedItems.get(item.id);
    skippedItems.set(
      item.id,
      existing === undefined ? item : { ...item, reason: `${existing.reason} / ${item.reason}` },
    );
  }
}

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
    const failureReporter: ChangelogFailureReporterPort = createWorkflowFailureReporter(
      this.env.GITHUB_DISPATCH_TOKEN,
      {
        name: 'CHANGELOG 推論 Workflow',
        workflowLabel: 'workflow:changelog-auto-inference',
        summary: 'CHANGELOG 推論 Workflow が失敗しました。',
        extraFields: ({ params }) => [
          `**検出時刻**: ${params.detectedAt}`,
          `**検出ハッシュ**: ${params.detectedHash}`,
        ],
      },
    );
    logger.info('Workflow を開始します', {
      'workflow.name': 'changelog-inference',
    });

    try {
      if (!paramsResult.success) {
        throw new Error(`Workflow パラメータが不正です: ${z.prettifyError(paramsResult.error)}`);
      }
      const params = paramsResult.data;
      const db = drizzle(this.env.DB);
      const existingChangelogReader = createExistingChangelogReader(db);
      const diffRepository = createChangelogDiffRepository(db);
      const inferenceRepository = createChangelogInferenceRepository(db);
      const source = createGitHubChangelogMarkdownSource(this.env.GITHUB_DISPATCH_TOKEN);
      const documentSearch = searchDocsForChangelogEntry.bind(null, drizzle(this.env.DOCS_DB));
      const translator = createChangelogTranslationAi(this.env.AI, this.env.AI_GATEWAY_ID);
      const inference = createChangelogItemInferenceAi(this.env.AI, this.env.AI_GATEWAY_ID);
      const summarizer = createChangelogSummaryAi(this.env.AI, this.env.AI_GATEWAY_ID);
      const notifier = createChangelogWorkflowNotifier(db, this.env.NOTIFICATION_QUEUE);
      const buildTrigger = createDeployHookBuildTrigger(this.env.DEPLOY_HOOK_URL);
      const skipReporter = createChangelogInferenceSkipReporter(this.env.GITHUB_DISPATCH_TOKEN);
      const classification = await runStep('fetch-and-classify', STEP_RETRIES, async () =>
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
        const translations: ChangelogAiTranslationItem[] = [];
        const skippedItems = new Map<string, SkippedItem>();
        for (
          let batchStart = 0, batchIndex = 0;
          batchStart < release.items.length;
          batchStart += TRANSLATION_BATCH_SIZE, batchIndex += 1
        ) {
          const batch = {
            version: release.version,
            items: release.items.slice(batchStart, batchStart + TRANSLATION_BATCH_SIZE),
          };
          const stepName = `translate-${release.version}-${batchIndex}`;
          try {
            translations.push(
              ...(await runStep(stepName, STEP_RETRIES, async () =>
                runWithLogContext({ 'ai.batch_index': batchIndex }, () =>
                  translateChangelogItemBatch(translator, batch),
                ),
              )),
            );
          } catch (error) {
            // ここで諦めないとリリース全体が保存されないため、このバッチだけ英語原文で残す
            if (!isUnusableAiResponseError(error)) {
              throw error;
            }
            addSkippedItems(skippedItems, reportSkippedBatch(stepName, batch, error));
          }
        }

        const inferenceInput: ChangelogInferenceInput = {
          version: release.version,
          items: [],
        };
        for (
          let chunkStart = 0, chunkIndex = 0;
          chunkStart < release.items.length;
          chunkStart += SEARCH_CHUNK_SIZE, chunkIndex += 1
        ) {
          const chunk = await runStep(
            `build-inference-input-${release.version}-${chunkIndex}`,
            STEP_RETRIES,
            async () =>
              buildChangelogInferenceInput(documentSearch, {
                ...release,
                items: release.items.slice(chunkStart, chunkStart + SEARCH_CHUNK_SIZE),
              }),
          );
          inferenceInput.items.push(...chunk.items);
        }
        // 翻訳は済んでいるため、推論を諦めても日本語訳は残る
        const itemInferences: ChangelogItemInference[] = [];
        for (
          let batchStart = 0, batchIndex = 0;
          batchStart < inferenceInput.items.length;
          batchStart += INFERENCE_BATCH_SIZE, batchIndex += 1
        ) {
          const batch = {
            version: inferenceInput.version,
            items: inferenceInput.items.slice(batchStart, batchStart + INFERENCE_BATCH_SIZE),
          };
          const stepName = `infer-${release.version}-${batchIndex}`;
          try {
            itemInferences.push(
              ...(await runStep(stepName, STEP_RETRIES, async () =>
                runWithLogContext({ 'ai.batch_index': batchIndex }, () =>
                  inferChangelogItemBatch(inference, batch),
                ),
              )),
            );
          } catch (error) {
            if (!isUnusableAiResponseError(error)) {
              throw error;
            }
            addSkippedItems(skippedItems, reportSkippedBatch(stepName, batch, error));
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
            translations,
            itemInferences,
            summary,
          }),
        );

        if (skippedItems.size > 0) {
          await runStep(
            `report-skipped-${release.version}`,
            {
              ...STEP_RETRIES,
              attrs: { 'changelog.skipped_item_count': skippedItems.size },
            },
            async () =>
              skipReporter.report({
                version: release.version,
                items: [...skippedItems.values()],
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
              'notification.version_count': classification.notifiableVersions.length,
            },
          },
          async () => {
            await notifyChangelogVersions(notifier, classification.notifiableVersions);
            return { versions: classification.notifiableVersions };
          },
        );
      }

      if (classification.versions.length > 0 || classification.diffEvents.length > 0) {
        await runStep('trigger-build', STEP_RETRIES, async () => buildTrigger.trigger());
      }

      logger.info('Workflow が完了しました', {
        'workflow.name': 'changelog-inference',
        'workflow.version_count': classification.versions.length,
      });
      return {
        processedVersions: [...classification.versions].map((release) => release.version),
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
