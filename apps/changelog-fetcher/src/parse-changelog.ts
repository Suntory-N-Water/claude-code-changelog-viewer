#!/usr/bin/env node
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLogger, toError } from '@claude-code-changelog-viewer/common';
import { fetchChangelog } from './usecase/fetch-changelog';
import { ChangelogFileStore } from './infrastructure/filesystem/changelog-file-store';
import { ClaudeCodeChangelogClient } from './infrastructure/github/claude-code-changelog-client';

const __dirname = dirname(fileURLToPath(import.meta.url));

const log = getLogger({ name: 'changelog-fetcher' });

async function main(): Promise<void> {
  const appDir = join(__dirname, '..');
  const store = new ChangelogFileStore(appDir);

  await store.deleteFetchSummary();
  // DETECTED_HASH は本番 workflow から workflow_dispatch inputs 経由で必ず注入される。
  // ローカル/手動実行時は未定義となり、その場合 client はハッシュ検証をスキップして 1 回だけ取得する。
  const expectedHash = process.env['DETECTED_HASH'];
  const result = await fetchChangelog({
    source: new ClaudeCodeChangelogClient(expectedHash ? { expectedHash } : {}),
    store,
  });
  await store.saveFetchSummary(result.summary);

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
