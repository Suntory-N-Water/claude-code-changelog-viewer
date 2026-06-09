import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { getLogger, toError } from '@claude-code-changelog-viewer/common';
import { analyzeChangelog } from './application/analyze-changelog';
import { parseChangelogEntries } from './infrastructure/docs/changelog-markdown-parser';
import { docsSearcher } from './infrastructure/docs/docs-searcher';
import { toAnalysisJson } from './infrastructure/serializers/analysis-serializer';

const log = getLogger({ name: 'changelog-analyzer' });

async function main() {
  const version = process.argv[2]; // v2.1.19

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
    docsSearch: docsSearcher,
  });

  const output = toAnalysisJson(analysis);

  const outputPath = path.join(
    process.cwd(),
    'analysis',
    `analysis_${version}.json`,
  );
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2));

  log.msg('APLG0002', {
    params: ['解析'],
    attrs: { outputPath, totalItems: output.items.length },
  });
}

main().catch((error) => {
  log.msg('APLG0018', {
    error: toError(error),
  });
  process.exit(1);
});
