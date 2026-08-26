import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { AnalysisSchema } from '@claude-code-changelog-viewer/types';
import type { AnalysisStorePort } from '../../usecase/analyze-changelog';
import type { ChangelogAnalysis } from '../../domain/analysis/changelog-analysis';
import {
  toAnalysisJson,
  toChangelogAnalysis,
} from '../serializers/analysis-serializer';

export function createAnalysisFileStore(appDir: string): AnalysisStorePort {
  return {
    async load(version: string): Promise<ChangelogAnalysis | null> {
      const filename = `analysis_${version}.json`;
      const filePath = join(appDir, 'analysis', filename);
      const analysis = await loadAnalysisFile(filePath);

      return analysis;
    },
    async save(analysis: ChangelogAnalysis, version: string): Promise<void> {
      const output = toAnalysisJson(analysis);
      const filename = `analysis_${version}.json`;
      const outputPath = join(appDir, 'analysis', filename);
      const serializedOutput = JSON.stringify(output, null, 2);

      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, serializedOutput);
    },
  };
}

async function loadAnalysisFile(
  filePath: string,
): Promise<ChangelogAnalysis | null> {
  if (!existsSync(filePath)) {
    return null;
  }

  const rawAnalysis = await readFile(filePath, 'utf-8');
  const parsedAnalysis = JSON.parse(rawAnalysis);
  const analysisJson = AnalysisSchema.parse(parsedAnalysis);
  const analysis = toChangelogAnalysis(analysisJson);

  return analysis;
}
