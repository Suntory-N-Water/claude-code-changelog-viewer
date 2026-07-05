#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLogger } from '@claude-code-changelog-viewer/common';
import { z } from 'zod';
import { AnthropicIssuesClient } from './infrastructure/github/anthropic-issues-client';
import { IssuesCorpusStore } from './infrastructure/filesystem/issues-corpus-store';
import { fetchIssueCorpus } from './usecase/fetch-issue-corpus';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = join(__dirname, '..');
const CORPUS_DIR = join(APP_DIR, 'issues-corpus');
const METADATA_PATH = join(APP_DIR, 'metadata', 'issues-fetch.json');
const MAINTAINERS_PATH = join(APP_DIR, 'config', 'maintainers.json');

const MaintainersFileSchema = z.object({
  handles: z.array(z.string()),
});

const log = getLogger({ name: 'fetch-issue-corpus' });

const argv = new Set(process.argv.slice(2));
const fullScan = argv.has('--full-scan');
const enrichAuthorAssociation = argv.has('--enrich-author-association');

const token = process.env['GITHUB_TOKEN'];
if (!token) {
  log.error('GITHUB_TOKEN が設定されていません');
  process.exit(1);
}

const maintainersRaw = await readFile(MAINTAINERS_PATH, 'utf-8');
const maintainers = MaintainersFileSchema.parse(JSON.parse(maintainersRaw));

const client = new AnthropicIssuesClient({ token, logger: log });
const store = new IssuesCorpusStore({
  corpusDir: CORPUS_DIR,
  metadataPath: METADATA_PATH,
});

try {
  const result = await fetchIssueCorpus({
    client,
    store,
    maintainerHandles: maintainers.handles,
    fullScan,
    enrichAuthorAssociation,
    logger: log,
  });
  log.info(
    `完了: fetched=${result.fetched} last_fetch=${result.metadata.last_fetch}`,
  );
} catch (error) {
  log.error('fetch-issue-corpus 失敗', { error });
  process.exit(1);
}
