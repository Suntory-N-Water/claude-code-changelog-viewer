import { getLogger } from '@claude-code-changelog-viewer/common';
import { createAnalyzedChangelogEntry } from '../domain/analysis/analyzed-changelog-entry';
import {
  createChangelogAnalysis,
  type ChangelogAnalysis,
} from '../domain/analysis/changelog-analysis';
import { mergeAnalysisEntries } from '../domain/analysis/merge-analysis-entries';
import type { RelatedDoc } from '../domain/analysis/related-doc';
import type { ChangelogEntry } from '../domain/changelog/changelog-entry';
import { createChangelogVersion } from '../domain/changelog/changelog-version';

const log = getLogger({ name: 'changelog-analyzer' });

export type DocsSearchPort = {
  findRelatedDocs: (entry: ChangelogEntry) => Promise<RelatedDoc[]>;
};

export type AnalysisStorePort = {
  load: (version: string) => Promise<ChangelogAnalysis | null>;
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

  const merged = mergeAnalysisEntries(
    entries,
    await input.store.load(input.version),
  );
  log.info('既存 analysis の差分マージ', {
    needsSearch: merged.entriesNeedingSearch.length,
  });

  const searched = await Promise.all(
    merged.entriesNeedingSearch.map(async (entry, index) => {
      log.info(
        `[${index + 1}/${merged.entriesNeedingSearch.length}] ${entry.content.slice(0, 60)}...`,
      );

      const relatedDocs = await input.docsSearch.findRelatedDocs(entry);

      return createAnalyzedChangelogEntry({
        content: entry.content,
        prefix: entry.prefix,
        relatedDocs,
      });
    }),
  );

  const items = merged.decisions.map((decision) => {
    if (decision.kind === 'existing') {
      return decision.entry;
    }

    const searchedEntry = searched[decision.searchedIndex];
    if (searchedEntry === undefined) {
      throw new Error('検索済み analysis 項目が不足しています');
    }

    return searchedEntry;
  });
  const analysis = createChangelogAnalysis({ version, items });
  await input.store.save(analysis, input.version);
  return analysis;
}
