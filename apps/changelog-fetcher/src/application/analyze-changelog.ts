import {
  getLogger,
  normalizeMarkdownForAi,
} from '@claude-code-changelog-viewer/common';
import { createAnalyzedChangelogEntry } from '../domain/analysis/analyzed-changelog-entry';
import {
  createChangelogAnalysis,
  type ChangelogAnalysis,
} from '../domain/analysis/changelog-analysis';
import type { RelatedDoc } from '../domain/analysis/related-doc';
import { createChangelogVersion } from '../domain/changelog/changelog-version';
import { parseChangelogEntries } from '../infrastructure/docs/changelog-markdown-parser';
import { extractKeywords } from '../infrastructure/docs/keyword-extractor';
import { searchDocs } from '../searchers/grep-executor';
import { extractSnippets } from '../searchers/snippet-extractor';

const log = getLogger({ name: 'changelog-analyzer' });

export async function analyzeChangelog(input: {
  readonly version: string;
  readonly changelogContent: string;
}): Promise<ChangelogAnalysis> {
  const version = createChangelogVersion(input.version);
  const entries = parseChangelogEntries(input.changelogContent);

  log.msg('APLG0010', { params: [`${entries.length} 件の項目`] });

  const items = await Promise.all(
    entries.map(async (entry, index) => {
      log.info(
        `[${index + 1}/${entries.length}] ${entry.content.slice(0, 60)}...`,
      );

      const keywordSet = extractKeywords(entry);
      const keywords = {
        original: [...keywordSet.original],
        normalized: [...keywordSet.normalized],
      };

      const searchResult = await searchDocs(keywords);
      const snippetResults = await extractSnippets(
        searchResult.files,
        keywords,
      );

      const relatedDocs: RelatedDoc[] = snippetResults
        .slice(0, 3)
        .map(({ file, snippets, hit_count }) => ({
          file,
          snippets: snippets
            .map(normalizeMarkdownForAi)
            .filter((s) => s.length > 0),
          hitCount: hit_count,
        }));

      return createAnalyzedChangelogEntry({
        content: entry.content,
        prefix: entry.prefix,
        relatedDocs,
      });
    }),
  );

  return createChangelogAnalysis({ version, items });
}
