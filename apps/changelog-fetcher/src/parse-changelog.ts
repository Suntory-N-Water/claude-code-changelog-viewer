#!/usr/bin/env node
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLogger, toError } from '@claude-code-changelog-viewer/common';
import { fetchChangelog } from './application/fetch-changelog';
import { ChangelogFileStore } from './infrastructure/filesystem/changelog-file-store';
import { ClaudeCodeChangelogClient } from './infrastructure/github/claude-code-changelog-client';

const __dirname = dirname(fileURLToPath(import.meta.url));

const log = getLogger({ name: 'changelog-fetcher' });

async function main(): Promise<void> {
  const appDir = join(__dirname, '..');
  const result = await fetchChangelog({
    source: new ClaudeCodeChangelogClient(),
    store: new ChangelogFileStore(appDir),
  });

  if (result.newCount === 0 && result.updatedCount === 0) {
    log.msg('APLG0008', { params: ['CHANGELOG'] });
    process.exit(1);
  }
}

if (import.meta.main) {
  main().catch((error) => {
    log.msg('APLG0018', { error: toError(error) });
    process.exit(2);
  });
}
