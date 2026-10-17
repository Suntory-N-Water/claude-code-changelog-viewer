import { workerLogger } from '../logger';
import { drizzle } from 'drizzle-orm/d1';
import { runWithLogContext, toError } from '@claude-code-changelog-viewer/common';
import { WorkflowEntrypoint } from 'cloudflare:workers';
import type { WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import { z } from 'zod';
import {
  createChangelogItemInferenceAi,
  createChangelogSummaryAi,
  createChangelogTranslationAi,
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
import type { ChangelogFailureReporterPort } from '../usecases/changelog-inference-workflow';
import {
  fetchAndClassifyChangelog,
  notifyChangelogVersions,
} from '../usecases/changelog-inference-workflow';
import { processChangelogRelease, STEP_RETRIES } from './changelog-release-processing';
import { createStepRunner } from './run-step';

const WorkflowParamsSchema = z.object({
  detectedHash: z.string().length(64),
  detectedAt: z.string().min(1),
});

const logger = workerLogger('workflows.changelog-inference');

export type ChangelogInferenceWorkflowParams = z.infer<typeof WorkflowParamsSchema>;

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
      const source = createGitHubChangelogMarkdownSource(this.env.GITHUB_DISPATCH_TOKEN);
      const notifier = createChangelogWorkflowNotifier(db, this.env.NOTIFICATION_QUEUE);
      const buildTrigger = createDeployHookBuildTrigger(this.env.DEPLOY_HOOK_URL);
      const processingDependencies = {
        translator: createChangelogTranslationAi(this.env.AI, this.env.AI_GATEWAY_ID),
        inference: createChangelogItemInferenceAi(this.env.AI, this.env.AI_GATEWAY_ID),
        summarizer: createChangelogSummaryAi(this.env.AI, this.env.AI_GATEWAY_ID),
        documentSearch: searchDocsForChangelogEntry.bind(null, drizzle(this.env.DOCS_DB)),
        inferenceRepository: createChangelogInferenceRepository(db),
        skipReporter: createChangelogInferenceSkipReporter(this.env.GITHUB_DISPATCH_TOKEN),
      };
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
        await processChangelogRelease(runStep, processingDependencies, release);
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
