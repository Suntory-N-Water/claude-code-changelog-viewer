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
  findRelatedDocs: (entries: ChangelogEntry[]) => Promise<RelatedDoc[][]>;
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

  log.msg('APLG0010', { attrs: { arg0: `${entries.length} 件の項目` } });

  const merged = mergeAnalysisEntries(
    entries,
    await input.store.load(input.version),
  );
  log.info('既存 analysis の差分マージ', {
    needsSearch: merged.entriesNeedingSearch.length,
  });

  const relatedDocsList = await input.docsSearch.findRelatedDocs(
    merged.entriesNeedingSearch,
  );

  const searched = merged.entriesNeedingSearch.map((entry, index) => {
    const relatedDocs = relatedDocsList[index];
    if (relatedDocs === undefined) {
      throw new Error('検索結果 relatedDocs が不足しています');
    }

    return createAnalyzedChangelogEntry({
      content: entry.content,
      prefix: entry.prefix,
      relatedDocs,
    });
  });

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
