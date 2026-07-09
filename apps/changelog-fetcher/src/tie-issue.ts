#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLogger, toError } from '@claude-code-changelog-viewer/common';
import { AnalysisSchema } from '@claude-code-changelog-viewer/types';
import { AnthropicIssuesClient } from './infrastructure/github/anthropic-issues-client';
import { createTiedFileStore } from './infrastructure/filesystem/tied-store';
import { toChangelogAnalysis } from './infrastructure/serializers/analysis-serializer';
import { extractMaintainerDeclaredIssues } from './usecase/extract-maintainer-declared-issues';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = join(__dirname, '..');

const log = getLogger({ name: 'tie-issue' });

function requireVersion(): string {
  const v = process.argv[2];
  if (!v) {
    log.error('Usage: tsx src/tie-issue.ts <version>');
    process.exit(1);
  }
  return v;
}
const version = requireVersion();

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    log.error(`${name} が設定されていません`);
    process.exit(1);
  }
  return v;
}
const token = requireEnv('GITHUB_TOKEN');

const analysisPath = join(APP_DIR, 'analysis', `analysis_${version}.json`);
if (!existsSync(analysisPath)) {
  log.error(`analysis ファイルが存在しません: ${analysisPath}`);
  process.exit(1);
}

async function main(): Promise<void> {
  log.info(`analysis 読込: ${analysisPath}`);
  const analysisRaw = await readFile(analysisPath, 'utf-8');
  const analysisJson = AnalysisSchema.parse(JSON.parse(analysisRaw));
  const analysis = toChangelogAnalysis(analysisJson);

  const client = new AnthropicIssuesClient({ token, logger: log });

  const candidates = await extractMaintainerDeclaredIssues({
    version,
    client,
    logger: log,
  });

  const tiedStore = createTiedFileStore(APP_DIR);
  await tiedStore.save(analysis, version, candidates);
  log.info(
    `tied 保存完了: tied/tied_${version}.json (候補 ${candidates.length}件)`,
  );
}

main().catch((error) => {
  log.error('tie-issue 失敗', { error: toError(error) });
  process.exit(1);
});
