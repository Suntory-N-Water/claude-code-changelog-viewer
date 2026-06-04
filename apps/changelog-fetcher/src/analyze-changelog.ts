import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { getLogger, toError } from '@claude-code-changelog-viewer/common';
import { AnalysisSchema } from '@claude-code-changelog-viewer/types';
import { analyzeChangelog } from './application/analyze-changelog';
import { toVersionNumber } from './domain/changelog/changelog-version';

// schema 互換のため残す固定値。現在は意味のある評価値として使わない。
const SCHEMA_COMPATIBILITY_SCORE = 0;

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

  const analysis = await analyzeChangelog({ version, changelogContent });

  const output = AnalysisSchema.parse({
    version: toVersionNumber(analysis.version),
    ...(analysis.summary !== undefined ? { summary: analysis.summary } : {}),
    items: analysis.items.map((entry) => ({
      content: entry.content,
      ...(entry.contentJa !== undefined ? { content_ja: entry.contentJa } : {}),
      prefix: entry.prefix,
      importance_score: SCHEMA_COMPATIBILITY_SCORE,
      feature_areas: [...entry.featureAreas],
      related_docs: entry.relatedDocs.map((doc) => ({
        file: doc.file,
        snippets: [...doc.snippets],
        hit_count: doc.hitCount,
        context_score: SCHEMA_COMPATIBILITY_SCORE,
        total_score: SCHEMA_COMPATIBILITY_SCORE,
      })),
      ...(entry.inference !== undefined
        ? {
            inference: {
              before: entry.inference.before,
              after: entry.inference.after,
              benefit: entry.inference.benefit,
            },
          }
        : {}),
    })),
  });

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
