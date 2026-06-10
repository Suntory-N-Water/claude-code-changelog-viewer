import { getLogger } from '@claude-code-changelog-viewer/common';
import { createAnalyzedChangelogEntry } from '../domain/analysis/analyzed-changelog-entry';
import {
  createChangelogAnalysis,
  type ChangelogAnalysis,
} from '../domain/analysis/changelog-analysis';
import type { RelatedDoc } from '../domain/analysis/related-doc';
import type { ChangelogEntry } from '../domain/changelog/changelog-entry';
import { createChangelogVersion } from '../domain/changelog/changelog-version';

const log = getLogger({ name: 'changelog-analyzer' });

export type DocsSearchPort = {
  findRelatedDocs: (entry: ChangelogEntry) => Promise<RelatedDoc[]>;
};

export type AnalysisStorePort = {
  save: (analysis: ChangelogAnalysis, version: string) => Promise<void>;
};

export async function analyzeChangelog(input: {
  version: string;
  entries: ChangelogEntry[];
  docsSearch: DocsSearchPort;
  store: AnalysisStorePort;
}): Promise<ChangelogAnalysis> {
  const version = createChangelogVersion(input.version);
  const entries = input.entries;

  log.msg('APLG0010', { params: [`${entries.length} 件の項目`] });

  const items = await Promise.all(
    entries.map(async (entry, index) => {
      log.info(
        `[${index + 1}/${entries.length}] ${entry.content.slice(0, 60)}...`,
      );

      const relatedDocs = await input.docsSearch.findRelatedDocs(entry);

      return createAnalyzedChangelogEntry({
        content: entry.content,
        prefix: entry.prefix,
        relatedDocs,
      });
    }),
  );

  const analysis = createChangelogAnalysis({ version, items });
  await input.store.save(analysis, input.version);
  return analysis;
}
