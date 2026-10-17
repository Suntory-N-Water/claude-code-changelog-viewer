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
import {
  createSettingsTranslationAi,
  createSettingsUseCaseAi,
  isUnusableSettingsAiResponseError,
} from '../infrastructure/ai/settings-reference-ai';
import { createDeployHookBuildTrigger } from '../infrastructure/build/deploy-hook';
import { createSettingsReferenceRepository } from '../infrastructure/drizzle/settings-reference-repository';
import { createSettingsEntrySource } from '../infrastructure/drizzle/settings-entry-source';
import { createWorkflowFailureReporter } from '../infrastructure/github/workflow-failure-issue';
import { searchDocsForSettingKey } from '../infrastructure/docs-search';
import type {
  SettingsReferenceFailureReporterPort,
  SettingsReferenceTranslation,
  SettingsReferenceUseCase,
} from '../usecases/settings-reference';
import {
  buildSettingsReferenceInput,
  hasUseCaseContext,
  planSettingsReferenceGeneration,
  saveSettingsReferences,
} from '../usecases/settings-reference';
import { createStepRunner } from './run-step';

const WorkflowParamsSchema = z.object({
  targetKeys: z.array(z.string().min(1)).optional(),
});

const STEP_RETRIES: WorkflowStepConfigWithStaticDelay = {
  retries: {
    limit: 3,
    delay: '10 seconds',
    backoff: 'exponential',
  },
};

const BATCH_SIZE = 30;

const logger = workerLogger('workflows.settings-reference');

export type SettingsReferenceWorkflowParams = z.infer<typeof WorkflowParamsSchema>;

type SettingsReferenceWorkflowOutput = { processedKeys: string[]; removedKeys: string[] };

export class SettingsReferenceWorkflow extends WorkflowEntrypoint<
  CloudflareBindings,
  SettingsReferenceWorkflowParams
> {
  override async run(
    event: WorkflowEvent<SettingsReferenceWorkflowParams>,
    step: WorkflowStep,
  ): Promise<SettingsReferenceWorkflowOutput> {
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
  ): Promise<SettingsReferenceWorkflowOutput> {
    const paramsResult = WorkflowParamsSchema.safeParse(event.payload ?? {});
    const failureParams: SettingsReferenceWorkflowParams = paramsResult.success
      ? paramsResult.data
      : {};
    const runStep = createStepRunner(step);
    const failureReporter: SettingsReferenceFailureReporterPort = createWorkflowFailureReporter(
      this.env.GITHUB_DISPATCH_TOKEN,
      {
        name: '設定リファレンス生成 Workflow',
        workflowLabel: 'workflow:generate-settings-reference',
        summary: '設定リファレンス生成 Workflow が失敗しました。',
        extraFields: ({ params }) => [
          `**対象キー**: ${params.targetKeys?.join(', ') ?? '指定なし'}`,
        ],
      },
    );
    logger.info('Workflow を開始します', {
      'workflow.name': 'settings-reference',
    });

    try {
      if (!paramsResult.success) {
        throw new Error(`Workflow パラメータが不正です: ${z.prettifyError(paramsResult.error)}`);
      }
      const params = paramsResult.data;
      const db = drizzle(this.env.DB);
      const docsDb = drizzle(this.env.DOCS_DB);
      const entrySource = createSettingsEntrySource(db, this.env.DOCS_DB);
      const documentSearch = searchDocsForSettingKey.bind(null, docsDb);
      const translator = createSettingsTranslationAi(this.env.AI, this.env.AI_GATEWAY_ID);
      const useCaseWriter = createSettingsUseCaseAi(this.env.AI, this.env.AI_GATEWAY_ID);
      const repository = createSettingsReferenceRepository(db);
      const buildTrigger = createDeployHookBuildTrigger(this.env.DEPLOY_HOOK_URL);
      // replay で日付が変わらないよう、実行時刻ではなく起動時刻を使う。
      const fetchedAt = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Tokyo',
      }).format(event.timestamp);

      const { entries, removedKeys } = await runStep('load-entries', STEP_RETRIES, async () =>
        planSettingsReferenceGeneration(entrySource, params),
      );
      if (removedKeys.length > 0) {
        await runStep(
          'remove-stale',
          { ...STEP_RETRIES, attrs: { 'settings.removed_keys': removedKeys } },
          async () => repository.deleteByKeys(removedKeys),
        );
      }

      const processedKeys: string[] = [];
      for (
        let batchStart = 0, batchIndex = 0;
        batchStart < entries.length;
        batchStart += BATCH_SIZE, batchIndex += 1
      ) {
        const batchEntries = entries.slice(batchStart, batchStart + BATCH_SIZE);
        const input = await runStep(`build-input-${batchIndex}`, STEP_RETRIES, async () =>
          buildSettingsReferenceInput(documentSearch, entrySource, batchEntries),
        );

        const translateStep = `translate-${batchIndex}`;
        let translations: SettingsReferenceTranslation[];
        try {
          translations = await runStep(translateStep, STEP_RETRIES, async () =>
            runWithLogContext({ 'ai.batch_index': batchIndex }, () =>
              translator.translate(input.entries),
            ),
          );
        } catch (error) {
          // 保存しなかった設定は未生成のまま残り、次回の定期実行で対象に戻る
          if (!isUnusableSettingsAiResponseError(error)) {
            throw error;
          }
          logger.warn('AI 処理を諦めて保存を見送ります', {
            'workflow.step': translateStep,
            'settings.keys': input.entries.map((entry) => entry.key),
            error: toError(error),
          });
          continue;
        }
        const translatedIds = new Set(translations.map((translation) => translation.id));
        const translatedEntries = input.entries.filter((entry) => translatedIds.has(entry.id));

        // 用途は関連ドキュメント付きで 1 件ずつ書かせる。30 件をまとめると入力が約 5 万トークンになり、
        // 1 件の失敗で同じバッチの用途がまとめて失われる
        const useCases: SettingsReferenceUseCase[] = [];
        for (const entry of translatedEntries.filter(hasUseCaseContext)) {
          const useCaseStep = `use-case-${batchIndex}-${entry.id}`;
          try {
            useCases.push(
              await runStep(useCaseStep, STEP_RETRIES, async () =>
                runWithLogContext({ 'ai.batch_index': batchIndex }, async () => ({
                  id: entry.id,
                  useCaseJa: await useCaseWriter.describeUseCase(entry),
                })),
              ),
            );
          } catch (error) {
            // 翻訳は済んでいるため、用途を諦めても説明は保存する
            if (!isUnusableSettingsAiResponseError(error)) {
              throw error;
            }
            logger.warn('AI 処理を諦めて用途なしで保存します', {
              'workflow.step': useCaseStep,
              'settings.keys': [entry.key],
              error: toError(error),
            });
          }
        }

        await runStep(`store-${batchIndex}`, STEP_RETRIES, async () =>
          saveSettingsReferences(repository, {
            input,
            translations,
            useCases,
            fetchedAt,
          }),
        );
        processedKeys.push(...translatedEntries.map((entry) => entry.key));
      }

      if (processedKeys.length > 0 || removedKeys.length > 0) {
        await runStep('trigger-build', STEP_RETRIES, async () => buildTrigger.trigger());
      }

      logger.info('Workflow が完了しました', {
        'workflow.name': 'settings-reference',
        'settings.entry_count': entries.length,
        'settings.processed_count': processedKeys.length,
        'settings.removed_count': removedKeys.length,
      });
      return { processedKeys, removedKeys };
    } catch (error) {
      logger.error('Workflow に失敗しました', {
        'workflow.name': 'settings-reference',
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
