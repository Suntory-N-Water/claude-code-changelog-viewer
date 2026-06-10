import { getLogger } from '@claude-code-changelog-viewer/common';
import pRetry, { AbortError } from 'p-retry';
import type { ChangelogAnalysis } from '../domain/analysis/changelog-analysis';
import {
  applyInferenceBatch,
  findMissingInferenceItems,
  type IndexedAnalyzedEntry,
  type InferenceBatch,
} from './inference-batch';
import { transferExistingInference } from './transfer-existing-inference';

const log = getLogger({ name: 'benefit-inferrer' });

export type InferencePort = {
  infer: (input: {
    version: string;
    items: IndexedAnalyzedEntry[];
  }) => Promise<InferenceBatch>;
};

export type InferredStorePort = {
  load: (version: string) => Promise<ChangelogAnalysis | null>;
};

export async function inferBenefits(input: {
  version: string;
  analysis: ChangelogAnalysis;
  skipAI: boolean;
  inference: InferencePort;
  store: InferredStorePort;
}): Promise<ChangelogAnalysis> {
  if (input.skipAI) {
    log.info('AI推論をスキップ (コピーモード)', {
      totalItems: input.analysis.items.length,
    });
    return input.analysis;
  }

  log.msg('APLG0001', {
    params: ['AI推論'],
    attrs: { totalItems: input.analysis.items.length },
  });

  let analysis = transferExistingInference(
    input.analysis,
    await input.store.load(input.version),
  );
  const missingBeforeInitial = findMissingInferenceItems(analysis);

  if (missingBeforeInitial.length === 0) {
    log.info('既存 inferred を全項目に流用したため AI推論をスキップ');
    return analysis;
  }

  analysis = applyInferenceBatch(analysis, {
    ...(await input.inference.infer({
      version: input.version,
      items: missingBeforeInitial,
    })),
    ...(analysis.summary !== undefined ? { summary: analysis.summary } : {}),
  });
  log.msg('APLG0002', { params: ['バージョンサマリー生成'] });

  const missingAfterInitial = findMissingInferenceItems(analysis);
  if (missingAfterInitial.length === 0) {
    return analysis;
  }

  log.info(`未処理項目あり: ${missingAfterInitial.length}件、リトライ開始`, {
    missingIds: missingAfterInitial.map((item) => item.originalIndex),
  });

  await pRetry(
    async () => {
      const missing = findMissingInferenceItems(analysis);
      if (missing.length === 0) {
        return;
      }

      try {
        analysis = applyInferenceBatch(analysis, {
          ...(await input.inference.infer({
            version: input.version,
            items: missing,
          })),
          ...(analysis.summary !== undefined
            ? { summary: analysis.summary }
            : {}),
        });
      } catch (error) {
        throw new AbortError(
          error instanceof Error ? error.message : String(error),
        );
      }

      const stillMissing = findMissingInferenceItems(analysis);
      if (stillMissing.length > 0) {
        throw new Error(
          `未処理項目が残存: ${stillMissing.length}件 (ids: ${stillMissing.map((item) => item.originalIndex).join(', ')})`,
        );
      }
    },
    {
      retries: 3,
      onFailedAttempt: (context) => {
        log.info(
          `リトライ ${context.attemptNumber}/3 失敗: ${context.error.message}`,
          { retriesLeft: context.retriesLeft },
        );
      },
    },
  ).catch(() => {
    const stillMissing = findMissingInferenceItems(analysis);
    log.info(`リトライ上限到達、未処理項目が残存: ${stillMissing.length}件`, {
      missingIds: stillMissing.map((item) => item.originalIndex),
    });
  });

  return analysis;
}
