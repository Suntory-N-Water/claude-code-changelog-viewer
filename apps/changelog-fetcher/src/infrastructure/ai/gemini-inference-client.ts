import type { AppLogger } from '@claude-code-changelog-viewer/common';
import type { InferenceBatchResult } from '@claude-code-changelog-viewer/types';
import {
  createInferenceBatch,
  type InferenceBatch,
  type IndexedAnalyzedEntry,
} from '../../application/inference-batch';
import type { InferencePort } from '../../application/infer-benefits';
import { GeminiClient } from './gemini-client';
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
    summary: result.summary,
  });
}
