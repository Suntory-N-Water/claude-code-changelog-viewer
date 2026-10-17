import { workerLogger } from '../logger';
import { drizzle } from 'drizzle-orm/d1';
import { runWithLogContext, toError } from '@claude-code-changelog-viewer/common';
import { WorkflowEntrypoint } from 'cloudflare:workers';
import type { WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import { z } from 'zod';
import type { ChangelogInferenceGaps } from '../domain/changelog-inference/changelog-inference';
import { compareChangelogVersions } from '../domain/changelog-inference/changelog-version';
import { createDeployHookBuildTrigger } from '../infrastructure/build/deploy-hook';
import { createStoredChangelogReleaseReader } from '../infrastructure/drizzle/stored-changelog-release-reader';
import { createWorkflowFailureReporter } from '../infrastructure/github/workflow-failure-issue';
import { findRegenerationTargetVersions } from '../usecases/changelog-inference-workflow';
import {
  createChangelogReleaseProcessingDependencies,
  processChangelogRelease,
  STEP_RETRIES,
} from './changelog-release-processing';
import { createStepRunner } from './run-step';

const ChangelogVersionParamSchema = z.string().regex(/^v?\d+(\.\d+)*$/);

const WorkflowParamsSchema = z
  .object({
    fromVersion: ChangelogVersionParamSchema,
    toVersion: ChangelogVersionParamSchema.optional(),
  })
  // 逆転した範囲は 0 件のまま成功で終わり、指定の誤りに気づけないため弾く
  .refine(
    ({ fromVersion, toVersion }) =>
      toVersion === undefined || compareChangelogVersions(fromVersion, toVersion) <= 0,
    { message: 'fromVersion は toVersion 以下にしてください', path: ['toVersion'] },
  );

const logger = workerLogger('workflows.changelog-regeneration');

export type ChangelogRegenerationWorkflowParams = z.infer<typeof WorkflowParamsSchema>;

type RegeneratedVersion = ChangelogInferenceGaps & { version: string };

// 既存バージョンの翻訳と変更後を作り直すだけで、購読者には新着として届けない。
// CHANGELOG の取得と差分記録も行わず、D1 に保存済みの原文を入力にする
export class ChangelogRegenerationWorkflow extends WorkflowEntrypoint<
  CloudflareBindings,
  ChangelogRegenerationWorkflowParams
> {
  override async run(
    event: WorkflowEvent<ChangelogRegenerationWorkflowParams>,
    step: WorkflowStep,
  ): Promise<{ regeneratedVersions: RegeneratedVersion[] }> {
    return runWithLogContext(
      {
        trace_id: event.instanceId,
        'workflow.name': 'changelog-regeneration',
      },
      async () => this.runWorkflow(event, step),
    );
  }

  private async runWorkflow(
    event: WorkflowEvent<ChangelogRegenerationWorkflowParams>,
    step: WorkflowStep,
  ): Promise<{ regeneratedVersions: RegeneratedVersion[] }> {
    const paramsResult = WorkflowParamsSchema.safeParse(event.payload);
    const failureParams = paramsResult.success
      ? paramsResult.data
      : { fromVersion: '(不正な payload)', toVersion: '(不正な payload)' };
    const runStep = createStepRunner(step);
    const failureReporter = createWorkflowFailureReporter<{
      params: ChangelogRegenerationWorkflowParams;
      instanceId: string;
      error: unknown;
    }>(this.env.GITHUB_DISPATCH_TOKEN, {
      name: 'CHANGELOG 再生成 Workflow',
      workflowLabel: 'workflow:changelog-regeneration',
      summary: 'CHANGELOG 再生成 Workflow が失敗しました。',
      extraFields: ({ params }) => [
        `**対象範囲**: ${params.fromVersion} 〜 ${params.toVersion ?? '最新'}`,
      ],
    });
    logger.info('Workflow を開始します', {
      'workflow.name': 'changelog-regeneration',
    });

    try {
      if (!paramsResult.success) {
        throw new Error(`Workflow パラメータが不正です: ${z.prettifyError(paramsResult.error)}`);
      }
      const params = paramsResult.data;
      const reader = createStoredChangelogReleaseReader(drizzle(this.env.DB));
      const buildTrigger = createDeployHookBuildTrigger(this.env.DEPLOY_HOOK_URL);
      const processingDependencies = createChangelogReleaseProcessingDependencies(this.env);

      const versions = await runStep('list-versions', STEP_RETRIES, async () =>
        findRegenerationTargetVersions(reader, params),
      );

      const regeneratedVersions: RegeneratedVersion[] = [];
      for (const version of versions) {
        // 全バージョン分の項目を 1 step で返すと戻り値の上限 1MiB に近づくため、バージョンごとに読む
        const stored = await runStep(`load-${version}`, STEP_RETRIES, async () =>
          reader.findRelease(version),
        );
        if (stored === null) {
          logger.warn('対象のバージョンが見つからないため再生成を省略します', {
            'changelog.version': version,
          });
          continue;
        }
        // 翻訳を諦めたバッチは原文で保存されるため、既存の日本語訳を残して劣化を防ぐ
        const gaps = await processChangelogRelease(runStep, processingDependencies, {
          release: stored.release,
          fallbackTranslations: stored.translations,
        });
        regeneratedVersions.push({ version, ...gaps });
      }

      if (regeneratedVersions.length > 0) {
        await runStep('trigger-build', STEP_RETRIES, async () => buildTrigger.trigger());
      }

      logger.info('Workflow が完了しました', {
        'workflow.name': 'changelog-regeneration',
        'workflow.version_count': regeneratedVersions.length,
        'changelog.item_count': sumGaps(regeneratedVersions, 'itemCount'),
        'changelog.untranslated_item_count': sumGaps(regeneratedVersions, 'untranslatedItemCount'),
        'changelog.missing_benefit_item_count': sumGaps(
          regeneratedVersions,
          'missingBenefitItemCount',
        ),
        'changelog.untranslated_benefit_item_count': sumGaps(
          regeneratedVersions,
          'untranslatedBenefitItemCount',
        ),
      });
      return { regeneratedVersions };
    } catch (error) {
      logger.error('Workflow に失敗しました', {
        'workflow.name': 'changelog-regeneration',
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

function sumGaps(versions: RegeneratedVersion[], key: keyof ChangelogInferenceGaps): number {
  return versions.reduce((total, version) => total + version[key], 0);
}
