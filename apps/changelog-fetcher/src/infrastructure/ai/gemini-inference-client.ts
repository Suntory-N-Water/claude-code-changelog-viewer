import type { AppLogger } from '@claude-code-changelog-viewer/common';
import {
  createInferenceBatch,
  type InferenceBatch,
  type IndexedAnalyzedEntry,
} from '../../usecase/inference-batch';
import type { InferencePort } from '../../usecase/infer-benefits';
import { GeminiClient, type InferenceBatchResult } from './gemini-client';
import { loadModelContext } from './model-context';
import { buildBatchInferencePrompt } from './prompts/inference-prompt';

export class GeminiInferenceClient implements InferencePort {
  private client: GeminiClient;

  constructor(apiKey: string, logger: AppLogger) {
    this.client = new GeminiClient(apiKey, logger);
  }

  async infer(input: {
    version: string;
    items: IndexedAnalyzedEntry[];
  }): Promise<InferenceBatch> {
    const prompt = buildBatchInferencePrompt(
      [...input.items],
      input.version,
      loadModelContext(),
    );
    return toInferenceBatch(await this.client.inferAll(prompt));
  }
}

function toInferenceBatch(result: InferenceBatchResult): InferenceBatch {
  return createInferenceBatch({
    inferredItems: result.inferred_items.map((item) => ({
      id: item.id,
      contentJa: item.content_ja,
      before: item.before,
      after: item.after,
      benefit: item.benefit,
    })),
    translatedItems: result.translated_items.map((item) => ({
      id: item.id,
      contentJa: item.content_ja,
    })),
    featureAreaCorrections: (result.feature_area_corrections ?? []).map(
      (item) => ({
        id: item.id,
        featureAreas: item.feature_areas,
      }),
    ),
    impactItems: result.impact_items.map((item) => ({
      id: item.id,
      level: item.level,
      defaultBehaviorChange: item.default_behavior_change,
      breaking: item.breaking,
      reason: item.reason,
    })),
    summary: result.summary,
  });
}
