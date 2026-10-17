import { runWithLogContext, toError } from '@claude-code-changelog-viewer/common';
import type { WorkflowStepConfigWithStaticDelay } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import {
  needsBenefit,
  type ChangelogAiTranslationItem,
  type ChangelogInferenceGaps,
  type ChangelogInferenceInput,
  type ChangelogInferenceRepository,
  type ChangelogItem,
  type ChangelogItemInference,
  type ChangelogRelease,
} from '../domain/changelog-inference/changelog-inference';
import {
  createChangelogItemInferenceAi,
  createChangelogSummaryAi,
  createChangelogTranslationAi,
  isUnusableAiResponseError,
} from '../infrastructure/ai/changelog-inference-ai';
import { searchDocsForChangelogEntry } from '../infrastructure/docs-search';
import { createChangelogInferenceRepository } from '../infrastructure/drizzle/changelog-inference-repository';
import { createChangelogInferenceSkipReporter } from '../infrastructure/github/changelog-inference-skip-reporter';
import { workerLogger } from '../logger';
import {
  buildChangelogInferenceInput,
  inferChangelogItemBatch,
  translateChangelogItemBatch,
  type ChangelogDocumentSearchPort,
  type ChangelogItemInferencePort,
  type ChangelogSummaryPort,
  type ChangelogTranslationPort,
} from '../usecases/changelog-inference';
import {
  saveChangelogInference,
  type ChangelogInferenceSkipReporterPort,
} from '../usecases/changelog-inference-workflow';
import type { StepRunner } from './run-step';

export const STEP_RETRIES: WorkflowStepConfigWithStaticDelay = {
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

// 1 項目の snippets は最大 8000 字で、約 180 項目のリリースを 1 step で処理すると
// step の戻り値の上限 1MiB を超えうる。20 項目なら最大でも約 160KB に収まる
const SEARCH_CHUNK_SIZE = 20;

const logger = workerLogger('workflows.changelog-release-processing');

type SkippedItem = { id: string; content: string; reason: string };

export type ChangelogReleaseProcessingDependencies = {
  translator: ChangelogTranslationPort;
  inference: ChangelogItemInferencePort;
  summarizer: ChangelogSummaryPort;
  documentSearch: ChangelogDocumentSearchPort;
  inferenceRepository: ChangelogInferenceRepository;
  skipReporter: ChangelogInferenceSkipReporterPort;
};

export function createChangelogReleaseProcessingDependencies(
  env: CloudflareBindings,
): ChangelogReleaseProcessingDependencies {
  return {
    translator: createChangelogTranslationAi(env.AI, env.AI_GATEWAY_ID),
    inference: createChangelogItemInferenceAi(env.AI, env.AI_GATEWAY_ID),
    summarizer: createChangelogSummaryAi(env.AI, env.AI_GATEWAY_ID),
    documentSearch: searchDocsForChangelogEntry.bind(null, drizzle(env.DOCS_DB)),
    inferenceRepository: createChangelogInferenceRepository(drizzle(env.DB)),
    skipReporter: createChangelogInferenceSkipReporter(env.GITHUB_DISPATCH_TOKEN),
  };
}

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

// step 名にバージョンを含めるため、同じ Workflow 内で複数のリリースを順に処理しても衝突しない
export async function processChangelogRelease(
  runStep: StepRunner,
  {
    translator,
    inference,
    summarizer,
    documentSearch,
    inferenceRepository,
    skipReporter,
  }: ChangelogReleaseProcessingDependencies,
  {
    release,
    fallbackTranslations = [],
  }: { release: ChangelogRelease; fallbackTranslations?: ChangelogAiTranslationItem[] },
): Promise<ChangelogInferenceGaps> {
  const fallbackById = new Map(fallbackTranslations.map((item) => [item.id, item]));
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
      // ここで諦めないとリリース全体が保存されないため、このバッチだけ既存の訳か、なければ英語原文で残す
      if (!isUnusableAiResponseError(error)) {
        throw error;
      }
      addSkippedItems(skippedItems, reportSkippedBatch(stepName, batch, error));
      translations.push(...batch.items.flatMap((item) => fallbackById.get(item.id) ?? []));
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
  // 変更後を求めない項目は AI を呼ばないため、step を作らずに済ませる。
  // Fixed だけで全項目の約 6 割あり、大きなリリースでは step 数が大きく減る
  const benefitTargets = inferenceInput.items.filter(needsBenefit);
  for (
    let batchStart = 0, batchIndex = 0;
    batchStart < benefitTargets.length;
    batchStart += INFERENCE_BATCH_SIZE, batchIndex += 1
  ) {
    const batch = {
      version: inferenceInput.version,
      items: benefitTargets.slice(batchStart, batchStart + INFERENCE_BATCH_SIZE),
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
  const { summary } = await runStep(`summarize-${release.version}`, STEP_RETRIES, async () => ({
    summary: await summarizer.summarize(release),
  }));

  const { gaps } = await runStep(`store-${release.version}`, STEP_RETRIES, async () =>
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
  return gaps;
}
