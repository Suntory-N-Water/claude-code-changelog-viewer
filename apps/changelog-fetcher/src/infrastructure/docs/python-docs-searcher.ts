import * as path from 'node:path';
import { normalizeMarkdownForAi } from '@claude-code-changelog-viewer/common';
import type { RelatedDoc } from '../../domain/analysis/related-doc';
import type { DocsSearchPort } from '../../usecase/analyze-changelog';
import { toRelativePath } from './docs-paths';
import { DOCS_DIR, runDocsSearchEngine } from './docs-search-engine-client';

export const pythonDocsSearcher: DocsSearchPort = {
  findRelatedDocs: async (entries) => {
    if (entries.length === 0) {
      return [];
    }

    const output = await runDocsSearchEngine({
      docsDir: DOCS_DIR,
      entries: entries.map((entry) => entry.content),
    });

    return output.results.map((docs) =>
      docs.map((doc): RelatedDoc => {
        const pairs = doc.snippets
          .map((s, i) => ({
            text: normalizeMarkdownForAi(s),
            score: doc.snippetScores[i] ?? 0,
          }))
          .filter((p) => p.text.length > 0);
        return {
          file: toRelativePath(path.join(DOCS_DIR, doc.file)),
          snippets: pairs.map((p) => p.text),
          snippetScores: pairs.map((p) => p.score),
          hitCount: doc.hitCount,
        };
      }),
    );
  },
};
