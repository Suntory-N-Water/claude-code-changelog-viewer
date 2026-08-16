import { drizzle } from 'drizzle-orm/d1';
import { WorkflowEntrypoint } from 'cloudflare:workers';
import type { WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import { z } from 'zod';
import {
  createChangelogInferenceAi,
  type WorkersAiBinding,
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
  inferChangelogRelease,
} from '../usecases/changelog-inference';
import {
  fetchAndClassifyChangelog,
  notifyChangelogVersions,
  reportChangelogWorkflowFailure,
  saveChangelogDiffs,
  saveChangelogInference,
  triggerChangelogBuild,
} from '../usecases/changelog-inference-workflow';

const WorkflowParamsSchema = z.object({
  detectedHash: z.string().length(64),
  detectedAt: z.string().min(1),
});

const STEP_RETRIES = {
  retries: {
    limit: 3,
    delay: '10 seconds' as const,
    backoff: 'exponential' as const,
  },
};

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
    const paramsResult = WorkflowParamsSchema.safeParse(event.payload);
    const failureParams = paramsResult.success
      ? paramsResult.data
      : { detectedHash: '(不正な payload)', detectedAt: '(不正な payload)' };
    const failureReporter = createChangelogWorkflowFailureReporter(
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
      const existingChangelogReader = createExistingChangelogReader(db);
      const diffRepository = createChangelogDiffRepository(db);
      const inferenceRepository = createChangelogInferenceRepository(db);
      const source = createGitHubChangelogMarkdownSource(
        this.env.GITHUB_DISPATCH_TOKEN,
      );
      const documentSearch = createChangelogDocumentSearch(
        drizzle(this.env.DOCS_DB),
      );
      const inference = createChangelogInferenceAi(
        this.env.AI as unknown as WorkersAiBinding,
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

      await step.do('save-diff', STEP_RETRIES, async () =>
        saveChangelogDiffs(diffRepository, classification.diffEvents),
      );

      for (const release of classification.versions) {
        const inferenceInput = await step.do(
          `build-inference-input-${release.version}`,
          STEP_RETRIES,
          async () => buildChangelogInferenceInput(documentSearch, release),
        );
        const inferenceResult = await step.do(
          `infer-${release.version}`,
          STEP_RETRIES,
          async () => inferChangelogRelease(inference, inferenceInput),
        );
        await step.do(`store-${release.version}`, STEP_RETRIES, async () =>
          saveChangelogInference(inferenceRepository, inferenceResult),
        );
      }

      if (classification.notifiableVersions.length > 0) {
        await step.do('notify', STEP_RETRIES, async () => {
          await notifyChangelogVersions(
            notifier,
            classification.notifiableVersions,
          );
          return { versions: classification.notifiableVersions };
        });
      }

      if (
        classification.versions.length > 0 ||
        classification.diffEvents.length > 0
      ) {
        await step.do('trigger-build', STEP_RETRIES, async () =>
          triggerChangelogBuild(buildTrigger),
        );
      }

      return {
        processedVersions: [...classification.versions].map(
          (release) => release.version,
        ),
        notifiedVersions: [...classification.notifiableVersions],
      };
    } catch (error) {
      await step.do('create-failure-issue', STEP_RETRIES, async () =>
        reportChangelogWorkflowFailure(failureReporter, {
          params: failureParams,
          instanceId: event.instanceId,
          error,
        }),
      );
      throw error;
    }
  }
}
