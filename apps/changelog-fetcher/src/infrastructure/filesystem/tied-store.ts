import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { AnalysisSchema } from '@claude-code-changelog-viewer/types';
import type { ChangelogAnalysis } from '../../domain/analysis/changelog-analysis';
import {
  toAnalysisJson,
  toChangelogAnalysis,
} from '../serializers/analysis-serializer';

export type TiedStorePort = {
  load(version: string): Promise<ChangelogAnalysis | null>;
  save(analysis: ChangelogAnalysis, version: string): Promise<void>;
};

// tied_<version>.json は AnalysisSchema と同型で、items[].related_issues が埋まっている。
// 別ファイルにする理由は tie-issue rerun を analysis 上書きせずに差分検証できるようにするため。
export function createTiedFileStore(appDir: string): TiedStorePort {
  const dir = join(appDir, 'tied');

  return {
    async load(version: string): Promise<ChangelogAnalysis | null> {
      const filePath = join(dir, `tied_${version}.json`);
      if (!existsSync(filePath)) {
        return null;
      }
      const raw = await readFile(filePath, 'utf-8');
      const parsed = AnalysisSchema.parse(JSON.parse(raw));
      return toChangelogAnalysis(parsed);
    },
    async save(analysis: ChangelogAnalysis, version: string): Promise<void> {
      const filePath = join(dir, `tied_${version}.json`);
      const output = toAnalysisJson(analysis);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(
        filePath,
        `${JSON.stringify(output, null, 2)}\n`,
        'utf-8',
      );
    },
  };
}
