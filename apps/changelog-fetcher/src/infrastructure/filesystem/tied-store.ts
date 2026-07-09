import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { AnalysisSchema } from '@claude-code-changelog-viewer/types';
import type { ChangelogAnalysis } from '../../domain/analysis/changelog-analysis';
import type { MaintainerCandidate } from '../../usecase/extract-maintainer-declared-issues';
import {
  toAnalysisJson,
  toChangelogAnalysis,
} from '../serializers/analysis-serializer';

export type TiedStorePort = {
  load(version: string): Promise<{
    analysis: ChangelogAnalysis;
    maintainerCandidates: MaintainerCandidate[];
  } | null>;
  save(
    analysis: ChangelogAnalysis,
    version: string,
    candidates: MaintainerCandidate[],
  ): Promise<void>;
};

export function createTiedFileStore(appDir: string): TiedStorePort {
  const dir = join(appDir, 'tied');

  return {
    async load(version: string) {
      const filePath = join(dir, `tied_${version}.json`);
      if (!existsSync(filePath)) {
        return null;
      }
      const raw = await readFile(filePath, 'utf-8');
      const parsed = AnalysisSchema.parse(JSON.parse(raw));
      return {
        analysis: toChangelogAnalysis(parsed),
        maintainerCandidates: (parsed.maintainer_candidates ?? []).map((c) => ({
          number: c.number,
          title: c.title,
          url: c.url,
          state: c.state,
          reactionsTotal: c.reactions_total,
          commentsCount: c.comments_count,
          isMaintainerInvolved: c.is_maintainer_involved,
          maintainerDeclaration: {
            user: c.maintainer_declaration.user,
            publishedAt: c.maintainer_declaration.published_at,
            body: c.maintainer_declaration.body,
            url: c.maintainer_declaration.url,
          },
        })),
      };
    },
    async save(
      analysis: ChangelogAnalysis,
      version: string,
      candidates: MaintainerCandidate[],
    ): Promise<void> {
      const filePath = join(dir, `tied_${version}.json`);
      const output = {
        ...toAnalysisJson(analysis),
        maintainer_candidates: candidates.map((c) => ({
          number: c.number,
          title: c.title,
          url: c.url,
          state: c.state,
          reactions_total: c.reactionsTotal,
          comments_count: c.commentsCount,
          is_maintainer_involved: c.isMaintainerInvolved,
          maintainer_declaration: {
            user: c.maintainerDeclaration.user,
            published_at: c.maintainerDeclaration.publishedAt,
            body: c.maintainerDeclaration.body,
            url: c.maintainerDeclaration.url,
          },
        })),
      };
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(
        filePath,
        `${JSON.stringify(output, null, 2)}\n`,
        'utf-8',
      );
    },
  };
}
