import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { getLogger, toError } from '@claude-code-changelog-viewer/common';
import { parseChangelogEntries } from './infrastructure/docs/changelog-markdown-parser';
import { pythonDocsSearcher } from './infrastructure/docs/python-docs-searcher';
import { createAnalysisFileStore } from './infrastructure/filesystem/changelog-file-store';
import { analyzeChangelog } from './usecase/analyze-changelog';

const log = getLogger({ name: 'changelog-analyzer' });

async function main() {
  const version = process.argv[2];

  if (!version) {
    log.error('Usage: tsx scripts/analyze-changelog.ts <version>');
    process.exit(1);
  }

  log.msg('APLG0001', { params: [`CHANGELOG 解析 (${version})`] });

  const changelogPath = path.join(process.cwd(), 'changelogs', `${version}.md`);
  const changelogContent = await fs.readFile(changelogPath, 'utf-8');

  const analysis = await analyzeChangelog({
    version,
    entries: parseChangelogEntries(changelogContent),
    docsSearch: pythonDocsSearcher,
    store: createAnalysisFileStore(process.cwd()),
  });

  const outputPath = path.join(
    process.cwd(),
    'analysis',
    `analysis_${version}.json`,
  );
  log.msg('APLG0002', {
    params: ['解析'],
    attrs: { outputPath, totalItems: analysis.items.length },
  });
}

main().catch((error) => {
  log.msg('APLG0018', {
    error: toError(error),
  });
  process.exit(1);
});
